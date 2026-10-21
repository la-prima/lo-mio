import { addMoney, type Money, money } from "@lo-mio/kernel";

export type Share = { guestId: string; amount: Money };

/**
 * Saldo de cada comensal: la suma de sus partes en los ítems vigentes (spec settlement). Los
 * comensales sin partes quedan en cero. Los pagos se restan en cobro-con-comprobante.
 */
export function balancesOf(
  guestIds: string[],
  items: { shares: Share[] }[],
  currency: string,
): Map<string, Money> {
  const balances = new Map(guestIds.map((id) => [id, money(0, currency)]));
  for (const share of items.flatMap((i) => i.shares)) {
    balances.set(
      share.guestId,
      addMoney(balances.get(share.guestId) ?? money(0, currency), share.amount),
    );
  }
  return balances;
}

/** Comensales cuyo saldo puede cambiar al pasar un ítem de unas partes a otras. */
export const affectedBy = (before: Share[], after: Share[]): string[] => [
  ...new Set([...before, ...after].map((s) => s.guestId)),
];
