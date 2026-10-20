import type { EventBus } from "@lo-mio/kernel";
import type { Db, Tx } from "@lo-mio/postgres";
import { venues } from "@lo-mio/venues/server";
import type { FastifyInstance } from "fastify";

/** Lo que cada contexto expone a la composition root. */
type ServerContext = {
  name: string;
  /** Carpeta de migraciones SQL propias del contexto, si tiene tablas. */
  migrations?: string;
  module: (app: FastifyInstance, deps: { db: Db; bus: EventBus<Tx> }) => Promise<void>;
};

export const contexts: ServerContext[] = [venues];
