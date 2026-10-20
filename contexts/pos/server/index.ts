import { join } from "node:path";
import { events } from "../contracts/index.ts";
import { posHandlers } from "./handlers.ts";
import { onTableRegistered, type PosDeps } from "./service.ts";

export * as posService from "./service.ts";

/** Punto de montaje del contexto en apps/api: handlers, eventos, suscripciones y migraciones. */
export const pos = {
  name: "pos",
  events,
  migrations: join(import.meta.dirname, "migrations"),
  handlers: posHandlers,
  subscribe: ({ bus }: PosDeps) =>
    bus.subscribe("venues.table.registered.v1", "pos", onTableRegistered),
};
