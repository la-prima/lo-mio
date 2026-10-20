import { describe, expect, it } from "vitest";
import { eventCatalogSource } from "./events.ts";

const channel = (address: string, ref = "./openapi.yaml#/components/schemas/ItemClaimed") => ({
  address,
  messages: { m: { payload: { $ref: ref } } },
});

describe("catálogo de eventos desde AsyncAPI", () => {
  it("mapea cada tópico al schema zod de su payload", () => {
    const source = eventCatalogSource("claims", {
      channels: {
        claimed: channel("claims.item.claimed.v1"),
        released: channel(
          "claims.item.released.v1",
          "./openapi.yaml#/components/schemas/ItemReleased",
        ),
      },
    });
    expect(source).toContain('import { zItemClaimed, zItemReleased } from "./zod.gen.ts";');
    expect(source).toContain('"claims.item.claimed.v1": zItemClaimed,');
    expect(source).toContain('"claims.item.released.v1": zItemReleased,');
  });

  it("un contexto sin eventos genera un catálogo vacío sin imports", () => {
    const source = eventCatalogSource("venues", {});
    expect(source).not.toContain("import");
    expect(source).toContain("export const events = {\n} as const;");
  });

  it("rechaza tópicos fuera de la convención o de otro contexto", () => {
    expect(() => eventCatalogSource("claims", { channels: { c: channel("ItemClaimed") } })).toThrow(
      /address/,
    );
    expect(() =>
      eventCatalogSource("claims", { channels: { c: channel("pos.item.received.v1") } }),
    ).toThrow(/address/);
  });

  it("rechaza payloads que no referencian el openapi.yaml del contexto", () => {
    const inline = { address: "claims.item.claimed.v1", messages: { m: { payload: {} } } };
    expect(() => eventCatalogSource("claims", { channels: { c: inline } })).toThrow(/\$ref/);
  });

  it("rechaza tópicos duplicados", () => {
    const doc = {
      channels: { a: channel("claims.item.claimed.v1"), b: channel("claims.item.claimed.v1") },
    };
    expect(() => eventCatalogSource("claims", doc)).toThrow(/dos veces/);
  });
});
