import { describe, expect, it } from "vitest";
import { affectedBy, balancesOf } from "./index.ts";

const clp = (amount: number) => ({ amount, currency: "CLP" });

describe("Saldo por comensal", () => {
  it("una cerveza de 4.500 y un tercio de una tabla de 12.000 suman 8.500", () => {
    const items = [
      { shares: [{ guestId: "ana", amount: clp(4500) }] },
      { shares: ["ana", "beto", "caro"].map((guestId) => ({ guestId, amount: clp(4000) })) },
    ];
    const balances = balancesOf(["ana", "beto", "caro", "dani"], items, "CLP");
    expect(balances.get("ana")).toEqual(clp(8500));
    expect(balances.get("beto")).toEqual(clp(4000));
    expect(balances.get("dani")).toEqual(clp(0));
  });

  it("al cambiar el reparto de un ítem se recalculan los dueños anteriores y los nuevos", () => {
    const before = [{ guestId: "ana", amount: clp(6000) }];
    const after = [
      { guestId: "ana", amount: clp(3000) },
      { guestId: "beto", amount: clp(3000) },
    ];
    expect(affectedBy(before, after).sort()).toEqual(["ana", "beto"]);
  });
});
