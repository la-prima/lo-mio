import { describe, expect, it } from "vitest";
import { splitAmount } from "./split.ts";

describe("splitAmount", () => {
  it("reparte en partes iguales sin perder pesos", () => {
    expect(splitAmount(10_000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
  });

  it("respeta porciones distintas", () => {
    expect(splitAmount(9_000, [2, 1])).toEqual([6000, 3000]);
  });

  it("la suma siempre coincide con el total", () => {
    for (const total of [0, 1, 7, 12_990, 1_000_001]) {
      for (const weights of [[1], [1, 1], [3, 2, 2], [1, 1, 1, 1, 1, 1, 1]]) {
        const parts = splitAmount(total, weights);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it("rechaza montos o pesos inválidos", () => {
    expect(() => splitAmount(10.5, [1])).toThrow(RangeError);
    expect(() => splitAmount(100, [])).toThrow(RangeError);
    expect(() => splitAmount(100, [1, 0])).toThrow(RangeError);
  });
});
