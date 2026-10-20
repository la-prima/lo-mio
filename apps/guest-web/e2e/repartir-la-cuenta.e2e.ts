import AxeBuilder from "@axe-core/playwright";
import { loadManualItems } from "@lo-mio/client";
import type { Browser, Page, TestInfo } from "@playwright/test";
import { expect, idempotency, test } from "../../../tests/flows/fixtures.ts";

/** Otro comensal con su propio teléfono: contexto aparte (su cookie) con las opciones del proyecto. */
async function phone(browser: Browser, testInfo: TestInfo, name: string) {
  const { baseURL, ignoreHTTPSErrors, locale, viewport, userAgent, isMobile, hasTouch } =
    testInfo.project.use;
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors,
    locale,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    recordVideo: { dir: testInfo.outputPath(`video-${name}`) },
  });
  const page = await context.newPage();
  return {
    page,
    close: async () => {
      const video = page.video();
      await context.close();
      if (video) await testInfo.attach(`video de ${name}`, { path: await video.path() });
    },
  };
}

const item = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });
const myBalance = (page: Page) => page.getByText("Tu saldo:");

test.describe("Reclamos", () => {
  test.describe("Repartir la cuenta de la mesa", () => {
    test("tres comensales en sus teléfonos reclaman, comparten y se suman en vivo", async ({
      bar,
      page,
      browser,
    }, testInfo) => {
      const beto = await phone(browser, testInfo, "Beto");
      const caro = await phone(browser, testInfo, "Caro");
      const ana = { page };
      const all = [ana.page, beto.page, caro.page];

      await test.step("los tres escanean el QR de la mesa al mismo tiempo", async () => {
        await Promise.all(all.map((p) => p.goto(`/m/${bar.table.qrCode}`)));
        for (const p of all) {
          await expect(
            p.getByRole("heading", { name: `Mesa ${bar.table.label}` }),
            "ve su mesa",
          ).toBeVisible();
          await expect(p.getByRole("heading", { name: "La cuenta" }), "ve la cuenta").toBeVisible();
        }
        // Cada uno ve a los tres en los saldos: así sabe con quién compartir.
        for (const p of all) {
          await expect(p.locator(".balances li"), "ve a los tres comensales").toHaveCount(3);
        }
      });

      await test.step("el mesero carga un schop y una tabla, y aparecen en los tres teléfonos", async () => {
        for (const [name, amount] of [
          ["Schop", 4500],
          ["Tabla de quesos", 9000],
        ] as const) {
          await loadManualItems({
            client: bar.staff,
            body: {
              tableId: bar.table.id,
              name,
              unitPrice: { amount, currency: "CLP" },
              quantity: 1,
            },
            ...idempotency(),
            throwOnError: true,
          });
        }
        for (const p of all) {
          await expect(
            item(p, "Tabla de quesos"),
            "la tabla aparece en vivo, sin recargar",
          ).toBeVisible();
        }
      });

      await test.step("Ana toca 'Es mío' en el schop", async () => {
        await item(ana.page, "Schop").getByRole("button", { name: "Es mío" }).click();
        await expect(item(ana.page, "Schop"), "Ana ve su parte").toContainText("Tu parte: $4.500");
        await expect(item(beto.page, "Schop"), "Beto ve que es de otro").toContainText("De:");
      });

      await test.step("Beto comparte la tabla con Ana en partes iguales", async () => {
        const tabla = item(beto.page, "Tabla de quesos");
        await tabla.getByRole("button", { name: "Compartir" }).click();
        const anaAlias = (await ana.page.locator("header strong").textContent()) ?? "";
        await tabla.getByRole("checkbox", { name: anaAlias }).check();
        await tabla.getByRole("button", { name: "Compartir en partes iguales" }).click();
        await expect(tabla, "Beto paga la mitad").toContainText("Tu parte: $4.500");
      });

      await test.step("Caro también comió de la tabla y toca 'Yo también'", async () => {
        await item(caro.page, "Tabla de quesos")
          .getByRole("button", { name: "Yo también" })
          .click();
        await expect(item(caro.page, "Tabla de quesos"), "ahora son tres partes").toContainText(
          "Tu parte: $3.000",
        );
      });

      await test.step("cada uno ve su saldo actualizado en vivo", async () => {
        await expect(myBalance(ana.page), "Ana: schop + un tercio de la tabla").toContainText(
          "$7.500",
        );
        await expect(myBalance(beto.page), "Beto: un tercio de la tabla").toContainText("$3.000");
        await expect(myBalance(caro.page), "Caro: un tercio de la tabla").toContainText("$3.000");
      });

      await test.step("la pantalla no tiene violaciones de accesibilidad serias", async () => {
        const { violations } = await new AxeBuilder({ page: ana.page }).analyze();
        const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        await testInfo.attach("axe", {
          body: JSON.stringify(violations, null, 2),
          contentType: "application/json",
        });
        expect(
          serious.map((v) => `${v.id}: ${v.help}`),
          "axe sin violaciones serias ni críticas",
        ).toEqual([]);
      });

      await beto.close();
      await caro.close();
    });
  });
});
