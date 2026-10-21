import { join } from "node:path";
import { events } from "../contracts/index.ts";
import { settlementHandlers } from "./handlers.ts";
import { onGuestJoined, onGuestRenamed, onItemChanged, type SettlementDeps } from "./service.ts";

export * as settlementService from "./service.ts";

/** Punto de montaje del contexto en apps/api: handlers, eventos, suscripciones y migraciones. */
export const settlement = {
  name: "settlement",
  events,
  migrations: join(import.meta.dirname, "migrations"),
  handlers: settlementHandlers,
  subscribe: async (deps: SettlementDeps) => {
    await deps.bus.subscribe("tables.guest.joined.v1", "settlement", onGuestJoined);
    await deps.bus.subscribe("tables.guest.renamed.v1", "settlement", onGuestRenamed);
    await deps.bus.subscribe("claims.item.changed.v1", "settlement", onItemChanged(deps));
  },
};
