import type { FastifyError, FastifyInstance, FastifyReply, HTTPMethods } from "fastify";

const BASE = "https://lo-mio.cl/problems";

/** Respuesta de error RFC 9457 (`application/problem+json`), como exigen los contratos. */
export function sendProblem(
  reply: FastifyReply,
  status: number,
  slug: string,
  title: string,
  detail?: string,
) {
  const body = { type: `${BASE}/${slug}`, title, status, ...(detail ? { detail } : {}) };
  return reply.code(status).type("application/problem+json").send(body);
}

/** Todo error que sale de la API (validación, 404, rate limit, inesperados) es un Problem. */
export function registerProblemHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((req, reply) =>
    sendProblem(
      reply,
      404,
      "not-found",
      "Recurso no encontrado",
      `${req.method} ${req.url} no existe en el contrato`,
    ),
  );
  app.setErrorHandler((error: FastifyError, req, reply) => {
    if (error.validation)
      return sendProblem(reply, 400, "invalid-request", "Solicitud inválida", error.message);
    if (error.statusCode === 429)
      return sendProblem(reply, 429, "rate-limited", "Demasiadas solicitudes");
    if (error.statusCode && error.statusCode < 500) {
      return sendProblem(reply, error.statusCode, "request-error", error.message);
    }
    // Inesperado: se loguea completo y al cliente no se le filtran detalles internos.
    req.log.error({ err: error }, "error no controlado");
    return sendProblem(reply, 500, "internal-error", "Error interno");
  });
}

const METHODS: HTTPMethods[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "TRACE", "QUERY"];

/**
 * RFC 9110: un método no soportado en una ruta que existe responde 405 con `Allow`, no 404.
 * Llamar con las rutas ya registradas (las del contrato): cubre cualquier path y método.
 */
export function registerMethodNotAllowed(
  app: FastifyInstance,
  routes: Map<string, Set<string>>,
): void {
  for (const [url, methods] of routes) {
    const allow = [...methods].sort().join(", ");
    const missing = METHODS.filter((m) => !methods.has(m));
    if (missing.length === 0) continue;
    app.route({
      method: missing,
      url,
      // En onRequest: antes de que Fastify valide el body (QUERY sin Content-Type daría 400).
      onRequest: async (req, reply) => {
        const detail = `${req.method} no está en el contrato para ${url}; usar ${allow}`;
        return sendProblem(
          reply.header("allow", allow),
          405,
          "method-not-allowed",
          "Método no permitido",
          detail,
        );
      },
      handler: async () => undefined,
    });
  }
}
