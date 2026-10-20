import { describe, expect, it } from "vitest";
import { z } from "zod";
import { addMoney, createEvent, eventEnvelopeSchema, money, newId, topicOf } from "./index.ts";

describe("Dinero", () => {
  it("suma montos de la misma moneda", () => {
    expect(addMoney(money(4500, "CLP"), money(4000, "CLP"))).toEqual(money(8500, "CLP"));
  });

  it("rechaza decimales y monedas mezcladas", () => {
    expect(() => money(10.5, "CLP")).toThrow(RangeError);
    expect(() => money(10, "clp")).toThrow(RangeError);
    expect(() => addMoney(money(1, "CLP"), money(1, "USD"))).toThrow(RangeError);
  });
});

describe("Identificadores", () => {
  it("genera UUIDv7 válidos, únicos y ordenados por tiempo entre milisegundos", async () => {
    const first = newId();
    await new Promise((r) => setTimeout(r, 2));
    const second = newId();
    expect(z.uuid({ version: "v7" }).parse(first)).toBe(first);
    expect(first).not.toBe(second);
    expect(first < second).toBe(true);
  });
});

describe("Sobre de eventos", () => {
  const schema = eventEnvelopeSchema(z.object({ itemId: z.uuid(), amount: z.int() }));
  const event = createEvent({
    type: "claims.item.claimed",
    version: 1,
    venueId: newId(),
    aggregateId: "item-1",
    data: { itemId: newId(), amount: 4500 },
  });

  it("sobrevive el round-trip de serialización sin cambios", () => {
    expect(schema.parse(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });

  it("inicia su propia cadena de correlación si no recibe una", () => {
    expect(event.correlationId).toBe(event.id);
    expect(event.causationId).toBeNull();
  });

  it("deriva el tópico con la versión", () => {
    expect(topicOf(event)).toBe("claims.item.claimed.v1");
  });

  it("rechaza tipos que no siguen <contexto>.<agregado>.<hecho>", () => {
    expect(schema.safeParse({ ...event, type: "ItemClaimed" }).success).toBe(false);
  });
});
