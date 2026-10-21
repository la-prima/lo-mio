import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { command, startApi } from "./testing.ts";

type Item = {
  itemId: string;
  status: string;
  shares: { alias: string; amount: { amount: number } }[];
};

describe("Reclamar por HTTP, de la carga del mesero al feed del comensal", () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let waiter: string;
  let guest: { cookie: string; sessionId: string };
  let tableId: string;

  beforeAll(async () => {
    api = await startApi();
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

  const feed = async () =>
    (
      await api.app.inject({
        method: "GET",
        url: `/v1/sessions/${guest.sessionId}/items`,
        cookies: { lomio_guest: guest.cookie },
      })
    ).json() as Item[];

  it("el mesero carga 2 cervezas y el comensal ve 2 ítems sin dueño en su feed", async () => {
    const load = await api.app.inject({
      method: "POST",
      url: "/v1/pos/manual/items",
      headers: command(waiter),
      payload: {
        tableId,
        name: "Schop",
        unitPrice: { amount: 4500, currency: "CLP" },
        quantity: 2,
      },
    });
    expect(load.statusCode).toBe(202);
    // pos → tables → claims viaja por el bus (pg-boss): la spec pide menos de 5 segundos.
    await vi.waitFor(
      async () => expect((await feed()).filter((i) => i.status === "unowned")).toHaveLength(2),
      { timeout: 5_000, interval: 100 },
    );
  });

  it("el comensal reclama una: queda suya por su precio; la otra sigue sin dueño", async () => {
    const [first] = await feed();
    const res = await api.app.inject({
      method: "POST",
      url: `/v1/items/${first?.itemId}/claim`,
      headers: { "idempotency-key": crypto.randomUUID() },
      cookies: { lomio_guest: guest.cookie },
    });
    expect(res.json()).toMatchObject({
      status: "claimed",
      shares: [{ alias: "Ana", amount: { amount: 4500 } }],
    });
    expect((await feed()).map((i) => i.status).sort()).toEqual(["claimed", "unowned"]);
  });

  it("el saldo del comensal refleja su reclamo (claims → settlement por el bus)", async () => {
    await vi.waitFor(
      async () => {
        const res = await api.app.inject({
          method: "GET",
          url: `/v1/sessions/${guest.sessionId}/balances`,
          cookies: { lomio_guest: guest.cookie },
        });
        expect(res.json()).toEqual([
          expect.objectContaining({ alias: "Ana", balance: { amount: 4500, currency: "CLP" } }),
        ]);
      },
      { timeout: 5_000, interval: 100 },
    );
  });
});
