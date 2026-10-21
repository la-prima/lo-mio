import { err, ok, type Result } from "@lo-mio/kernel";

export const ROLES = ["waiter", "manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Un turno: la sesión del dispositivo vence a las 12 horas (spec staff-access). */
export const SESSION_HOURS = 12;

export const sessionExpiry = (issuedAt: Date): Date =>
  new Date(issuedAt.getTime() + SESSION_HOURS * 3_600_000);

export const isActive = (
  session: { expiresAt: Date; revokedAt: Date | null },
  now: Date,
): boolean => session.revokedAt === null && session.expiresAt > now;

/** Mismo email con otras mayúsculas o espacios = misma persona. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Al menos 12 caracteres: largo sobre complejidad (NIST 800-63B). */
export function checkPassword(password: string): Result<string, "password-too-short"> {
  return password.length >= 12 ? ok(password) : err("password-too-short");
}
