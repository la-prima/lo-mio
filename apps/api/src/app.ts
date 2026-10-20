import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { type Db, ping } from "@lo-mio/postgres";
import Fastify, { type FastifyInstance } from "fastify";
import type { Env } from "./env.ts";

/** Arma la API sin escuchar en un puerto: así los tests la ejercitan con `inject`. */
export async function buildApp(env: Env, db: Db): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
    },
  });
  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false });
  // ponytail: límite global por IP; los endpoints sensibles (login, PIN) suman el suyo.
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  // liveness: el proceso responde. No toca la base, para que una caída de Postgres no
  // reinicie todos los pods en cascada.
  app.get("/health/live", async () => ({ status: "ok" }));

  // readiness: puede atender tráfico (la base responde).
  app.get("/health", async (_req, reply) => {
    try {
      await ping(db);
      return { status: "ok" };
    } catch (error) {
      app.log.error({ err: error }, "health: base de datos no disponible");
      return reply.code(503).send({ status: "unavailable" });
    }
  });

  return app;
}
