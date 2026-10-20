import { actorOf, sendProblem } from "@lo-mio/server";
import type { FastifyReply, FastifyRequest } from "fastify";
import { type SettlementDeps, sessionBalances } from "./service.ts";

/** Handlers de contracts/openapi.yaml, por operationId. */
export const settlementHandlers = ({ db }: SettlementDeps) => ({
  listSessionBalances: async (
    req: FastifyRequest<{ Params: { sessionId: string } }>,
    reply: FastifyReply,
  ) =>
    (await sessionBalances(db, actorOf(req), req.params.sessionId)) ??
    sendProblem(reply, 404, "not-found", "Recurso no encontrado"),
});
