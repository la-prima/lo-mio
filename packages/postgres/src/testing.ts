import { PostgreSqlContainer } from "@testcontainers/postgresql";

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
