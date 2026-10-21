import { Ajv, type Options } from "ajv";
import addFormats from "ajv-formats";
import type { FastifyInstance } from "fastify";

// strict: false porque los schemas traen palabras de OpenAPI (examples, description, x-*).
const base: Options = { allErrors: false, strict: false, useDefaults: true };

type ObjectSchema = { properties?: Record<string, unknown>; required?: string[] };

/** Node entrega los headers en minúsculas (HTTP no distingue): el schema debe coincidir. */
function lowercaseHeaders(schema: ObjectSchema): ObjectSchema {
  const properties = Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return { ...schema, properties, required: schema.required?.map((name) => name.toLowerCase()) };
}

/**
 * Body: se valida tal cual dice el contrato. Fastify por defecto convierte tipos (un número pasa a
 * string) y quita propiedades desconocidas: un request inválido se "arreglaría" en silencio.
 * Query, params y headers sí se convierten, porque en HTTP siempre llegan como texto.
 */
export function registerContractValidation(app: FastifyInstance): void {
  const strict = addFormats.default(
    new Ajv({ ...base, coerceTypes: false, removeAdditional: false }),
  );
  const coercing = addFormats.default(
    new Ajv({ ...base, coerceTypes: "array", removeAdditional: false }),
  );
  app.setValidatorCompiler(({ schema, httpPart }) => {
    if (httpPart === "body") return strict.compile(schema);
    return coercing.compile(
      httpPart === "headers" ? lowercaseHeaders(schema as ObjectSchema) : schema,
    );
  });
}
