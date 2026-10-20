import { createDb, migrate, PgBossEventBus } from "@lo-mio/postgres";
import { PgBoss } from "pg-boss";
import { buildApp } from "./app.ts";
import { compose } from "./compose.ts";
import { contextMigrations, contexts, eventCatalog } from "./contexts.ts";
import { loadEnv } from "./env.ts";
import { registerRealtime } from "./realtime.ts";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
if (env.MIGRATE_ON_START) await migrate(db, contextMigrations());

const boss = new PgBoss(env.DATABASE_URL);
await boss.start();
const bus = new PgBossEventBus(boss, db, eventCatalog());

const deps = { db, bus };
const app = await buildApp(env, compose(deps));
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
