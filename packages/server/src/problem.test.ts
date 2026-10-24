import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { frameworkErrorProblem, registerProblemHandlers } from "./index.ts";

describe("Errores con el formato del contrato", () => {
  const app = Fastify({ frameworkErrors: frameworkErrorProblem });
  registerProblemHandlers(app);
  app.get("/v1/tables/:tableId", async () => ({ ok: true }));

  it("un parámetro de ruta demasiado largo es una solicitud inválida en problem+json, no un 414", async () => {
    const res = await app.inject({ method: "GET", url: `/v1/tables/${"x".repeat(500)}` });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json()).toMatchObject({ type: "https://lo-mio.cl/problems/invalid-request" });
  });

  it("una URL mal formada también responde problem+json", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/tables/%E0%A4%A" });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toContain("application/problem+json");
  });
});
