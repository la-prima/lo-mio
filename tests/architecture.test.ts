/**
 * Reglas de arquitectura (ver AGENTS.md#arquitectura). Resuelve cada import de cada archivo
 * y verifica que respete los límites entre contextos, capas y apps.
 */
import { globSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");
const FRONTS = new Set(["mobile", "guest-web"]);
const SERVER_ONLY_LIBS =
  /^(fastify|@fastify\/|pg$|pg-boss|kysely|node:|@lo-mio\/(server|postgres))/;
const IMPORT_RE = /(?:from|import|export\s*\*\s*from)\s*\(?\s*["']([^"']+)["']/g;

type Zone = {
  kind: "kernel" | "package" | "context" | "app" | "other";
  name: string;
  layer: string;
};

function zoneOfPath(path: string): Zone {
  const [top = "", name = "", layer = ""] = relative(ROOT, path).split("/");
  if (top === "packages") return { kind: name === "kernel" ? "kernel" : "package", name, layer };
  if (top === "contexts") return { kind: "context", name, layer };
  if (top === "apps") return { kind: "app", name, layer };
  return { kind: "other", name: top, layer };
}

function zoneOfSpecifier(spec: string, fromFile: string): Zone | undefined {
  if (spec.startsWith(".")) return zoneOfPath(resolve(dirname(fromFile), spec));
  const m = spec.match(/^@lo-mio\/([^/]+)\/?(.*)$/);
  if (!m) return undefined;
  const [, name = "", layer = ""] = m;
  if (name === "kernel") return { kind: "kernel", name, layer };
  const isContext = globSync(`contexts/${name}`, { cwd: ROOT }).length > 0;
  return { kind: isContext ? "context" : "package", name, layer };
}

/** Devuelve el motivo si el import está prohibido. */
function violation(from: Zone, to: Zone | undefined, spec: string): string | undefined {
  if (from.kind === "kernel") {
    if (to?.kind !== "kernel" && spec !== "vitest" && spec !== "zod")
      return "kernel es puro: solo se importa a sí mismo (y zod)";
    return undefined;
  }
  if (from.kind === "context") return contextViolation(from, to, spec);
  if (from.kind === "app") return appViolation(from, to, spec);
  if (from.kind === "package" && (to?.kind === "app" || to?.layer === "server")) {
    return "packages/ no importa apps ni capas server";
  }
  return undefined;
}

/** domain/ y contracts/ solo usan kernel y unas pocas librerías puras; nunca otros paquetes. */
function purityViolation(from: Zone, to: Zone | undefined, spec: string): string | undefined {
  const allowedLibs: Record<string, RegExp> = { domain: /^vitest$/, contracts: /^(vitest|zod)$/ };
  const allowed = allowedLibs[from.layer];
  if (!allowed) return undefined;
  if (!to && !allowed.test(spec)) return `${from.layer}/ no usa la librería ${spec}`;
  if (to?.kind === "package") return `${from.layer}/ no usa el paquete ${spec}`;
  return undefined;
}

function contextViolation(from: Zone, to: Zone | undefined, spec: string): string | undefined {
  const impure = purityViolation(from, to, spec);
  if (impure) return impure;
  if (!to || to.kind === "kernel") return undefined;
  if (to.kind === "app") return "un contexto nunca importa de apps/";
  if (to.kind === "context" && to.name !== from.name && to.layer !== "contracts") {
    return `entre contextos solo se importa @lo-mio/${to.name}/contracts`;
  }
  if (to.name === from.name && from.layer === "domain" && to.layer !== "domain") {
    return "domain/ no depende de contracts/ ni server/";
  }
  if (to.name === from.name && from.layer === "contracts" && to.layer === "server") {
    return "contracts/ no depende de server/";
  }
  return undefined;
}

function appViolation(from: Zone, to: Zone | undefined, spec: string): string | undefined {
  if (to?.kind === "app" && to.name !== from.name)
    return "una app no importa de otra: usar packages/";
  if (to?.layer === "server" && from.name !== "api") return "solo apps/api monta capas server";
  if (FRONTS.has(from.name) && SERVER_ONLY_LIBS.test(spec))
    return `librería de servidor en front: ${spec}`;
  return undefined;
}

function* imports() {
  const files = globSync("{apps,contexts,packages}/**/*.{ts,tsx}", {
    cwd: ROOT,
    exclude: (f) => f.includes("node_modules"),
  });
  for (const file of files) {
    const abs = resolve(ROOT, file);
    for (const [, spec = ""] of readFileSync(abs, "utf8").matchAll(IMPORT_RE)) {
      yield { file, abs, spec };
    }
  }
}

describe("Límites entre contextos y capas", () => {
  it("todos los imports respetan los límites", () => {
    const errors: string[] = [];
    for (const { file, abs, spec } of imports()) {
      const reason = violation(zoneOfPath(abs), zoneOfSpecifier(spec, abs), spec);
      if (reason) errors.push(`${file} → ${spec}: ${reason}`);
    }
    expect(errors).toEqual([]);
  });

  it("contracts/ solo reexporta lo generado desde los contratos (nada escrito a mano)", () => {
    const reexport =
      /^export (\*|\* as \w+|\{[^}]*\}|type \{[^}]*\}) from "\.\/generated\/[^"]+";$/;
    const files = globSync("contexts/*/contracts/**/*.ts", {
      cwd: ROOT,
      exclude: (f) => f.includes("generated"),
    });
    const errors = files.flatMap((file) =>
      readFileSync(resolve(ROOT, file), "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("//") && !reexport.test(line))
        .map((line) => `${file}: "${line}" (escribirlo en el contrato y correr pnpm contracts)`),
    );
    expect(errors).toEqual([]);
  });

  it("el código de runtime solo importa dependencias de producción (la imagen no trae las de desarrollo)", () => {
    const errors: string[] = [];
    const isTest =
      /\.(test|int\.test|flow)\.ts$|\/(testing|fixtures|contract-suite)\.ts$|\.config\.ts$/;
    const runtimeDeps = (pkgDir: string) => {
      const manifest = JSON.parse(readFileSync(resolve(ROOT, pkgDir, "package.json"), "utf8")) as {
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      return { ...manifest.dependencies, ...manifest.peerDependencies };
    };
    const packageOf = (spec: string) =>
      spec
        .split("/")
        .slice(0, spec.startsWith("@") ? 2 : 1)
        .join("/");
    for (const { file, spec } of imports()) {
      if (isTest.test(file) || spec.startsWith(".") || spec.startsWith("node:")) continue;
      const pkgDir = file.split("/").slice(0, 2).join("/");
      const name = packageOf(spec);
      if (!(name in runtimeDeps(pkgDir))) {
        errors.push(`${file} → ${name}: no está en dependencies de ${pkgDir}/package.json`);
      }
    }
    expect(errors).toEqual([]);
  });
});
