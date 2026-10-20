import { describe, expect, it } from "vitest";
import { createEvent, type EventEnvelope, InMemoryEventBus, newId } from "./index.ts";

const claimed = () =>
  createEvent({
    type: "claims.item.claimed",
    version: 1,
    venueId: newId(),
    aggregateId: "item-1",
    data: {},
  });

describe("InMemoryEventBus", () => {
  it("entrega cada evento a todos los suscriptores de su tópico, con la transacción", async () => {
    const bus = new InMemoryEventBus<string>();
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
});
