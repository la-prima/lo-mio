import { createEvent, type EventEnvelope, InMemoryEventBus, newId } from "@lo-mio/kernel";
import { createDb, type Db, migrate, type Tx } from "@lo-mio/postgres";
import { startPostgres } from "@lo-mio/postgres/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { events } from "../contracts/index.ts";
import { fold, type ItemEvent } from "../domain/index.ts";
import { claims } from "./index.ts";
import * as repo from "./repository.ts";
import * as service from "./service.ts";

const catalog = {
  ...events,
  "tables.item.seated.v1": z.unknown(),
  "tables.guest.joined.v1": z.unknown(),
  "tables.guest.renamed.v1": z.unknown(),
};

describe("Reclamos y repartos", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  let bus: InMemoryEventBus<Tx>;
  const venue = newId();
  const session = newId();
  const deps = () => ({ db, bus });
  const emit = (type: string, data: unknown) =>
    db.transaction().execute((tx) =>
      bus.publish(createEvent({ type, version: 1, venueId: venue, aggregateId: session, data }), {
        tx,
      }),
    );
  const guest = async (alias: string, sessionId = session) => {
    const guestId = newId();
    await emit("tables.guest.joined", { sessionId, guestId, alias });
    return { kind: "guest", guestId, sessionId, venueId: venue } as const;
  };
  /** Ítem nuevo en la mesa; devuelve su id en claims. */
  const seat = async (name: string, amount: number) => {
    const ref = `manual:${newId()}#1`;
    await emit("tables.item.seated", {
      sessionId: session,
      tableId: newId(),
      itemId: ref,
      posItemId: ref,
      name,
      unitPrice: { amount, currency: "CLP" },
    });
    const feed =
      (await service.sessionFeed(
        db,
        { kind: "staff", staffId: newId(), venueId: venue, role: "waiter" },
        session,
      )) ?? [];
    return String(feed.find((i) => i.name === name)?.itemId);
  };
  const changed = () =>
    bus.published.filter((e: EventEnvelope) => e.type === "claims.item.changed");
  const run = (
    actor: Awaited<ReturnType<typeof guest>>,
    itemId: string,
    cmd: Parameters<typeof service.command>[3],
  ) => service.command(deps(), actor, itemId, cmd, newId());

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url);
    await migrate(db, { claims: claims.migrations });
    bus = new InMemoryEventBus<Tx>(catalog);
    await claims.subscribe(deps());
  });
  afterAll(async () => {
    await db.destroy();
    await pg.stop();
  });

  it("un ítem nuevo aparece sin dueño y se publica su estado", async () => {
    const itemId = await seat("Agua", 2000);
    expect(changed().at(-1)?.data).toMatchObject({
      itemId,
      status: "unowned",
      version: 1,
      shares: [],
    });
  });

  it("'lo mío': la cerveza queda del comensal por su precio", async () => {
    const ana = await guest("Ana");
    const itemId = await seat("Schop", 4500);
    expect(await run(ana, itemId, { type: "claim", guestId: ana.guestId })).toMatchObject({
      status: 200,
      body: { status: "claimed", shares: [{ alias: "Ana", amount: { amount: 4500 } }] },
    });
  });

  it("dos reclamos simultáneos del mismo ítem: uno gana, el otro recibe 409", async () => {
    const [a, b] = [await guest("A"), await guest("B")];
    const itemId = await seat("Pisco", 5000);
    const results = await Promise.all(
      [a, b].map((g) => run(g, itemId, { type: "claim", guestId: g.guestId })),
    );
    expect(results.map((r) => ("status" in r ? r.status : 0)).sort()).toEqual([200, 409]);
    expect((await repo.findItem(db, itemId))?.state.owners).toHaveLength(1);
  });

  it("una tabla de 10.000 entre 3 en partes iguales; luego un cuarto se suma", async () => {
    const [a, b, c, d] = [await guest("A"), await guest("B"), await guest("C"), await guest("D")];
    const itemId = await seat("Tabla", 10_000);
    const owners = [a, b, c].map((g) => ({ guestId: g.guestId, portions: 1 }));
    const shared = await run(a, itemId, { type: "share", guestId: a.guestId, owners });
    expect(
      "body" in shared &&
        (shared.body as { shares: { amount: { amount: number } }[] }).shares.map(
          (s) => s.amount.amount,
        ),
    ).toEqual([3334, 3333, 3333]);
    const joined = await run(d, itemId, { type: "join", guestId: d.guestId });
    expect("body" in joined && (joined.body as { shares: unknown[] }).shares).toHaveLength(4);
  });

  it("no se puede repartir con alguien que no está en la mesa", async () => {
    const a = await guest("A");
    const itemId = await seat("Papas", 6000);
    const owners = [
      { guestId: a.guestId, portions: 1 },
      { guestId: newId(), portions: 1 },
    ];
    expect(await run(a, itemId, { type: "share", guestId: a.guestId, owners })).toMatchObject({
      status: 422,
      body: { type: "https://lo-mio.cl/problems/unknown-guest" },
    });
  });

  it("un comensal de otra mesa no ve ni toca los ítems de esta", async () => {
    const outsider = await guest("X", newId());
    const itemId = await seat("Vino", 9000);
    expect(await run(outsider, itemId, { type: "claim", guestId: outsider.guestId })).toMatchObject(
      { status: 404 },
    );
    expect(await service.sessionFeed(db, outsider, session)).toBeUndefined();
  });

  it("reintentar con la misma clave no repite el reclamo; un evento repetido no duplica el ítem", async () => {
    const a = await guest("A");
    const itemId = await seat("Café", 1500);
    const key = newId();
    const first = await service.command(
      deps(),
      a,
      itemId,
      { type: "claim", guestId: a.guestId },
      key,
    );
    expect(
      await service.command(deps(), a, itemId, { type: "claim", guestId: a.guestId }, key),
    ).toEqual(first);
    const before = (await service.sessionFeed(db, a, session))?.length;
    const ref = `manual:${newId()}#1`;
    for (let i = 0; i < 2; i++)
      await emit("tables.item.seated", {
        sessionId: session,
        tableId: newId(),
        itemId: ref,
        posItemId: ref,
        name: "Doble",
        unitPrice: { amount: 1, currency: "CLP" },
      });
    expect((await service.sessionFeed(db, a, session))?.length).toBe(Number(before) + 1);
  });

  it("el historial del ítem cuenta cada cambio con su autor y reconstruye el estado vigente", async () => {
    const [a, b] = [await guest("A"), await guest("B")];
    const itemId = await seat("Ceviche", 12_000);
    await run(a, itemId, { type: "claim", guestId: a.guestId });
    await run(b, itemId, { type: "join", guestId: b.guestId });
    const manager = { kind: "staff", staffId: newId(), venueId: venue, role: "manager" } as const;
    const history = (await service.itemHistory(db, manager, itemId)) ?? [];
    expect(history.map((h) => [h.version, h.type, h.actor.kind])).toEqual([
      [1, "added", "system"],
      [2, "claimed", "guest"],
      [3, "joined", "guest"],
    ]);
    const rebuilt = fold(
      itemId,
      history.map((h) => ({ type: h.type, ...h.data }) as ItemEvent),
    );
    expect(rebuilt).toEqual((await repo.findItem(db, itemId))?.state);
    expect(await service.itemHistory(db, { ...manager, venueId: newId() }, itemId)).toBeUndefined();
  });
});
