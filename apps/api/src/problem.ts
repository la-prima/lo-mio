import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";

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
