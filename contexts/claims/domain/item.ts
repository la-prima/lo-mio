import { err, type Money, ok, type Result, splitAmount } from "@lo-mio/kernel";

/** Dueño de un ítem y cuántas porciones le tocan (partes iguales = 1 porción cada uno). */
export type Owner = { guestId: string; portions: number };

export type ItemState = {
  itemId: string;
  sessionId: string;
  name: string;
  price: Money;
  /** Cantidad de eventos aplicados: control optimista de concurrencia. */
  version: number;
  owners: Owner[];
};

/** Eventos de dominio de un ítem: son la auditoría (spec item-claims) y la fuente del estado. */
export type ItemEvent =
  | { type: "added"; sessionId: string; name: string; price: Money }
  | { type: "claimed"; guestId: string }
  | { type: "shared"; owners: Owner[] }
  | { type: "joined"; guestId: string };

export type ItemCommand =
  | { type: "claim"; guestId: string }
  | { type: "share"; guestId: string; owners: Owner[] }
  | { type: "join"; guestId: string };

export type ClaimError =
  | "already-owned"
  | "not-owned"
  | "already-owner"
  | "not-in-share"
  | "not-allowed"
  | "invalid-portions";

const isOwner = (state: ItemState, guestId: string) =>
  state.owners.some((o) => o.guestId === guestId);

/** Aplica un evento al estado (pura y total: nunca falla, los eventos ya ocurrieron). */
export function evolve(state: ItemState | undefined, event: ItemEvent, itemId: string): ItemState {
  if (event.type === "added") {
    return {
      itemId,
      sessionId: event.sessionId,
      name: event.name,
      price: event.price,
      version: 1,
      owners: [],
    };
  }
  if (!state) throw new Error(`evento ${event.type} antes de "added" en el ítem ${itemId}`);
  const next = { ...state, version: state.version + 1 };
  if (event.type === "claimed")
    return { ...next, owners: [{ guestId: event.guestId, portions: 1 }] };
  if (event.type === "shared") return { ...next, owners: event.owners };
  // joined: en un reparto por porciones, el que se suma lleva una porción, igual que en partes iguales.
  return { ...next, owners: [...state.owners, { guestId: event.guestId, portions: 1 }] };
}

/** Reconstruye el estado vigente desde los eventos (spec: "el estado se reconstruye"). */
export const fold = (itemId: string, events: ItemEvent[]): ItemState | undefined =>
  events.reduce<ItemState | undefined>((state, event) => evolve(state, event, itemId), undefined);

function decideShare(
  state: ItemState,
  command: Extract<ItemCommand, { type: "share" }>,
): Result<ItemEvent, ClaimError> {
  // Comparte quien ya es dueño, o cualquiera si el ítem no tiene dueño. Siempre se incluye a sí mismo.
  if (state.owners.length > 0 && !isOwner(state, command.guestId)) return err("not-allowed");
  if (!command.owners.some((o) => o.guestId === command.guestId)) return err("not-in-share");
  const ids = command.owners.map((o) => o.guestId);
  const validPortions = command.owners.every(
    (o) => Number.isSafeInteger(o.portions) && o.portions >= 1 && o.portions <= 100,
  );
  if (command.owners.length < 2 || new Set(ids).size !== ids.length || !validPortions)
    return err("invalid-portions");
  return ok({ type: "shared", owners: command.owners });
}

/** Decide qué evento produce un comando sobre el estado vigente, o por qué no se puede. */
export function decide(state: ItemState, command: ItemCommand): Result<ItemEvent, ClaimError> {
  if (command.type === "claim") {
    return state.owners.length === 0
      ? ok({ type: "claimed", guestId: command.guestId })
      : err("already-owned");
  }
  if (command.type === "share") return decideShare(state, command);
  if (state.owners.length === 0) return err("not-owned");
  if (isOwner(state, command.guestId)) return err("already-owner");
  return ok({ type: "joined", guestId: command.guestId });
}

/** Parte de cada dueño: la suma es siempre el precio (el resto va a los primeros, determinista). */
export function sharesOf(state: ItemState): { guestId: string; portions: number; amount: Money }[] {
  if (state.owners.length === 0) return [];
  const amounts = splitAmount(
    state.price.amount,
    state.owners.map((o) => o.portions),
  );
  return state.owners.map((o, i) => ({
    ...o,
    amount: { amount: amounts[i] ?? 0, currency: state.price.currency },
  }));
}

export const statusOf = (state: ItemState): "unowned" | "claimed" | "shared" =>
  state.owners.length === 0 ? "unowned" : state.owners.length === 1 ? "claimed" : "shared";
