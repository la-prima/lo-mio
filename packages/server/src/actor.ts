import type { FastifyRequest } from "fastify";

export type StaffRole = "waiter" | "manager" | "admin";

/** Quién hace la request. Siempre trae su local: ninguna operación cruza locales. */
export type Actor =
  | { kind: "staff"; staffId: string; venueId: string; role: StaffRole }
  | { kind: "guest"; guestId: string; sessionId: string; venueId: string };

declare module "fastify" {
  interface FastifyRequest {
    /** Lo resuelven los securityHandlers de apps/api según el contrato de la operación. */
    actor?: Actor;
  }
}

/** Actor de una operación protegida (el contrato garantiza que se autenticó antes). */
export function actorOf(req: FastifyRequest): Actor {
  if (!req.actor) throw new Error("operación sin actor: revisar `security` en el contrato");
  return req.actor;
}

export function staffOf(req: FastifyRequest): Extract<Actor, { kind: "staff" }> {
  const actor = actorOf(req);
  if (actor.kind !== "staff")
    throw new Error("se esperaba personal: revisar `security` en el contrato");
  return actor;
}
