/**
 * Pipeline de contratos (contract-first, ver docs/arquitectura.md sección 12):
 * lint de cada OpenAPI y unión en apps/api/openapi.yaml, que es lo que monta la API.
 * `--check`: falla si lo generado no coincide con lo commiteado.
 */
import { execFileSync } from "node:child_process";
import { existsSync, globSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BUNDLE = "apps/api/openapi.yaml";
const GENERATED = [BUNDLE];
const env = { ...process.env, REDOCLY_SUPPRESS_UPDATE_NOTICE: "true", REDOCLY_TELEMETRY: "off" };
const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { cwd: ROOT, env, stdio: "inherit" });

const openapis = [
  "apps/api/openapi/platform.yaml",
  ...globSync("contexts/*/contracts/openapi.yaml", { cwd: ROOT }).sort(),
];

run("pnpm", ["exec", "redocly", "lint", "--format=stylish", ...openapis]);
run("pnpm", ["exec", "redocly", "join", ...openapis, "-o", BUNDLE, "--without-x-tag-groups"]);
run("pnpm", ["exec", "biome", "format", "--write", "--no-errors-on-unmatched", BUNDLE]);

if (process.argv.includes("--check")) {
  const existing = GENERATED.filter((f) => existsSync(resolve(ROOT, f)));
  run("git", ["diff", "--exit-code", "--", ...existing]);
}
