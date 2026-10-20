import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.ts";

describe("Configuración del entorno", () => {
  it("aplica valores por defecto y separa los orígenes de CORS", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      CORS_ORIGINS: "https://a.cl, https://b.cl",
    });
    expect(env).toMatchObject({
      PORT: 3000,
      LOG_LEVEL: "info",
      MIGRATE_ON_START: true,
      CORS_ORIGINS: ["https://a.cl", "https://b.cl"],
    });
  });

  it("permite desactivar la migración al arrancar (Kubernetes usa un Job)", () => {
    const env = loadEnv({ DATABASE_URL: "postgres://localhost/db", MIGRATE_ON_START: "false" });
    expect(env.MIGRATE_ON_START).toBe(false);
  });

  it("nombra cada variable inválida o faltante", () => {
    expect(() => loadEnv({ PORT: "abc" })).toThrow(/DATABASE_URL[\s\S]*PORT/);
  });

  it("rechaza una URL de base de datos que no es Postgres", () => {
    expect(() => loadEnv({ DATABASE_URL: "mysql://localhost/db" })).toThrow(/DATABASE_URL/);
  });
});
