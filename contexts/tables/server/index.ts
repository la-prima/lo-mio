import { join } from "node:path";
import { events } from "../contracts/index.ts";
import { tablesHandlers } from "./handlers.ts";
import { onItemReceived, onTableQrRotated, onTableRegistered, type TablesDeps } from "./service.ts";

export * as tablesService from "./service.ts";

/** Punto de montaje del contexto en apps/api: handlers, eventos, suscripciones y migraciones. */
export const tables = {
  name: "tables",
  events,
  migrations: join(import.meta.dirname, "migrations"),
  handlers: tablesHandlers,
  subscribe: async (deps: TablesDeps) => {
    await deps.bus.subscribe("venues.table.registered.v1", "tables", onTableRegistered);
    await deps.bus.subscribe("venues.table.qr-rotated.v1", "tables", onTableQrRotated);
    await deps.bus.subscribe("pos.item.received.v1", "tables", onItemReceived(deps));
  },
};
