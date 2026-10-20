import { type Generated, Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import pg from "pg";

/** Tablas de plataforma. Cada contexto agrega las suyas con `db.withTables<…>()`. */
export type PlatformTables = {
  schema_migrations: { name: string; applied_at: Generated<Date> };
  inbox: { subscriber: string; event_id: string; processed_at: Generated<Date> };
  idempotency_keys: {
    scope: string;
    key: string;
    request_hash: string;
    status: number;
    body: unknown;
    created_at: Generated<Date>;
  };
};

export type Db = Kysely<PlatformTables>;
export type Tx = Transaction<PlatformTables>;

export function createDb(connectionString: string): Db {
  return new Kysely({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }) });
}

/** Verifica que la base responde. */
export async function ping(db: Db): Promise<void> {
  await sql`select 1`.execute(db);
}
