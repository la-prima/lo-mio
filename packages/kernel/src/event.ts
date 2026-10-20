import { z } from "zod";
import { newId } from "./id.ts";

const segment = "[a-z][a-z0-9-]*";

/** `<contexto>.<agregado>.<hecho-en-pasado>`, ej. `claims.item.claimed`. */
const eventTypeSchema = z.string().regex(new RegExp(`^${segment}\\.${segment}\\.${segment}$`));

export function eventEnvelopeSchema<D extends z.ZodType>(data: D) {
  return z.object({
    id: z.uuid(),
    type: eventTypeSchema,
    version: z.int().positive(),
    venueId: z.uuid(),
    aggregateId: z.string().min(1),
    occurredAt: z.iso.datetime(),
    correlationId: z.uuid(),
    causationId: z.uuid().nullable(),
    data,
  });
}

export type EventEnvelope<D = unknown> = {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly venueId: string;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly data: D;
};

type NewEvent<D> = Omit<EventEnvelope<D>, "id" | "occurredAt" | "causationId" | "correlationId"> & {
  readonly correlationId?: string;
  readonly causationId?: string | null;
};

/** Crea un evento. Sin `correlationId`, el evento inicia su propia cadena. */
export function createEvent<D>(event: NewEvent<D>): EventEnvelope<D> {
  const id = newId();
  return {
    ...event,
    id,
    occurredAt: new Date().toISOString(),
    correlationId: event.correlationId ?? id,
    causationId: event.causationId ?? null,
  };
}

/** Tópico del bus: `<type>.v<version>`, ej. `claims.item.claimed.v1`. */
export const topicOf = (event: Pick<EventEnvelope, "type" | "version">): string =>
  `${event.type}.v${event.version}`;
