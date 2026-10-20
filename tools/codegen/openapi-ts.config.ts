/**
 * Código generado desde los contratos (ver docs/arquitectura.md, sección 12). No editar lo generado:
 * cambiar el contrato y correr `pnpm contracts`.
 */
import { globSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "@hey-api/openapi-ts";

const ROOT = resolve(import.meta.dirname, "../..");
const output = (path: string) => ({
  path: resolve(ROOT, path),
  importFileExtension: ".ts" as const,
});

// Por contexto: tipos y schemas zod de su propio contrato.
const contexts = globSync("contexts/*/contracts/openapi.yaml", { cwd: ROOT }).map((file) => ({
  input: resolve(ROOT, file),
  output: output(`${dirname(file)}/generated`),
  plugins: ["@hey-api/typescript", "zod"],
}));

// Cliente único de los fronts: el bundle completo, con hooks de TanStack Query.
const client = {
  input: resolve(ROOT, "apps/api/openapi.yaml"),
  output: output("packages/client/src/generated"),
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/sdk",
    "@hey-api/typescript",
    "zod",
    "@tanstack/react-query",
  ],
};

export default defineConfig([...contexts, client]);
