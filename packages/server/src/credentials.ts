import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  pwd: string,
  salt: Buffer,
  len: number,
  opts: object,
) => Promise<Buffer>;
// ~32 MB por hash: caro para fuerza bruta, tolerable para un login. Se guardan con el hash.
const PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 32;

/** `scrypt$N$r$p$salt$hash` (base64url): los parámetros viajan con el hash para poder subirlos. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, PARAMS);
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const params = { N: Number(N), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem };
  const key = await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length, params);
  return timingSafeEqual(key, expected);
}

/** Token opaco para sesiones (personal y comensales): 256 bits aleatorios. */
export const newSessionToken = (): string => randomBytes(32).toString("base64url");

/** En la base solo se guarda el hash: una filtración de la base no expone sesiones. */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
