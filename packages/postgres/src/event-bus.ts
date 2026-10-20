import { type EventBus, type EventEnvelope, type EventHandler, topicOf } from "@lo-mio/kernel";
import { fromKysely, type PgBoss } from "pg-boss";
import type { Db, Tx } from "./db.ts";

/**
 * EventBus sobre pg-boss. `publish` escribe en la transacción del caller (outbox): si hace
 * rollback, el evento no existe. Cada suscriptor tiene su queue con reintentos y dead-letter, y
 * el handler corre en una transacción junto con su registro en `inbox`: un evento repetido
 * (reintento tras un corte, o entrega doble) se descarta sin repetir efectos.
 */
export class PgBossEventBus implements EventBus<Tx> {
  readonly #boss: PgBoss;
  readonly #db: Db;

  constructor(boss: PgBoss, db: Db) {
    this.#boss = boss;
    this.#db = db;
  }

  async publish(event: EventEnvelope, { tx }: { tx: Tx }): Promise<void> {
    await this.#boss.publish(topicOf(event), event, { db: fromKysely(tx) });
  }

  async subscribe(topic: string, subscriber: string, handler: EventHandler<Tx>): Promise<void> {
    const queue = `${topic}__${subscriber}`;
    const deadLetter = `${queue}__dead`;
    await this.#ensureQueue(deadLetter, {});
    await this.#ensureQueue(queue, { retryLimit: 5, retryBackoff: true, deadLetter, notify: true });
    await this.#boss.subscribe(topic, queue);
    // LISTEN/NOTIFY despierta al worker al instante solo para jobs inmediatos; los reintentos
    // quedan programados a futuro y los recoge este sondeo (por defecto cada 30 s).
    // ponytail: ~1 consulta cada 5 s por queue; subirlo si las queues crecen a cientos.
    const polling = { notifyPollingIntervalSeconds: 5 };
    await this.#boss.work<EventEnvelope>(queue, polling, async ([job]) => {
      if (job) await this.#handleOnce(subscriber, job.data, handler);
    });
  }

  async #ensureQueue(name: string, options: Parameters<PgBoss["createQueue"]>[1]): Promise<void> {
    if (!(await this.#boss.getQueue(name))) await this.#boss.createQueue(name, options);
  }

  async #handleOnce(subscriber: string, event: EventEnvelope, handler: EventHandler<Tx>) {
    await this.#db.transaction().execute(async (tx) => {
      const isNew = await tx
        .insertInto("inbox")
        .values({ subscriber, event_id: event.id })
        .onConflict((oc) => oc.doNothing())
        .returning("event_id")
        .executeTakeFirst();
      if (isNew) await handler(event, tx);
    });
  }
}
