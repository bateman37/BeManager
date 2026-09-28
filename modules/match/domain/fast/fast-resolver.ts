/**
 * Resolución rápida real del escenario de ME-01 (HF-002 §3). Llama
 * directamente a `computePossessionCore` (el mismo núcleo de decisión y
 * fórmulas LAB-0.1 que usa el motor detallado) con el historial de
 * posiciones desactivado: no llama a `runPossession`, no construye relato
 * por jugada ni snapshots de diez jugadores, y solo cuenta las categorías
 * que realmente representa la línea de tiempo ligera devuelta por el
 * núcleo.
 */
import { computePossessionCore } from "../simulation/possession-core";
import { LAB_PARAMETERS_VERSION } from "../lab/lab-0-1-parameters";
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
  readonly seedStart: number;
  readonly seedEnd: number;
  readonly rulesetVersion: MatchInput["rulesetVersion"];
  readonly labParametersVersion: typeof LAB_PARAMETERS_VERSION;
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
 * forma determinista (`baseSeed + i`), calculando cada corrida por etapas
 * (sin relato ni snapshots) y agregando categorías reales derivadas de la
 * línea de tiempo de hechos de cada corrida.
 */
export function runScenarioBatch(input: MatchInput, sampleSize: number): ScenarioBatchResult {
  if (sampleSize < 1) {
    throw new RangeError("El tamaño de muestra debe ser al menos 1.");
  }

  const totals = emptyCategories();

  for (let i = 0; i < sampleSize; i++) {
    const runInput: MatchInput = { ...input, seed: input.seed + i };
    const result = computePossessionCore(runInput, { trackPositionHistory: false });

    for (const raw of result.timeline) {
      switch (raw.kind) {
        case "screen_navigated":
          totals.screensNavigated++;
          break;
        case "help_left_assignment":
          totals.helpLeftAssignment++;
          break;
        case "pass_received":
          if (raw.actors.includes("O5")) totals.passesToRoll++;
          if (raw.actors.includes("O3")) totals.passesToCorner++;
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
        case "rebound_secured":
        case "rebound_contested":
          if (raw.actors[0]?.startsWith("O")) totals.offensiveRebounds++;
          else totals.defensiveRebounds++;
          break;
        default:
          break;
      }
    }

    if (result.terminal.kind === "shot_clock_violation") totals.shotClockViolations++;
    if (result.terminal.kind === "out_of_bounds") totals.outOfBounds++;
  }

  return {
    scenarioId: input.scenarioId,
    sampleSize,
    seedStart: input.seed,
    seedEnd: input.seed + sampleSize - 1,
    rulesetVersion: input.rulesetVersion,
    labParametersVersion: input.labParametersVersion,
    categories: totals,
  };
}

export interface HelpComparisonResult {
  readonly withHelp: ScenarioBatchResult;
  readonly withoutHelp: ScenarioBatchResult;
}

/**
 * Compara, con las mismas semillas por índice, el escenario con ayuda de D3
 * frente al mismo escenario sin ayuda (prompt §4: "un cambio en ayuda debe
 * alterar dónde aparece la oportunidad en ambos modos"). Siempre compara
 * exactamente estas dos variantes, con independencia del escenario que esté
 * seleccionado en la vista individual (HF-002 §1.7): el escenario de
 * closeout tardío no es un cambio de ayuda sí/no y no se compara aquí.
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
