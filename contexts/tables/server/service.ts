import { createEvent, type EventBus, type EventEnvelope, newId } from "@lo-mio/kernel";
import type { Db, Tx } from "@lo-mio/postgres";
import { type Actor, hashToken, newSessionToken } from "@lo-mio/server";
import type { FastifyBaseLogger } from "fastify";
import { checkAlias, defaultAlias, unitsOf } from "../domain/index.ts";
import * as repo from "./repository.ts";

export type TablesDeps = { db: Db; bus: EventBus<Tx> };
type Guest = Extract<Actor, { kind: "guest" }>;

const publish = (
  deps: TablesDeps,
  tx: Tx,
  venueId: string,
  type: string,
  aggregateId: string,
  data: unknown,
) => deps.bus.publish(createEvent({ type, version: 1, venueId, aggregateId, data }), { tx });

/** Sesión abierta de la mesa, abriéndola si no hay. Publica la apertura solo si la creó. */
async function ensureOpenSession(deps: TablesDeps, tx: Tx, venueId: string, tableId: string) {
  const created = await repo.insertSessionIfNone(tx, {
    id: newId(),
    venue_id: venueId,
    table_id: tableId,
  });
  const session = await repo.openSessionOf(tx, tableId);
  if (!session) throw new Error(`la mesa ${tableId} no quedó con sesión abierta`);
  if (created)
    await publish(deps, tx, venueId, "tables.session.opened", session.id, {
      sessionId: session.id,
      tableId,
    });
  return session;
}

const sessionView = (s: { id: string; table_id: string; opened_at: Date }) => ({
  id: s.id,
  tableId: s.table_id,
  openedAt: s.opened_at.toISOString(),
});

// ---------- eventos de otros contextos ----------

export async function onTableRegistered(event: EventEnvelope, tx: Tx) {
  const { tableId, label, qrCode, currency } = event.data as {
    tableId: string;
    label: string;
    qrCode: string;
    currency: string;
  };
  await repo.upsertTable(tx, {
    table_id: tableId,
    venue_id: event.venueId,
    label,
    qr_code: qrCode,
    currency,
  });
}

export async function onTableQrRotated(event: EventEnvelope, tx: Tx) {
  const { tableId, qrCode } = event.data as { tableId: string; qrCode: string };
  await repo.rotateQr(tx, tableId, qrCode);
}

type ItemReceived = {
  posItemId: string;
  tableId: string;
  name: string;
  unitPrice: unknown;
  quantity: number;
};

/** pos.item.received.v1 → cada unidad queda en la sesión abierta de su mesa (la abre si no hay). */
export const onItemReceived = (deps: TablesDeps) => async (event: EventEnvelope, tx: Tx) => {
  const item = event.data as ItemReceived;
  // Los eventos de venues y de pos viajan por colas distintas: si la mesa todavía no llegó, se
  // falla para que el bus reintente cuando ya esté.
  if (!(await repo.tableById(tx, item.tableId)))
    throw new Error(`mesa ${item.tableId} aún desconocida`);
  const session = await ensureOpenSession(deps, tx, event.venueId, item.tableId);
  for (const itemId of unitsOf(item)) {
    const { posItemId, tableId, name, unitPrice } = item;
    const data = { sessionId: session.id, tableId, itemId, posItemId, name, unitPrice };
    await publish(deps, tx, event.venueId, "tables.item.seated", session.id, data);
  }
};

// ---------- comandos y consultas ----------

export async function openTableSession(
  deps: TablesDeps,
  actor: Extract<Actor, { kind: "staff" }>,
  tableId: string,
  log: FastifyBaseLogger,
) {
  return deps.db.transaction().execute(async (tx) => {
    const table = await repo.tableById(tx, tableId);
    if (table && table.venue_id !== actor.venueId) {
      log.warn(
        { actor, tableId, tableVenueId: table.venue_id },
        "intento de abrir una mesa de otro local",
      );
    }
    if (!table || table.venue_id !== actor.venueId) return undefined;
    return sessionView(await ensureOpenSession(deps, tx, actor.venueId, tableId));
  });
}

