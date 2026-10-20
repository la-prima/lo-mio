import { events } from "../contracts/index.ts";

/** Punto de montaje del contexto en apps/api: handlers por operationId, eventos y migraciones. */
export const venues = {
  name: "venues",
  events,
  handlers: () => ({}),
};
