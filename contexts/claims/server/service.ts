import { createEvent, type EventBus, type EventEnvelope, newId } from "@lo-mio/kernel";
import { type Db, runIdempotent, type Tx } from "@lo-mio/postgres";
import { type Actor, type CommandResponse, idempotencyScope } from "@lo-mio/server";
import {
  type ClaimError,
  decide,
  evolve,
  type ItemCommand,
  type ItemState,
  type Owner,
  sharesOf,
  statusOf,
} from "../domain/index.ts";
import * as repo from "./repository.ts";

export type ClaimsDeps = { db: Db; bus: EventBus<Tx> };
type Guest = Extract<Actor, { kind: "guest" }>;

const problem = (status: number, slug: string, title: string): CommandResponse => ({
  status,
  body: { type: `https://lo-mio.cl/problems/${slug}`, title, status },
});

const REJECTIONS: Record<ClaimError | "unknown-guest", CommandResponse> = {
  "already-owned": problem(409, "already-owned", "El ítem ya tiene dueño"),
  "already-owner": problem(409, "already-owner", "Ya estás en este ítem"),
  "not-owned": problem(422, "not-owned", "El ítem todavía no tiene dueño: reclamarlo primero"),
  "not-in-share": problem(422, "not-in-share", "Quien comparte debe estar en el reparto"),
  "not-allowed": problem(422, "not-allowed", "Solo un dueño del ítem puede repartirlo"),
  "invalid-portions": problem(
    422,
    "invalid-portions",
    "Reparto inválido: 2 o más comensales distintos, porciones enteras",
  ),
  "unknown-guest": problem(422, "unknown-guest", "Alguien del reparto no está en esta mesa"),
};

/** Vista del ítem con el alias de cada dueño (feed). */
export function itemView(state: ItemState, aliases: Map<string, string>) {
  const shares = sharesOf(state).map((s) => ({
    ...s,
    alias: aliases.get(s.guestId) ?? "Comensal",
  }));
  return { ...state, status: statusOf(state), shares };
}

/** claims.item.changed.v1: estado completo (los consumidores proyectan por version). */
async function publishChanged(deps: ClaimsDeps, tx: Tx, venueId: string, state: ItemState) {
  const { itemId, sessionId, name, price, version } = state;
  const data = {
    itemId,
    sessionId,
    name,
    price,
    version,
    status: statusOf(state),
    shares: sharesOf(state),
  };
  await deps.bus.publish(
    createEvent({ type: "claims.item.changed", version: 1, venueId, aggregateId: itemId, data }),
    { tx },
  );
}

// ---------- eventos de otros contextos ----------

type ItemSeated = {
  sessionId: string;
  itemId: string;
  name: string;
  unitPrice: { amount: number; currency: string };
};

/** tables.item.seated.v1 → ítem nuevo sin dueño (evento "added", versión 1). */
export const onItemSeated = (deps: ClaimsDeps) => async (event: EventEnvelope, tx: Tx) => {
  const seated = event.data as ItemSeated;
  const added = {
    type: "added" as const,
    sessionId: seated.sessionId,
    name: seated.name,
    price: seated.unitPrice,
  };
  const state = evolve(undefined, added, newId());
  if (!(await repo.insertItem(tx, { venueId: event.venueId, posUnitRef: seated.itemId, state })))
    return;
  await repo.appendEvent(tx, state.itemId, state.version, added, { kind: "system", id: null });
  await publishChanged(deps, tx, event.venueId, state);
};

export async function onGuestJoined(event: EventEnvelope, tx: Tx) {
  const { guestId, sessionId, alias } = event.data as {
    guestId: string;
    sessionId: string;
    alias: string;
  };
  await repo.upsertGuest(tx, { guest_id: guestId, session_id: sessionId, alias });
}

// ---------- comandos del comensal ----------

/** Aplica un comando del comensal a un ítem de su sesión, una sola vez por Idempotency-Key. */
export async function command(
  deps: ClaimsDeps,
  actor: Guest,
  itemId: string,
  cmd: ItemCommand,
  key: string,
) {
  const request = [cmd.type, itemId, cmd];
  return runIdempotent(deps.db, { scope: idempotencyScope(actor), key, request }, async (tx) => {
    const row = await repo.lockItem(tx, itemId);
    // Un ítem de otra sesión no existe para este comensal.
    if (!row || row.state.sessionId !== actor.sessionId)
      return problem(404, "not-found", "Recurso no encontrado");
    const aliases = await repo.guestsOf(tx, actor.sessionId);
    if (cmd.type === "share" && cmd.owners.some((o: Owner) => !aliases.has(o.guestId)))
      return REJECTIONS["unknown-guest"];
    const decided = decide(row.state, cmd);
    if (!decided.ok) return REJECTIONS[decided.error];
    const next = evolve(row.state, decided.value, itemId);
    await repo.appendEvent(tx, itemId, next.version, decided.value, {
      kind: "guest",
      id: actor.guestId,
    });
    await repo.saveState(tx, next);
    await publishChanged(deps, tx, row.venueId, next);
    return { status: 200, body: itemView(next, aliases) };
  });
}

// ---------- consultas ----------

/** Feed de la sesión: para sus comensales o el personal del local (otro local no ve nada). */
export async function sessionFeed(db: Db, actor: Actor, sessionId: string) {
  if (actor.kind === "guest" && actor.sessionId !== sessionId) return undefined;
  const rows = await repo.sessionItems(db, sessionId);
  const aliases = await repo.guestsOf(db, sessionId);
  return rows.filter((r) => r.venueId === actor.venueId).map((r) => itemView(r.state, aliases));
}

/** Historial del ítem (auditoría), solo del local del encargado. */
export async function itemHistory(
  db: Db,
  actor: Extract<Actor, { kind: "staff" }>,
  itemId: string,
) {
  const row = await repo.findItem(db, itemId);
  if (!row || row.venueId !== actor.venueId) return undefined;
  return (await repo.history(db, itemId)).map((e) => ({
    version: e.version,
    type: e.type,
    at: e.at.toISOString(),
    actor: e.actor_id ? { kind: e.actor_kind, id: e.actor_id } : { kind: e.actor_kind },
    data: e.data,
  }));
}
