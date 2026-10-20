import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  /** En Kubernetes las migraciones corren en un Job previo al despliegue (`src/migrate.ts`). */
  MIGRATE_ON_START: z.stringbool().default(true),
  /** Orígenes permitidos para CORS, separados por coma. Vacío = ninguno. */
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

/** Valida el entorno al arranque: si falta o sobra algo inválido, el proceso no arranca. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  throw new Error(`Variables de entorno inválidas:\n- ${problems.join("\n- ")}`);
}
