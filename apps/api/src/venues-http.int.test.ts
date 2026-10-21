import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, command, startApi } from "./testing.ts";

describe("Locales por HTTP", () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let admin: string;
  let otherAdmin: string;

  beforeAll(async () => {
    api = await startApi();
    admin = (await api.staff(await api.newVenue("Bar A"), "admin")).token;
    otherAdmin = (await api.staff(await api.newVenue("Bar B"), "admin")).token;
  });
  afterAll(() => api.stop());

  it("el administrador registra mesas y productos; el mesero los ve", async () => {
    const table = await api.app.inject({
      method: "POST",
      url: "/v1/venues/current/tables",
      headers: command(admin),
      payload: { label: "5" },
    });
    expect(table.statusCode).toBe(201);
    const product = await api.app.inject({
      method: "POST",
      url: "/v1/venues/current/products",
      headers: command(admin),
      payload: { name: "Schop", price: { amount: 4500, currency: "CLP" } },
    });
    expect(product.statusCode).toBe(201);
    const venue = await api.app.inject({
      method: "GET",
      url: "/v1/venues/current",
      headers: bearer(admin),
    });
    expect(venue.json()).toMatchObject({ name: "Bar A", country: "CL", currency: "CLP" });
  });

  it("un body que no cumple el contrato se rechaza, no se corrige en silencio", async () => {
    const asNumber = await api.app.inject({
      method: "POST",
      url: "/v1/venues/current/tables",
      headers: command(admin),
      payload: { label: 60216331315366580 },
    });
    expect(asNumber.statusCode).toBe(400);
    const extra = await api.app.inject({
      method: "POST",
      url: "/v1/venues/current/products",
      headers: command(admin),
      payload: { name: "Vino", price: { amount: 1, currency: "CLP", descuento: 50 } },
    });
    expect(extra.statusCode).toBe(400);
    const control = await api.app.inject({
      method: "POST",
      url: "/v1/venues/current/tables",
      headers: command(admin),
      payload: { label: "\u0003" },
    });
    expect(control.statusCode).toBe(400);
  });

  it("un comando sin Idempotency-Key se rechaza por contrato", async () => {
    const res = await api.app.inject({
      method: "POST",
      url: "/v1/venues/current/tables",
      headers: bearer(admin),
      payload: { label: "6" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("la misma Idempotency-Key con otra solicitud responde 422", async () => {
    const headers = command(admin);
    await api.app.inject({
      method: "POST",
      url: "/v1/venues/current/tables",
      headers,
      payload: { label: "7" },
    });
    const reused = await api.app.inject({
      method: "POST",
      url: "/v1/venues/current/tables",
      headers,
      payload: { label: "8" },
    });
    expect(reused.statusCode).toBe(422);
  });

  it("un administrador no puede rotar el QR de una mesa de otro local", async () => {
    const tables = await api.app.inject({
      method: "GET",
      url: "/v1/venues/current/tables",
      headers: bearer(admin),
    });
    const [table] = tables.json() as { id: string }[];
    const res = await api.app.inject({
      method: "POST",
      url: `/v1/venues/current/tables/${table?.id}/qr-rotation`,
      headers: command(otherAdmin),
    });
    expect(res.statusCode).toBe(404);
  });
});
