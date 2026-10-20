import { randomBytes } from "node:crypto";
import { createEvent, type EventBus, newId } from "@lo-mio/kernel";
import { type Db, runIdempotent, type Tx } from "@lo-mio/postgres";
import { type Actor, type CommandResponse, idempotencyScope } from "@lo-mio/server";
import type { FastifyBaseLogger } from "fastify";
import { registerProduct, registerTable, rotateQr, type Table } from "../domain/index.ts";
import * as repo from "./repository.ts";

export type VenuesDeps = { db: Db; bus: EventBus<Tx> };
type Staff = Extract<Actor, { kind: "staff" }>;
type Command = { key: string; log: FastifyBaseLogger };

/** 128 bits aleatorios: el QR impreso no se puede adivinar a partir del número de mesa. */
const newQrCode = () => randomBytes(16).toString("base64url");

const tableView = (t: Table) => ({ id: t.id, label: t.label, qrCode: t.qrCode });

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

const publish = (
  deps: VenuesDeps,
  tx: Tx,
  actor: Staff,
  type: string,
  aggregateId: string,
  data: unknown,
) =>
  deps.bus.publish(createEvent({ type, version: 1, venueId: actor.venueId, aggregateId, data }), {
    tx,
  });

const run = (
  deps: VenuesDeps,
  actor: Staff,
  key: string,
  request: unknown,
  fn: (tx: Tx) => Promise<CommandResponse>,
) => runIdempotent(deps.db, { scope: idempotencyScope(actor), key, request }, fn);

export async function currentVenue(deps: VenuesDeps, actor: Staff) {
  const venue = await repo.findVenue(deps.db, actor.venueId);
  // Un actor siempre pertenece a un local existente: si no, es un error de datos, no del usuario.
  if (!venue) throw new Error(`el local ${actor.venueId} del actor no existe`);
  return venue;
}

export const listTables = async (deps: VenuesDeps, actor: Staff) =>
  (await repo.listTables(deps.db, actor.venueId)).map(tableView);

export const listProducts = async (deps: VenuesDeps, actor: Staff) =>
  (await repo.listProducts(deps.db, actor.venueId)).map(({ id, name, price }) => ({
    id,
    name,
    price,
  }));

export async function addTable(
  deps: VenuesDeps,
  actor: Staff,
  input: { label: string },
  { key }: Command,
) {
  const venue = await currentVenue(deps, actor);
  return run(deps, actor, key, ["registerTable", input], async (tx) => {
    const table = registerTable(venue, { id: newId(), label: input.label, qrCode: newQrCode() });
    // 422: el request cumple el contrato, pero no la regla (ej. un nombre que es solo espacios).
    if (!table.ok) return problem(422, "invalid-table-label", "Nombre de mesa inválido");
    if (!(await repo.insertTable(tx, table.value))) {
      return problem(409, "table-label-taken", "Ya existe una mesa con ese nombre");
    }
    const { id: tableId, label, qrCode } = table.value;
    await publish(deps, tx, actor, "venues.table.registered", tableId, {
      tableId,
      label,
      qrCode,
      currency: venue.currency,
    });
    return { status: 201, body: tableView(table.value) };
  });
}

export async function rotateTableQr(
  deps: VenuesDeps,
  actor: Staff,
  tableId: string,
  { key, log }: Command,
) {
  return run(deps, actor, key, ["rotateTableQr", tableId], async (tx) => {
    const table = await repo.findTable(tx, tableId);
    if (table && table.venueId !== actor.venueId) {
      // Acceso cruzado entre locales: se registra y se responde como si no existiera.
      log.warn(
        { actor, tableId, tableVenueId: table.venueId },
        "intento de acceso a una mesa de otro local",
      );
    }
    if (!table || table.venueId !== actor.venueId)
      return problem(404, "not-found", "Recurso no encontrado");
    const rotated = rotateQr(table, newQrCode());
    await repo.updateQr(tx, rotated);
    await publish(deps, tx, actor, "venues.table.qr-rotated", rotated.id, {
      tableId: rotated.id,
      qrCode: rotated.qrCode,
    });
    return { status: 200, body: tableView(rotated) };
  });
}

export async function addProduct(
  deps: VenuesDeps,
  actor: Staff,
  input: { name: string; price: { amount: number; currency: string } },
  { key }: Command,
) {
  const venue = await currentVenue(deps, actor);
  return run(deps, actor, key, ["registerProduct", input], async (tx) => {
    const product = registerProduct(venue, { id: newId(), ...input });
    if (!product.ok) {
      if (product.error !== "currency-mismatch") {
        return problem(422, "invalid-product-name", "Nombre de producto inválido");
      }
      const detail = `El precio debe estar en ${venue.currency}`;
      return problem(422, "currency-mismatch", "El precio no está en la moneda del local", detail);
    }
    await repo.insertProduct(tx, product.value);
    const { id, name, price } = product.value;
    return { status: 201, body: { id, name, price } };
  });
}
