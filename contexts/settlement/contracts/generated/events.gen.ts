// Generado por scripts/contracts.ts desde asyncapi.yaml. No editar.

import { zBalanceChanged } from "./zod.gen.ts";

/** Eventos que publica el contexto: tópico → schema del payload. */
export const events = {
  "settlement.balance.changed.v1": zBalanceChanged,
} as const;
