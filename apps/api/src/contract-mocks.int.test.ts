import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startMicrocks } from "@lo-mio/postgres/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";

const PLATFORM = join(import.meta.dirname, "../openapi/platform.yaml");
const contract = parse(readFileSync(PLATFORM, "utf8"));
const exampleOf = (path: string, status: string, name: string) =>
  contract.paths[path].get.responses[status].content["application/json"].examples[name].value;

describe("mocks desde el contrato (Microcks)", () => {
  let microcks: Awaited<ReturnType<typeof startMicrocks>>;
  let mock: string;

  beforeAll(async () => {
    // Microcks no sigue $ref a otros archivos (contracts/common.yaml): se sube el contrato empaquetado.
    const bundled = join(mkdtempSync(join(tmpdir(), "lo-mio-mock-")), "platform.yaml");
    execFileSync("pnpm", ["exec", "redocly", "bundle", PLATFORM, "-o", bundled], {
      stdio: "ignore",
    });
    microcks = await startMicrocks([bundled]);
    mock = microcks.mockUrl(contract.info.title, contract.info.version);
  });
  afterAll(() => microcks.stop());

  it("el mock responde siempre el ejemplo por defecto del contrato", async () => {
    for (const path of ["/health/live", "/health", "/health", "/health"]) {
      const res = await fetch(`${mock}${path}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(exampleOf(path, "200", "ok"));
    }
  });

  it("un consumidor puede pedir un ejemplo de error del contrato con X-Mock-Example", async () => {
    const res = await fetch(`${mock}/health`, {
      headers: { "X-Mock-Example": "dependency-unavailable" },
    });
    expect(res.status).toBe(503);
    const problem =
      contract.paths["/health"].get.responses["503"].content["application/problem+json"];
    expect(await res.json()).toEqual(problem.examples["dependency-unavailable"].value);
  });

  it("el mock no responde rutas que el contrato no declara", async () => {
    const res = await fetch(`${mock}/admin`);
    expect(res.ok).toBe(false);
  });
});
