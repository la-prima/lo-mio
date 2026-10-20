/**
 * Resumen en Markdown del reporte Allure para el PR y el resumen del job.
 * Uso: node deploy/ci/report-summary.ts <summary.json> <url-del-reporte>
 * `NEEDS` (JSON de `needs` de GitHub Actions): los jobs que no terminaron bien se listan y el
 * resumen queda en rojo, porque sus pruebas faltan en el reporte.
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
const jobs = JSON.parse(process.env.NEEDS ?? "{}") as Record<string, { result: string }>;
const brokenJobs = Object.entries(jobs).filter(([, job]) => job.result !== "success");
const ok = status === "passed" && brokenJobs.length === 0;

const table = ROWS.filter(([, key]) => stats[key]).map(
  ([label, key]) => `| ${label} | ${stats[key]} |`,
);

process.stdout.write(
  [
    `## ${ok ? "✅" : "❌"} Evidencias de pruebas`,
    "",
    ...(brokenJobs.length > 0
      ? [
          `⚠️ **Jobs que no terminaron bien** (sus pruebas no están en el reporte): ${brokenJobs.map(([name, job]) => `\`${name}\` (${job.result})`).join(", ")}`,
          "",
        ]
      : []),
    "| Resultado | Pruebas |",
    "|---|---|",
    ...table,
    "",
    `📄 **[Reporte completo](${url})**: un solo HTML, agrupado por contexto → flujo → escenario → paso, con request/response, traces y videos. Descargar y abrir \`index.html\`.`,
    "",
  ].join("\n"),
);
