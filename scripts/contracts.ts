/**
 * Pipeline de contratos (contract-first, ver docs/arquitectura.md sección 12):
 * lint de cada OpenAPI, unión en apps/api/openapi.yaml (lo que monta la API) y generación de
 * tipos, zod y cliente (tools/codegen). `--check`: falla si lo generado difiere de lo commiteado.
 */
import { execFileSync } from "node:child_process";
import { existsSync, globSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Parser } from "@asyncapi/parser";
import { parse, stringify } from "yaml";
import { eventCatalogSource } from "./events.ts";
import { mergeOpenApi } from "./merge-openapi.ts";

const ROOT = resolve(import.meta.dirname, "..");
const BUNDLE = "apps/api/openapi.yaml";
const GENERATED = [
  BUNDLE,
  "packages/client/src/generated",
  ...globSync("contexts/*/contracts/generated", { cwd: ROOT }),
];
const env = { ...process.env, REDOCLY_SUPPRESS_UPDATE_NOTICE: "true", REDOCLY_TELEMETRY: "off" };
const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { cwd: ROOT, env, stdio: "inherit" });

const openapis = [
  "apps/api/openapi/platform.yaml",
  ...globSync("contexts/*/contracts/openapi.yaml", { cwd: ROOT }).sort(),
];

run("pnpm", ["exec", "redocly", "lint", "--format=stylish", "contracts/common.yaml", ...openapis]);
// Cada contrato se empaqueta (resuelve $ref externos, ej. contracts/common.yaml) y se une.
const tmp = mkdtempSync(join(tmpdir(), "lo-mio-contracts-"));
const bundled = openapis.map((file, i): [string, Parameters<typeof mergeOpenApi>[0]] => {
  const out = join(tmp, `${i}.yaml`);
  run("pnpm", ["exec", "redocly", "bundle", file, "-o", out]);
  return [file, parse(readFileSync(out, "utf8"))];
});
const [[, base] = ["", {}], ...rest] = bundled;
writeFileSync(
  resolve(ROOT, BUNDLE),
  `# Generado por scripts/contracts.ts desde los contratos de plataforma y contextos. No editar.\n${stringify(mergeOpenApi(base, rest))}`,
);
run("pnpm", ["--filter", "@lo-mio/codegen", "generate"]);

// hey-api genera `z.object`, que descarta en silencio los campos no declarados. Nuestros contratos
// son cerrados (regla objects-are-closed), así que el zod debe rechazarlos: `z.strictObject`.
for (const file of globSync(
  "{contexts/*/contracts/generated,packages/client/src/generated}/zod.gen.ts",
  { cwd: ROOT },
)) {
  const path = resolve(ROOT, file);
  writeFileSync(path, readFileSync(path, "utf8").replaceAll("z.object(", "z.strictObject("));
}

// AsyncAPI de cada contexto: validación oficial y catálogo de eventos (después de hey-api, que
// limpia la carpeta generated/).
for (const file of globSync("contexts/*/contracts/asyncapi.yaml", { cwd: ROOT }).sort()) {
  const path = resolve(ROOT, file);
  const content = readFileSync(path, "utf8");
  const { diagnostics } = await new Parser().parse(content, { source: path });
  const errors = diagnostics.filter((d) => d.severity === 0);
  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`${file}: ${e.message} (${e.path.join(".")})\n`);
    process.exit(1);
  }
  const context = basename(dirname(dirname(path)));
  writeFileSync(
    resolve(dirname(path), "generated/events.gen.ts"),
    eventCatalogSource(context, parse(content)),
  );
}

if (process.argv.includes("--check")) {
  const existing = GENERATED.filter((f) => existsSync(resolve(ROOT, f)));
  // Si regenerar cambió o creó archivos respecto del índice, contrato y código estaban desalineados.
  const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT }).toString().trim();
  const drift = [
    git("diff", "--name-only", "--", ...existing),
    git("ls-files", "--others", "--exclude-standard", "--", ...existing),
  ]
    .filter(Boolean)
    .join("\n");
  if (drift) {
    process.stderr.write(
      `Lo generado no coincide con los contratos. Correr \`pnpm contracts\` y commitear:\n${drift}\n`,
    );
    process.exit(1);
  }
}
