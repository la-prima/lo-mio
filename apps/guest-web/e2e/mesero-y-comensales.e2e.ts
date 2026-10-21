/**
 * Mesero en la app (Maestro, emulador Android) y comensales en la web sobre la misma mesa.
 * Corre solo donde hay emulador con la app instalada (job mobile-e2e): MAESTRO=1.
 */
import { execFile } from "node:child_process";
import { globSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { registerProduct } from "@lo-mio/client";
import type { Page } from "@playwright/test";
import { expect, idempotency, test } from "../../../tests/flows/fixtures.ts";
import { phone } from "./phone.ts";

const run = promisify(execFile);
const FLOW = resolve(import.meta.dirname, "../../mobile/e2e/coordinados/cargar-items.yaml");
const item = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name });

test.describe("POS", () => {
  test.describe("Carga manual", () => {
    test.skip(process.env.MAESTRO !== "1", "requiere el emulador con la app (job mobile-e2e)");
    test.setTimeout(5 * 60_000);

    test("el mesero carga desde la app y tres comensales reclaman en la web", async ({
      bar,
      page,
      browser,
    }, testInfo) => {
      const suffix = crypto.randomUUID().slice(0, 4);
      const [schop, papas] = [`Schop ${suffix}`, `Papas ${suffix}`];
      await test.step("el local tiene schop y papas fritas en su catálogo", async () => {
        for (const [name, amount] of [
          [schop, 4500],
          [papas, 6000],
        ] as const) {
          await registerProduct({
            client: bar.staff,
            body: { name, price: { amount, currency: "CLP" } },
            ...idempotency(),
            throwOnError: true,
          });
        }
      });

      const others = await Promise.all(["Beto", "Caro"].map((n) => phone(browser, testInfo, n)));
      const guests = [page, ...others.map((o) => o.page)];
      await test.step("tres comensales escanean el QR y esperan la cuenta", async () => {
        await Promise.all(guests.map((p) => p.goto(`/m/${bar.table.qrCode}`)));
        for (const p of guests) {
          await expect(
            p.getByRole("heading", { name: "La cuenta" }),
            "ve la cuenta vacía",
          ).toBeVisible();
        }
      });

      await test.step("el mesero abre la mesa en la app y carga 2 schops y unas papas", async () => {
        const output = testInfo.outputPath("maestro");
        // Si el flujo falla, maestro sale con error y execFile lo lanza (con su salida).
        await run(
          "maestro",
          [
            "test",
            FLOW,
            "-e",
            `MESA=${bar.table.label}`,
            "-e",
            `PRODUCTO_1=${schop}`,
            "-e",
            `PRODUCTO_2=${papas}`,
            "--debug-output",
            output,
            "--flatten-debug-output",
          ],
          { timeout: 4 * 60_000 },
        ).finally(async () => {
          for (const video of globSync("**/*.mp4", { cwd: output })) {
            await testInfo.attach("video del mesero (app)", { path: join(output, video) });
          }
        });
      });

      await test.step("los ítems llegan en vivo a los tres teléfonos", async () => {
        for (const p of guests) {
          await expect(item(p, schop), "dos schops sin dueño").toHaveCount(2);
          await expect(item(p, papas), "las papas").toHaveCount(1);
        }
      });

      await test.step("cada uno reclama lo suyo y comparten las papas", async () => {
        const [ana, beto, caro] = guests as [Page, Page, Page];
        await item(ana, schop).first().getByRole("button", { name: "Es mío" }).click();
        await expect(
          item(beto, schop).getByRole("button", { name: "Es mío" }),
          "Beto ve un schop libre",
        ).toHaveCount(1);
        await item(beto, schop).getByRole("button", { name: "Es mío" }).click();
        await item(caro, papas).getByRole("button", { name: "Compartir" }).click();
        for (const p of [ana, beto]) {
          const alias = (await p.locator("header strong").textContent()) ?? "";
          await item(caro, papas).getByRole("checkbox", { name: alias }).check();
        }
        await item(caro, papas)
          .getByRole("button", { name: "Compartir en partes iguales" })
          .click();
        await expect(
          ana.getByText("Tu saldo:"),
          "Ana: schop + un tercio de las papas",
        ).toContainText("$6.500");
        await expect(caro.getByText("Tu saldo:"), "Caro: un tercio de las papas").toContainText(
          "$2.000",
        );
      });
      for (const o of others) await o.close();
    });
  });
});
