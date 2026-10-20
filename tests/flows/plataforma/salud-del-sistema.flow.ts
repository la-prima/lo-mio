import { getLiveness, getReadiness } from "@lo-mio/client";
import { expect, test } from "../fixtures.ts";

// Contexto → flujo de usuario → escenario → pasos, en lenguaje de negocio (ver AGENTS.md).
test.describe("Plataforma", () => {
  test.describe("Salud del sistema", () => {
    test("el balanceador confirma que la API está viva y lista para atender", async ({ api }) => {
      await test.step("El balanceador pregunta si el proceso responde", async () => {
        const { data, response } = await getLiveness({ client: api });
        expect(response?.status, "la API responde 200").toBe(200);
        expect(data, "el proceso informa que está vivo").toEqual({ status: "ok" });
      });

      await test.step("El balanceador pregunta si puede enviarle tráfico (la base de datos responde)", async () => {
        const { data, response } = await getReadiness({ client: api });
        expect(response?.status, "la API responde 200").toBe(200);
        expect(data, "la API informa que puede atender tráfico").toEqual({ status: "ok" });
      });
    });

    test("la API entrega encabezados de seguridad en cada respuesta", async ({ api }) => {
      await test.step("Un navegador consulta la salud de la API", async () => {
        const { response } = await getLiveness({ client: api });
        const headers = response?.headers;
        expect(
          headers?.get("x-content-type-options"),
          "el navegador no adivina tipos de contenido",
        ).toBe("nosniff");
        expect(
          headers?.get("strict-transport-security"),
          "el navegador exige HTTPS en adelante",
        ).toBeTruthy();
      });
    });
  });
});
