import { describe, expect, it } from "vitest";
import { decide, fold, type ItemEvent, type ItemState, sharesOf, statusOf } from "./index.ts";

const added = (amount: number): ItemEvent => ({
  type: "added",
  sessionId: "s1",
  name: "Tabla",
  price: { amount, currency: "CLP" },
});

function apply(events: ItemEvent[], ...commands: Parameters<typeof decide>[1][]): ItemState {
  let all = events;
  for (const command of commands) {
    const state = fold("i1", all);
    if (!state) throw new Error("sin estado");
    const decided = decide(state, command);
    if (!decided.ok) throw new Error(decided.error);
    all = [...all, decided.value];
  }
  const state = fold("i1", all);
  if (!state) throw new Error("sin estado");
  return state;
}
const amounts = (state: ItemState) => sharesOf(state).map((s) => [s.guestId, s.amount.amount]);

describe("Reclamo de ítem completo", () => {
  it("un ítem nuevo no tiene dueño", () => {
    expect(statusOf(apply([added(4500)]))).toBe("unowned");
  });

  it("'lo mío' en una cerveza sin dueño la asigna a quien la reclama por su precio", () => {
    const state = apply([added(4500)], { type: "claim", guestId: "ana" });
    expect(statusOf(state)).toBe("claimed");
    expect(amounts(state)).toEqual([["ana", 4500]]);
  });

  it("un ítem ya reclamado no se puede reclamar de nuevo: se propone compartirlo", () => {
    const state = apply([added(4500)], { type: "claim", guestId: "ana" });
    expect(decide(state, { type: "claim", guestId: "beto" })).toEqual({
      ok: false,
      error: "already-owned",
    });
  });
});

describe("Ítems compartidos", () => {
  it("una tabla de 10.000 entre 3 en partes iguales: 3.334, 3.333 y 3.333", () => {
    const owners = ["ana", "beto", "caro"].map((guestId) => ({ guestId, portions: 1 }));
    const state = apply([added(10_000)], { type: "share", guestId: "ana", owners });
    expect(amounts(state)).toEqual([
      ["ana", 3334],
      ["beto", 3333],
      ["caro", 3333],
    ]);
    expect(statusOf(state)).toBe("shared");
  });

  it("por porciones: quien comió el doble paga el doble", () => {
    const owners = [
      { guestId: "ana", portions: 2 },
      { guestId: "beto", portions: 1 },
    ];
    expect(amounts(apply([added(9000)], { type: "share", guestId: "ana", owners }))).toEqual([
      ["ana", 6000],
      ["beto", 3000],
    ]);
  });

  it("'yo también comí' en un compartido entre 2 lo pasa a 3 y recalcula", () => {
    const owners = [
      { guestId: "ana", portions: 1 },
      { guestId: "beto", portions: 1 },
    ];
    const state = apply(
      [added(12_000)],
      { type: "share", guestId: "ana", owners },
      { type: "join", guestId: "caro" },
    );
    expect(amounts(state)).toEqual([
      ["ana", 4000],
      ["beto", 4000],
      ["caro", 4000],
    ]);
  });

  it("reglas: comparte un dueño o cualquiera si no hay dueño, incluyéndose, entre 2 o más", () => {
    const claimed = apply([added(5000)], { type: "claim", guestId: "ana" });
    const two = [
      { guestId: "beto", portions: 1 },
      { guestId: "caro", portions: 1 },
    ];
    expect(decide(claimed, { type: "share", guestId: "beto", owners: two })).toEqual({
      ok: false,
      error: "not-allowed",
    });
    const unowned = apply([added(5000)]);
    expect(decide(unowned, { type: "share", guestId: "ana", owners: two })).toEqual({
      ok: false,
      error: "not-in-share",
    });
    expect(
      decide(unowned, { type: "share", guestId: "ana", owners: [{ guestId: "ana", portions: 1 }] }),
    ).toEqual({ ok: false, error: "invalid-portions" });
    const zero = [
      { guestId: "ana", portions: 0 },
      { guestId: "beto", portions: 1 },
    ];
    expect(decide(unowned, { type: "share", guestId: "ana", owners: zero })).toEqual({
      ok: false,
      error: "invalid-portions",
    });
  });

  it("'yo también comí' requiere un ítem con dueño y no repetirse", () => {
    expect(decide(apply([added(1000)]), { type: "join", guestId: "ana" })).toEqual({
      ok: false,
      error: "not-owned",
    });
    const claimed = apply([added(1000)], { type: "claim", guestId: "ana" });
    expect(decide(claimed, { type: "join", guestId: "ana" })).toEqual({
      ok: false,
      error: "already-owner",
    });
  });

  it("propiedad: con cualquier precio y reparto, la suma de las partes es exactamente el precio", () => {
    let seed = 42;
    const random = (max: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed % max;
    };
    for (let run = 0; run < 2000; run++) {
      const price = random(2_000_000);
      const owners = Array.from({ length: 2 + random(8) }, (_, i) => ({
        guestId: `g${i}`,
        portions: 1 + random(5),
      }));
      const state = apply([added(price)], { type: "share", guestId: "g0", owners });
      const total = sharesOf(state).reduce((sum, s) => sum + s.amount.amount, 0);
      expect(total, `precio ${price}, porciones ${owners.map((o) => o.portions)}`).toBe(price);
    }
  });
});

describe("Auditoría de asignaciones", () => {
  it("el estado vigente se reconstruye desde los eventos y la versión cuenta cada cambio", () => {
    const events: ItemEvent[] = [
      added(6000),
      { type: "claimed", guestId: "ana" },
      { type: "joined", guestId: "beto" },
    ];
    const state = fold("i1", events);
    expect(state?.version).toBe(3);
    expect(state && amounts(state)).toEqual([
      ["ana", 3000],
      ["beto", 3000],
    ]);
  });
});
