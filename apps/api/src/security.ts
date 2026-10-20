import type { Db } from "@lo-mio/postgres";
import { staffTokenOf } from "@lo-mio/server";
import { staffService } from "@lo-mio/staff/server";
import type { FastifyReply, FastifyRequest } from "fastify";

const fail = (statusCode: 401 | 403, message: string) =>
  Object.assign(new Error(message), { statusCode });

/**
 * Esquemas de seguridad de contracts/common.yaml. fastify-openapi-glue los aplica según el
 * `security` de cada operación; los roles requeridos llegan como `scopes` (ej. `[admin]`).
 */
export const securityHandlers = (db: Db) => ({
  async staffSession(req: FastifyRequest, _reply: FastifyReply, roles: string[]) {
    const token = staffTokenOf(req);
    const actor = token ? await staffService.authenticate(db, token) : undefined;
    if (!actor || actor.kind !== "staff") throw fail(401, "sesión del personal requerida");
    if (roles.length > 0 && !roles.includes(actor.role))
      throw fail(403, `requiere rol ${roles.join(" o ")}`);
    req.actor = actor;
  },
});

export type SecurityHandlers = ReturnType<typeof securityHandlers>;
