import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db, migrate } from "./index.ts";
import { startPostgres } from "./testing.ts";

describe("Migraciones de base de datos", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  const moduleDir = mkdtempSync(join(tmpdir(), "lo-mio-migrations-"));

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url);
    writeFileSync(
      join(moduleDir, "001_tables.sql"),
      "create table a (id int); create table b (id int);",
    );
  });
  afterAll(async () => {
    await db.destroy();
    await pg.stop();
  });

  it("migra una base vacía en orden y no repite lo aplicado", async () => {
    expect(await migrate(db, { venues: moduleDir })).toEqual([
      "platform/001_inbox.sql",
      "venues/001_tables.sql",
    ]);
    expect(await migrate(db, { venues: moduleDir })).toEqual([]);
    const { rows } = await sql<{ n: number }>`select count(*)::int as n from b`.execute(db);
    expect(rows[0]?.n).toBe(0);
  });

  it("no deja nada a medias si una migración falla", async () => {
    writeFileSync(join(moduleDir, "002_ok.sql"), "create table c (id int);");
    writeFileSync(join(moduleDir, "003_broken.sql"), "create table oops (");
    await expect(migrate(db, { venues: moduleDir })).rejects.toThrow();
    const { rows } = await sql<{ t: string | null }>`select to_regclass('c')::text as t`.execute(
      db,
    );
    expect(rows[0]?.t).toBeNull();
  });
});
