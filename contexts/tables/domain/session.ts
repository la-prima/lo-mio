import { err, ok, type Result } from "@lo-mio/kernel";

export type TableSession = {
  id: string;
  venueId: string;
  tableId: string;
  openedAt: Date;
  closedAt: Date | null;
};
export type Guest = { id: string; sessionId: string; alias: string };

// biome-ignore lint/suspicious/noControlCharactersInRegex: justamente se buscan caracteres de control.
const PRINTABLE = /^[^\u0000-\u001F\u007F-\u009F]+$/;

/** Alias legible por orden de llegada: no pide datos personales (spec guest-identity). */
export const defaultAlias = (position: number): string => `Comensal ${position}`;

export function checkAlias(alias: string): Result<string, "invalid-alias"> {
  const text = alias.trim();
  return text.length > 0 && text.length <= 30 && PRINTABLE.test(text)
    ? ok(text)
    : err("invalid-alias");
}

export const isOpen = (session: Pick<TableSession, "closedAt">): boolean =>
  session.closedAt === null;

/**
 * Un ítem del POS con cantidad N son N unidades: cada una se reclama y se reparte por separado
 * (2 cervezas = 2 ítems en el feed). El id es estable, así un evento repetido no duplica unidades.
 */
export function unitsOf(item: { posItemId: string; quantity: number }): string[] {
  return Array.from({ length: item.quantity }, (_, i) => `${item.posItemId}#${i + 1}`);
}
