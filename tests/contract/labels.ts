/**
 * Lleva los resultados Allure de Schemathesis a la jerarquía común (tests/allure/labels.ts):
 * epic = dominio (desde el tag de la operación), feature = conformidad, story = operación.
 * Schemathesis emite un resultado por fase (cobertura, fuzzing) con el mismo id, que Allure
 * mostraría como reintentos: se deja uno por operación, el fallido si alguno falló.
 * Uso: node tests/contract/labels.ts <origen> <destino>
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DOMAINS } from "../allure/labels.ts";

type Label = { name: string; value: string };
type Result = { historyId?: string; status?: string; labels?: Label[] };

const [from = "", to = ""] = process.argv.slice(2);
mkdirSync(to, { recursive: true });

const relabel = (result: Result): Result => {
  const labels = result.labels ?? [];
  const value = (name: string) => labels.find((l) => l.name === name)?.value ?? "";
  const tag = value("feature");
  return {
    ...result,
    labels: [
      ...labels.filter((l) => !["epic", "feature", "story"].includes(l.name)),
      // Sin tag: los tests stateful recorren operaciones de varios contextos.
      { name: "epic", value: DOMAINS[tag as keyof typeof DOMAINS] ?? (tag || DOMAINS.plataforma) },
      { name: "feature", value: "Conformidad con el contrato" },
      { name: "story", value: value("story") },
      { name: "tag", value: "contrato" },
    ],
  };
};

const byOperation = new Map<string, Result>();
for (const file of readdirSync(from)) {
  const content = readFileSync(join(from, file), "utf8");
  if (!file.endsWith("-result.json")) {
    writeFileSync(join(to, file), content);
    continue;
  }
  const result = JSON.parse(content) as Result;
  const key = result.historyId ?? file;
  const current = byOperation.get(key);
  if (!current || (current.status === "passed" && result.status !== "passed"))
    byOperation.set(key, result);
}
for (const [key, result] of byOperation)
  writeFileSync(join(to, `contract-${key}-result.json`), JSON.stringify(relabel(result)));
