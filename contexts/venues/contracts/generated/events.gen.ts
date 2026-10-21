// Generado por scripts/contracts.ts desde asyncapi.yaml. No editar.

import { zTableQrRotated, zTableRegistered } from "./zod.gen.ts";

/** Eventos que publica el contexto: tópico → schema del payload. */
export const events = {
  "venues.table.qr-rotated.v1": zTableQrRotated,
  "venues.table.registered.v1": zTableRegistered,
} as const;
