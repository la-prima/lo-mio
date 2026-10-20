import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, Wait } from "testcontainers";

/**
 * Postgres real y descartable para tests de integración.
 * ponytail: un contenedor por archivo de test; pasar a globalSetup compartido si la suite tarda.
 */
export async function startPostgres(): Promise<{ url: string; stop: () => Promise<void> }> {
  const container = await new PostgreSqlContainer("postgres:18-alpine").start();
  return {
    url: container.getConnectionUri(),
    stop: async () => {
      await container.stop();
    },
  };
}

/**
 * Microcks descartable con los contratos cargados: mocks fieles a sus ejemplos.
 * Sin @microcks/microcks-testcontainers: fija `Content-Length` a mano y el fetch de Node 24 lo
 * rechaza. Esto hace lo mismo con la API de Microcks.
 */
export async function startMicrocks(contracts: string[]): Promise<{
  mockUrl: (service: string, version: string) => string;
  stop: () => Promise<void>;
}> {
  const container = await new GenericContainer("quay.io/microcks/microcks-uber:1.15.0")
    .withExposedPorts(8080)
    .withWaitStrategy(Wait.forHttp("/api/health", 8080))
    .start();
  const base = `http://${container.getHost()}:${container.getMappedPort(8080)}`;
  for (const contract of contracts) {
    const form = new FormData();
    form.append("file", new Blob([readFileSync(contract)]), basename(contract));
    const res = await fetch(`${base}/api/artifact/upload?mainArtifact=true`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`Microcks rechazó ${contract}: ${res.status} ${await res.text()}`);
  }
  return {
    mockUrl: (service, version) => `${base}/rest/${encodeURIComponent(service)}/${version}`,
    stop: async () => {
      await container.stop();
    },
  };
}
