import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Db } from "./index.ts";
import { startPostgres } from "./testing.ts";

describe("Conexión a la base de datos", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  let admin: Db;
  const onError = vi.fn();

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url, onError);
    admin = createDb(pg.url);
  });
  afterAll(async () => {
    await db.destroy();
    await admin.destroy();
    await pg.stop();
  });

  it("si Postgres corta una conexión inactiva (reinicio, failover), se informa y la API sigue respondiendo", async () => {
    const { rows } = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(db);
    // La conexión vuelve al pool y queda inactiva: Postgres la termina, como en un failover.
    await sql`select pg_terminate_backend(${rows[0]?.pid})`.execute(admin);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ code: "57P01" });
    // El pool descartó la conexión rota: la siguiente consulta usa una nueva.
    const next = await sql<{ ok: number }>`select 1 as ok`.execute(db);
    expect(next.rows).toEqual([{ ok: 1 }]);
  });
});
