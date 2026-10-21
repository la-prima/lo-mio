import { getCurrentGuest, renameCurrentGuest } from "@lo-mio/client";
import { expect, test } from "../fixtures.ts";

test.describe("Mesas", () => {
  test.describe("Unirse a la mesa", () => {
    test("un comensal escanea el QR, entra anónimo con su alias y lo puede cambiar", async ({
      bar,
    }) => {
      const ana = await test.step("Ana escanea el QR de la mesa y escribe su alias", () =>
        bar.guest("Ana"));

      await test.step("Ana ve que está en la mesa con su alias, sin haber dado datos personales", async () => {
        const { data } = await getCurrentGuest({ client: ana.api });
        expect(data, "Ana está en la mesa correcta").toMatchObject({
          alias: "Ana",
          tableLabel: bar.table.label,
        });
      });

      await test.step("Ana cambia su alias", async () => {
        const { data } = await renameCurrentGuest({ client: ana.api, body: { alias: "Ana P." } });
        expect(data?.alias, "el alias nuevo queda guardado").toBe("Ana P.");
      });
    });

    test("un QR que no corresponde a ninguna mesa muestra un error claro", async ({ api }) => {
      await test.step("Alguien escanea un QR viejo o de otro local", async () => {
        const { joinTable } = await import("@lo-mio/client");
        const { response, error } = await joinTable({
          client: api,
          path: { qrCode: "codigo-que-no-existe-0000" },
          body: {},
        });
        expect(response?.status, "la API responde 404").toBe(404);
        expect(error, "el error dice que el QR no es de una mesa activa").toMatchObject({
          type: "https://lo-mio.cl/problems/unknown-qr",
        });
      });
    });
  });
});
