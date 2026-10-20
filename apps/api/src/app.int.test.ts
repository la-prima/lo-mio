import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { compose } from "./compose.ts";
import { loadEnv } from "./env.ts";
import { startApi } from "./testing.ts";

describe("API HTTP desde el contrato", () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  const env = () => loadEnv({ DATABASE_URL: "postgres://x/y", LOG_LEVEL: "fatal" });
  const options = () =>
    compose({ db: api.db, bus: { publish: async () => {}, subscribe: async () => {} } });

  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(() => api.stop());

  it("GET /health responde ok con la base disponible y headers de seguridad", async () => {
    const res = await api.app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-ratelimit-limit"]).toBe("300");
  });

  it("una ruta que no está en el contrato responde 404 como problem+json", async () => {
    const res = await api.app.inject({ method: "GET", url: "/admin" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json()).toMatchObject({ status: 404, type: "https://lo-mio.cl/problems/not-found" });
  });

  it("un método no declarado en una ruta existente responde 405 con Allow (RFC 9110)", async () => {
    for (const method of ["POST", "DELETE", "TRACE", "QUERY"] as const) {
      const res = await api.app.inject({ method, url: "/health/live" });
      expect(res.statusCode).toBe(405);
      expect(res.headers.allow).toBe("GET, HEAD");
      expect(res.headers["content-type"]).toContain("application/problem+json");
    }
  });

  it("un campo que el contrato no declara no sale en la respuesta", async () => {
    const base = options();
    const leaky = await buildApp(env(), {
      ...base,
      handlers: {
        ...base.handlers,
        getLiveness: async () => ({ status: "ok", internalSecret: "no debería salir" }),
      },
    });
    const res = await leaky.inject({ method: "GET", url: "/health/live" });
    expect(res.json()).toEqual({ status: "ok" });
    await leaky.close();
  });

  it("una operación protegida sin sesión responde 401 como problem+json", async () => {
    const res = await api.app.inject({ method: "GET", url: "/v1/venues/current" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ type: "https://lo-mio.cl/problems/unauthenticated" });
  });

  it("no arranca si el contrato declara una operación sin handler", async () => {
    const base = options();
    const { getReadiness: _missing, ...incomplete } = base.handlers;
    await expect(buildApp(env(), { ...base, handlers: incomplete })).rejects.toThrow(
      /getReadiness del contrato no tiene handler/,
    );
  });

  it("no arranca si sobra un handler que no está en el contrato", async () => {
    const base = options();
    const extra = { ...base.handlers, getHealtz: async () => ({}) };
    await expect(buildApp(env(), { ...base, handlers: extra })).rejects.toThrow(
      /sin operación en el contrato: getHealtz/,
    );
  });

  it("si la base no está disponible, /health responde 503 como problem+json y /health/live sigue en 200", async () => {
    await api.db.destroy();
    const ready = await api.app.inject({ method: "GET", url: "/health" });
    expect(ready.statusCode).toBe(503);
    expect(ready.headers["content-type"]).toContain("application/problem+json");
    expect(ready.json()).toMatchObject({ status: 503, title: "Dependencia no disponible" });
    expect((await api.app.inject({ method: "GET", url: "/health/live" })).statusCode).toBe(200);
  });

  it("el proceso no arranca si falta una variable de entorno", () => {
    const run = spawnSync(process.execPath, [join(import.meta.dirname, "main.ts")], {
      env: { PATH: process.env.PATH },
      encoding: "utf8",
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("DATABASE_URL");
  });
});
