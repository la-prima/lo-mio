import type { EventBus } from "@lo-mio/kernel";
import type { Db, Tx } from "@lo-mio/postgres";
import type { FastifyInstance } from "fastify";

/** Punto de montaje del contexto en apps/api: rutas, suscripciones y migraciones (`migrations`). */
export const venues = {
  name: "venues",
  async module(_app: FastifyInstance, _deps: { db: Db; bus: EventBus<Tx> }): Promise<void> {},
};
