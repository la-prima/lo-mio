import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { GenericContainer, Wait } from "testcontainers";

/**
 * Espera a que no quede ningún cliente conectado. `pool.end()` (Kysely, pg-boss) resuelve antes de
 * que cada socket termine de cerrarse: si el contenedor se apaga en ese hueco, Postgres envía 57P01
 * a una conexión que ya salió del pool (sin listener) y el test termina con un error no manejado.
 */
async function waitForNoClients(url: string, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = new pg.Client({ connectionString: url });
    await probe.connect();
    const { rows } = await probe.query<{ n: number }>(
      "select count(*)::int as n from pg_stat_activity where backend_type = 'client backend' and pid <> pg_backend_pid()",
    );
    // end() resuelve cuando el socket se cerró: la sonda nunca queda colgando.
    await probe.end();
    if (rows[0]?.n === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    "quedaron conexiones abiertas a Postgres al terminar el test: ¿falta un destroy/stop?",
  );
}

/**
 * Postgres real y descartable para tests de integración.
 * ponytail: un contenedor por archivo de test; pasar a globalSetup compartido si la suite tarda.
 */
export async function startPostgres(): Promise<{ url: string; stop: () => Promise<void> }> {
  const container = await new PostgreSqlContainer("postgres:18-alpine").start();
  return {
    url: container.getConnectionUri(),
    stop: async () => {
      await waitForNoClients(container.getConnectionUri());
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
