import { createBoss, createDb, migrate, PgBossEventBus } from "@lo-mio/postgres";
import { buildApp } from "./app.ts";
import { compose } from "./compose.ts";
import { contextMigrations, contexts, eventCatalog } from "./contexts.ts";
import { loadEnv } from "./env.ts";
import { registerRealtime } from "./realtime.ts";

const env = loadEnv();
// Una conexión inactiva cortada por Postgres (reinicio, failover) se registra y el pool la
// reemplaza: la API sigue en pie. (`app` existe antes de que el pool tenga conexiones inactivas.)
const db = createDb(env.DATABASE_URL, (err) =>
  app.log.error({ err }, "Postgres cortó una conexión inactiva del pool"),
);
if (env.MIGRATE_ON_START) await migrate(db, contextMigrations());

const boss = createBoss(env.DATABASE_URL);
await boss.start();
const bus = new PgBossEventBus(boss, db, eventCatalog());

const deps = { db, bus };
const app = await buildApp(env, compose(deps));
boss.on("error", (err) => app.log.error({ err }, "error de pg-boss"));
await registerRealtime(app, { ...deps, connectionString: env.DATABASE_URL });
for (const context of contexts) await context.subscribe?.(deps);
await app.listen({ host: env.HOST, port: env.PORT });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    await boss.stop();
    await db.destroy();
  });
}
