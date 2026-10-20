import { describe, expect, it } from "vitest";
import { countryOf, registerProduct, registerTable, registerVenue, rotateQr } from "./index.ts";

const venue = () => {
  const result = registerVenue({ id: "v1", name: "Bar La Prima", country: "CL" });
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe("Configuración de país del local", () => {
  it("un local chileno usa CLP sin decimales y boleta electrónica SII", () => {
    expect(countryOf("CL")).toEqual({
      ok: true,
      value: { code: "CL", currency: "CLP", minorUnits: 0, taxDocument: "boleta-electronica-sii" },
    });
    expect(venue()).toMatchObject({ country: "CL", currency: "CLP" });
  });

  it("un país sin configuración se rechaza", () => {
    expect(registerVenue({ id: "v2", name: "Bar", country: "AR" })).toEqual({
      ok: false,
      error: "unsupported-country",
    });
    expect(countryOf("toString")).toEqual({ ok: false, error: "unsupported-country" });
  });
});

describe("Mesas y su QR", () => {
  it("una mesa nueva queda en el local con su QR", () => {
    expect(registerTable(venue(), { id: "t1", label: " 5 ", qrCode: "abc" })).toEqual({
      ok: true,
      value: { id: "t1", venueId: "v1", label: "5", qrCode: "abc" },
    });
  });

  it("un nombre vacío o demasiado largo se rechaza", () => {
    expect(registerTable(venue(), { id: "t1", label: "  ", qrCode: "a" }).ok).toBe(false);
    expect(registerTable(venue(), { id: "t1", label: "x".repeat(21), qrCode: "a" }).ok).toBe(false);
  });

  it("rotar el QR reemplaza el código anterior", () => {
    const table = { id: "t1", venueId: "v1", label: "5", qrCode: "viejo" };
    expect(rotateQr(table, "nuevo").qrCode).toBe("nuevo");
  });
});

describe("Catálogo de productos", () => {
  it("un producto se registra con precio en la moneda del local", () => {
    const result = registerProduct(venue(), {
      id: "p1",
      name: "Schop",
      price: { amount: 4500, currency: "CLP" },
    });
    expect(result).toMatchObject({ ok: true, value: { name: "Schop", price: { amount: 4500 } } });
  });

  it("un precio en otra moneda, negativo o con decimales se rechaza", () => {
    const v = venue();
    expect(
      registerProduct(v, { id: "p", name: "x", price: { amount: 10, currency: "USD" } }),
    ).toEqual({
      ok: false,
      error: "currency-mismatch",
    });
    expect(
      registerProduct(v, { id: "p", name: "x", price: { amount: -1, currency: "CLP" } }).ok,
    ).toBe(false);
    expect(
      registerProduct(v, { id: "p", name: "x", price: { amount: 1.5, currency: "CLP" } }).ok,
    ).toBe(false);
  });
});
