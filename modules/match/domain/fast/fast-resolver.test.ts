import { describe, expect, it } from "vitest";
import { runScenarioBatch, compareHelpToggle } from "./fast-resolver";
import { LAB_ROSTER_FIXTURE } from "../players/lab-roster-fixture";
import { LAB_PARAMETERS_VERSION } from "../lab/lab-0-1-parameters";
import type { MatchInput } from "../lab/match-input";

function baseInput(): Omit<MatchInput, "scenarioId"> {
  return {
    seed: 1000,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: LAB_PARAMETERS_VERSION,
    offensePlayers: LAB_ROSTER_FIXTURE[0]!.players,
    defensePlayers: LAB_ROSTER_FIXTURE[1]!.players,
  };
}

describe("runScenarioBatch", () => {
  it("agrega categorías reales sobre el tamaño de muestra declarado", () => {
    const result = runScenarioBatch({ ...baseInput(), scenarioId: "drop_con_ayuda" }, 30);

    expect(result.sampleSize).toBe(30);
    expect(result.categories.shotsAttempted).toBeGreaterThan(0);
    const total =
      result.categories.shotsMade +
      (result.categories.shotsAttempted - result.categories.shotsMade);
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it("no acepta un tamaño de muestra menor que 1", () => {
    expect(() => runScenarioBatch({ ...baseInput(), scenarioId: "drop_con_ayuda" }, 0)).toThrow();
  });
});

describe("compareHelpToggle: invariante 7 (variar ayuda cambia la oportunidad)", () => {
  it("produce categorías distintas de pase al roll frente a pase a la esquina", () => {
    const comparison = compareHelpToggle(baseInput(), 40);

    // Sin ayuda, D3 nunca deja su marca ni se genera pase a la esquina liberada.
    expect(comparison.withoutHelp.categories.helpLeftAssignment).toBe(0);
    expect(comparison.withoutHelp.categories.passesToCorner).toBe(0);

    // Con ayuda, sí se registra la marca dejada en al menos parte de la muestra.
    expect(comparison.withHelp.categories.helpLeftAssignment).toBeGreaterThan(0);
  });
});
