import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bearer, command, startApi } from "./testing.ts";

describe("Mesas y comensales por HTTP", () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let admin: string;
  let table: { id: string; qrCode: string };

  beforeAll(async () => {
    api = await startApi();
    admin = (await api.staff(await api.newVenue("Bar A"), "admin")).token;
    const res = await api.app.inject({
      method: "POST",
      url: "/v1/venues/current/tables",
      headers: command(admin),
      payload: { label: "5" },
    });
    table = res.json();
    // venues → tables viaja por el bus: se espera a que tables proyecte la mesa (sin consumir el
    // límite de solicitudes del endpoint de unión).
    await vi.waitFor(
      async () => {
        const known = await sql<{
          n: number;
        }>`select count(*)::int as n from tables_registry where qr_code = ${table.qrCode}`.execute(
          api.db,
        );
        expect(known.rows[0]?.n).toBe(1);
      },
      { timeout: 15_000, interval: 200 },
    );
  });
  afterAll(() => api.stop());

  it("el comensal se une por QR y recibe una cookie que los scripts no pueden leer", async () => {
    const res = await api.app.inject({
      method: "POST",
      url: `/v1/join/${table.qrCode}`,
      payload: { alias: "Ana" },
    });
    expect(res.json()).toMatchObject({ alias: "Ana", tableLabel: "5" });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/^lomio_guest=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    const token = cookie.match(/^lomio_guest=([^;]+)/)?.[1] ?? "";
    const me = await api.app.inject({
      method: "GET",
      url: "/v1/guests/me",
      cookies: { lomio_guest: token },
    });
    expect(me.json()).toMatchObject({ alias: "Ana" });
  });

  it("sin cookie de comensal, las operaciones del comensal responden 401", async () => {
    expect((await api.app.inject({ method: "GET", url: "/v1/guests/me" })).statusCode).toBe(401);
  });

  it("un QR inexistente responde 404 con un error claro", async () => {
    const res = await api.app.inject({
      method: "POST",
      url: "/v1/join/codigo-que-no-existe",
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ type: "https://lo-mio.cl/problems/unknown-qr" });
  });

  it("el mesero abre la mesa ya abierta y ve la misma sesión; otro local no la encuentra", async () => {
    const first = await api.app.inject({
      method: "POST",
      url: `/v1/tables/${table.id}/session`,
      headers: bearer(admin),
    });
    const second = await api.app.inject({
      method: "POST",
      url: `/v1/tables/${table.id}/session`,
      headers: bearer(admin),
    });
    expect(second.json().id).toBe(first.json().id);
    const other = (await api.staff(await api.newVenue("Bar B"), "waiter")).token;
    expect(
      (
        await api.app.inject({
          method: "POST",
          url: `/v1/tables/${table.id}/session`,
          headers: bearer(other),
        })
      ).statusCode,
    ).toBe(404);
  });
});
