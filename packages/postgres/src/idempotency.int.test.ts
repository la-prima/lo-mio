import { newId } from "@lo-mio/kernel";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db, migrate, runIdempotent } from "./index.ts";
import { startPostgres } from "./testing.ts";

describe("Comandos idempotentes", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  let executions = 0;
  const command = (key: string, request: unknown) =>
    runIdempotent(db, { scope: "staff:ana", key, request }, async (tx) => {
      executions++;
      await sql`insert into effects values (${key})`.execute(tx);
      return { status: 201, body: { n: executions } };
    });

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url);
    await migrate(db);
    await sql`create table effects (key text)`.execute(db);
  });
  afterAll(async () => {
    await db.destroy();
    await pg.stop();
  });

  it("un reintento con la misma clave devuelve la respuesta original sin repetir el efecto", async () => {
    const key = newId();
    const first = await command(key, { label: "5" });
    const retry = await command(key, { label: "5" });
    expect(retry).toEqual(first);
    const { rows } = await sql<{
      n: number;
    }>`select count(*)::int as n from effects where key = ${key}`.execute(db);
    expect(rows[0]?.n).toBe(1);
  });

  it("dos intentos simultáneos con la misma clave se aplican una sola vez", async () => {
    const key = newId();
    const [a, b] = await Promise.all([command(key, { label: "6" }), command(key, { label: "6" })]);
    expect(a).toEqual(b);
    const { rows } = await sql<{
      n: number;
    }>`select count(*)::int as n from effects where key = ${key}`.execute(db);
    expect(rows[0]?.n).toBe(1);
  });

  it("la misma clave con otra solicitud se rechaza", async () => {
    const key = newId();
    await command(key, { label: "7" });
    expect(await command(key, { label: "8" })).toEqual({ reused: true });
  });

  it("si el comando falla no queda registrada la clave (se puede reintentar)", async () => {
    const key = newId();
    await expect(
      runIdempotent(db, { scope: "staff:ana", key, request: {} }, async () => {
        throw new Error("falla");
      }),
    ).rejects.toThrow("falla");
    expect(await command(key, {})).toMatchObject({ status: 201 });
  });
});
