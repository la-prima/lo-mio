import {
  actorOf,
  GUEST_COOKIE,
  guestTokenOf,
  sendProblem,
  setSessionCookie,
  staffOf,
} from "@lo-mio/server";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { JoinRequest, Rename } from "../contracts/index.ts";
import * as service from "./service.ts";

const TWELVE_HOURS = 12 * 3600;
const invalidAlias = (reply: FastifyReply) =>
  sendProblem(reply, 422, "invalid-alias", "Alias inválido");

/** Handlers de contracts/openapi.yaml, por operationId. */
export const tablesHandlers = (deps: service.TablesDeps) => ({
  openTableSession: async (
    req: FastifyRequest<{ Params: { tableId: string } }>,
    reply: FastifyReply,
  ) => {
    const session = await service.openTableSession(deps, staffOf(req), req.params.tableId, req.log);
    return session ?? sendProblem(reply, 404, "not-found", "Recurso no encontrado");
  },
  listOpenSessions: async (req: FastifyRequest) => service.openSessions(deps.db, staffOf(req)),
  joinTable: {
    // Público: frena el escaneo masivo de códigos de QR.
    rateLimit: { max: 30, timeWindow: "1 minute" },
    handler: async (
      req: FastifyRequest<{ Params: { qrCode: string }; Body: JoinRequest }>,
      reply: FastifyReply,
    ) => {
      const joined = await service.joinTable(deps, req.params.qrCode, req.body, guestTokenOf(req));
      if (!joined)
        return sendProblem(reply, 404, "unknown-qr", "Este QR no corresponde a una mesa activa");
      if ("error" in joined) return invalidAlias(reply);
      setSessionCookie(reply, GUEST_COOKIE, joined.token, TWELVE_HOURS);
      return joined.guest;
    },
  },
  getCurrentGuest: async (req: FastifyRequest) =>
    service.currentGuest(deps.db, String(guestTokenOf(req))),
  renameCurrentGuest: async (req: FastifyRequest<{ Body: Rename }>, reply: FastifyReply) => {
    const actor = actorOf(req);
    if (actor.kind !== "guest")
      throw new Error("se esperaba un comensal: revisar `security` en el contrato");
    const renamed = await service.renameGuest(deps, actor, String(guestTokenOf(req)), req.body);
    return "error" in renamed ? invalidAlias(reply) : renamed.guest;
  },
});
