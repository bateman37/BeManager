/**
 * Resolución rápida real del escenario de laboratorio (HF-002 §3, ME-02
 * C3). Llama directamente a `computePossessionCore` (el mismo núcleo de
 * decisión y fórmulas LAB-0.1/LAB-0.2 que usa el motor detallado) con el
 * historial de posiciones desactivado: no llama a `runPossession`, no
 * construye relato por jugada ni snapshots de diez jugadores, y solo
 * cuenta las categorías que realmente representa la línea de tiempo
 * ligera devuelta por el núcleo — la misma taxonomía de hechos que usa el
 * motor detallado (C3 §2), nunca una tabla distinta.
 */
import { computePossessionCore } from "../simulation/possession-core";
import { LAB_PARAMETERS_VERSION } from "../lab/lab-0-1-parameters";
import { LAB_0_2_PARAMETERS_VERSION } from "../lab/lab-0-2-parameters";
import { LAB_0_3_PARAMETERS_VERSION } from "../lab/lab-0-3-parameters";
import type { MatchInput, DefensiveCoverageChoice } from "../lab/match-input";
import type { ScenarioId } from "../lab/scenario";

/**
 * Categorías agregadas de un lote (C3 §2): separan la oportunidad de tiro
 * (`shotOpportunities`, todo `shot_prepared`, útil para leer decisiones)
 * del tiro de campo oficial FIBA (`fieldGoalAttempts2/3` y
 * `fieldGoalMade2/3`, derivado del hecho `field_goal_attempt` que el
 * núcleo solo emite cuando de verdad cuenta como FGA: no en una falta de
 * tiro con intento fallado, sí en un tapón legal, una canasta limpia o un
 * and-one). `freeThrowAttempts/Made` viene de cada libre realmente
 * ejecutado. `points` = 2×2FGM + 3×3FGM + FTM.
 */
export interface ScenarioBatchCategories {
  readonly screensNavigated: number;
  readonly helpLeftAssignment: number;
  readonly passesToRoll: number;
  readonly passesToCorner: number;
  readonly passesToOutlet: number;
  readonly safeOutlets: number;
  readonly shotOpportunities: number;
  readonly fieldGoalAttempts2: number;
  readonly fieldGoalMade2: number;
  readonly fieldGoalAttempts3: number;
  readonly fieldGoalMade3: number;
  readonly freeThrowAttempts: number;
  readonly freeThrowMade: number;
  readonly points: number;
  readonly shootingFouls: number;
  readonly turnovers: number;
  readonly steals: number;
  readonly blockedShots: number;
  readonly offensiveRebounds: number;
  readonly defensiveRebounds: number;
  readonly shotClockViolations: number;
  readonly outOfBounds: number;
  /** Solo relevante en cobertura `trampa`; queda en 0 para `drop`. */
  readonly trapCommitted: number;
  readonly trapBrokenAdvantage: number;
}

export interface ScenarioBatchResult {
  readonly scenarioId: ScenarioId;
  readonly coverage: DefensiveCoverageChoice;
  readonly sampleSize: number;
  readonly seedStart: number;
  readonly seedEnd: number;
  readonly rulesetVersion: MatchInput["rulesetVersion"];
  readonly labParametersVersion:
    | typeof LAB_PARAMETERS_VERSION
    | typeof LAB_0_2_PARAMETERS_VERSION
    | typeof LAB_0_3_PARAMETERS_VERSION;
  readonly categories: ScenarioBatchCategories;
}

function emptyCategories(): { -readonly [K in keyof ScenarioBatchCategories]: number } {
  return {
    screensNavigated: 0,
    helpLeftAssignment: 0,
    passesToRoll: 0,
    passesToCorner: 0,
    passesToOutlet: 0,
    safeOutlets: 0,
    shotOpportunities: 0,
    fieldGoalAttempts2: 0,
    fieldGoalMade2: 0,
    fieldGoalAttempts3: 0,
    fieldGoalMade3: 0,
    freeThrowAttempts: 0,
    freeThrowMade: 0,
    points: 0,
    shootingFouls: 0,
    turnovers: 0,
    steals: 0,
    blockedShots: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    shotClockViolations: 0,
    outOfBounds: 0,
    trapCommitted: 0,
    trapBrokenAdvantage: 0,
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
          if (raw.actors.includes("O4")) totals.passesToOutlet++;
          break;
        case "possession_continues":
          totals.safeOutlets++;
          break;
        case "shot_prepared":
          totals.shotOpportunities++;
          break;
        case "field_goal_attempt": {
          const made = raw.detail.made === true;
          const isThree = raw.detail.shotType === "three_point";
          if (isThree) {
            totals.fieldGoalAttempts3++;
            if (made) {
              totals.fieldGoalMade3++;
              totals.points += 3;
            }
          } else {
            totals.fieldGoalAttempts2++;
            if (made) {
              totals.fieldGoalMade2++;
              totals.points += 2;
            }
          }
          break;
        }
        case "free_throws_result":
          totals.freeThrowAttempts++;
          if (raw.detail.made === true) {
            totals.freeThrowMade++;
            totals.points += 1;
          }
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
        case "trap_committed":
          totals.trapCommitted++;
          break;
        case "trap_broken_advantage":
          totals.trapBrokenAdvantage++;
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
    coverage: input.coverage,
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
 * Ambas ramas usan la cobertura `drop` (ME-02 §3: la trampa se compara
 * aparte, en `compareCoverageBatch`).
 */
export function compareHelpToggle(
  baseInput: Omit<MatchInput, "scenarioId" | "coverage">,
  sampleSize: number,
): HelpComparisonResult {
  return {
    withHelp: runScenarioBatch({ ...baseInput, scenarioId: "drop_con_ayuda", coverage: "drop" }, sampleSize),
    withoutHelp: runScenarioBatch({ ...baseInput, scenarioId: "drop_sin_ayuda", coverage: "drop" }, sampleSize),
  };
}

export interface CoverageComparisonResult {
  readonly drop: ScenarioBatchResult;
  readonly trampa: ScenarioBatchResult;
}

/**
 * ME-02 §3-4: compara la misma posesión de media pista, quintetos y bloqueo
 * central, cambiando exclusivamente la cobertura (`drop` o `trampa`); en
 * ambas D3 tiene encomendada la ayuda al continuador y D4 la reparación,
 * por lo que las dos ramas parten siempre del escenario `drop_con_ayuda`.
 * Es una comparación distinta de `compareHelpToggle` (drop ayuda sí/no) y
 * no sustituye al caso individual de closeout tardío.
 */
export function compareCoverageBatch(
  baseInput: Omit<MatchInput, "scenarioId" | "coverage">,
  sampleSize: number,
): CoverageComparisonResult {
  return {
    drop: runScenarioBatch({ ...baseInput, scenarioId: "drop_con_ayuda", coverage: "drop" }, sampleSize),
    trampa: runScenarioBatch({ ...baseInput, scenarioId: "drop_con_ayuda", coverage: "trampa" }, sampleSize),
  };
}
