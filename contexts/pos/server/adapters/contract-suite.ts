import { describe, expect, it } from "vitest";
import { CAPABILITIES, type PosAdapter } from "../../domain/index.ts";

const methodOf = { readItems: "itemsOf", createOrder: "createOrder" } as const;

/**
 * Suite que pasa TODO adaptador POS (manual, Fudo, …). `tableId` es una mesa que existe en el POS
 * del adaptador (o su mock de Microcks), usada si el adaptador puede leer ítems.
 */
export function describePosAdapterContract(
  adapter: PosAdapter,
  options: { tableId?: string } = {},
) {
  describe(`Contrato de adaptador POS: ${adapter.name}`, () => {
    it("declara cada capacidad como soportada o no soportada", () => {
      expect(Object.keys(adapter.capabilities).sort()).toEqual([...CAPABILITIES].sort());
    });

    it("trae exactamente los métodos de las capacidades que declara", () => {
      for (const capability of CAPABILITIES) {
        const method = adapter[methodOf[capability]];
        expect(typeof method === "function", `${capability} ↔ ${methodOf[capability]}()`).toBe(
          adapter.capabilities[capability],
        );
      }
    });

    it.runIf(adapter.capabilities.readItems)(
      "los ítems leídos cumplen el modelo (montos enteros, cantidad ≥ 1, ids únicos)",
      async () => {
        const items = await adapter.itemsOf?.(String(options.tableId));
        for (const item of items ?? []) {
          expect(Number.isSafeInteger(item.unitPrice.amount), "monto en unidad mínima").toBe(true);
          expect(item.quantity, "cantidad").toBeGreaterThanOrEqual(1);
        }
        const ids = (items ?? []).map((i) => i.posItemId);
        expect(new Set(ids).size, "posItemId único").toBe(ids.length);
      },
    );
  });
}
