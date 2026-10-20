import {
  assertDeclared,
  type EventBus,
  type EventCatalog,
  type EventEnvelope,
  type EventHandler,
  topicOf,
} from "@lo-mio/kernel";
import { fromKysely, PgBoss } from "pg-boss";
import type { Db, Tx } from "./db.ts";

/**
 * pg-boss configurado para el bus. Sin `useListenNotify` (por defecto apagado en v12) la opción
 * `notify` de las queues no hace nada y cada salto entre contextos espera el sondeo (hasta 2 s).
 * Producción y tests lo crean aquí, para que nunca difieran.
 */
export const createBoss = (connectionString: string) =>
  new PgBoss({ connectionString, useListenNotify: true });

/**
 * EventBus sobre pg-boss. `publish` escribe en la transacción del caller (outbox): si hace
 * rollback, el evento no existe. Cada suscriptor tiene su queue con reintentos y dead-letter, y
 * el handler corre en una transacción junto con su registro en `inbox`: un evento repetido
 * (reintento tras un corte, o entrega doble) se descarta sin repetir efectos. Solo se publican
 * eventos declarados en el catálogo (contratos AsyncAPI), validados antes de tocar la transacción.
 */
export class PgBossEventBus implements EventBus<Tx> {
  readonly #boss: PgBoss;
  readonly #db: Db;
  readonly #catalog: EventCatalog;

  constructor(boss: PgBoss, db: Db, catalog: EventCatalog) {
    this.#boss = boss;
    this.#db = db;
    this.#catalog = catalog;
  }

  async publish(event: EventEnvelope, { tx }: { tx: Tx }): Promise<void> {
    assertDeclared(this.#catalog, event);
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
    // En lotes: varios eventos publicados juntos (ej. las unidades de un ítem) generan un solo
    // aviso; con un job por vez, el resto esperaba al sondeo (hasta 5 s). Cada evento se aplica
    // en su propia transacción: si uno falla, el lote se reintenta y el inbox salta los ya aplicados.
    const options = { notifyPollingIntervalSeconds: 5, batchSize: 20 };
    await this.#boss.work<EventEnvelope>(queue, options, async (jobs) => {
      for (const job of jobs) await this.#handleOnce(subscriber, job.data, handler);
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
