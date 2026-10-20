import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "kysely";
import type { Db } from "./db.ts";

const PLATFORM_MIGRATIONS = join(import.meta.dirname, "../migrations");

/**
 * Aplica los `.sql` pendientes: primero los de plataforma y luego los de cada módulo, en orden
 * de nombre. Todo en una transacción con lock: si algo falla no queda nada a medias, y dos
 * instancias arrancando a la vez no migran dos veces. Devuelve los nombres aplicados.
 */
export async function migrate(db: Db, modules: Record<string, string> = {}): Promise<string[]> {
  const files = Object.entries({ platform: PLATFORM_MIGRATIONS, ...modules }).flatMap(
    ([module, dir]) =>
      readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((f) => ({ name: `${module}/${f}`, path: join(dir, f) })),
  );
  return db.transaction().execute(async (tx) => {
    await sql`select pg_advisory_xact_lock(hashtext('schema_migrations'))`.execute(tx);
    await sql`create table if not exists schema_migrations (
      name text primary key, applied_at timestamptz not null default now())`.execute(tx);
    const applied = new Set(
      (await tx.selectFrom("schema_migrations").select("name").execute()).map((r) => r.name),
    );
    const pending = files.filter((f) => !applied.has(f.name));
    for (const file of pending) {
      await sql.raw(readFileSync(file.path, "utf8")).execute(tx);
      await tx.insertInto("schema_migrations").values({ name: file.name }).execute();
    }
    return pending.map((f) => f.name);
  });
}
