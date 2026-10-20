import { type EventEnvelope, topicOf } from "./event.ts";

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

  async publish(event: EventEnvelope, { tx }: { tx: Tx }): Promise<void> {
    this.published.push(event);
    for (const handler of this.#handlers.get(topicOf(event)) ?? []) await handler(event, tx);
  }

  async subscribe(topic: string, _subscriber: string, handler: EventHandler<Tx>): Promise<void> {
    this.#handlers.set(topic, [...(this.#handlers.get(topic) ?? []), handler]);
  }
}
