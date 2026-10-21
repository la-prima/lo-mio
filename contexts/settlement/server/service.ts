import { createEvent, type EventBus, type EventEnvelope, type Money } from "@lo-mio/kernel";
import type { Db, Tx } from "@lo-mio/postgres";
import type { Actor } from "@lo-mio/server";
import type { JSONColumnType } from "kysely";
import { affectedBy, balancesOf, type Share } from "../domain/index.ts";

export type SettlementDeps = { db: Db; bus: EventBus<Tx> };

type SettlementTables = {
  settlement_items: {
    item_id: string;
    session_id: string;
    version: number;
    shares: JSONColumnType<Share[]>;
  };
  settlement_guests: {
    guest_id: string;
    session_id: string;
    venue_id: string;
    alias: string;
    currency: string;
  };
  settlement_balances: { guest_id: string; amount: string; currency: string };
};
const tables = (db: Db) => db.withTables<SettlementTables>();

type ItemChanged = {
  itemId: string;
  sessionId: string;
  version: number;
  price: Money;
  shares: Share[];
};

export async function onGuestJoined(event: EventEnvelope, tx: Tx) {
  const guest = event.data as {
    guestId: string;
    sessionId: string;
    alias: string;
    currency: string;
  };
  await tables(tx)
    .insertInto("settlement_guests")
    .values({
      guest_id: guest.guestId,
      session_id: guest.sessionId,
      venue_id: event.venueId,
      alias: guest.alias,
      currency: guest.currency,
    })
    .onConflict((oc) => oc.column("guest_id").doNothing())
    .execute();
}

export async function onGuestRenamed(event: EventEnvelope, tx: Tx) {
  const { guestId, alias } = event.data as { guestId: string; alias: string };
  await tables(tx)
    .updateTable("settlement_guests")
    .set({ alias })
    .where("guest_id", "=", guestId)
    .execute();
}

/** Guarda el saldo si cambió; `true` si cambió (hay que publicarlo). */
async function storeBalance(tx: Tx, guestId: string, balance: Money): Promise<boolean> {
  const stored = await tables(tx)
    .selectFrom("settlement_balances")
    .select("amount")
    .where("guest_id", "=", guestId)
    .executeTakeFirst();
  if (stored && Number(stored.amount) === balance.amount) return false;
  await tables(tx)
    .insertInto("settlement_balances")
    .values({ guest_id: guestId, amount: String(balance.amount), currency: balance.currency })
    .onConflict((oc) => oc.column("guest_id").doUpdateSet({ amount: String(balance.amount) }))
    .execute();
  return true;
}

/**
 * claims.item.changed.v1 → partes vigentes del ítem (una versión vieja que llega tarde se descarta)
 * y saldo nuevo de los comensales afectados; se publica solo si cambió.
 */
export const onItemChanged = (deps: SettlementDeps) => async (event: EventEnvelope, tx: Tx) => {
  const item = event.data as ItemChanged;
  const previous = await tables(tx)
    .selectFrom("settlement_items")
    .selectAll()
    .where("item_id", "=", item.itemId)
    .forUpdate()
    .executeTakeFirst();
  if (previous && previous.version >= item.version) return;
  const shares = JSON.stringify(item.shares);
  await tables(tx)
    .insertInto("settlement_items")
    .values({ item_id: item.itemId, session_id: item.sessionId, version: item.version, shares })
    .onConflict((oc) => oc.column("item_id").doUpdateSet({ version: item.version, shares }))
    .execute();
  const affected = affectedBy(previous?.shares ?? [], item.shares);
  const items = await tables(tx)
    .selectFrom("settlement_items")
    .select("shares")
    .where("session_id", "=", item.sessionId)
    .execute();
  for (const [guestId, balance] of balancesOf(affected, items, item.price.currency)) {
    if (!affected.includes(guestId) || !(await storeBalance(tx, guestId, balance))) continue;
    const data = { sessionId: item.sessionId, guestId, balance };
    const changed = createEvent({
      type: "settlement.balance.changed",
      version: 1,
      venueId: event.venueId,
      aggregateId: guestId,
      data,
    });
    await deps.bus.publish(changed, { tx });
  }
};

/** Saldo de cada comensal de la sesión: para sus comensales o el personal del local. */
export async function sessionBalances(db: Db, actor: Actor, sessionId: string) {
  if (actor.kind === "guest" && actor.sessionId !== sessionId) return undefined;
  const guests = await tables(db)
    .selectFrom("settlement_guests")
    .leftJoin("settlement_balances", "settlement_balances.guest_id", "settlement_guests.guest_id")
    .select([
      "settlement_guests.guest_id",
      "alias",
      "settlement_guests.currency",
      "settlement_balances.amount",
    ])
    .where("session_id", "=", sessionId)
    .where("venue_id", "=", actor.venueId)
    .orderBy("alias")
    .execute();
  return guests.map((g) => ({
    guestId: g.guest_id,
    alias: g.alias,
    balance: { amount: Number(g.amount ?? 0), currency: g.currency },
  }));
}
