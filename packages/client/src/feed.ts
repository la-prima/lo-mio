/**
 * Feed en vivo de una mesa (apps/api/asyncapi/realtime.yaml): snapshot al conectar y luego cada
 * cambio. Cada ítem trae su `version`: se descarta lo viejo, así reconectar o recibir el mismo
 * cambio por la respuesta HTTP y por el socket nunca duplica nada.
 */
import { useCallback, useEffect, useReducer, useState } from "react";
import type {
  Balance,
  BalanceChanged,
  GuestJoined,
  GuestRenamed,
  Item,
  ItemChanged,
} from "./generated/index.ts";

export type Feed = { items: Item[]; balances: Balance[] };

export type FeedMessage =
  | { type: "snapshot"; items: Item[]; balances: Balance[] }
  | { type: "event"; id: string; topic: "claims.item.changed.v1"; data: ItemChanged }
  | { type: "event"; id: string; topic: "settlement.balance.changed.v1"; data: BalanceChanged }
  | { type: "event"; id: string; topic: "tables.guest.joined.v1"; data: GuestJoined }
  | { type: "event"; id: string; topic: "tables.guest.renamed.v1"; data: GuestRenamed }
  /** Respuesta de un comando (reclamar, compartir, sumarse): el ítem ya actualizado. */
  | { type: "item"; item: Item };

export const emptyFeed: Feed = { items: [], balances: [] };

/** El evento no trae alias: se completan con los comensales que ya conoce el feed. */
function withAliases(item: ItemChanged, balances: Balance[]): Item {
  const alias = new Map(balances.map((b) => [b.guestId, b.alias]));
  return { ...item, shares: item.shares.map((s) => ({ ...s, alias: alias.get(s.guestId) ?? "" })) };
}

function upsertItem(items: Item[], item: Item): Item[] {
  const current = items.find((i) => i.itemId === item.itemId);
  if (!current) return [...items, item];
  if (current.version >= item.version) return items;
  return items.map((i) => (i.itemId === item.itemId ? item : i));
}

const updateGuest = (balances: Balance[], guestId: string, change: Partial<Balance>) =>
  balances.map((b) => (b.guestId === guestId ? { ...b, ...change } : b));

/** Sin cambios devuelve el mismo objeto: React no vuelve a pintar. */
function withItem(feed: Feed, item: Item): Feed {
  const items = upsertItem(feed.items, item);
  return items === feed.items ? feed : { ...feed, items };
}

export function applyFeedMessage(feed: Feed, message: FeedMessage): Feed {
  if (message.type === "snapshot") return { items: message.items, balances: message.balances };
  if (message.type === "item") return withItem(feed, message.item);
  const { balances } = feed;
  switch (message.topic) {
    case "claims.item.changed.v1":
      return withItem(feed, withAliases(message.data, balances));
    case "settlement.balance.changed.v1": {
      const { guestId, balance } = message.data;
      return { ...feed, balances: updateGuest(balances, guestId, { balance }) };
    }
    case "tables.guest.joined.v1": {
      const { guestId, alias, currency } = message.data;
      if (balances.some((b) => b.guestId === guestId)) return feed;
      return {
        ...feed,
        balances: [...balances, { guestId, alias, balance: { amount: 0, currency } }],
      };
    }
    case "tables.guest.renamed.v1": {
      const { guestId, alias } = message.data;
      return { ...feed, balances: updateGuest(balances, guestId, { alias }) };
    }
  }
}

/** Cierre por falta de sesión (realtime.ts): reconectar no lo arregla. */
const UNAUTHORIZED = 4401;

/**
 * Se conecta al feed de la sesión y reconecta solo si se corta (con espera creciente hasta 10 s).
 * `origin` es el de la API (`https://…`); en la web del comensal, el mismo de la página.
 */
export function useSessionFeed(sessionId: string, origin: string) {
  const [feed, dispatch] = useReducer(applyFeedMessage, emptyFeed);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const url = `${origin.replace(/^http/, "ws")}/v1/sessions/${sessionId}/events`;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;
    const connect = () => {
      socket = new WebSocket(url);
      socket.onmessage = (e) => {
        attempt = 0;
        setConnected(true);
        dispatch(JSON.parse(String(e.data)) as FeedMessage);
      };
      socket.onclose = (e) => {
        setConnected(false);
        if (stopped || e.code === UNAUTHORIZED) return;
        retry = setTimeout(connect, Math.min(10_000, 500 * 2 ** attempt++));
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [sessionId, origin]);
  const applyItem = useCallback((item: Item) => dispatch({ type: "item", item }), []);
  return { ...feed, connected, applyItem };
}
