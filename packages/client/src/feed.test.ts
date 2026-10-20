import { describe, expect, it } from "vitest";
import { applyFeedMessage, emptyFeed, type Feed } from "./feed.ts";
import type { Item } from "./generated/index.ts";

const clp = (amount: number) => ({ amount, currency: "CLP" });
const ana = { guestId: "g-ana", alias: "Ana", balance: clp(0) };
const schop: Item = {
  itemId: "i-1",
  sessionId: "s-1",
  name: "Schop",
  price: clp(4500),
  status: "unowned",
  version: 1,
  shares: [],
};
const claimed = {
  ...schop,
  status: "claimed" as const,
  version: 2,
  shares: [{ guestId: "g-ana", portions: 1, amount: clp(4500) }],
};
const start: Feed = applyFeedMessage(emptyFeed, {
  type: "snapshot",
  items: [schop],
  balances: [ana],
});
const event = <T>(topic: T, data: unknown) =>
  ({ type: "event", id: crypto.randomUUID(), topic, data }) as never;

describe("Feed en vivo de la mesa", () => {
  it("un cambio de ítem reemplaza la versión anterior y trae el alias de cada dueño", () => {
    const feed = applyFeedMessage(start, event("claims.item.changed.v1", claimed));
    expect(feed.items).toEqual([{ ...claimed, shares: [{ ...claimed.shares[0], alias: "Ana" }] }]);
  });

  it("descarta una versión igual o más vieja (reconexión o respuesta HTTP repetida)", () => {
    const feed = applyFeedMessage(start, event("claims.item.changed.v1", claimed));
    expect(applyFeedMessage(feed, { type: "item", item: schop })).toBe(feed);
    expect(applyFeedMessage(feed, event("claims.item.changed.v1", claimed))).toBe(feed);
  });

  it("un comensal nuevo aparece con saldo 0 y una sola vez", () => {
    const joined = event("tables.guest.joined.v1", {
      sessionId: "s-1",
      guestId: "g-beto",
      alias: "Beto",
      currency: "CLP",
    });
    const feed = applyFeedMessage(applyFeedMessage(start, joined), joined);
    expect(feed.balances.map((b) => [b.alias, b.balance.amount])).toEqual([
      ["Ana", 0],
      ["Beto", 0],
    ]);
  });

  it("actualiza el saldo y el alias del comensal", () => {
    let feed = applyFeedMessage(
      start,
      event("settlement.balance.changed.v1", {
        sessionId: "s-1",
        guestId: "g-ana",
        balance: clp(4500),
      }),
    );
    feed = applyFeedMessage(
      feed,
      event("tables.guest.renamed.v1", { sessionId: "s-1", guestId: "g-ana", alias: "Anita" }),
    );
    expect(feed.balances).toEqual([{ guestId: "g-ana", alias: "Anita", balance: clp(4500) }]);
  });

  it("el snapshot de una reconexión reemplaza todo el estado", () => {
    const feed = applyFeedMessage(start, { type: "snapshot", items: [], balances: [] });
    expect(feed).toEqual(emptyFeed);
  });
});
