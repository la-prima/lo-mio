import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createEvent, type EventEnvelope, InMemoryEventBus, newId } from "./index.ts";

const catalog = {
  "claims.item.claimed.v1": z.strictObject({ amount: z.int() }),
  "claims.item.claimed.v2": z.strictObject({ amount: z.int() }),
};

const claimed = (data: unknown = { amount: 4500 }, type = "claims.item.claimed") =>
  createEvent({ type, version: 1, venueId: newId(), aggregateId: "item-1", data });

describe("Bus de eventos en memoria (tests)", () => {
  it("entrega cada evento a todos los suscriptores de su tópico, con la transacción", async () => {
    const bus = new InMemoryEventBus<string>(catalog);
    const received: [string, EventEnvelope, string][] = [];
    await bus.subscribe("claims.item.claimed.v1", "settlement", async (e, tx) => {
      received.push(["settlement", e, tx]);
    });
    await bus.subscribe("claims.item.claimed.v1", "gateway", async (e, tx) => {
      received.push(["gateway", e, tx]);
    });
    await bus.subscribe("claims.item.claimed.v2", "otro", async () => {
      throw new Error("no debería recibir otra versión");
    });

    const event = claimed();
    await bus.publish(event, { tx: "tx-1" });

    expect(received).toEqual([
      ["settlement", event, "tx-1"],
      ["gateway", event, "tx-1"],
    ]);
    expect(bus.published).toEqual([event]);
  });

  it("rechaza eventos no declarados en un contrato", async () => {
    const bus = new InMemoryEventBus(catalog);
    await expect(bus.publish(claimed({}, "claims.item.lost"), { tx: undefined })).rejects.toThrow(
      /no declarado/,
    );
    expect(bus.published).toEqual([]);
  });

  it("rechaza payloads que no cumplen el contrato, incluidos campos no declarados", async () => {
    const bus = new InMemoryEventBus(catalog);
    for (const data of [{ amount: "4500" }, { amount: 4500, extra: true }, {}]) {
      await expect(bus.publish(claimed(data), { tx: undefined })).rejects.toThrow(
        /no cumple su contrato/,
      );
    }
    expect(bus.published).toEqual([]);
  });
});
