import { join } from "node:path";
import { events } from "../contracts/index.ts";
import { claimsHandlers } from "./handlers.ts";
import { type ClaimsDeps, onGuestJoined, onItemSeated } from "./service.ts";

export * as claimsService from "./service.ts";

/** Punto de montaje del contexto en apps/api: handlers, eventos, suscripciones y migraciones. */
export const claims = {
  name: "claims",
  events,
  migrations: join(import.meta.dirname, "migrations"),
  handlers: claimsHandlers,
  subscribe: async (deps: ClaimsDeps) => {
    await deps.bus.subscribe("tables.item.seated.v1", "claims", onItemSeated(deps));
    await deps.bus.subscribe("tables.guest.joined.v1", "claims", onGuestJoined);
    await deps.bus.subscribe("tables.guest.renamed.v1", "claims", onGuestJoined);
  },
};
