import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { command, startApi } from "./testing.ts";

type Message = {
  type: string;
  topic?: string;
  items?: { itemId: string; status: string }[];
  data?: Record<string, unknown>;
};

describe("Feed en tiempo real entre instancias", () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let other: Awaited<ReturnType<Awaited<ReturnType<typeof startApi>>["anotherInstance"]>>;
  let guest: { cookie: string; sessionId: string };
  let waiter: string;
  let tableId: string;

  beforeAll(async () => {
    api = await startApi();
    other = await api.anotherInstance();
    const venueId = await api.newVenue("Bar A");
    const admin = (await api.staff(venueId, "admin")).token;
    waiter = (await api.staff(venueId, "waiter")).token;
    const table = (
      await api.app.inject({
        method: "POST",
        url: "/v1/venues/current/tables",
        headers: command(admin),
        payload: { label: "5" },
      })
    ).json();
    tableId = table.id;
    await vi.waitFor(
      async () => {
        const { rows } = await sql<{
          n: number;
        }>`select (select count(*) from pos_tables where table_id = ${tableId}) + (select count(*) from tables_registry where table_id = ${tableId}) as n`.execute(
          api.db,
        );
        expect(Number(rows[0]?.n)).toBe(2);
      },
      { timeout: 15_000, interval: 200 },
    );
    const joined = await api.app.inject({
      method: "POST",
      url: `/v1/join/${table.qrCode}`,
      payload: { alias: "Ana" },
    });
    guest = {
      cookie: String(joined.headers["set-cookie"]).match(/^lomio_guest=([^;]+)/)?.[1] ?? "",
      sessionId: joined.json().sessionId,
    };
  });
  afterAll(() => api.stop());

  it("conectado a la instancia B, el comensal recibe el snapshot y luego, en vivo, lo que pasa por la A", async () => {
    const messages: Message[] = [];
    const socket = await other.injectWS(`/v1/sessions/${guest.sessionId}/events`, {
      headers: { cookie: `lomio_guest=${guest.cookie}` },
    });
    socket.on("message", (raw: Buffer) => messages.push(JSON.parse(raw.toString())));
    await vi.waitFor(() => expect(messages[0]?.type).toBe("snapshot"));

    await api.app.inject({
      method: "POST",
      url: "/v1/pos/manual/items",
      headers: command(waiter),
      payload: {
        tableId,
        name: "Schop",
        unitPrice: { amount: 4500, currency: "CLP" },
        quantity: 1,
      },
    });
    const itemEvent = () => messages.find((m) => m.topic === "claims.item.changed.v1");
    await vi.waitFor(
      () => expect(itemEvent()?.data).toMatchObject({ status: "unowned", name: "Schop" }),
      { timeout: 5_000 },
    );

    const itemId = String(itemEvent()?.data?.itemId);
    await api.app.inject({
      method: "POST",
      url: `/v1/items/${itemId}/claim`,
      headers: { "idempotency-key": crypto.randomUUID() },
      cookies: { lomio_guest: guest.cookie },
    });
    await vi.waitFor(
      () =>
        expect(
          messages.find((m) => m.topic === "settlement.balance.changed.v1")?.data,
        ).toMatchObject({ balance: { amount: 4500 } }),
      { timeout: 5_000 },
    );
    socket.terminate();
  });

  it("al reconectarse recibe el snapshot completo (sin duplicar acciones)", async () => {
    const messages: Message[] = [];
    const socket = await api.app.injectWS(`/v1/sessions/${guest.sessionId}/events`, {
      headers: { cookie: `lomio_guest=${guest.cookie}` },
    });
    socket.on("message", (raw: Buffer) => messages.push(JSON.parse(raw.toString())));
    await vi.waitFor(() =>
      expect(messages[0]?.items).toEqual([expect.objectContaining({ status: "claimed" })]),
    );
    socket.terminate();
  });

  it("sin la cookie de un comensal de esa sesión, el socket se cierra", async () => {
    const socket = await api.app.injectWS(`/v1/sessions/${guest.sessionId}/events`);
    const code = await new Promise<number>((resolve) =>
      socket.on("close", (c: number) => resolve(c)),
    );
    expect(code).toBe(4401);
  });
});
