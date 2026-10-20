// Reporte unificado de evidencias: unit, integración, contrato y flujos (ver AGENTS.md, "Evidencias").
import { defineConfig } from "allure";

export default defineConfig({
  name: "lo-mio · evidencias de pruebas",
  output: "reports/allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: true,
        reportLanguage: "es",
        groupBy: ["epic", "feature", "story"],
      },
    },
  },
});
