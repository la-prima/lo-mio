import { idempotencyKeyOf, replyCommand, staffOf } from "@lo-mio/server";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ManualItems } from "../contracts/index.ts";
import { loadManualItems, type PosDeps } from "./service.ts";

/** Handlers de contracts/openapi.yaml, por operationId. */
export const posHandlers = (deps: PosDeps) => ({
  loadManualItems: async (req: FastifyRequest<{ Body: ManualItems }>, reply: FastifyReply) =>
    replyCommand(
      reply,
      await loadManualItems(deps, staffOf(req), req.body, {
        key: idempotencyKeyOf(req),
        log: req.log,
      }),
    ),
});
