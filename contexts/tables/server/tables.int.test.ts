import { createEvent, type EventEnvelope, InMemoryEventBus, newId } from "@lo-mio/kernel";
import { createDb, type Db, migrate, type Tx } from "@lo-mio/postgres";
import { startPostgres } from "@lo-mio/postgres/testing";
import type { FastifyBaseLogger } from "fastify";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { events } from "../contracts/index.ts";
import { tables } from "./index.ts";
import * as service from "./service.ts";

const any = z.unknown();
const catalog = {
  ...events,
  "venues.table.registered.v1": any,
  "venues.table.qr-rotated.v1": any,
  "pos.item.received.v1": any,
};

describe("Sesiones de mesa y comensales", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  let bus: InMemoryEventBus<Tx>;
  const venue = newId();
  const log = { warn: vi.fn() } as unknown as FastifyBaseLogger;
  const waiter = () =>
    ({ kind: "staff", staffId: newId(), venueId: venue, role: "waiter" }) as const;
  const deps = () => ({ db, bus });
  const published = (type: string) => bus.published.filter((e: EventEnvelope) => e.type === type);
  const emit = (type: string, data: unknown) =>
    db.transaction().execute((tx) =>
      bus.publish(createEvent({ type, version: 1, venueId: venue, aggregateId: newId(), data }), {
        tx,
      }),
    );

  /** Mesa nueva registrada en venues; devuelve id y QR. */
  const newTable = async (label: string) => {
    const table = { tableId: newId(), label, qrCode: `qr-${newId()}`, currency: "CLP" };
    await emit("venues.table.registered", table);
    return table;
  };

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url);
    await migrate(db, { tables: tables.migrations });
    bus = new InMemoryEventBus<Tx>(catalog);
    await tables.subscribe(deps());
  });
  afterAll(async () => {
    await db.destroy();
    await pg.stop();
  });

  it("dos meseros abren la misma mesa al mismo tiempo y ambos ven una sola sesión", async () => {
    const { tableId } = await newTable("3");
    const sessions = await Promise.all(
      Array.from({ length: 5 }, () => service.openTableSession(deps(), waiter(), tableId, log)),
    );
    expect(new Set(sessions.map((s) => s?.id)).size).toBe(1);
    const { rows } = await sql<{
      n: number;
    }>`select count(*)::int as n from table_sessions where table_id = ${tableId}`.execute(db);
    expect(rows[0]?.n).toBe(1);
    expect(
      published("tables.session.opened").filter(
        (e) => (e.data as { tableId: string }).tableId === tableId,
      ),
    ).toHaveLength(1);
  });

  it("el primer ítem del POS abre la mesa y cada unidad queda en la sesión", async () => {
    const { tableId } = await newTable("4");
    await emit("pos.item.received", {
      posItemId: "manual:x",
      tableId,
      name: "Schop",
      unitPrice: { amount: 4500, currency: "CLP" },
      quantity: 2,
    });
    const seated = published("tables.item.seated").filter(
      (e) => (e.data as { tableId: string }).tableId === tableId,
    );
    expect(seated.map((e) => (e.data as { itemId: string }).itemId)).toEqual([
      "manual:x#1",
      "manual:x#2",
    ]);
    const session = await service.openTableSession(deps(), waiter(), tableId, log);
    expect(new Set(seated.map((e) => (e.data as { sessionId: string }).sessionId))).toEqual(
      new Set([session?.id]),
    );
  });

  it("un ítem de una mesa que todavía no llegó desde venues falla para que el bus reintente", async () => {
    await expect(
      emit("pos.item.received", {
        posItemId: "manual:y",
        tableId: newId(),
        name: "x",
        unitPrice: {},
        quantity: 1,
      }),
    ).rejects.toThrow(/aún desconocida/);
  });

  it("un comensal se une por QR, anónimo y con alias por defecto; recargar no crea otro", async () => {
    const { qrCode } = await newTable("5");
    const first = await service.joinTable(deps(), qrCode, {}, undefined);
    if (!first || "error" in first) throw new Error("no se unió");
    expect(first.guest).toMatchObject({ alias: "Comensal 1", tableLabel: "5" });
    const reload = await service.joinTable(deps(), qrCode, {}, first.token);
    expect(reload && !("error" in reload) && reload.guest.guestId).toBe(first.guest.guestId);
    const second = await service.joinTable(deps(), qrCode, { alias: "Ana" }, undefined);
    expect(second && !("error" in second) && second.guest.alias).toBe("Ana");
  });

  it("el identificador de una sesión ya cerrada entra como comensal nuevo en la sesión actual", async () => {
    const { qrCode, tableId } = await newTable("6");
    const old = await service.joinTable(deps(), qrCode, {}, undefined);
    if (!old || "error" in old) throw new Error("no se unió");
    await sql`update table_sessions set closed_at = now() where table_id = ${tableId}`.execute(db);
    expect(await service.authenticate(db, old.token)).toBeUndefined();
    const fresh = await service.joinTable(deps(), qrCode, {}, old.token);
    if (!fresh || "error" in fresh) throw new Error("no se unió");
    expect(fresh.guest.guestId).not.toBe(old.guest.guestId);
    expect(fresh.guest.sessionId).not.toBe(old.guest.sessionId);
  });

  it("un QR inexistente o revocado no crea ninguna sesión", async () => {
    const { qrCode, tableId } = await newTable("7");
    await emit("venues.table.qr-rotated", { tableId, qrCode: `qr-${newId()}` });
    expect(await service.joinTable(deps(), qrCode, {}, undefined)).toBeUndefined();
    expect(await service.joinTable(deps(), "no-existe-este-codigo", {}, undefined)).toBeUndefined();
    const { rows } = await sql<{
      n: number;
    }>`select count(*)::int as n from table_sessions where table_id = ${tableId}`.execute(db);
    expect(rows[0]?.n).toBe(0);
  });

  it("el comensal cambia su alias y se publica; un alias vacío se rechaza", async () => {
    const { qrCode } = await newTable("8");
    const joined = await service.joinTable(deps(), qrCode, {}, undefined);
    if (!joined || "error" in joined) throw new Error("no se unió");
    const actor = await service.authenticate(db, joined.token);
    if (actor?.kind !== "guest") throw new Error("sin actor");
    expect(await service.renameGuest(deps(), actor, joined.token, { alias: "Bea" })).toMatchObject({
      guest: { alias: "Bea" },
    });
    expect(published("tables.guest.renamed").at(-1)?.data).toMatchObject({
      guestId: actor.guestId,
      alias: "Bea",
    });
    expect(await service.renameGuest(deps(), actor, joined.token, { alias: "   " })).toEqual({
      error: "invalid-alias",
    });
  });
});
