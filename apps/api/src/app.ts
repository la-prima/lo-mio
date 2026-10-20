import { readFileSync } from "node:fs";
import { join } from "node:path";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { registerMethodNotAllowed, registerProblemHandlers } from "@lo-mio/server";
import Fastify, { type FastifyInstance, type RouteOptions } from "fastify";
import openapiGlue from "fastify-openapi-glue";
import { parse } from "yaml";
import { authenticationHook, type SchemeHandler } from "./authentication.ts";
import type { Env } from "./env.ts";
import { registerContractValidation } from "./validation.ts";

/** Contrato unificado (plataforma + contextos) que genera `pnpm contracts`. */
const SPECIFICATION = join(import.meta.dirname, "../openapi.yaml");

/**
 * Handler de una operación del contrato. El request se tipa en cada contexto con el body y los
 * params del contrato (glue ya los validó), por eso aquí se acepta cualquier tipo de request.
 */
type Handler = (req: never, reply: never) => unknown;
/** Un handler, o un handler con límite de solicitudes propio (ej. login). */
export type Handlers = Record<
  string,
  Handler | { handler: Handler; rateLimit: { max: number; timeWindow: string } }
>;

export type AppOptions = {
  handlers: Handlers;
  /** Esquemas de seguridad del contrato (contracts/common.yaml). */
  security: Record<string, (req: never, reply: never, roles: string[]) => Promise<void>>;
  specification?: string;
};

type Operation = { operationId?: string; security?: Record<string, string[]>[] };

/** `security` declarado de cada operación del contrato (o el global del documento). */
function securityByOperation(specification: string) {
  const doc = parse(readFileSync(specification, "utf8")) as {
    security?: Operation["security"];
    paths?: Record<string, Record<string, Operation>>;
  };
  const operations = Object.values(doc.paths ?? {}).flatMap((item) => Object.values(item));
  return new Map(operations.map((op) => [String(op.operationId), op.security ?? doc.security]));
}

/**
 * Arma la API sin escuchar en un puerto (los tests usan `inject`). Las rutas salen del contrato:
 * no existe ninguna que no esté declarada, y las respuestas se serializan con su schema.
 * No arranca si el contrato tiene una operación sin handler o si sobra un handler.
 */
export async function buildApp(env: Env, options: AppOptions): Promise<FastifyInstance> {
  const { handlers, security, specification = SPECIFICATION } = options;
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
    },
  });
  registerProblemHandlers(app);
  registerContractValidation(app);
  const routes = new Map<string, Set<string>>();
  app.addHook("onRoute", (route) => {
    // Las rutas comodín (ej. OPTIONS * de CORS) no son paths del contrato.
    if (route.url.includes("*")) return;
    const methods = routes.get(route.url) ?? new Set<string>();
    for (const m of [route.method].flat()) methods.add(m);
    routes.set(route.url, methods);
  });
  await app.register(cookie);
  // Fastify no valida el body si no llega: una operación con requestBody obligatorio (todas las
  // nuestras) recibiría `undefined` y fallaría con 500. El contrato manda: 400.
  app.addHook("preValidation", async (req) => {
    if (req.routeOptions.schema?.body && req.body === undefined) {
      throw Object.assign(new Error("body: se requiere un cuerpo JSON"), {
        statusCode: 400,
        validation: [],
      });
    }
  });
  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false });
  // ponytail: límites en memoria de cada pod (con N réplicas el límite efectivo es N veces);
  // pasar a un contador compartido en Postgres si hace falta un límite exacto.
  // Global por IP; los endpoints sensibles (login, PIN) suman el suyo.
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  const mounted = new Set<string>();
  const securityOf = securityByOperation(specification);
  await app.register(openapiGlue, {
    specification,
    operationResolver: (operationId: string) => {
      const entry = handlers[operationId];
      if (!entry) throw new Error(`la operación ${operationId} del contrato no tiene handler`);
      mounted.add(operationId);
      const handler = typeof entry === "function" ? entry : entry.handler;
      const options = {
        handler,
        // La autenticación corre en onRequest (antes de validar); la de glue (preHandler) no se usa.
        onRequest: authenticationHook(
          securityOf.get(operationId),
          security as Record<string, SchemeHandler>,
        ),
        preHandler: undefined,
        ...(typeof entry === "function" ? {} : { config: { rateLimit: entry.rateLimit } }),
      };
      // glue completa method y url desde el contrato; su tipo igual exige RouteOptions completo.
      return options as unknown as RouteOptions;
    },
  });
  registerMethodNotAllowed(app, new Map(routes));
  const orphans = Object.keys(handlers).filter((id) => !mounted.has(id));
  if (orphans.length > 0)
    throw new Error(`handlers sin operación en el contrato: ${orphans.join(", ")}`);
  return app;
}
