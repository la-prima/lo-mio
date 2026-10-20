// Todo lo de la API sale del contrato (ver tools/codegen): tipos, funciones, schemas y hooks.
export * from "./generated/@tanstack/react-query.gen.ts";
export { createClient, createConfig } from "./generated/client/index.ts";
export * from "./generated/index.ts";
export * as schemas from "./generated/zod.gen.ts";
