/**
 * Une contratos OpenAPI ya empaquetados (sin $ref externos) en el contrato de la API.
 * Reglas: un path o un operationId repetido es error; un componente con el mismo nombre solo se
 * acepta si es idéntico (pasa con los que vienen de contracts/common.yaml).
 */
import { isDeepStrictEqual } from "node:util";

type Operation = { operationId?: string };
type Doc = {
  openapi?: string;
  info?: unknown;
  servers?: unknown;
  tags?: { name: string }[];
  paths?: Record<string, Record<string, Operation>>;
  components?: Record<string, Record<string, unknown>>;
};
type Merged = Doc & {
  tags: { name: string }[];
  paths: Record<string, Record<string, Operation>>;
  components: Record<string, Record<string, unknown>>;
};

function addPaths(target: Merged, doc: Doc, name: string, operationIds: Set<string>): void {
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (path in target.paths) throw new Error(`${name}: el path ${path} ya está declarado`);
    for (const { operationId } of Object.values(item)) {
      if (!operationId) continue;
      if (operationIds.has(operationId))
        throw new Error(`${name}: operationId ${operationId} repetido`);
      operationIds.add(operationId);
    }
    target.paths[path] = item;
  }
}

function addComponents(target: Merged, doc: Doc, name: string): void {
  for (const [kind, entries] of Object.entries(doc.components ?? {})) {
    const bucket = target.components[kind] ?? {};
    for (const [key, value] of Object.entries(entries)) {
      if (key in bucket && !isDeepStrictEqual(bucket[key], value)) {
        throw new Error(`${name}: components.${kind}.${key} ya existe con otra definición`);
      }
      bucket[key] = value;
    }
    target.components[kind] = bucket;
  }
}

function addTags(target: Merged, doc: Doc): void {
  for (const tag of doc.tags ?? []) {
    if (!target.tags.some((t) => t.name === tag.name)) target.tags.push(tag);
  }
}

export function mergeOpenApi(base: Doc, docs: [string, Doc][]): Merged {
  const merged: Merged = { ...base, tags: [], paths: {}, components: {} };
  const operationIds = new Set<string>();
  for (const [name, doc] of [["base", base] as [string, Doc], ...docs]) {
    addPaths(merged, doc, name, operationIds);
    addComponents(merged, doc, name);
    addTags(merged, doc);
  }
  return merged;
}
