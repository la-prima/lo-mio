import { describe, expect, it } from "vitest";
import { checkPassword, isActive, normalizeEmail, sessionExpiry } from "./index.ts";

describe("Sesión de dispositivo del personal", () => {
  it("una sesión dura un turno de 12 horas", () => {
    expect(sessionExpiry(new Date("2026-10-20T20:00:00Z")).toISOString()).toBe(
      "2026-10-21T08:00:00.000Z",
    );
  });

  it("una sesión vencida o cerrada ya no sirve", () => {
    const now = new Date("2026-10-21T09:00:00Z");
    expect(isActive({ expiresAt: new Date("2026-10-21T10:00:00Z"), revokedAt: null }, now)).toBe(
      true,
    );
    expect(isActive({ expiresAt: new Date("2026-10-21T08:00:00Z"), revokedAt: null }, now)).toBe(
      false,
    );
    expect(isActive({ expiresAt: new Date("2026-10-21T10:00:00Z"), revokedAt: now }, now)).toBe(
      false,
    );
  });

  it("el email se compara sin importar mayúsculas ni espacios", () => {
    expect(normalizeEmail("  Ana@LaPrima.CL ")).toBe("ana@laprima.cl");
  });

  it("una contraseña de menos de 12 caracteres se rechaza", () => {
    expect(checkPassword("corta")).toEqual({ ok: false, error: "password-too-short" });
    expect(checkPassword("una-clave-larga").ok).toBe(true);
  });
});
