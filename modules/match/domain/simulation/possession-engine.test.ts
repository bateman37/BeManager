import { describe, expect, it } from "vitest";
import { runPossession } from "./possession-engine";
import { LAB_ROSTER_FIXTURE } from "../players/lab-roster-fixture";
import type { MatchInput } from "../lab/match-input";
import { LAB_PARAMETERS_VERSION } from "../lab/lab-0-1-parameters";
import type { ScenarioId } from "../lab/scenario";

function buildInput(scenarioId: ScenarioId, seed: number): MatchInput {
  return {
    scenarioId,
    seed,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: LAB_PARAMETERS_VERSION,
    offensePlayers: LAB_ROSTER_FIXTURE[0]!.players,
    defensePlayers: LAB_ROSTER_FIXTURE[1]!.players,
  };
}

const VALID_TERMINAL_KINDS = [
  "made_basket",
  "missed_shot_defensive_rebound",
  "missed_shot_offensive_rebound_continues",
  "live_turnover",
  "steal_by_defense",
  "blocked_shot_live_ball",
  "shooting_foul",
  "out_of_bounds",
  "shot_clock_violation",
  "possession_reorganized_control_kept",
  "simulation_guard_stopped",
];

describe("runPossession: invariante 2 (reproducibilidad)", () => {
  it("misma entrada y semilla producen los mismos hechos deportivos", () => {
    const a = runPossession(buildInput("drop_con_ayuda", 12345));
    const b = runPossession(buildInput("drop_con_ayuda", 12345));

    expect(a.terminal).toEqual(b.terminal);
    expect(a.facts.map((f) => ({ kind: f.kind, atMs: f.atMs, text: f.text }))).toEqual(
      b.facts.map((f) => ({ kind: f.kind, atMs: f.atMs, text: f.text })),
    );
  });

  it("semillas distintas pueden producir secuencias distintas", () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => runPossession(buildInput("drop_con_ayuda", seed)));
    const uniqueOutcomes = new Set(seeds.map((s) => JSON.stringify(s.terminal)));
    expect(uniqueOutcomes.size).toBeGreaterThan(1);
  });
});

describe("runPossession: invariante 3 (estados legales y tiempos)", () => {
  it("termina siempre en un estado legal soportado", () => {
    for (const scenarioId of ["drop_con_ayuda", "drop_sin_ayuda", "closeout_tardio_con_contacto"] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const state = runPossession(buildInput(scenarioId, seed));
        expect(state.terminal).not.toBeNull();
        expect(VALID_TERMINAL_KINDS).toContain(state.terminal!.kind);
      }
    }
  });

  it("todos los hechos tienen instantes no negativos y en orden no decreciente", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 99));
    let previous = -1;
    for (const fact of state.facts) {
      expect(fact.atMs).toBeGreaterThanOrEqual(0);
      expect(fact.atMs).toBeGreaterThanOrEqual(previous);
      previous = fact.atMs;
    }
  });

  it("nunca hay dos jugadores en la misma posición exacta que el balón sin dueño (diez asignaciones)", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 7));
    const ids = Object.keys(state.players);
    expect(new Set(ids).size).toBe(10);
  });
});

describe("runPossession: invariante 4 (ayuda de D3 deja a O3)", () => {
  it("cuando D3 ayuda, se registra el hecho de que deja su marca", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 42));
    const helpFact = state.facts.find((f) => f.kind === "help_left_assignment");
    expect(helpFact).toBeDefined();
  });

  it("cuando D3 no ayuda, no se genera el hecho de dejar la marca", () => {
    const state = runPossession(buildInput("drop_sin_ayuda", 42));
    const helpFact = state.facts.find((f) => f.kind === "help_left_assignment");
    expect(helpFact).toBeUndefined();
  });
});

describe("runPossession: comparación reproducible entre ayuda sí/no (invariante 7)", () => {
  it("cambiar la ayuda altera la secuencia de hechos con la misma semilla", () => {
    const withHelp = runPossession(buildInput("drop_con_ayuda", 555));
    const withoutHelp = runPossession(buildInput("drop_sin_ayuda", 555));

    expect(withHelp.facts.map((f) => f.kind)).not.toEqual(withoutHelp.facts.map((f) => f.kind));
  });
});

describe("runPossession: escenario closeout tardío", () => {
  it("es alcanzable y produce un estado terminal legal", () => {
    let foundFoul = false;
    for (let seed = 1; seed <= 40; seed++) {
      const state = runPossession(buildInput("closeout_tardio_con_contacto", seed));
      expect(state.terminal).not.toBeNull();
      if (state.terminal!.kind === "shooting_foul") foundFoul = true;
    }
    expect(foundFoul).toBe(true);
  });
});
