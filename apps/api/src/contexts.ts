import type { EventBus, EventCatalog } from "@lo-mio/kernel";
import type { Db, Tx } from "@lo-mio/postgres";
import { venues } from "@lo-mio/venues/server";
import type { Handlers } from "./app.ts";

type ContextDeps = { db: Db; bus: EventBus<Tx> };

/** Lo que cada contexto expone a la composition root. */
type ServerContext = {
  name: string;
  /** Eventos que publica, generados desde su asyncapi.yaml. */
  events: EventCatalog;
  /** Carpeta de migraciones SQL propias del contexto, si tiene tablas. */
  migrations?: string;
  /** Handlers de las operaciones de su openapi.yaml, por operationId. */
  handlers: (deps: ContextDeps) => Handlers;
  /** Suscripciones a eventos de otros contextos. */
  subscribe?: (deps: ContextDeps) => Promise<void>;
};

export const contexts: ServerContext[] = [venues];

/** Catálogo de todos los eventos declarados: el bus rechaza cualquier otro. */
export const eventCatalog = (): EventCatalog => Object.assign({}, ...contexts.map((c) => c.events));

/** Carpetas de migraciones de los contextos que tienen tablas, por nombre de contexto. */
export const contextMigrations = (): Record<string, string> =>
  Object.fromEntries(contexts.flatMap((c) => (c.migrations ? [[c.name, c.migrations]] : [])));
