/**
 * Jerarquía única del reporte Allure para todos los frameworks: epic = contexto (dominio),
 * feature = flujo de usuario, story = escenario. Se deriva de la estructura de los tests para que
 * nadie la escriba a mano (ver AGENTS.md, "Evidencias").
 */
export type Labels = { epic: string; feature: string; story: string };

/** Nombre de negocio de cada contexto (docs/glosario.md). Es el `epic` en todas las fuentes. */
export const DOMAINS = {
  venues: "Locales",
  staff: "Personal",
  tables: "Mesas",
  claims: "Reclamos",
  pos: "POS",
  settlement: "Liquidación",
  plataforma: "Plataforma",
  arquitectura: "Arquitectura",
} as const;

const KNOWN = new Set<string>(Object.values(DOMAINS));
const AREA = /(?:^|\/)(contexts|packages|apps|tools)\/([^/]+)\//;

/** Dominio de un archivo de test: su contexto; paquetes y apps son plataforma. */
export function areaOf(file: string): string {
  const match = file.match(AREA);
  if (match?.[1] === "contexts" && match[2]) {
    return DOMAINS[match[2] as keyof typeof DOMAINS] ?? match[2];
  }
  if (match) return DOMAINS.plataforma;
  return file.includes("/tests/") ? DOMAINS.arquitectura : DOMAINS.plataforma;
}

/** Flujos (Playwright): describe(Contexto) → describe(Flujo) → test(escenario). */
export function flowLabels(describes: string[], test: string): Labels {
  const [epic = "", feature = ""] = describes;
  if (!KNOWN.has(epic)) {
    throw new Error(
      `el primer describe de un flujo es un contexto de DOMAINS (${[...KNOWN].join(", ")}); llegó "${epic}"`,
    );
  }
  if (!feature)
    throw new Error(`el flujo "${test}" necesita un describe con el nombre del flujo de usuario`);
  return { epic, feature, story: test };
}

/** Unit e integración (Vitest): el contexto sale de la carpeta; el flujo, del primer describe. */
export function codeLabels(file: string, describes: string[], test: string): Labels {
  return { epic: areaOf(file), feature: describes[0] ?? "General", story: test };
}
