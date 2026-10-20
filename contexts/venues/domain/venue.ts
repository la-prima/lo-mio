import { err, type Money, ok, type Result } from "@lo-mio/kernel";
import { countryOf } from "./country.ts";

export type Venue = { id: string; name: string; country: string; currency: string };
export type Table = { id: string; venueId: string; label: string; qrCode: string };
export type Product = { id: string; venueId: string; name: string; price: Money };

// Sin caracteres de control (C0/C1). No se usa \p{C}: incluye los no asignados, que cambian con
// cada versión de Unicode (el contrato y sus clientes podrían discrepar).
// biome-ignore lint/suspicious/noControlCharactersInRegex: justamente se buscan caracteres de control.
const PRINTABLE = /^[^\u0000-\u001F\u007F-\u009F]+$/;

const trimmed = (value: string, max: number) => {
  const text = value.trim();
  return text.length > 0 && text.length <= max && PRINTABLE.test(text) ? text : undefined;
};

export function registerVenue(input: {
  id: string;
  name: string;
  country: string;
}): Result<Venue, "unsupported-country" | "invalid-name"> {
  const country = countryOf(input.country);
  if (!country.ok) return country;
  const name = trimmed(input.name, 80);
  if (!name) return err("invalid-name");
  return ok({ id: input.id, name, country: country.value.code, currency: country.value.currency });
}

/** Los códigos de QR los genera el servidor (aleatorios); el dominio solo los asigna. */
export function registerTable(
  venue: Venue,
  input: { id: string; label: string; qrCode: string },
): Result<Table, "invalid-label"> {
  const label = trimmed(input.label, 20);
  if (!label) return err("invalid-label");
  return ok({ id: input.id, venueId: venue.id, label, qrCode: input.qrCode });
}

/** El código anterior deja de servir: un QR impreso que se filtró se invalida reimprimiendo. */
export function rotateQr(table: Table, qrCode: string): Table {
  return { ...table, qrCode };
}

export function registerProduct(
  venue: Venue,
  input: { id: string; name: string; price: Money },
): Result<Product, "invalid-name" | "currency-mismatch" | "invalid-price"> {
  const name = trimmed(input.name, 80);
  if (!name) return err("invalid-name");
  if (input.price.currency !== venue.currency) return err("currency-mismatch");
  if (!Number.isSafeInteger(input.price.amount) || input.price.amount < 0)
    return err("invalid-price");
  return ok({ id: input.id, venueId: venue.id, name, price: input.price });
}
