import type { Db } from "@lo-mio/postgres";
import {
  clearSessionCookie,
  STAFF_COOKIE,
  sendProblem,
  setSessionCookie,
  staffTokenOf,
} from "@lo-mio/server";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Credentials } from "../contracts/index.ts";
import { SESSION_HOURS } from "../domain/index.ts";
import * as service from "./service.ts";

type Req<Body = unknown> = FastifyRequest<{ Body: Body }>;
const tokenOf = (req: FastifyRequest) => String(staffTokenOf(req));

/** Handlers de contracts/openapi.yaml, por operationId. */
export const staffHandlers = ({ db }: { db: Db }) => ({
  createStaffSession: {
    // Más estricto que el límite global: frena la fuerza bruta sobre contraseñas.
    rateLimit: { max: 10, timeWindow: "1 minute" },
    handler: async (req: Req<Credentials>, reply: FastifyReply) => {
      const session = await service.login(db, req.body.email, req.body.password);
      if (!session)
        return sendProblem(reply, 401, "invalid-credentials", "Email o contraseña incorrectos");
      setSessionCookie(reply, STAFF_COOKIE, session.token, SESSION_HOURS * 3600);
      return reply.code(201).send(session);
    },
  },
  getCurrentStaffSession: async (req: Req) => service.currentSession(db, tokenOf(req)),
  deleteCurrentStaffSession: async (req: Req, reply: FastifyReply) => {
    await service.logout(db, tokenOf(req));
    clearSessionCookie(reply, STAFF_COOKIE);
    return reply.code(204).send();
  },
});
