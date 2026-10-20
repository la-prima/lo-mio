import { describe, expect, it } from "vitest";
import { areaOf, codeLabels, flowLabels } from "./labels.ts";

describe("jerarquía del reporte", () => {
  it("el contexto de un test sale de su carpeta", () => {
    expect(areaOf("/repo/contexts/claims/server/claim.int.test.ts")).toBe("Reclamos");
    expect(areaOf("/repo/packages/kernel/src/split.test.ts")).toBe("Plataforma");
    expect(areaOf("/repo/apps/api/src/app.int.test.ts")).toBe("Plataforma");
    expect(areaOf("/repo/tests/architecture.test.ts")).toBe("Arquitectura");
  });

  it("un flujo se agrupa como contexto → flujo → escenario", () => {
    expect(
      flowLabels(["Reclamos", "Compartir un ítem"], "tres comensales reparten una tabla"),
    ).toEqual({
      epic: "Reclamos",
      feature: "Compartir un ítem",
      story: "tres comensales reparten una tabla",
    });
  });

  it("un flujo con un contexto desconocido o sin nombre de flujo falla", () => {
    expect(() => flowLabels(["claims", "Compartir"], "x")).toThrow(/DOMAINS/);
    expect(() => flowLabels(["Reclamos"], "x")).toThrow(/describe con el nombre del flujo/);
  });

  it("un test de código usa el primer describe como flujo", () => {
    expect(
      codeLabels("/repo/packages/kernel/src/split.test.ts", ["splitAmount", "x"], "reparte"),
    ).toEqual({
      epic: "Plataforma",
      feature: "splitAmount",
      story: "reparte",
    });
  });
});
