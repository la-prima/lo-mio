import { createDb, migrate } from "@lo-mio/postgres";
import { contextMigrations } from "./contexts.ts";
import { loadEnv } from "./env.ts";

// Entrypoint del Job de migraciones de Helm: aplica lo pendiente y termina.
const env = loadEnv();
const db = createDb(env.DATABASE_URL);
try {
  const applied = await migrate(db, contextMigrations());
  process.stdout.write(`${JSON.stringify({ msg: "migraciones aplicadas", applied })}\n`);
} finally {
  await db.destroy();
}
