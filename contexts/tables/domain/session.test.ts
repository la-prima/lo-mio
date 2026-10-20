import { describe, expect, it } from "vitest";
import { checkAlias, defaultAlias, isOpen, unitsOf } from "./index.ts";

describe("Unión de comensales", () => {
  it("un comensal sin alias recibe uno legible por orden de llegada", () => {
    expect(defaultAlias(3)).toBe("Comensal 3");
  });

  it("el alias se puede cambiar por uno visible, sin caracteres de control", () => {
    expect(checkAlias("  Ana 🍺 ")).toEqual({ ok: true, value: "Ana 🍺" });
    expect(checkAlias("   ")).toEqual({ ok: false, error: "invalid-alias" });
    expect(checkAlias("\u0007")).toEqual({ ok: false, error: "invalid-alias" });
    expect(checkAlias("x".repeat(31)).ok).toBe(false);
  });
});

describe("Apertura de sesión", () => {
  it("una sesión está abierta hasta que se cierra", () => {
    expect(isOpen({ closedAt: null })).toBe(true);
    expect(isOpen({ closedAt: new Date() })).toBe(false);
  });

  it("2 cervezas del POS son 2 unidades con ids estables", () => {
    expect(unitsOf({ posItemId: "manual:abc", quantity: 2 })).toEqual([
      "manual:abc#1",
      "manual:abc#2",
    ]);
    expect(unitsOf({ posItemId: "manual:abc", quantity: 2 })).toEqual(
      unitsOf({ posItemId: "manual:abc", quantity: 2 }),
    );
  });
});
