import { join } from "node:path";
import { events } from "../contracts/index.ts";
import { staffHandlers } from "./handlers.ts";

export * as staffService from "./service.ts";

/** Punto de montaje del contexto en apps/api: handlers por operationId, eventos y migraciones. */
export const staff = {
  name: "staff",
  events,
  migrations: join(import.meta.dirname, "migrations"),
  handlers: staffHandlers,
};
