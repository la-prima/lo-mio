import { defineConfig, devices } from "@playwright/test";

// E2E del comensal contra el ambiente desplegado (kind o CI), por el Gateway con HTTPS.
// En cada PR: Chromium y Pixel. Cada noche (E2E_MATRIX=full): la matriz completa.
const pr = [
  { name: "chromium", use: devices["Desktop Chrome"] },
  { name: "pixel", use: devices["Pixel 7"] },
];
const nightly = [
  { name: "firefox", use: devices["Desktop Firefox"] },
  { name: "webkit", use: devices["Desktop Safari"] },
  { name: "iphone", use: devices["iPhone 15"] },
];

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "../../reports/guest-web/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../reports/guest-web/html", open: "never" }],
    ["allure-playwright", { resultsDir: "../../reports/allure-results" }],
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.WEB_URL ?? "https://mesa.lo-mio.localhost",
    // La CA local de kind no está en el almacén de los navegadores (Node la recibe por NODE_EXTRA_CA_CERTS).
    ignoreHTTPSErrors: true,
    locale: "es-CL",
    trace: "on",
    video: "on",
  },
  projects: process.env.E2E_MATRIX === "full" ? [...pr, ...nightly] : pr,
});
