/**
 * Resumen en Markdown del reporte Allure para el PR y el resumen del job.
 * Uso: node deploy/ci/report-summary.ts <summary.json> <url-del-reporte>
 */
import { readFileSync } from "node:fs";

type Summary = { stats: Record<string, number>; status: string; duration?: number };
const [file = "", url = ""] = process.argv.slice(2);
const { stats, status } = JSON.parse(readFileSync(file, "utf8")) as Summary;
const ROWS: [string, string][] = [
  ["Total", "total"],
  ["Aprobadas", "passed"],
  ["Fallidas", "failed"],
  ["Rotas", "broken"],
  ["Omitidas", "skipped"],
];
const table = ROWS.filter(([, key]) => stats[key]).map(
  ([label, key]) => `| ${label} | ${stats[key]} |`,
);

process.stdout.write(
  [
    `## ${status === "passed" ? "✅" : "❌"} Evidencias de pruebas`,
    "",
    "| Resultado | Pruebas |",
    "|---|---|",
    ...table,
    "",
    `📄 **[Reporte completo](${url})**: un solo HTML, agrupado por contexto → flujo → escenario → paso, con request/response, traces y videos. Descargar y abrir \`index.html\`.`,
    "",
  ].join("\n"),
);
