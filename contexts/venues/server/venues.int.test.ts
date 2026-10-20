import { InMemoryEventBus, newId } from "@lo-mio/kernel";
import { createDb, type Db, migrate, type Tx } from "@lo-mio/postgres";
import { startPostgres } from "@lo-mio/postgres/testing";
import type { FastifyBaseLogger } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { events } from "../contracts/index.ts";
import { registerVenue } from "../domain/index.ts";
import { venues } from "./index.ts";
import { insertVenue } from "./repository.ts";
import * as service from "./service.ts";

const staff = (venueId: string, role: "waiter" | "admin" = "admin") =>
  ({ kind: "staff", staffId: newId(), venueId, role }) as const;

describe("Locales, mesas y catálogo", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  let bus: InMemoryEventBus<Tx>;
  const venueA = newId();
  const venueB = newId();
  const log = { warn: vi.fn() } as unknown as FastifyBaseLogger & {
    warn: ReturnType<typeof vi.fn>;
  };
  const cmd = () => ({ key: newId(), log });

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url);
    await migrate(db, { venues: venues.migrations });
    for (const id of [venueA, venueB]) {
      const venue = registerVenue({ id, name: `Local ${id.slice(-4)}`, country: "CL" });
      if (venue.ok) await insertVenue(db, venue.value);
    }
  });
  afterAll(async () => {
    await db.destroy();
    await pg.stop();
  });
  const deps = () => ({ db, bus });

  it("el administrador registra una mesa y se publica con su QR", async () => {
    bus = new InMemoryEventBus<Tx>(events);
    const result = await service.addTable(deps(), staff(venueA), { label: "5" }, cmd());
    expect(result).toMatchObject({ status: 201, body: { label: "5" } });
    const body = "body" in result ? (result.body as { id: string; qrCode: string }) : undefined;
    expect(bus.published.map((e) => [e.type, e.data])).toEqual([
      ["venues.table.registered", { tableId: body?.id, label: "5", qrCode: body?.qrCode }],
    ]);
    expect(await service.listTables(deps(), staff(venueA, "waiter"))).toEqual([body]);
  });

  it("dos mesas con el mismo nombre en un local responden 409; en otro local se permite", async () => {
    bus = new InMemoryEventBus<Tx>(events);
    expect(await service.addTable(deps(), staff(venueA), { label: "5" }, cmd())).toMatchObject({
      status: 409,
    });
    expect(await service.addTable(deps(), staff(venueB), { label: "5" }, cmd())).toMatchObject({
      status: 201,
    });
  });

  it("reintentar el registro con la misma clave no crea otra mesa", async () => {
    bus = new InMemoryEventBus<Tx>(events);
    const key = newId();
    const actor = staff(venueA);
    const first = await service.addTable(deps(), actor, { label: "Terraza" }, { key, log });
    const retry = await service.addTable(deps(), actor, { label: "Terraza" }, { key, log });
    expect(retry).toEqual(first);
    expect(bus.published).toHaveLength(1);
  });

  it("rotar el QR invalida el anterior y se publica", async () => {
    bus = new InMemoryEventBus<Tx>(events);
    const [table] = await service.listTables(deps(), staff(venueA));
    const rotated = await service.rotateTableQr(deps(), staff(venueA), String(table?.id), cmd());
    expect(rotated).toMatchObject({ status: 200, body: { id: table?.id } });
    const qrCode = "body" in rotated ? (rotated.body as { qrCode: string }).qrCode : "";
    expect(qrCode).not.toBe(table?.qrCode);
    expect(bus.published[0]?.type).toBe("venues.table.qr-rotated");
  });

  it("una mesa de otro local responde 404 y el intento queda registrado", async () => {
    bus = new InMemoryEventBus<Tx>(events);
    const [tableOfB] = await service.listTables(deps(), staff(venueB));
    const result = await service.rotateTableQr(deps(), staff(venueA), String(tableOfB?.id), cmd());
    expect(result).toMatchObject({ status: 404 });
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: tableOfB?.id, tableVenueId: venueB }),
      "intento de acceso a una mesa de otro local",
    );
    expect(bus.published).toEqual([]);
  });

  it("el catálogo acepta precios en la moneda del local y rechaza otras", async () => {
    bus = new InMemoryEventBus<Tx>(events);
    const schop = { name: "Schop", price: { amount: 4500, currency: "CLP" } };
    expect(await service.addProduct(deps(), staff(venueA), schop, cmd())).toMatchObject({
      status: 201,
    });
    const usd = await service.addProduct(
      deps(),
      staff(venueA),
      { name: "Vino", price: { amount: 10, currency: "USD" } },
      cmd(),
    );
    expect(usd).toMatchObject({
      status: 422,
      body: {
        type: "https://lo-mio.cl/problems/currency-mismatch",
        detail: "El precio debe estar en CLP",
      },
    });
    expect(await service.listProducts(deps(), staff(venueA, "waiter"))).toEqual([
      expect.objectContaining(schop),
    ]);
  });
});
