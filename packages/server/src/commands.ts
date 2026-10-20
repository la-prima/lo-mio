import type { CommandResponse, Idempotent } from "@lo-mio/postgres";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Actor } from "./actor.ts";
import { sendProblem } from "./problem.ts";

/** Ámbito de una Idempotency-Key: la misma clave de dos actores son comandos distintos. */
export const idempotencyScope = (actor: Actor): string =>
  actor.kind === "staff" ? `staff:${actor.staffId}` : `guest:${actor.guestId}`;

/** El contrato exige el header en los comandos; aquí solo se lee. */
export const idempotencyKeyOf = (req: FastifyRequest): string =>
  String(req.headers["idempotency-key"]);

export function replyCommand(reply: FastifyReply, result: Idempotent) {
  if ("reused" in result) {
    return sendProblem(
      reply,
      422,
      "idempotency-key-reused",
      "Idempotency-Key reutilizada",
      "La misma clave se usó con otra solicitud",
    );
  }
  // Los errores de los servicios son Problems (RFC 9457): su content-type lo exige el contrato.
  if (result.status >= 400) reply.type("application/problem+json");
  return reply.code(result.status).send(result.body);
}

export type { CommandResponse };
