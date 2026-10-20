import type { Db } from "@lo-mio/postgres";
import { GUEST_COOKIE, STAFF_COOKIE } from "@lo-mio/server";
import { staffService } from "@lo-mio/staff/server";
import { tablesService } from "@lo-mio/tables/server";
import type { FastifyReply, FastifyRequest } from "fastify";

const fail = (statusCode: 401 | 403, message: string) =>
  Object.assign(new Error(message), { statusCode });

/** Valida un token del personal y los roles que exige la operación; deja el actor en el request. */
async function authenticateStaff(
  db: Db,
  req: FastifyRequest,
  token: string | undefined,
  roles: string[],
) {
  const actor = token ? await staffService.authenticate(db, token) : undefined;
  if (!actor || actor.kind !== "staff") throw fail(401, "sesión del personal requerida");
  if (roles.length > 0 && !roles.includes(actor.role))
    throw fail(403, `requiere rol ${roles.join(" o ")}`);
  req.actor = actor;
}

/**
 * Esquemas de seguridad de contracts/common.yaml. fastify-openapi-glue los aplica según el
 * `security` de cada operación (alternativas: basta con que uno pase); los roles llegan como
 * `scopes`. Cada esquema lee solo su fuente, como dice el contrato.
 */
export const securityHandlers = (db: Db) => ({
  staffCookie: (req: FastifyRequest, _reply: FastifyReply, roles: string[]) =>
    authenticateStaff(db, req, req.cookies[STAFF_COOKIE], roles),
  async guestSession(req: FastifyRequest) {
    const token = req.cookies[GUEST_COOKIE];
    const actor = token ? await tablesService.authenticate(db, token) : undefined;
    if (!actor) throw fail(401, "comensal de una sesión abierta requerido");
    req.actor = actor;
  },
  staffBearer: (req: FastifyRequest, _reply: FastifyReply, roles: string[]) =>
    authenticateStaff(db, req, req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1], roles),
});
