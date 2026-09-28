import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runScenarioBatch, compareHelpToggle } from "./fast-resolver";
import { LAB_ROSTER_FIXTURE } from "../players/lab-roster-fixture";
import { LAB_PARAMETERS_VERSION } from "../lab/lab-0-1-parameters";
import type { MatchInput } from "../lab/match-input";

function baseInput(): Omit<MatchInput, "scenarioId" | "coverage"> {
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
    const result = runScenarioBatch({ ...baseInput(), scenarioId: "drop_con_ayuda", coverage: "drop" }, 30);

    expect(result.sampleSize).toBe(30);
    expect(result.categories.shotOpportunities).toBeGreaterThan(0);
    // C3: FGA oficial (2+3) nunca puede superar la oportunidad de tiro
    // preparada, porque una falta de tiro fallada no cuenta como FGA.
    const officialFga = result.categories.fieldGoalAttempts2 + result.categories.fieldGoalAttempts3;
    expect(officialFga).toBeLessThanOrEqual(result.categories.shotOpportunities);
  });

  it("no acepta un tamaño de muestra menor que 1", () => {
    expect(() => runScenarioBatch({ ...baseInput(), scenarioId: "drop_con_ayuda", coverage: "drop" }, 0)).toThrow();
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

  it("identifica sin ambigüedad qué se comparó (escenarios, semillas y versiones)", () => {
    const comparison = compareHelpToggle(baseInput(), 10);
    expect(comparison.withHelp.scenarioId).toBe("drop_con_ayuda");
    expect(comparison.withoutHelp.scenarioId).toBe("drop_sin_ayuda");
    expect(comparison.withHelp.seedStart).toBe(baseInput().seed);
    expect(comparison.withHelp.seedEnd).toBe(baseInput().seed + 9);
    expect(comparison.withHelp.labParametersVersion).toBe(LAB_PARAMETERS_VERSION);
  });
});

describe("runScenarioBatch: HF-002 bug 1 (la ruta rápida no es el motor detallado)", () => {
  it("fast-resolver.ts no importa el motor detallado (possession-engine)", () => {
    const source = readFileSync(fileURLToPath(new URL("./fast-resolver.ts", import.meta.url)), "utf-8");
    const importLines = source.split("\n").filter((line) => line.trim().startsWith("import "));
    expect(importLines.some((line) => line.includes("possession-engine"))).toBe(false);
  });
});

describe("runScenarioBatch: HF-002 bug 4 (rebote ofensivo agregado correctamente)", () => {
  it("cuenta un rebote ofensivo real incluso cuando la posesión sigue con un segundo tiro", () => {
    // Un lote suficientemente grande debe contener, con las mismas semillas
    // por índice, al menos una corrida con rebote ofensivo real seguido de
    // un segundo intento (ver possession-engine.test.ts, bug 4).
    const result = runScenarioBatch(
      { ...baseInput(), scenarioId: "drop_con_ayuda", coverage: "drop", seed: 1 },
      400,
    );
    expect(result.categories.offensiveRebounds).toBeGreaterThan(0);
    expect(result.categories.shotOpportunities).toBeGreaterThan(result.sampleSize);
  });
});
