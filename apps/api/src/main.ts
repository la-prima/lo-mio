import { createDb, migrate, PgBossEventBus } from "@lo-mio/postgres";
import { PgBoss } from "pg-boss";
import { buildApp } from "./app.ts";
import { contextMigrations, contexts } from "./contexts.ts";
import { loadEnv } from "./env.ts";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
if (env.MIGRATE_ON_START) await migrate(db, contextMigrations());

const boss = new PgBoss(env.DATABASE_URL);
await boss.start();
const bus = new PgBossEventBus(boss, db);

const app = await buildApp(env, db);
for (const context of contexts) await app.register(context.module, { db, bus });
await app.listen({ host: env.HOST, port: env.PORT });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    await boss.stop();
    await db.destroy();
  });
}
