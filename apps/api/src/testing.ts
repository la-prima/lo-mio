/** API completa contra un Postgres real y descartable: misma composición que main.ts. */
import { newId } from "@lo-mio/kernel";
import { createDb, migrate, PgBossEventBus } from "@lo-mio/postgres";
import { startPostgres } from "@lo-mio/postgres/testing";
import { staffService } from "@lo-mio/staff/server";
import { PgBoss } from "pg-boss";
import { buildApp } from "./app.ts";
import { compose } from "./compose.ts";
import { contextMigrations, contexts, eventCatalog } from "./contexts.ts";
import { loadEnv } from "./env.ts";
import { seed } from "./seed.ts";

export const PASSWORD = "una-clave-larga-de-prueba";

export async function startApi() {
  const pg = await startPostgres();
  const db = createDb(pg.url);
  await migrate(db, contextMigrations());
  const boss = new PgBoss({ connectionString: pg.url, useListenNotify: true });
  await boss.start();
  const bus = new PgBossEventBus(boss, db, eventCatalog());
  const app = await buildApp(
    loadEnv({ DATABASE_URL: pg.url, LOG_LEVEL: "fatal" }),
    compose({ db, bus }),
  );
  // Mismas suscripciones que main.ts: los eventos viajan por el bus real (pg-boss).
  for (const context of contexts) await context.subscribe?.({ db, bus });

  /** Crea un local con su administrador y devuelve el id del local. */
  const newVenue = async (name = `Local ${newId().slice(-6)}`) => {
    const venueId = await seed(db, {
      SEED_VENUE_NAME: name,
      SEED_VENUE_COUNTRY: "CL",
      SEED_ADMIN_NAME: "Admin",
      SEED_ADMIN_EMAIL: `admin-${newId()}@lo-mio.test`,
      SEED_ADMIN_PASSWORD: PASSWORD,
    });
    if (!venueId) throw new Error("el seed no creó el local");
    return venueId;
  };

  /** Persona del personal con sesión iniciada por HTTP; devuelve su token. */
  const staff = async (venueId: string, role: "waiter" | "manager" | "admin") => {
    const email = `${role}-${newId()}@lo-mio.test`;
    await staffService.addMember(db, { venueId, email, name: role, role, password: PASSWORD });
    const res = await app.inject({
      method: "POST",
      url: "/v1/staff/sessions",
      payload: { email, password: PASSWORD },
    });
    return { token: (res.json() as { token: string }).token, email };
  };

  const stop = async () => {
    await app.close();
    await boss.stop({ graceful: false });
    await db.destroy();
    await pg.stop();
  };
  return { app, db, newVenue, staff, stop };
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
export const command = (token: string) => ({ ...bearer(token), "idempotency-key": newId() });
