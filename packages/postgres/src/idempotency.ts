import { createHash } from "node:crypto";
import type { Db, Tx } from "./db.ts";

export type CommandResponse = { status: number; body: unknown };
export type Idempotent = CommandResponse | { reused: true };

/**
 * Ejecuta un comando una sola vez por (scope, key), dentro de una transacción. Un reintento con
 * la misma clave y la misma solicitud devuelve la respuesta original sin volver a ejecutar; con
 * otra solicitud devuelve `{ reused: true }` (→ 422). Dos intentos simultáneos se serializan en
 * la clave primaria.
 */
export async function runIdempotent(
  db: Db,
  command: { scope: string; key: string; request: unknown },
  run: (tx: Tx) => Promise<CommandResponse>,
): Promise<Idempotent> {
  const requestHash = createHash("sha256").update(JSON.stringify(command.request)).digest("hex");
  return db.transaction().execute(async (tx) => {
    const claimed = await tx
      .insertInto("idempotency_keys")
      .values({
        scope: command.scope,
        key: command.key,
        request_hash: requestHash,
        status: 0,
        body: null,
      })
      .onConflict((oc) => oc.doNothing())
      .returning("key")
      .executeTakeFirst();
    if (!claimed) {
      const previous = await tx
        .selectFrom("idempotency_keys")
        .select(["request_hash", "status", "body"])
        .where("scope", "=", command.scope)
        .where("key", "=", command.key)
        .executeTakeFirstOrThrow();
      if (previous.request_hash !== requestHash) return { reused: true };
      return { status: previous.status, body: previous.body };
    }
    const response = await run(tx);
    await tx
      .updateTable("idempotency_keys")
      .set({ status: response.status, body: JSON.stringify(response.body ?? null) })
      .where("scope", "=", command.scope)
      .where("key", "=", command.key)
      .execute();
    return response;
  });
}
