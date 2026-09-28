/**
 * Aproximación rápida limitada al escenario de ME-01 (prompt §4). Reutiliza
 * exactamente los mismos snapshots, roles, reglas y funciones de
 * tiro/rebote/falta que el motor detallado: no introduce coeficientes
 * nuevos ni una probabilidad sustitutiva de "táctica exitosa". Cuenta
 * únicamente las categorías que representa; no produce relato por jugada,
 * boxscore de partido ni posiciones inventadas.
 */
import { runPossession } from "../simulation/possession-engine";
import type { MatchInput } from "../lab/match-input";
import type { ScenarioId } from "../lab/scenario";

export interface ScenarioBatchCategories {
  readonly screensNavigated: number;
  readonly helpLeftAssignment: number;
  readonly passesToRoll: number;
  readonly passesToCorner: number;
  readonly safeOutlets: number;
  readonly shotsAttempted: number;
  readonly shotsMade: number;
  readonly turnovers: number;
  readonly steals: number;
  readonly blockedShots: number;
  readonly offensiveRebounds: number;
  readonly defensiveRebounds: number;
  readonly shootingFouls: number;
  readonly shotClockViolations: number;
  readonly outOfBounds: number;
}

export interface ScenarioBatchResult {
  readonly scenarioId: ScenarioId;
  readonly sampleSize: number;
  readonly categories: ScenarioBatchCategories;
}

function emptyCategories(): { -readonly [K in keyof ScenarioBatchCategories]: number } {
  return {
    screensNavigated: 0,
    helpLeftAssignment: 0,
    passesToRoll: 0,
    passesToCorner: 0,
    safeOutlets: 0,
    shotsAttempted: 0,
    shotsMade: 0,
    turnovers: 0,
    steals: 0,
    blockedShots: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    shootingFouls: 0,
    shotClockViolations: 0,
    outOfBounds: 0,
  };
}

/**
 * Ejecuta el mismo escenario `sampleSize` veces, variando solo la semilla de
 * forma determinista (`baseSeed + i`), y agrega categorías reales sin
 * conservar el relato de cada corrida.
 */
export function runScenarioBatch(input: MatchInput, sampleSize: number): ScenarioBatchResult {
  if (sampleSize < 1) {
    throw new RangeError("El tamaño de muestra debe ser al menos 1.");
  }

  const totals = emptyCategories();

  for (let i = 0; i < sampleSize; i++) {
    const runInput: MatchInput = { ...input, seed: input.seed + i };
    const state = runPossession(runInput);

    for (const fact of state.facts) {
      switch (fact.kind) {
        case "screen_navigated":
          totals.screensNavigated++;
          break;
        case "help_left_assignment":
          totals.helpLeftAssignment++;
          break;
        case "pass_received":
          if (fact.actors.includes("O5")) totals.passesToRoll++;
          if (fact.actors.includes("O3")) totals.passesToCorner++;
          break;
        case "possession_continues":
          totals.safeOutlets++;
          break;
        case "shot_prepared":
          totals.shotsAttempted++;
          break;
        case "shot_result":
          totals.shotsMade++;
          break;
        case "turnover":
          totals.turnovers++;
          totals.steals++;
          break;
        case "pass_control_lost":
          totals.turnovers++;
          break;
        case "shot_blocked":
          totals.blockedShots++;
          break;
        case "shooting_foul":
          totals.shootingFouls++;
          break;
        default:
          break;
      }
    }

    if (state.terminal?.kind === "missed_shot_defensive_rebound") totals.defensiveRebounds++;
    if (
      state.terminal?.kind === "missed_shot_offensive_rebound_continues" ||
      (state.terminal?.kind !== "missed_shot_defensive_rebound" &&
        state.facts.some((f) => f.kind === "rebound_secured" && f.actors[0]?.startsWith("O")))
    ) {
      totals.offensiveRebounds++;
    }
    if (state.terminal?.kind === "shot_clock_violation") totals.shotClockViolations++;
    if (state.terminal?.kind === "out_of_bounds") totals.outOfBounds++;
  }

  return { scenarioId: input.scenarioId, sampleSize, categories: totals };
}

export interface HelpComparisonResult {
  readonly withHelp: ScenarioBatchResult;
  readonly withoutHelp: ScenarioBatchResult;
}

/**
 * Compara, con las mismas semillas por índice, el escenario con ayuda de D3
 * frente al mismo escenario sin ayuda (prompt §4: "un cambio en ayuda debe
 * alterar dónde aparece la oportunidad en ambos modos").
 */
export function compareHelpToggle(
  baseInput: Omit<MatchInput, "scenarioId">,
  sampleSize: number,
): HelpComparisonResult {
  return {
    withHelp: runScenarioBatch({ ...baseInput, scenarioId: "drop_con_ayuda" }, sampleSize),
    withoutHelp: runScenarioBatch({ ...baseInput, scenarioId: "drop_sin_ayuda" }, sampleSize),
  };
}
