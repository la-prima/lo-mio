// Todo lo de la API sale del contrato (ver tools/codegen): tipos, funciones y hooks.
// Los schemas zod van aparte (`@lo-mio/client/schemas`): sin usarlos, no pesan en el bundle.

export * from "./feed.ts";
export * from "./generated/@tanstack/react-query.gen.ts";
export { createClient, createConfig } from "./generated/client/index.ts";
export { client } from "./generated/client.gen.ts";
export * from "./generated/index.ts";
