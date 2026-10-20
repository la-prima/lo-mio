// Generado por scripts/contracts.ts desde asyncapi.yaml. No editar.

import { zGuestJoined, zItemSeated, zSessionOpened } from "./zod.gen.ts";

/** Eventos que publica el contexto: tópico → schema del payload. */
export const events = {
  "tables.guest.joined.v1": zGuestJoined,
  "tables.guest.renamed.v1": zGuestJoined,
  "tables.item.seated.v1": zItemSeated,
  "tables.session.opened.v1": zSessionOpened,
} as const;
