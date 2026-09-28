import { describe, expect, it } from "vitest";
import { evaluateCloseoutLegality, awardFreeThrowsForShootingFoul } from "./foul-resolver";

describe("evaluateCloseoutLegality", () => {
  it("es legal cuando el margen deja tiempo suficiente de frenada", () => {
    expect(evaluateCloseoutLegality(-0.3, 0.15)).toBe("legal_contest");
  });

  it("no hay contestación cuando el defensor llega después de soltar", () => {
    expect(evaluateCloseoutLegality(0.1, 0.15)).toBe("no_contest");
  });

  it("es contacto tardío ilegal en el margen intermedio", () => {
    expect(evaluateCloseoutLegality(-0.05, 0.15)).toBe("late_illegal_contact");
  });
});

describe("awardFreeThrowsForShootingFoul (invariante 6: libres coherentes con FIBA 2026)", () => {
  it("canasta válida con falta concede un libre adicional", () => {
    expect(awardFreeThrowsForShootingFoul("close_finish", true)).toEqual({
      count: 1,
      basketCounted: true,
    });
    expect(awardFreeThrowsForShootingFoul("three_point", true)).toEqual({
      count: 1,
      basketCounted: true,
    });
  });

  it("tiro de dos fallado con falta concede dos libres", () => {
    expect(awardFreeThrowsForShootingFoul("close_finish", false)).toEqual({
      count: 2,
      basketCounted: false,
    });
  });

  it("triple fallado con falta concede tres libres", () => {
    expect(awardFreeThrowsForShootingFoul("three_point", false)).toEqual({
      count: 3,
      basketCounted: false,
    });
  });
});
