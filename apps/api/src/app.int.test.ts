import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { createDb, type Db } from "@lo-mio/postgres";
import { startPostgres } from "@lo-mio/postgres/testing";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { loadEnv } from "./env.ts";

describe("api", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  let app: FastifyInstance;

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url);
    app = await buildApp(loadEnv({ DATABASE_URL: pg.url, LOG_LEVEL: "fatal" }), db);
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

  it("GET /health responde 503 si la base no está disponible", async () => {
    await db.destroy();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(503);
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
