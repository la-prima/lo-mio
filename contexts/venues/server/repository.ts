import type { Db } from "@lo-mio/postgres";
import type { Product, Table, Venue } from "../domain/index.ts";

type VenuesTables = {
  venues: { id: string; name: string; country: string; currency: string };
  venue_tables: { id: string; venue_id: string; label: string; qr_code: string };
  venue_products: {
    id: string;
    venue_id: string;
    name: string;
    price_amount: string;
    price_currency: string;
  };
};

// Acepta la base o una transacción (Transaction extiende Kysely).
const db = (tx: Db) => tx.withTables<VenuesTables>();

export async function findVenue(tx: Db, id: string): Promise<Venue | undefined> {
  return db(tx)
    .selectFrom("venues")
    .select(["id", "name", "country", "currency"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function insertVenue(tx: Db, venue: Venue): Promise<void> {
  await db(tx)
    .insertInto("venues")
    .values(venue)
    .onConflict((oc) => oc.column("id").doNothing())
    .execute();
}

const toTable = (r: { id: string; venue_id: string; label: string; qr_code: string }): Table => ({
  id: r.id,
  venueId: r.venue_id,
  label: r.label,
  qrCode: r.qr_code,
});

export async function listTables(tx: Db, venueId: string): Promise<Table[]> {
  const rows = await db(tx)
    .selectFrom("venue_tables")
    .selectAll()
    .where("venue_id", "=", venueId)
    .orderBy("label")
    .execute();
  return rows.map(toTable);
}

export async function findTable(tx: Db, id: string): Promise<Table | undefined> {
  const row = await db(tx)
    .selectFrom("venue_tables")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  return row && toTable(row);
}

/** `false` si ya hay una mesa con ese nombre en el local. */
export async function insertTable(tx: Db, table: Table): Promise<boolean> {
  const inserted = await db(tx)
    .insertInto("venue_tables")
    .values({ id: table.id, venue_id: table.venueId, label: table.label, qr_code: table.qrCode })
    .onConflict((oc) => oc.columns(["venue_id", "label"]).doNothing())
    .returning("id")
    .executeTakeFirst();
  return inserted !== undefined;
}

export async function updateQr(tx: Db, table: Table): Promise<void> {
  await db(tx)
    .updateTable("venue_tables")
    .set({ qr_code: table.qrCode })
    .where("id", "=", table.id)
    .execute();
}

export async function listProducts(tx: Db, venueId: string): Promise<Product[]> {
  const rows = await db(tx)
    .selectFrom("venue_products")
    .selectAll()
    .where("venue_id", "=", venueId)
    .orderBy("name")
    .execute();
  return rows.map((r) => ({
    id: r.id,
    venueId: r.venue_id,
    name: r.name,
    price: { amount: Number(r.price_amount), currency: r.price_currency },
  }));
}

export async function insertProduct(tx: Db, product: Product): Promise<void> {
  await db(tx)
    .insertInto("venue_products")
    .values({
      id: product.id,
      venue_id: product.venueId,
      name: product.name,
      price_amount: String(product.price.amount),
      price_currency: product.price.currency,
    })
    .execute();
}
