import { describe, expect, it } from "vitest";
import { hashPassword, hashToken, newSessionToken, verifyPassword } from "./credentials.ts";

describe("Credenciales del personal", () => {
  it("una contraseña se verifica contra su hash y no contra otra", async () => {
    const stored = await hashPassword("una-clave-larga-1");
    expect(stored).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword("una-clave-larga-1", stored)).toBe(true);
    expect(await verifyPassword("una-clave-larga-2", stored)).toBe(false);
  });

  it("dos hashes de la misma contraseña son distintos (sal aleatoria)", async () => {
    expect(await hashPassword("misma-clave")).not.toBe(await hashPassword("misma-clave"));
  });

  it("los tokens de sesión son únicos y se guardan solo como hash", () => {
    const token = newSessionToken();
    expect(token).not.toBe(newSessionToken());
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});
