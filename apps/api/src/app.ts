import { join } from "node:path";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type RouteHandlerMethod } from "fastify";
import openapiGlue from "fastify-openapi-glue";
import type { Env } from "./env.ts";
import { registerProblemHandlers } from "./problem.ts";

/** Contrato unificado (plataforma + contextos) que genera `pnpm contracts`. */
const SPECIFICATION = join(import.meta.dirname, "../openapi.yaml");

export type Handlers = Record<string, RouteHandlerMethod>;

/**
 * Arma la API sin escuchar en un puerto (los tests usan `inject`). Las rutas salen del contrato:
 * no existe ninguna que no esté declarada, y las respuestas se serializan con su schema.
 * No arranca si el contrato tiene una operación sin handler o si sobra un handler.
 */
export async function buildApp(
  env: Env,
  handlers: Handlers,
  specification: string = SPECIFICATION,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
    },
  });
  registerProblemHandlers(app);
  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false });
  // ponytail: límite global por IP; los endpoints sensibles (login, PIN) suman el suyo.
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  const mounted = new Set<string>();
  await app.register(openapiGlue, {
    specification,
    operationResolver: (operationId: string) => {
      const handler = handlers[operationId];
      if (!handler) throw new Error(`la operación ${operationId} del contrato no tiene handler`);
      mounted.add(operationId);
      return handler;
    },
  });
  const orphans = Object.keys(handlers).filter((id) => !mounted.has(id));
  if (orphans.length > 0)
    throw new Error(`handlers sin operación en el contrato: ${orphans.join(", ")}`);
  return app;
}
