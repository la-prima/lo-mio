import { describe, expect, it } from "vitest";
import { manualAdapter, manualItemId } from "../../domain/index.ts";
import { describePosAdapterContract } from "./contract-suite.ts";

describePosAdapterContract(manualAdapter);

describe("Adaptador manual", () => {
  it("no puede crear pedidos en un POS: el modo order-via-lo-mio no se ofrece", () => {
    expect(manualAdapter.capabilities.createOrder).toBe(false);
  });

  it("sus ids llevan prefijo y no chocan con los de un POS real", () => {
    expect(manualItemId("0199")).toBe("manual:0199");
  });
});
