import type { Db } from "@lo-mio/postgres";
import type { Generated, JSONColumnType, Selectable } from "kysely";
import type { ItemEvent, ItemState, Owner } from "../domain/index.ts";

type ClaimsTables = {
  claims_events: {
    item_id: string;
    version: number;
    type: string;
    data: JSONColumnType<Record<string, unknown>>;
    actor_kind: "guest" | "staff" | "system";
    actor_id: string | null;
    at: Generated<Date>;
  };
  claims_items: {
    item_id: string;
    session_id: string;
    venue_id: string;
    pos_unit_ref: string;
    name: string;
    price_amount: string;
    price_currency: string;
    owners: JSONColumnType<Owner[]>;
    version: number;
    created_at: Generated<Date>;
  };
  claims_guests: { guest_id: string; session_id: string; alias: string };
};
const db = (tx: Db) => tx.withTables<ClaimsTables>();

export type Row = { venueId: string; state: ItemState };
export type Actor = { kind: "guest" | "staff" | "system"; id: string | null };

const toRow = (r: Selectable<ClaimsTables["claims_items"]>): Row => ({
  venueId: r.venue_id,
  state: {
    itemId: r.item_id,
    sessionId: r.session_id,
    name: r.name,
    price: { amount: Number(r.price_amount), currency: r.price_currency },
    version: r.version,
    owners: r.owners,
  },
});

/** Ítem con lock de fila: dos comandos sobre el mismo ítem se aplican en orden, nunca a la vez. */
export async function lockItem(tx: Db, itemId: string): Promise<Row | undefined> {
  const row = await db(tx)
    .selectFrom("claims_items")
    .selectAll()
    .where("item_id", "=", itemId)
    .forUpdate()
    .executeTakeFirst();
  return row && toRow(row);
}

export const findItem = async (tx: Db, itemId: string) => {
  const row = await db(tx)
    .selectFrom("claims_items")
    .selectAll()
    .where("item_id", "=", itemId)
    .executeTakeFirst();
  return row && toRow(row);
};

export async function sessionItems(tx: Db, sessionId: string): Promise<Row[]> {
  const rows = await db(tx)
    .selectFrom("claims_items")
    .selectAll()
    .where("session_id", "=", sessionId)
    .orderBy("created_at")
    .orderBy("pos_unit_ref")
    .execute();
  return rows.map(toRow);
}

/** `false` si la unidad ya existía (evento repetido). */
export async function insertItem(
  tx: Db,
  item: { venueId: string; posUnitRef: string; state: ItemState },
) {
  const { state } = item;
  const inserted = await db(tx)
    .insertInto("claims_items")
    .values({
      item_id: state.itemId,
      session_id: state.sessionId,
      venue_id: item.venueId,
      pos_unit_ref: item.posUnitRef,
      name: state.name,
      price_amount: String(state.price.amount),
      price_currency: state.price.currency,
      owners: JSON.stringify(state.owners),
      version: state.version,
    })
    .onConflict((oc) => oc.column("pos_unit_ref").doNothing())
    .returning("item_id")
    .executeTakeFirst();
  return inserted !== undefined;
}

export async function saveState(tx: Db, state: ItemState) {
  await db(tx)
    .updateTable("claims_items")
    .set({ owners: JSON.stringify(state.owners), version: state.version })
    .where("item_id", "=", state.itemId)
    .execute();
}

export async function appendEvent(
  tx: Db,
  itemId: string,
  version: number,
  event: ItemEvent,
  actor: Actor,
) {
  const { type, ...data } = event;
  await db(tx)
    .insertInto("claims_events")
    .values({
      item_id: itemId,
      version,
      type,
      data: JSON.stringify(data),
      actor_kind: actor.kind,
      actor_id: actor.id,
    })
    .execute();
}

export const history = (tx: Db, itemId: string) =>
  db(tx)
    .selectFrom("claims_events")
    .selectAll()
    .where("item_id", "=", itemId)
    .orderBy("version")
    .execute();

export async function upsertGuest(
  tx: Db,
  guest: { guest_id: string; session_id: string; alias: string },
) {
  await db(tx)
    .insertInto("claims_guests")
    .values(guest)
    .onConflict((oc) => oc.column("guest_id").doUpdateSet({ alias: guest.alias }))
    .execute();
}

export async function guestsOf(tx: Db, sessionId: string): Promise<Map<string, string>> {
  const rows = await db(tx)
    .selectFrom("claims_guests")
    .select(["guest_id", "alias"])
    .where("session_id", "=", sessionId)
    .execute();
  return new Map(rows.map((r) => [r.guest_id, r.alias]));
}
