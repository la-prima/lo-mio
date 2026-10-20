/** Monto en la unidad mínima de la moneda (ej. pesos CLP, centavos USD). Nunca float. */
export type Money = { readonly amount: number; readonly currency: string };

export function money(amount: number, currency: string): Money {
  if (!Number.isSafeInteger(amount)) throw new RangeError("amount must be an integer");
  if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError("currency must be an ISO 4217 code");
  return { amount, currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new RangeError(`cannot add ${a.currency} and ${b.currency}`);
  return money(a.amount + b.amount, a.currency);
}

/** Texto para mostrar: la unidad mínima según los decimales de la moneda (CLP 0, USD 2). */
export function formatMoney(value: Money, locale = "es-CL"): string {
  const format = new Intl.NumberFormat(locale, { style: "currency", currency: value.currency });
  const decimals = format.resolvedOptions().maximumFractionDigits ?? 0;
  return format.format(value.amount / 10 ** decimals);
}
