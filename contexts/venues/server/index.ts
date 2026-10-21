import { join } from "node:path";
import { events } from "../contracts/index.ts";
import { venuesHandlers } from "./handlers.ts";

export * as venuesRepository from "./repository.ts";
export * as venuesService from "./service.ts";

/** Punto de montaje del contexto en apps/api: handlers por operationId, eventos y migraciones. */
export const venues = {
  name: "venues",
  events,
  migrations: join(import.meta.dirname, "migrations"),
  handlers: venuesHandlers,
};
