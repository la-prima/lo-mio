/**
 * Pipeline de contratos (contract-first, ver docs/arquitectura.md sección 12):
 * lint de cada OpenAPI, unión en apps/api/openapi.yaml (lo que monta la API) y generación de
 * tipos, zod y cliente (tools/codegen). `--check`: falla si lo generado difiere de lo commiteado.
 */
import { execFileSync } from "node:child_process";
import { existsSync, globSync } from "node:fs";
import { resolve } from "node:path";

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

run("pnpm", ["exec", "redocly", "lint", "--format=stylish", ...openapis]);
run("pnpm", ["exec", "redocly", "join", ...openapis, "-o", BUNDLE, "--without-x-tag-groups"]);
run("pnpm", ["--filter", "@lo-mio/codegen", "generate"]);

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
