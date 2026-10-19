/**
 * Reparte un monto entero (unidades mínimas de la moneda, ej. pesos CLP o centavos)
 * según pesos relativos, sin perder ni inventar unidades: la suma del resultado
 * es siempre igual a `total`. Partes iguales = todos los pesos en 1.
 * El resto se asigna por mayor residuo; empates, al primero de la lista.
 */
export function splitAmount(total: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new RangeError("total must be a non-negative integer");
  }
  if (weights.length === 0 || weights.some((w) => !Number.isSafeInteger(w) || w <= 0)) {
    throw new RangeError("weights must be positive integers");
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((w) => Math.floor((total * w) / sum));
  const remainders = weights.map((w, i) => ({ i, r: (total * w) % sum }));
  remainders.sort((a, b) => b.r - a.r || a.i - b.i);
  let left = total - shares.reduce((a, b) => a + b, 0);
  for (const { i } of remainders) {
    if (left === 0) break;
    shares[i] = (shares[i] ?? 0) + 1;
    left--;
  }
  return shares;
}
