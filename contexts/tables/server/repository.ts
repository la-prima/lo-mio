import type { Db } from "@lo-mio/postgres";
import type { ColumnType, Generated } from "kysely";

type TablesTables = {
  tables_registry: {
    table_id: string;
    venue_id: string;
    label: string;
    qr_code: string;
    currency: string;
  };
  table_sessions: {
    id: string;
    venue_id: string;
    table_id: string;
    opened_at: Generated<Date>;
    closed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  };
  guests: {
    id: string;
    session_id: string;
    alias: string;
    token_hash: string;
    joined_at: Generated<Date>;
  };
};
const db = (tx: Db) => tx.withTables<TablesTables>();

export type Registered = TablesTables["tables_registry"];

export async function upsertTable(tx: Db, table: Registered) {
  await db(tx)
    .insertInto("tables_registry")
    .values(table)
    .onConflict((oc) =>
      oc.column("table_id").doUpdateSet({ label: table.label, qr_code: table.qr_code }),
    )
    .execute();
}

export async function rotateQr(tx: Db, tableId: string, qrCode: string) {
  await db(tx)
    .updateTable("tables_registry")
    .set({ qr_code: qrCode })
    .where("table_id", "=", tableId)
    .execute();
}

export const tableByQr = (tx: Db, qrCode: string) =>
  db(tx).selectFrom("tables_registry").selectAll().where("qr_code", "=", qrCode).executeTakeFirst();

export const tableById = (tx: Db, tableId: string) =>
  db(tx)
    .selectFrom("tables_registry")
    .selectAll()
    .where("table_id", "=", tableId)
    .executeTakeFirst();

export const openSessionOf = (tx: Db, tableId: string) =>
  db(tx)
    .selectFrom("table_sessions")
    .selectAll()
    .where("table_id", "=", tableId)
    .where("closed_at", "is", null)
    .executeTakeFirst();

/** Inserta la sesión salvo que ya haya una abierta (índice único parcial). `true` si la creó. */
export async function insertSessionIfNone(
  tx: Db,
  session: { id: string; venue_id: string; table_id: string },
) {
  const inserted = await db(tx)
    .insertInto("table_sessions")
    .values(session)
    .onConflict((oc) => oc.column("table_id").where("closed_at", "is", null).doNothing())
    .returning("id")
    .executeTakeFirst();
  return inserted !== undefined;
}

export const guestByTokenHash = (tx: Db, tokenHash: string) =>
  db(tx)
    .selectFrom("guests")
    .innerJoin("table_sessions", "table_sessions.id", "guests.session_id")
    .innerJoin("tables_registry", "tables_registry.table_id", "table_sessions.table_id")
    .select([
      "guests.id as guestId",
      "guests.session_id as sessionId",
      "guests.alias",
      "table_sessions.venue_id as venueId",
      "table_sessions.closed_at as closedAt",
      "tables_registry.label as tableLabel",
    ])
    .where("guests.token_hash", "=", tokenHash)
    .executeTakeFirst();

/**
 * Posición del próximo comensal. Bloquea la sesión hasta el fin de la transacción: dos uniones
 * simultáneas se numeran una después de la otra (nunca dos "Comensal 2").
 */
export async function nextGuestPosition(tx: Db, sessionId: string) {
  await db(tx)
    .selectFrom("table_sessions")
    .select("id")
    .where("id", "=", sessionId)
    .forUpdate()
    .execute();
  const row = await db(tx)
    .selectFrom("guests")
    .select((eb) => eb.fn.countAll<string>().as("n"))
    .where("session_id", "=", sessionId)
    .executeTakeFirstOrThrow();
  return Number(row.n) + 1;
}

export async function insertGuest(
  tx: Db,
  guest: { id: string; session_id: string; alias: string; token_hash: string },
) {
  await db(tx).insertInto("guests").values(guest).execute();
}

export async function renameGuest(tx: Db, guestId: string, alias: string) {
  await db(tx).updateTable("guests").set({ alias }).where("id", "=", guestId).execute();
}

export const sessionById = (tx: Db, sessionId: string) =>
  db(tx)
    .selectFrom("table_sessions")
    .select(["id", "venue_id"])
    .where("id", "=", sessionId)
    .executeTakeFirst();
