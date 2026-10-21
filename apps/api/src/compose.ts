import type { EventBus } from "@lo-mio/kernel";
import type { Db, Tx } from "@lo-mio/postgres";
import type { AppOptions } from "./app.ts";
import { contexts } from "./contexts.ts";
import { platformHandlers } from "./platform.ts";
import { securityHandlers } from "./security.ts";

/** Arma handlers y seguridad de todos los contextos. Lo usan main.ts y los tests (misma API). */
export function compose(deps: { db: Db; bus: EventBus<Tx> }): AppOptions {
  return {
    handlers: Object.assign(platformHandlers(deps.db), ...contexts.map((c) => c.handlers(deps))),
    security: securityHandlers(deps.db),
  };
}
