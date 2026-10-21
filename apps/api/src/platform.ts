import { type Db, ping } from "@lo-mio/postgres";
import { sendProblem } from "@lo-mio/server";
import type { FastifyReply, FastifyRequest } from "fastify";

/** Handlers de apps/api/openapi/platform.yaml, por operationId. */
export const platformHandlers = (db: Db) => ({
  // liveness: no toca la base, para que una caída de Postgres no reinicie los pods en cascada.
  getLiveness: async () => ({ status: "ok" }),

  // readiness: puede atender tráfico (la base responde).
  getReadiness: async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await ping(db);
      return { status: "ok" };
    } catch (error) {
      req.log.error({ err: error }, "readiness: base de datos no disponible");
      return sendProblem(reply, 503, "dependency-unavailable", "Dependencia no disponible");
    }
  },
});
