import { err, ok, type Result } from "@lo-mio/kernel";

/** Configuración por país: nada específico de un país vive fuera de aquí (ver config de OpenSpec). */
const COUNTRIES = {
  CL: { currency: "CLP", minorUnits: 0, taxDocument: "boleta-electronica-sii" },
} as const;

export type CountryCode = keyof typeof COUNTRIES;
export type Country = (typeof COUNTRIES)[CountryCode] & { code: CountryCode };

export function countryOf(code: string): Result<Country, "unsupported-country"> {
  if (!Object.hasOwn(COUNTRIES, code)) return err("unsupported-country");
  return ok({ code: code as CountryCode, ...COUNTRIES[code as CountryCode] });
}
