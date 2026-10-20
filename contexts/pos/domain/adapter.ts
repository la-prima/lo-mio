import type { Money } from "@lo-mio/kernel";

/** Un ítem tal como lo entrega cualquier POS, ya traducido a nuestro modelo. */
export type PosItem = {
  posItemId: string;
  tableId: string;
  name: string;
  unitPrice: Money;
  quantity: number;
};

export const CAPABILITIES = ["readItems", "createOrder"] as const;
export type Capability = (typeof CAPABILITIES)[number];

/**
 * Contrato que implementa cada integración con un POS (capa anticorrupción): el dominio nunca sabe
 * qué POS usa el local. Cada adaptador declara qué puede hacer, y solo trae los métodos de lo que
 * declaró (lo verifica la suite de contrato, `server/adapters/contract-suite.ts`).
 */
export interface PosAdapter {
  readonly name: string;
  readonly capabilities: Readonly<Record<Capability, boolean>>;
  /** readItems: ítems actuales de una mesa del POS. */
  itemsOf?(tableId: string): Promise<PosItem[]>;
  /** createOrder: envía un pedido al POS para que llegue a cocina o barra (modo order-via-lo-mio). */
  createOrder?(order: {
    tableId: string;
    items: Omit<PosItem, "posItemId" | "tableId">[];
  }): Promise<{ posItemIds: string[] }>;
}

/**
 * Adaptador manual: el mesero carga los ítems en lo-mio, así que no lee ni escribe en ningún POS.
 * Los ítems llegan por `loadManualItems` y se publican igual que los de cualquier otro adaptador.
 */
export const manualAdapter: PosAdapter = {
  name: "manual",
  capabilities: { readItems: false, createOrder: false },
};

/** Los ids del adaptador manual llevan prefijo: nunca chocan con los de un POS real. */
export const manualItemId = (id: string): string => `manual:${id}`;
