import { newId } from "@lo-mio/kernel";
import type { Db } from "@lo-mio/postgres";
import {
  type Actor,
  hashPassword,
  hashToken,
  newSessionToken,
  verifyPassword,
} from "@lo-mio/server";
import {
  checkPassword,
  isActive,
  normalizeEmail,
  type Role,
  sessionExpiry,
} from "../domain/index.ts";

type StaffTables = {
  staff_members: {
    id: string;
    venue_id: string;
    email: string;
    name: string;
    role: Role;
    password_hash: string;
  };
  staff_sessions: {
    token_hash: string;
    staff_id: string;
    expires_at: Date;
    revoked_at: Date | null;
  };
};
const tables = (db: Db) => db.withTables<StaffTables>();

export type StaffMember = { id: string; name: string; role: Role; venueId: string };

// Hash de una contraseña que no existe: un email desconocido cuesta lo mismo que uno conocido.
const DUMMY_HASH = hashPassword("contraseña-de-relleno-para-tiempo-constante");

const memberView = (m: StaffTables["staff_members"]): StaffMember => ({
  id: m.id,
  name: m.name,
  role: m.role,
  venueId: m.venue_id,
});

export async function addMember(
  db: Db,
  input: { venueId: string; email: string; name: string; role: Role; password: string },
): Promise<StaffMember> {
  const password = checkPassword(input.password);
  if (!password.ok) throw new Error("la contraseña debe tener al menos 12 caracteres");
  const member = {
    id: newId(),
    venue_id: input.venueId,
    email: normalizeEmail(input.email),
    name: input.name,
    role: input.role,
    password_hash: await hashPassword(password.value),
  };
  await tables(db).insertInto("staff_members").values(member).execute();
  return memberView(member);
}

export async function memberExists(db: Db, email: string): Promise<boolean> {
  const row = await tables(db)
    .selectFrom("staff_members")
    .select("id")
    .where("email", "=", normalizeEmail(email))
    .executeTakeFirst();
  return row !== undefined;
}

/** Inicia sesión. `undefined` si el email no existe o la contraseña no coincide (no se distingue). */
export async function login(db: Db, email: string, password: string, now = new Date()) {
  const member = await tables(db)
    .selectFrom("staff_members")
    .selectAll()
    .where("email", "=", normalizeEmail(email))
    .executeTakeFirst();
  const valid = await verifyPassword(password, member?.password_hash ?? (await DUMMY_HASH));
  if (!member || !valid) return undefined;
  const token = newSessionToken();
  const expiresAt = sessionExpiry(now);
  await tables(db)
    .insertInto("staff_sessions")
    .values({
      token_hash: hashToken(token),
      staff_id: member.id,
      expires_at: expiresAt,
      revoked_at: null,
    })
    .execute();
  return { token, expiresAt: expiresAt.toISOString(), staff: memberView(member) };
}

async function activeSession(db: Db, token: string, now: Date) {
  const row = await tables(db)
    .selectFrom("staff_sessions")
    .innerJoin("staff_members", "staff_members.id", "staff_sessions.staff_id")
    .selectAll("staff_members")
    .select(["staff_sessions.expires_at", "staff_sessions.revoked_at"])
    .where("staff_sessions.token_hash", "=", hashToken(token))
    .executeTakeFirst();
  if (!row || !isActive({ expiresAt: row.expires_at, revokedAt: row.revoked_at }, now))
    return undefined;
  return { staff: memberView(row), expiresAt: row.expires_at.toISOString() };
}

/** Actor de un token de sesión vigente (lo usan los securityHandlers de apps/api). */
export async function authenticate(
  db: Db,
  token: string,
  now = new Date(),
): Promise<Actor | undefined> {
  const session = await activeSession(db, token, now);
  if (!session) return undefined;
  const { id, venueId, role } = session.staff;
  return { kind: "staff", staffId: id, venueId, role };
}

export const currentSession = (db: Db, token: string, now = new Date()) =>
  activeSession(db, token, now);

export async function logout(db: Db, token: string, now = new Date()): Promise<void> {
  await tables(db)
    .updateTable("staff_sessions")
    .set({ revoked_at: now })
    .where("token_hash", "=", hashToken(token))
    .where("revoked_at", "is", null)
    .execute();
}
