import { createEvent, type EventBus, type EventEnvelope, newId } from "@lo-mio/kernel";
import { type Db, runIdempotent, type Tx } from "@lo-mio/postgres";
import { type Actor, type CommandResponse, idempotencyScope } from "@lo-mio/server";
import type { FastifyBaseLogger } from "fastify";
import { manualItemId } from "../domain/index.ts";

export type PosDeps = { db: Db; bus: EventBus<Tx> };
type Staff = Extract<Actor, { kind: "staff" }>;
type PosTables = { pos_tables: { table_id: string; venue_id: string; currency: string } };
const tables = (db: Db) => db.withTables<PosTables>();

const problem = (
  status: number,
  slug: string,
  title: string,
  detail?: string,
): CommandResponse => ({
  status,
  body: {
    type: `https://lo-mio.cl/problems/${slug}`,
    title,
    status,
    ...(detail ? { detail } : {}),
  },
});

/** venues.table.registered.v1 → mesa conocida por pos (idempotente: el bus puede repetir). */
export async function onTableRegistered(event: EventEnvelope, tx: Tx) {
  const { tableId, currency } = event.data as { tableId: string; currency: string };
  await tables(tx)
    .insertInto("pos_tables")
    .values({ table_id: tableId, venue_id: event.venueId, currency })
    .onConflict((oc) => oc.column("table_id").doNothing())
    .execute();
}

type ManualItems = {
  tableId: string;
  name: string;
  unitPrice: { amount: number; currency: string };
  quantity: number;
};

/** Adaptador manual: el ítem cargado por el mesero se publica como cualquier ítem del POS. */
export async function loadManualItems(
  deps: PosDeps,
  actor: Staff,
  input: ManualItems,
  { key, log }: { key: string; log: FastifyBaseLogger },
) {
  const request = ["loadManualItems", input];
  return runIdempotent(deps.db, { scope: idempotencyScope(actor), key, request }, async (tx) => {
    const table = await tables(tx)
      .selectFrom("pos_tables")
      .selectAll()
      .where("table_id", "=", input.tableId)
      .executeTakeFirst();
    if (table && table.venue_id !== actor.venueId) {
      log.warn(
        { actor, tableId: input.tableId, tableVenueId: table.venue_id },
        "intento de cargar ítems en una mesa de otro local",
      );
    }
    if (!table || table.venue_id !== actor.venueId)
      return problem(404, "not-found", "Recurso no encontrado");
    if (input.unitPrice.currency !== table.currency) {
      const detail = `El precio debe estar en ${table.currency}`;
      return problem(422, "currency-mismatch", "El precio no está en la moneda del local", detail);
    }
    const posItemId = manualItemId(newId());
    const event = createEvent({
      type: "pos.item.received",
      version: 1,
      venueId: actor.venueId,
      aggregateId: posItemId,
      data: { posItemId, ...input },
    });
    await deps.bus.publish(event, { tx });
    return { status: 202, body: { posItemIds: [posItemId] } };
  });
}
