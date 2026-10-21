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

/**
 * `onError` recibe los errores de conexiones inactivas del pool (Postgres reinicia, hace failover o
 * corta la red). Sin listener, Node los convierte en una excepción no manejada y el proceso cae
 * aunque no hubiera ninguna consulta en curso. El pool ya descarta esa conexión; las consultas en
 * curso fallan por su cuenta. Por defecto se relanza (scripts cortos: que fallen).
 */
export function createDb(
  connectionString: string,
  onError: (error: Error) => void = (error) => {
    throw error;
  },
): Db {
  const pool = new pg.Pool({ connectionString });
  pool.on("error", onError);
  return new Kysely({ dialect: new PostgresDialect({ pool }) });
}

/** Verifica que la base responde. */
export async function ping(db: Db): Promise<void> {
  await sql`select 1`.execute(db);
}
