import { defineConfig } from "@playwright/test";

// Flujos funcionales contra la API desplegada (kind o CI), por el Gateway con HTTPS.
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.flow.ts",
  outputDir: "../../reports/flows/results",
  reporter: [["list"], ["html", { outputFolder: "../../reports/flows/html", open: "never" }]],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  use: { baseURL: process.env.API_URL ?? "https://api.lo-mio.localhost" },
});
