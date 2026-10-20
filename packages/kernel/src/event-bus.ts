import type { z } from "zod";
import { type EventEnvelope, topicOf } from "./event.ts";

/** Tópico → schema del payload. Lo genera cada contexto desde su asyncapi.yaml (`events`). */
export type EventCatalog = Readonly<Record<string, z.ZodType>>;

/** El bus solo acepta eventos declarados en un contrato AsyncAPI y con un payload que lo cumpla. */
export function assertDeclared(catalog: EventCatalog, event: EventEnvelope): void {
  const topic = topicOf(event);
  const schema = catalog[topic];
  if (!schema) throw new Error(`evento no declarado en ningún asyncapi.yaml: ${topic}`);
  const result = schema.safeParse(event.data);
  if (!result.success) {
    throw new Error(`el payload de ${topic} no cumple su contrato: ${result.error.message}`);
  }
}

/** Recibe el evento y la transacción donde aplicar sus efectos (se confirman junto con el ack). */
export type EventHandler<Tx> = (event: EventEnvelope, tx: Tx) => Promise<void>;

/**
 * Puerto del bus de eventos. `Tx` es la transacción del adaptador: publicar exige una, para que
 * el evento se confirme o se descarte junto con el cambio que lo produjo (outbox).
 */
export interface EventBus<Tx> {
  publish(event: EventEnvelope, options: { tx: Tx }): Promise<void>;
  /** `subscriber` identifica al consumidor (ej. `settlement`): cada uno recibe su propia copia. */
  subscribe(topic: string, subscriber: string, handler: EventHandler<Tx>): Promise<void>;
}

/** Solo para unit tests de handlers: entrega en el acto, sin persistencia ni reintentos. */
export class InMemoryEventBus<Tx = undefined> implements EventBus<Tx> {
  readonly published: EventEnvelope[] = [];
  readonly #handlers = new Map<string, EventHandler<Tx>[]>();
  readonly #catalog: EventCatalog;

  constructor(catalog: EventCatalog) {
    this.#catalog = catalog;
  }

  async publish(event: EventEnvelope, { tx }: { tx: Tx }): Promise<void> {
    assertDeclared(this.#catalog, event);
    this.published.push(event);
    for (const handler of this.#handlers.get(topicOf(event)) ?? []) await handler(event, tx);
  }

  async subscribe(topic: string, _subscriber: string, handler: EventHandler<Tx>): Promise<void> {
    this.#handlers.set(topic, [...(this.#handlers.get(topic) ?? []), handler]);
  }
}
