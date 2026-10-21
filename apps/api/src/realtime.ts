/**
 * Tiempo real del feed de una mesa (contrato: asyncapi/realtime.yaml).
 * Fan-out entre instancias: un suscriptor durable del bus (`realtime`) toma cada evento una vez y
 * hace pg_notify en su transacción; cada instancia escucha el canal y reenvía a sus sockets.
 */
import websocket from "@fastify/websocket";
import { claimsService } from "@lo-mio/claims/server";
import type { EventBus } from "@lo-mio/kernel";
import type { Db, Tx } from "@lo-mio/postgres";
import { type Actor, GUEST_COOKIE, STAFF_COOKIE } from "@lo-mio/server";
import { settlementService } from "@lo-mio/settlement/server";
import { staffService } from "@lo-mio/staff/server";
import { tablesService } from "@lo-mio/tables/server";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { sql } from "kysely";
import pg from "pg";

const CHANNEL = "lomio_realtime";
const REALTIME_TOPICS = [
  "claims.item.changed.v1",
  "settlement.balance.changed.v1",
  "tables.guest.joined.v1",
  "tables.guest.renamed.v1",
];

type Socket = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: "close", fn: () => void): void;
};
type Deps = { db: Db; bus: EventBus<Tx>; connectionString: string };

/** Comensal de la sesión o personal del local de la sesión; `undefined` si no corresponde. */
async function actorFor(
  db: Db,
  req: FastifyRequest,
  sessionId: string,
): Promise<Actor | undefined> {
  const guestToken = req.cookies[GUEST_COOKIE];
  if (guestToken) {
    const guest = await tablesService.authenticate(db, guestToken);
    return guest?.kind === "guest" && guest.sessionId === sessionId ? guest : undefined;
  }
  const staffToken =
    req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1] ?? req.cookies[STAFF_COOKIE];
  const staff = staffToken ? await staffService.authenticate(db, staffToken) : undefined;
  return staff && (await tablesService.sessionVenue(db, sessionId)) === staff.venueId
    ? staff
    : undefined;
}

/** Comensales desde tables (la fuente) con su saldo de settlement; sin saldo aún, cero. */
async function snapshotBalances(db: Db, actor: Actor, sessionId: string) {
  const guests = await tablesService.sessionGuests(db, sessionId);
  const amounts = new Map(
    (await settlementService.sessionBalances(db, actor, sessionId))?.map((b) => [
      b.guestId,
      b.balance,
    ]),
  );
  return guests.map(({ guestId, alias, currency }) => ({
    guestId,
    alias,
    balance: amounts.get(guestId) ?? { amount: 0, currency },
  }));
}

export async function registerRealtime(app: FastifyInstance, { db, bus, connectionString }: Deps) {
  const sockets = new Map<string, Set<(message: string) => void>>();

  // Relay durable: cada evento se notifica una vez, al confirmarse su transacción.
  for (const topic of REALTIME_TOPICS) {
    await bus.subscribe(topic, "realtime", async (event, tx) => {
      const { sessionId } = event.data as { sessionId: string };
      // ponytail: NOTIFY admite ~8 KB por mensaje; un ítem con decenas de dueños sigue entrando.
      const message = JSON.stringify({
        sessionId,
        type: "event",
        id: event.id,
        topic,
        data: event.data,
      });
      await sql`select pg_notify(${CHANNEL}, ${message})`.execute(tx);
    });
  }

  // Cada instancia escucha el canal con una conexión dedicada y reenvía a sus sockets.
  const listener = new pg.Client({ connectionString });
  await listener.connect();
  await listener.query(`listen ${CHANNEL}`);
  listener.on("notification", ({ payload }) => {
    const { sessionId, ...message } = JSON.parse(String(payload)) as { sessionId: string };
    for (const deliver of sockets.get(sessionId) ?? []) deliver(JSON.stringify(message));
  });
  app.addHook("onClose", async () => listener.end());

  await app.register(websocket);
  app.get<{ Params: { sessionId: string } }>(
    "/v1/sessions/:sessionId/events",
    { websocket: true },
    async (socket: Socket, req) => {
      const { sessionId } = req.params;
      const actor = await actorFor(db, req, sessionId);
      if (!actor) return socket.close(4401, "sesión de la mesa requerida");
      // Se suscribe antes de leer el snapshot (no se pierde lo que pase mientras tanto), pero lo
      // que llegue se retiene hasta enviarlo: el snapshot va primero; el cliente descarta por versión.
      const pending: string[] = [];
      let send = (message: string): unknown => pending.push(message);
      const deliver = (message: string) => send(message);
      const subscribers = sockets.get(sessionId) ?? new Set();
      subscribers.add(deliver);
      sockets.set(sessionId, subscribers);
      socket.on("close", () => subscribers.delete(deliver));
      const items = await claimsService.sessionFeed(db, actor, sessionId);
      const balances = await snapshotBalances(db, actor, sessionId);
      socket.send(JSON.stringify({ type: "snapshot", items, balances }));
      send = (message) => socket.send(message);
      for (const message of pending) socket.send(message);
    },
  );
}
