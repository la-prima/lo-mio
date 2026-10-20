import { createEvent, type EventEnvelope, InMemoryEventBus, newId } from "@lo-mio/kernel";
import { createDb, type Db, migrate, type Tx } from "@lo-mio/postgres";
import { startPostgres } from "@lo-mio/postgres/testing";
import type { FastifyBaseLogger } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { events } from "../contracts/index.ts";
import { pos } from "./index.ts";
import { loadManualItems } from "./service.ts";

const tableRegistered = z.strictObject({
  tableId: z.uuid(),
  label: z.string(),
  qrCode: z.string(),
  currency: z.string(),
});
const catalog = { ...events, "venues.table.registered.v1": tableRegistered };

describe("Carga manual de ítems", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  let bus: InMemoryEventBus<Tx>;
  const venueA = newId();
  const venueB = newId();
  const tableOfA = newId();
  const log = { warn: vi.fn() } as unknown as FastifyBaseLogger & {
    warn: ReturnType<typeof vi.fn>;
  };
  const waiter = (venueId: string) =>
    ({ kind: "staff", staffId: newId(), venueId, role: "waiter" }) as const;
  const beer = {
    tableId: tableOfA,
    name: "Schop",
    unitPrice: { amount: 4500, currency: "CLP" },
    quantity: 2,
  };
  const received = () => bus.published.filter((e: EventEnvelope) => e.type === "pos.item.received");

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url);
    await migrate(db, { pos: pos.migrations });
    bus = new InMemoryEventBus<Tx>(catalog);
    await pos.subscribe({ db, bus });
    const registered = createEvent({
      type: "venues.table.registered",
      version: 1,
      venueId: venueA,
      aggregateId: tableOfA,
      data: { tableId: tableOfA, label: "5", qrCode: "q", currency: "CLP" },
    });
    await db.transaction().execute((tx) => bus.publish(registered, { tx }));
  });
  afterAll(async () => {
    await db.destroy();
    await pg.stop();
  });

  it("el mesero carga 2 cervezas y se publica un ítem recibido con cantidad 2", async () => {
    const result = await loadManualItems({ db, bus }, waiter(venueA), beer, { key: newId(), log });
    expect(result).toMatchObject({ status: 202 });
    const [event] = received();
    expect(event?.data).toMatchObject({
      tableId: tableOfA,
      name: "Schop",
      quantity: 2,
      unitPrice: { amount: 4500 },
    });
    expect((event?.data as { posItemId?: string } | undefined)?.posItemId).toMatch(/^manual:/);
  });

  it("una mesa de otro local responde 404 y el intento queda registrado", async () => {
    const before = received().length;
    expect(
      await loadManualItems({ db, bus }, waiter(venueB), beer, { key: newId(), log }),
    ).toMatchObject({ status: 404 });
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: tableOfA }),
      "intento de cargar ítems en una mesa de otro local",
    );
    expect(received()).toHaveLength(before);
  });

  it("un precio en otra moneda que la del local se rechaza con 422", async () => {
    const usd = { ...beer, unitPrice: { amount: 5, currency: "USD" } };
    expect(
      await loadManualItems({ db, bus }, waiter(venueA), usd, { key: newId(), log }),
    ).toMatchObject({
      status: 422,
      body: { type: "https://lo-mio.cl/problems/currency-mismatch" },
    });
  });

  it("una mesa que pos todavía no conoce responde 404", async () => {
    const unknown = { ...beer, tableId: newId() };
    expect(
      await loadManualItems({ db, bus }, waiter(venueA), unknown, { key: newId(), log }),
    ).toMatchObject({ status: 404 });
  });
});
