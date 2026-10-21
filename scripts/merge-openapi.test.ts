import { describe, expect, it } from "vitest";
import { mergeOpenApi } from "./merge-openapi.ts";

const problem = { type: "object", properties: { title: { type: "string" } } };
const base = {
  openapi: "3.1.0",
  info: { title: "api" },
  paths: { "/health": { get: { operationId: "getHealth" } } },
};

describe("Unión de contratos OpenAPI", () => {
  it("une paths, tags y componentes de varios contextos", () => {
    const merged = mergeOpenApi(base, [
      [
        "venues",
        {
          tags: [{ name: "venues" }],
          paths: { "/v1/venues": { get: { operationId: "getVenue" } } },
          components: { schemas: { Problem: problem } },
        },
      ],
      [
        "claims",
        {
          tags: [{ name: "claims" }],
          paths: { "/v1/claims": { post: { operationId: "claim" } } },
          components: { schemas: { Problem: problem } },
        },
      ],
    ]);
    expect(Object.keys(merged.paths ?? {})).toEqual(["/health", "/v1/venues", "/v1/claims"]);
    expect(merged.tags?.map((t) => t.name)).toEqual(["venues", "claims"]);
    expect(merged.components?.schemas?.Problem).toEqual(problem);
  });

  it("rechaza un componente con el mismo nombre y otra definición", () => {
    const other = { type: "object", properties: { detail: { type: "string" } } };
    expect(() =>
      mergeOpenApi(base, [
        ["a", { components: { schemas: { Problem: problem } } }],
        ["b", { components: { schemas: { Problem: other } } }],
      ]),
    ).toThrow(/Problem ya existe con otra definición/);
  });

  it("rechaza paths u operationId repetidos entre contextos", () => {
    expect(() => mergeOpenApi(base, [["a", { paths: { "/health": { get: {} } } }]])).toThrow(
      /path \/health/,
    );
    expect(() =>
      mergeOpenApi(base, [["a", { paths: { "/x": { get: { operationId: "getHealth" } } } }]]),
    ).toThrow(/operationId getHealth repetido/);
  });
});