/** Comensal del dispositivo, si su token sigue vigente (sesión abierta). */
async function guestOfToken(db: Db, token: string | undefined) {
  const guest = token ? await repo.guestByTokenHash(db, hashToken(token)) : undefined;
  return guest && guest.closedAt === null ? guest : undefined;
}

const guestView = (g: {
  guestId: string;
  sessionId: string;
  alias: string;
  tableLabel: string;
}) => ({
  guestId: g.guestId,
  sessionId: g.sessionId,
  alias: g.alias,
  tableLabel: g.tableLabel,
});

/**
 * Unirse por QR. Con el token de un comensal de la sesión abierta devuelve ese mismo comensal
 * (recargar no crea otro); con uno de una sesión cerrada, o sin token, crea uno nuevo.
 * `undefined` si el QR no corresponde a una mesa (inexistente o revocado).
 */
export async function joinTable(
  deps: TablesDeps,
  qrCode: string,
  input: { alias?: string },
  token: string | undefined,
) {
  const table = await repo.tableByQr(deps.db, qrCode);
  if (!table) return undefined;
  const alias = input.alias === undefined ? undefined : checkAlias(input.alias);
  if (alias && !alias.ok) return { error: "invalid-alias" as const };
  return deps.db.transaction().execute(async (tx) => {
    const session = await ensureOpenSession(deps, tx, table.venue_id, table.table_id);
    const current = await guestOfToken(tx, token);
    if (current?.sessionId === session.id && token) return { token, guest: guestView(current) };
    // ponytail: dos uniones simultáneas pueden recibir el mismo "Comensal N"; es solo el alias
    // por defecto (los ids son únicos). Usar una secuencia por sesión si molesta.
    const name = alias?.ok
      ? alias.value
      : defaultAlias((await repo.countGuests(tx, session.id)) + 1);
    const guestId = newId();
    const newToken = newSessionToken();
    await repo.insertGuest(tx, {
      id: guestId,
      session_id: session.id,
      alias: name,
      token_hash: hashToken(newToken),
    });
    await publish(deps, tx, table.venue_id, "tables.guest.joined", session.id, {
      sessionId: session.id,
      guestId,
      alias: name,
      // La moneda de la sesión: settlement la necesita para el saldo (también en cero).
      currency: table.currency,
    });
    return {
      token: newToken,
      guest: { guestId, sessionId: session.id, alias: name, tableLabel: table.label },
    };
  });
}

/** Actor de un token de comensal vigente (lo usan los securityHandlers de apps/api). */
export async function authenticate(db: Db, token: string): Promise<Actor | undefined> {
  const guest = await guestOfToken(db, token);
  return (
    guest && {
      kind: "guest",
      guestId: guest.guestId,
      sessionId: guest.sessionId,
      venueId: guest.venueId,
    }
  );
}

export async function currentGuest(db: Db, token: string) {
  const guest = await guestOfToken(db, token);
  return guest && guestView(guest);
}

export async function renameGuest(
  deps: TablesDeps,
  actor: Guest,
  token: string,
  input: { alias: string },
) {
  const alias = checkAlias(input.alias);
  if (!alias.ok) return { error: "invalid-alias" as const };
  return deps.db.transaction().execute(async (tx) => {
    await repo.renameGuest(tx, actor.guestId, alias.value);
    const data = { sessionId: actor.sessionId, guestId: actor.guestId, alias: alias.value };
    await publish(deps, tx, actor.venueId, "tables.guest.renamed", actor.sessionId, data);
    const guest = await guestOfToken(tx, token);
    return { guest: guest && guestView(guest) };
  });
}

/** Local al que pertenece una sesión (lo usa el tiempo real para validar al personal). */
export async function sessionVenue(db: Db, sessionId: string): Promise<string | undefined> {
  return (await repo.sessionById(db, sessionId))?.venue_id;
}
