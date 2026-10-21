/**
 * Alta inicial de un local y su administrador (el MVP no tiene autoservicio). Idempotente: si el
 * email ya existe, no hace nada. Uso (variables de entorno):
 *   DATABASE_URL, SEED_VENUE_NAME, SEED_VENUE_COUNTRY (CL), SEED_ADMIN_NAME, SEED_ADMIN_EMAIL,
 *   SEED_ADMIN_PASSWORD (≥ 12 caracteres)   →   node src/seed.ts
 */
import { newId } from "@lo-mio/kernel";
import { createDb, type Db, migrate } from "@lo-mio/postgres";
import { staffService } from "@lo-mio/staff/server";
import { registerVenue } from "@lo-mio/venues/domain";
import { venuesRepository } from "@lo-mio/venues/server";
import { z } from "zod";
import { contextMigrations } from "./contexts.ts";

const seedSchema = z.object({
  DATABASE_URL: z.url(),
  SEED_VENUE_NAME: z.string().min(1),
  SEED_VENUE_COUNTRY: z.string().default("CL"),
  SEED_ADMIN_NAME: z.string().min(1),
  SEED_ADMIN_EMAIL: z.email(),
  SEED_ADMIN_PASSWORD: z.string(),
});
export type SeedInput = z.infer<typeof seedSchema>;

/** Devuelve el id del local creado, o `undefined` si el administrador ya existía. */
export async function seed(
  db: Db,
  input: Omit<SeedInput, "DATABASE_URL">,
): Promise<string | undefined> {
  if (await staffService.memberExists(db, input.SEED_ADMIN_EMAIL)) return undefined;
  const venue = registerVenue({
    id: newId(),
    name: input.SEED_VENUE_NAME,
    country: input.SEED_VENUE_COUNTRY,
  });
  if (!venue.ok) throw new Error(`no se puede crear el local: ${venue.error}`);
  await venuesRepository.insertVenue(db, venue.value);
  await staffService.addMember(db, {
    venueId: venue.value.id,
    email: input.SEED_ADMIN_EMAIL,
    name: input.SEED_ADMIN_NAME,
    role: "admin",
    password: input.SEED_ADMIN_PASSWORD,
  });
  return venue.value.id;
}

if (import.meta.main) {
  const input = seedSchema.parse(process.env);
  const db = createDb(input.DATABASE_URL);
  try {
    await migrate(db, contextMigrations());
    const venueId = await seed(db, input);
    process.stdout.write(
      `${JSON.stringify({ msg: venueId ? "local creado" : "ya existía", venueId })}\n`,
    );
  } finally {
    await db.destroy();
  }
}
