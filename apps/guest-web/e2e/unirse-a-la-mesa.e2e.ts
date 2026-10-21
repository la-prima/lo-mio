import { expect, test } from "../../../tests/flows/fixtures.ts";

test.describe("Mesas", () => {
  test.describe("Unirse a la mesa por QR", () => {
    test("el comensal escanea el QR y ve su mesa y su alias", async ({ bar, page }) => {
      await test.step("abre el enlace del QR", async () => {
        await page.goto(`/m/${bar.table.qrCode}`);
      });
      await test.step("queda unido a la mesa con un alias", async () => {
        await expect(
          page.getByRole("heading", { name: `Mesa ${bar.table.label}` }),
          "ve el nombre de su mesa",
        ).toBeVisible();
        await expect(page.getByText("Estás como"), "ve el alias que le tocó").toBeVisible();
      });
    });

    test("un QR que no existe muestra cómo seguir", async ({ page }) => {
      await page.goto("/m/no-existe-este-qr-0000");
      await expect(page.getByRole("alert"), "le pide un QR nuevo al mesero").toContainText(
        "QR nuevo",
      );
    });
  });
});
