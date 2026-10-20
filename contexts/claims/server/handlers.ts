import { actorOf, idempotencyKeyOf, replyCommand, sendProblem, staffOf } from "@lo-mio/server";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Share } from "../contracts/index.ts";
import * as service from "./service.ts";

type ItemReq<Body = unknown> = FastifyRequest<{ Params: { itemId: string }; Body: Body }>;

const guestOf = (req: FastifyRequest) => {
  const actor = actorOf(req);
  if (actor.kind !== "guest")
    throw new Error("se esperaba un comensal: revisar `security` en el contrato");
  return actor;
};
const notFound = (reply: FastifyReply) =>
  sendProblem(reply, 404, "not-found", "Recurso no encontrado");

/** Handlers de contracts/openapi.yaml, por operationId. */
export const claimsHandlers = (deps: service.ClaimsDeps) => {
  const run = async (
    req: ItemReq,
    reply: FastifyReply,
    cmd: Parameters<typeof service.command>[3],
  ) =>
    replyCommand(
      reply,
      await service.command(deps, guestOf(req), req.params.itemId, cmd, idempotencyKeyOf(req)),
    );
  return {
    listSessionItems: async (
      req: FastifyRequest<{ Params: { sessionId: string } }>,
      reply: FastifyReply,
    ) =>
      (await service.sessionFeed(deps.db, actorOf(req), req.params.sessionId)) ?? notFound(reply),
    claimItem: async (req: ItemReq, reply: FastifyReply) =>
      run(req, reply, { type: "claim", guestId: guestOf(req).guestId }),
    shareItem: async (req: ItemReq<Share>, reply: FastifyReply) =>
      run(req, reply, { type: "share", guestId: guestOf(req).guestId, owners: req.body.owners }),
    joinItem: async (req: ItemReq, reply: FastifyReply) =>
      run(req, reply, { type: "join", guestId: guestOf(req).guestId }),
    getItemHistory: async (req: ItemReq, reply: FastifyReply) =>
      (await service.itemHistory(deps.db, staffOf(req), req.params.itemId)) ?? notFound(reply),
  };
};
