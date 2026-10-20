import type { FastifyReply, FastifyRequest } from "fastify";

/** Un requisito de seguridad del contrato: esquemas (todos deben pasar) con sus roles. */
type Requirement = Record<string, string[]>;
export type SchemeHandler = (
  req: FastifyRequest,
  reply: FastifyReply,
  roles: string[],
) => Promise<void>;

const statusOf = (error: unknown) => (error as { statusCode?: number }).statusCode ?? 401;

/** Intenta cumplir una alternativa: todos sus esquemas deben pasar. Devuelve el error o nada. */
async function attempt(
  requirement: Requirement,
  schemes: Record<string, SchemeHandler>,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<unknown> {
  try {
    for (const [name, roles] of Object.entries(requirement))
      await schemes[name]?.(req, reply, roles);
    return undefined;
  } catch (error) {
    return error;
  }
}

/**
 * Hook `onRequest` que aplica el `security` de una operación ANTES de validar el request: sin
 * sesión se responde 401, nunca un 400 que revele la forma del contrato. Alternativas = OR;
 * esquemas dentro de una alternativa = AND. Si alguna alternativa autenticó pero no tenía el rol,
 * se reporta ese 403 (la causa real) en vez de un 401.
 * `undefined` = operación pública (`security: []`).
 */
export function authenticationHook(
  requirements: Requirement[] | undefined,
  schemes: Record<string, SchemeHandler>,
) {
  if (!requirements?.length || requirements.some((r) => Object.keys(r).length === 0))
    return undefined;
  for (const name of requirements.flatMap((r) => Object.keys(r))) {
    if (!schemes[name])
      throw new Error(`el esquema de seguridad ${name} del contrato no tiene handler`);
  }
  return async (req: FastifyRequest, reply: FastifyReply) => {
    let failure: unknown;
    for (const requirement of requirements) {
      const error = await attempt(requirement, schemes, req, reply);
      if (!error) return;
      if (!failure || statusOf(error) > statusOf(failure)) failure = error;
    }
    throw failure;
  };
}
