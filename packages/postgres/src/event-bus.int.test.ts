import { createEvent, type EventEnvelope, newId } from "@lo-mio/kernel";
import { sql } from "kysely";
import type { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createBoss, createDb, type Db, migrate, PgBossEventBus } from "./index.ts";
import { startPostgres } from "./testing.ts";

const payload = z.strictObject({ n: z.int() });
const catalog = Object.fromEntries(
  ["rollback", "fanout", "retry", "duplicate"].map((t) => [`test.${t}.happened.v1`, payload]),
);
const event = (type: string, data: unknown = { n: 1 }) =>
  createEvent({ type, version: 1, venueId: newId(), aggregateId: newId(), data });

describe("Bus de eventos sobre Postgres", () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>;
  let db: Db;
  let boss: PgBoss;
  let bus: PgBossEventBus;

  beforeAll(async () => {
    pg = await startPostgres();
    db = createDb(pg.url);
    await migrate(db);
    await sql`create table effects (event_id uuid not null)`.execute(db);
    boss = createBoss(pg.url);
    await boss.start();
    bus = new PgBossEventBus(boss, db, catalog);
  });
  afterAll(async () => {
    await boss.stop({ graceful: false });
    await db.destroy();
    await pg.stop();
  });

  const effectsOf = async (id: string) =>
    (
      await sql<{
        n: number;
      }>`select count(*)::int as n from effects where event_id = ${id}`.execute(db)
    ).rows[0]?.n;

  it("un evento publicado en una transacción que hace rollback no se entrega", async () => {
    const received: string[] = [];
    await bus.subscribe("test.rollback.happened.v1", "probe", async (e) => {
      received.push(e.id);
    });
    const discarded = event("test.rollback.happened");
    const committed = event("test.rollback.happened");

    await expect(
      db.transaction().execute(async (tx) => {
        await bus.publish(discarded, { tx });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    await db.transaction().execute((tx) => bus.publish(committed, { tx }));

    await vi.waitFor(() => expect(received).toContain(committed.id), { timeout: 15_000 });
    expect(received).not.toContain(discarded.id);
  });

  it("cada suscriptor recibe su propia copia del evento", async () => {
    const received: string[] = [];
    for (const subscriber of ["settlement", "gateway"]) {
      await bus.subscribe("test.fanout.happened.v1", subscriber, async () => {
        received.push(subscriber);
      });
    }
    await db.transaction().execute((tx) => bus.publish(event("test.fanout.happened"), { tx }));

    await vi.waitFor(() => expect(received.sort()).toEqual(["gateway", "settlement"]), {
      timeout: 15_000,
    });
  });

  it("si el handler falla se reintenta, y sus efectos del intento fallido no quedan", async () => {
    let attempts = 0;
    await bus.subscribe("test.retry.happened.v1", "probe", async (e, tx) => {
      attempts++;
      await sql`insert into effects (event_id) values (${e.id})`.execute(tx);
      if (attempts === 1) throw new Error("falla transitoria");
    });
    const e = event("test.retry.happened");
    await db.transaction().execute((tx) => bus.publish(e, { tx }));

    await vi.waitFor(async () => expect(attempts).toBe(2), { timeout: 30_000 });
    await vi.waitFor(async () => expect(await effectsOf(e.id)).toBe(1), { timeout: 5_000 });
  });

  it("el mismo evento entregado dos veces se aplica una sola vez", async () => {
    const handled: EventEnvelope[] = [];
    await bus.subscribe("test.duplicate.happened.v1", "probe", async (e, tx) => {
      handled.push(e);
      await sql`insert into effects (event_id) values (${e.id})`.execute(tx);
    });
    const e = event("test.duplicate.happened");
    await db.transaction().execute(async (tx) => {
      await bus.publish(e, { tx });
      await bus.publish(e, { tx });
    });

    await vi.waitFor(async () => expect(await effectsOf(e.id)).toBe(1), { timeout: 15_000 });
    await new Promise((r) => setTimeout(r, 1_000));
    expect(await effectsOf(e.id)).toBe(1);
    expect(handled).toHaveLength(1);
  });

  it("rechaza eventos no declarados o inválidos antes de tocar la transacción", async () => {
    for (const e of [event("test.unknown.happened"), event("test.fanout.happened", { n: "1" })]) {
      await expect(db.transaction().execute((tx) => bus.publish(e, { tx }))).rejects.toThrow(
        /no declarado|no cumple su contrato/,
      );
    }
  });
});
