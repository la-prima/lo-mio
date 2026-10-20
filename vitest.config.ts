import { defineConfig } from "vitest/config";

// unit: rápidos, sin IO (pre-commit). integration: `*.int.test.ts`, con Docker (CI y `pnpm test:int`).
// Ambos escriben evidencias para Allure en reports/allure-results (ver allurerc.mjs).
export default defineConfig({
  test: {
    setupFiles: ["allure-vitest/setup", "./tests/allure/vitest-setup.ts"],
    reporters: ["default", ["allure-vitest/reporter", { resultsDir: "reports/allure-results" }]],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.ts"],
          exclude: ["**/*.int.test.ts", "**/*.flow.ts", "**/node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["**/*.int.test.ts"],
          exclude: ["**/node_modules/**"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
