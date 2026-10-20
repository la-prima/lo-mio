import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { createDb, type Db } from "@lo-mio/postgres";
import { startPostgres } from "@lo-mio/postgres/testing";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { loadEnv } from "./env.ts";
import { platformHandlers } from "./platform.ts";

const env = (url: string) => loadEnv({ DATABASE_URL: url, LOG_LEVEL: "fatal" });

describe("api", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  let app: FastifyInstance;

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url);
    app = await buildApp(env(pg.url), platformHandlers(db));
  });
  afterAll(async () => {
    await app.close();
    await pg.stop();
  });

  it("GET /health responde ok con la base disponible y headers de seguridad", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-ratelimit-limit"]).toBe("300");
  });

  it("una ruta que no está en el contrato responde 404 como problem+json", async () => {
    const res = await app.inject({ method: "GET", url: "/admin" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json()).toMatchObject({ status: 404, type: "https://lo-mio.cl/problems/not-found" });
  });

  it("un campo que el contrato no declara no sale en la respuesta", async () => {
    const leaky = await buildApp(env(pg.url), {
      ...platformHandlers(db),
      getLiveness: async () => ({ status: "ok", internalSecret: "no debería salir" }),
    });
    const res = await leaky.inject({ method: "GET", url: "/health/live" });
    expect(res.json()).toEqual({ status: "ok" });
    await leaky.close();
  });

  it("no arranca si el contrato declara una operación sin handler", async () => {
    const { getReadiness: _missing, ...incomplete } = platformHandlers(db);
    await expect(buildApp(env(pg.url), incomplete)).rejects.toThrow(
      /getReadiness del contrato no tiene handler/,
    );
  });

  it("no arranca si sobra un handler que no está en el contrato", async () => {
    const extra = { ...platformHandlers(db), getHealtz: async () => ({}) };
    await expect(buildApp(env(pg.url), extra)).rejects.toThrow(
      /sin operación en el contrato: getHealtz/,
    );
  });

  it("si la base no está disponible, /health responde 503 como problem+json y /health/live sigue en 200", async () => {
    await db.destroy();
    const ready = await app.inject({ method: "GET", url: "/health" });
    expect(ready.statusCode).toBe(503);
    expect(ready.headers["content-type"]).toContain("application/problem+json");
    expect(ready.json()).toMatchObject({ status: 503, title: "Dependencia no disponible" });
    expect((await app.inject({ method: "GET", url: "/health/live" })).statusCode).toBe(200);
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
