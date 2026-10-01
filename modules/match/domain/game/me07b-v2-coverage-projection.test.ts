import { describe, expect, it, vi } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput, type GameResult } from "./game-model";
import { projectOrganizedOpportunity } from "../simulation/possession-core";
import { getScenario } from "../lab/scenario";
import { blendProjectionWithObservation, OBSERVATION_PRIOR_WEIGHT_USES } from "../lab/lab-0-4-parameters";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { DefensiveCoverage, DefensiveCoverageChoice } from "../lab/match-input";
import type { ObservedOutcome } from "../lab/lab-0-4-parameters";

vi.setConfig({ testTimeout: 120_000 });

/**
 * ME-07B v2 §2.2/§5: el ataque `auto` ya no proyecta el bloqueo directo solo
 * contra drop. Pondera la concesión proyectada de cada cobertura que el rival
 * **ha mostrado** en el partido por su frecuencia observada (LAB-0.4,
 * `shownCoverageWeights`, drop como previa): «auto pondera lo observable y
 * realizable, sin conocer la tirada futura».
 */
const scenario = getScenario("drop_con_ayuda");
const start: Record<string, { x: number; y: number }> = {};
for (const s of [...scenario.offense, ...scenario.defense]) start[s.playerId] = s.initialPosition;
const binding = Object.fromEntries(Object.keys(start).map((k) => [k, k]));

function project(shown: Partial<Record<DefensiveCoverage, ObservedOutcome>>) {
  return projectOrganizedOpportunity(
    { scenarioId: "drop_con_ayuda", coverage: "auto", seed: 1, rulesetVersion: "FIBA-2026", labParametersVersion: "LAB-0.2", offensePlayers: SIERRA_CLARA.players, defensePlayers: PUERTO_AMBAR.players, offensivePlan: "auto", screenPlacement: "central" },
    { binding, startPositions: start, shotClockMs: 20_000, gameClockMs: 400_000, attackingPriority: "proteger_balance", observations: { offenseByFamily: {}, defenseByCoverage: shown } },
  );
}

describe("ME-07B v2 §2.2/§5: proyección del ataque frente a la defensa observada", () => {
  it("misma geometría y mismas muestras propias: la tendencia mostrada por el rival cambia la familia elegida", () => {
    // Sin muestras del rival: solo drop (comportamiento anterior) y gana la mano a mano.
    const none = project({});
    expect(none.plan).toBe("mano_a_mano_sin_balon");
    // Un rival que ha cambiado 20 veces: el bloqueo directo contra el cambio vale más y gana.
    const switching = project({ cambio: { uses: 20, points: 20 } });
    expect(switching.plan).toBe("bloqueo_directo");
    expect(switching.value).toBeGreaterThan(none.value);
    // Un rival que ha hecho drop 20 veces deja exactamente la proyección contra drop.
    expect(project({ drop: { uses: 20, points: 20 } })).toEqual(none);
    // ICE ante una pantalla central no es aplicable (se juega drop): pesa como drop.
    expect(project({ ice: { uses: 20, points: 20 } })).toEqual(none);
    // Pocas muestras pesan poco (K usos equivalentes de previa).
    const few = project({ cambio: { uses: 1, points: 1 } });
    expect(few.plan).toBe("mano_a_mano_sin_balon");
    expect(OBSERVATION_PRIOR_WEIGHT_USES).toBeGreaterThan(1);
  });
});

function play(seed: number, coverage: DefensiveCoverageChoice): GameResult {
  const common = { priority: "proteger_balance" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const };
  return playFullGame(
    buildGameInput({
      seed,
      auditEnabled: true,
      home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...common, coverage: "auto", screenPlacement: "central" },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common, coverage, screenPlacement: "auto" },
    }),
  );
}

function sierraFamilyDecisions(r: GameResult) {
  const team = new Map(r.possessions.map((p) => [p.index, p.teamId]));
  return r.audit!.decisions.filter((d) => d.point === "seleccion_familia" && team.get(d.possessionIndex!) === SIERRA_CLARA.id && d.options.some((o) => o.values?.expectedValueOverShownCoverages !== undefined));
}

/** Familia que habría elegido la proyección anterior (solo contra drop) con las mismas muestras propias. */
function dropOnlyChoice(d: ReturnType<typeof sierraFamilyDecisions>[number]): string {
  const b = d.options.find((o) => o.id === "bloqueo_directo")!.values!;
  const h = d.options.find((o) => o.id === "mano_a_mano_sin_balon")!.values!;
  const dropOnly = b.viable ? blendProjectionWithObservation(b.situationalValue as number, { uses: b.observedUses as number, points: b.observedPoints as number }) : -Infinity;
  return (h.blendedValue as number) > dropOnly ? "mano_a_mano_sin_balon" : "bloqueo_directo";
}

describe("ME-07B v2 §2.2/§5: en partido completo el ataque aprende la cobertura que ve", () => {
  it("contra una defensa que solo hace drop la proyección es la de siempre; contra una que cambia, pesa el cambio y la elección se aparta de la proyección solo contra drop", { timeout: 240_000 }, () => {
    const drop = sierraFamilyDecisions(play(92, "drop"));
    expect(drop.length).toBeGreaterThan(50);
    for (const d of drop) {
      const b = d.options.find((o) => o.id === "bloqueo_directo")!.values!;
      expect(b.coverageWeight_drop).toBe(1);
      expect(b.expectedValueOverShownCoverages).toBeCloseTo(b.viable ? (b.situationalValue as number) : 0, 12);
      expect(dropOnlyChoice(d)).toBe(d.chosenOptionId);
    }
    const switching = sierraFamilyDecisions(play(92, "cambio"));
    expect(switching.length).toBeGreaterThan(50);
    const weights = switching.map((d) => (d.options.find((o) => o.id === "bloqueo_directo")!.values!.coverageWeight_cambio as number | undefined) ?? 0);
    // La primera vez no ha visto nada; después el peso del cambio crece con cada uso visto.
    expect(weights[0]).toBe(0);
    for (let i = 1; i < weights.length; i++) expect(weights[i]!).toBeGreaterThanOrEqual(weights[i - 1]!);
    expect(weights[weights.length - 1]!).toBeGreaterThan(0.9);
    for (const d of switching.slice(1)) {
      const b = d.options.find((o) => o.id === "bloqueo_directo")!.values!;
      expect(typeof b.valueAgainst_cambio).toBe("number");
    }
    // Hay decisiones reales en las que la proyección contra el cambio cambia la familia elegida. Sesión v2-6:
    // son raras (la mano a mano central queda por debajo incluso del bloqueo solo contra drop casi siempre),
    // así que se cuentan en las seis semillas medidas (91–96: 1 de 682), sin escoger la que lo muestra.
    let changed = 0;
    for (const seed of [91, 92, 93, 94, 95, 96]) {
      const ds = seed === 92 ? switching : sierraFamilyDecisions(play(seed, "cambio"));
      changed += ds.filter((d) => dropOnlyChoice(d) !== d.chosenOptionId).length;
    }
    expect(changed).toBeGreaterThan(0);
  });
});
