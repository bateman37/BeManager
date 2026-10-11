import { describe, expect, it } from "vitest";
import { CONTACT_FOUL_BASE_PROBABILITY, contactFoulProbability } from "./lab-0-6-parameters";

describe("LAB-0.6: riesgo de falta de un contacto defensivo real (ME-07B v2 §2.5)", () => {
  it("caso neutro M07 = 8 devuelve la base de cada situación", () => {
    for (const [situation, base] of Object.entries(CONTACT_FOUL_BASE_PROBABILITY)) {
      expect(contactFoulProbability(situation as keyof typeof CONTACT_FOUL_BASE_PROBABILITY, 8)).toBeCloseTo(base, 12);
    }
  });

  it("más disciplina reduce el riesgo con pendiente 0,008 por punto y queda acotado", () => {
    expect(contactFoulProbability("finalizacion", 15)).toBeCloseTo(0.12 - 0.056, 12);
    expect(contactFoulProbability("finalizacion", 1)).toBeCloseTo(0.12 + 0.056, 12);
    expect(contactFoulProbability("tiro_exterior", 15)).toBe(0.01);
    expect(contactFoulProbability("finalizacion", 1)).toBeLessThanOrEqual(0.35);
  });

  it("una finalización con contacto arriesga más falta que un tiro exterior con el mismo defensor", () => {
    expect(contactFoulProbability("finalizacion", 8)).toBeGreaterThan(contactFoulProbability("tiro_exterior", 8));
  });
});
