import { createEvent, type EventEnvelope, InMemoryEventBus, newId } from "@lo-mio/kernel";
import { createDb, type Db, migrate, type Tx } from "@lo-mio/postgres";
import { startPostgres } from "@lo-mio/postgres/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { events } from "../contracts/index.ts";
import { settlement } from "./index.ts";
import { sessionBalances } from "./service.ts";

const catalog = {
  ...events,
  "tables.guest.joined.v1": z.unknown(),
  "tables.guest.renamed.v1": z.unknown(),
  "claims.item.changed.v1": z.unknown(),
};
const clp = (amount: number) => ({ amount, currency: "CLP" });

describe("Saldo por comensal", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  let bus: InMemoryEventBus<Tx>;
  const venue = newId();
  const session = newId();
  const [ana, beto, caro, dani] = [newId(), newId(), newId(), newId()];
  const staff = { kind: "staff", staffId: newId(), venueId: venue, role: "waiter" } as const;
  const emit = (type: string, data: unknown) =>
    db.transaction().execute((tx) =>
      bus.publish(createEvent({ type, version: 1, venueId: venue, aggregateId: session, data }), {
        tx,
      }),
    );
  const itemChanged = (
    itemId: string,
    version: number,
    price: number,
    shares: [string, number][],
  ) =>
    emit("claims.item.changed", {
      itemId,
      sessionId: session,
      name: "x",
      price: clp(price),
      status: "claimed",
      version,
      shares: shares.map(([guestId, amount]) => ({ guestId, portions: 1, amount: clp(amount) })),
    });
  const balanceOf = async (guestId: string) =>
    (await sessionBalances(db, staff, session))?.find((b) => b.guestId === guestId)?.balance;
  const published = () =>
    bus.published.filter((e: EventEnvelope) => e.type === "settlement.balance.changed");

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url);
    await migrate(db, { settlement: settlement.migrations });
    bus = new InMemoryEventBus<Tx>(catalog);
    await settlement.subscribe({ db, bus });
    for (const [guestId, alias] of [
      [ana, "Ana"],
      [beto, "Beto"],
      [caro, "Caro"],
      [dani, "Dani"],
    ] as const) {
      await emit("tables.guest.joined", { sessionId: session, guestId, alias, currency: "CLP" });
    }
  });
  afterAll(async () => {
    await db.destroy();
    await pg.stop();
  });

  it("una cerveza de 4.500 y un tercio de una tabla de 12.000 suman 8.500", async () => {
    await itemChanged(newId(), 2, 4500, [[ana, 4500]]);
    await itemChanged(newId(), 2, 12_000, [
      [ana, 4000],
      [beto, 4000],
      [caro, 4000],
    ]);
    expect(await balanceOf(ana)).toEqual(clp(8500));
    expect(await balanceOf(beto)).toEqual(clp(4000));
  });

  it("un comensal sin ítems tiene saldo cero en la moneda de su sesión", async () => {
    expect(await balanceOf(dani)).toEqual(clp(0));
  });

  it("al repartir un ítem que era de uno solo, baja su saldo y sube el del otro", async () => {
    const item = newId();
    await itemChanged(item, 2, 6000, [[dani, 6000]]);
    const before = published().length;
    await itemChanged(item, 3, 6000, [
      [dani, 3000],
      [caro, 3000],
    ]);
    expect(await balanceOf(dani)).toEqual(clp(3000));
    expect(await balanceOf(caro)).toEqual(clp(7000));
    expect(
      published()
        .slice(before)
        .map((e) => (e.data as { guestId: string }).guestId)
        .sort(),
    ).toEqual([caro, dani].sort());
  });

  it("una versión vieja que llega tarde no pisa la vigente", async () => {
    const item = newId();
    await itemChanged(item, 3, 2000, [
      [beto, 1000],
      [caro, 1000],
    ]);
    const betoBefore = await balanceOf(beto);
    await itemChanged(item, 2, 2000, [[beto, 2000]]);
    expect(await balanceOf(beto)).toEqual(betoBefore);
  });

  it("un comensal de otra sesión no ve los saldos de esta", async () => {
    const outsider = {
      kind: "guest",
      guestId: newId(),
      sessionId: newId(),
      venueId: venue,
    } as const;
    expect(await sessionBalances(db, outsider, session)).toBeUndefined();
  });
});
