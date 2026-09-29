/**
 * Perfil de reglas del partido completo de laboratorio, edición FIBA 2026
 * (Official Basketball Rules 2026 v1.1, vigente desde el 1-10-2026): arts.
 * 8–10 (tiempo, fin y sentido), 12 (salto y alternancia), 19
 * (sustituciones), 29 (reloj de lanzamiento tras falta), 41 (cinco faltas
 * del jugador), 42 (faltas de equipo) y 50 (reloj de partido).
 *
 * Funciones **puras** con fronteras exactas en milisegundos enteros. Las
 * llama el partido (`play-full-game.ts`) y también los casos de frontera
 * del laboratorio (`rule-boundary-fixtures.ts`): no existe un segundo
 * reglamento para la demostración. El hecho deportivo (quién tocó a quién,
 * cuándo) se decide antes y fuera de aquí; estas funciones solo adjudican
 * su consecuencia reglamentaria. No son reglas NBA ni NCAA: otro perfil
 * futuro implementaría el mismo contrato (`GameRulesProfile`) con sus
 * propias constantes y funciones, sin tocar el núcleo de acciones.
 */
import type { Milliseconds } from "../time/clock";
import type { AttackDirection } from "../geometry/frame";
import { SHOT_CLOCK_FULL_MS, SHOT_CLOCK_RESET_14_MS } from "../sequence/fiba-clock-rules";
import { awardFreeThrowsForShootingFoul } from "../simulation/resolvers/foul-resolver";

export interface GameRulesProfile {
  readonly id: "FIBA-2026";
  readonly regulationPeriods: number;
  readonly periodMs: Milliseconds;
  readonly overtimeMs: Milliseconds;
  /** Descanso tras el período indicado (art. 8): 15 min al descanso, 2 min en los demás. */
  readonly intervalAfterPeriodMs: (period: number) => Milliseconds;
  /** Período en el que los equipos intercambian canastas (art. 9: la segunda mitad). */
  readonly switchBasketsAtPeriod: number;
  /** Últimos minutos del cuarto período y de cada prórroga (art. 50). */
  readonly lastMinutesMs: Milliseconds;
  /** Faltas de equipo en un período tras las que se aplica la penalización (art. 42). */
  readonly teamFoulPenaltyThreshold: number;
  /** Faltas personales con las que un jugador queda excluido (art. 41). */
  readonly personalFoulLimit: number;
  readonly bonusFreeThrows: number;
}

export const FIBA_2026: GameRulesProfile = {
  id: "FIBA-2026",
  regulationPeriods: 4,
  periodMs: 600_000,
  overtimeMs: 300_000,
  intervalAfterPeriodMs: (period) => (period === 2 ? 15 * 60_000 : 2 * 60_000),
  switchBasketsAtPeriod: 3,
  lastMinutesMs: 120_000,
  teamFoulPenaltyThreshold: 4,
  personalFoulLimit: 5,
  bonusFreeThrows: 2,
};

// --- períodos, sentido y final ---------------------------------------------

export function isOvertime(profile: GameRulesProfile, period: number): boolean {
  return period > profile.regulationPeriods;
}

export function periodDurationMs(profile: GameRulesProfile, period: number): Milliseconds {
  return isOvertime(profile, period) ? profile.overtimeMs : profile.periodMs;
}

export function periodLabel(profile: GameRulesProfile, period: number): string {
  return isOvertime(profile, period) ? `Prórroga ${period - profile.regulationPeriods}` : `C${period}`;
}

/**
 * Sentido de ataque (arts. 9–10): el primer equipo (`teamIndex` 0) ataca
 * hacia x creciente en la primera mitad; se intercambian al empezar C3 y
 * las prórrogas conservan el sentido de C4.
 */
export function attackDirectionForPeriod(profile: GameRulesProfile, teamIndex: 0 | 1, period: number): AttackDirection {
  const secondHalf = period >= profile.switchBasketsAtPeriod;
  const firstTeamRight = !secondHalf;
  const right = teamIndex === 0 ? firstTeamRight : !firstTeamRight;
  return right ? "hacia_x_creciente" : "hacia_x_decreciente";
}

export type PeriodEndDecision =
  | { readonly kind: "siguiente_periodo"; readonly nextPeriod: number; readonly overtime: boolean; readonly reason: string }
  | { readonly kind: "final"; readonly winnerTeamId: string; readonly reason: string };

/**
 * Fin de un período (art. 8): tras C1–C3 se juega el siguiente; al final
 * de C4 o de una prórroga, si hay empate se juega otra prórroga de 5:00,
 * tantas como hagan falta; si no, el partido termina. Nunca cierra un
 * empate como final.
 */
export function adjudicatePeriodEnd(
  profile: GameRulesProfile,
  period: number,
  score: readonly [{ readonly teamId: string; readonly points: number }, { readonly teamId: string; readonly points: number }],
): PeriodEndDecision {
  if (period < profile.regulationPeriods) {
    return { kind: "siguiente_periodo", nextPeriod: period + 1, overtime: false, reason: `el final de ${periodLabel(profile, period)}` };
  }
  const [a, b] = score;
  if (a.points === b.points) {
    return {
      kind: "siguiente_periodo",
      nextPeriod: period + 1,
      overtime: true,
      reason: `empate ${a.points}–${b.points} al final de ${periodLabel(profile, period)}: se juega una prórroga de 5:00`,
    };
  }
  const winner = a.points > b.points ? a : b;
  return { kind: "final", winnerTeamId: winner.teamId, reason: `final sin empate: ${a.points}–${b.points}` };
}

// --- reloj de partido ------------------------------------------------------------

/**
 * Art. 50: una canasta de campo detiene el reloj de partido solo desde
 * 2:00 o menos en C4 y en cada prórroga (inclusive 2:00,00). En C1–C3 y
 * antes de 2:00 de C4/prórroga, no lo detiene por sí sola.
 */
export function gameClockStopsOnMadeBasket(profile: GameRulesProfile, period: number, remainingMs: Milliseconds): boolean {
  return period >= profile.regulationPeriods && remainingMs <= profile.lastMinutesMs;
}

/**
 * Bocina de fin de período: un lanzamiento cuenta si sale de las manos
 * **antes** de la señal (misma convención de frontera que el reloj de
 * lanzamiento: soltar en el milisegundo exacto de la señal ya es tarde).
 * El balón puede seguir en el aire y entrar después; uno soltado en o
 * tras la señal no cuenta ni genera FGA.
 */
export function isReleasedBeforeBuzzer(releaseMs: Milliseconds, buzzerMs: Milliseconds): boolean {
  return releaseMs < buzzerMs;
}

export interface BuzzerShotAdjudication {
  readonly releasedInTime: boolean;
  /** El tiro de campo oficial se registra (FGA) aunque falle. */
  readonly countsAsFieldGoalAttempt: boolean;
  readonly pointsAwarded: 0 | 2 | 3;
  /** Un fallo final sin control no genera rebote: el período ya terminó. */
  readonly reboundAfterMiss: false;
}

export function adjudicateBuzzerShot(args: {
  readonly releaseMs: Milliseconds;
  readonly buzzerMs: Milliseconds;
  readonly made: boolean;
  readonly shotPoints: 2 | 3;
}): BuzzerShotAdjudication {
  const releasedInTime = isReleasedBeforeBuzzer(args.releaseMs, args.buzzerMs);
  return {
    releasedInTime,
    countsAsFieldGoalAttempt: releasedInTime,
    pointsAwarded: releasedInTime && args.made ? args.shotPoints : 0,
    reboundAfterMiss: false,
  };
}

// --- faltas y bonus --------------------------------------------------------------

/** Contador de faltas de equipo del período (art. 42): C1–C3 propios; todas las prórrogas cuentan en C4. */
export function teamFoulPeriodKey(profile: GameRulesProfile, period: number): number {
  return Math.min(period, profile.regulationPeriods);
}

export type DefensiveFoulType = "tiro" | "sin_tiro";

export interface DefensiveFoulFacts {
  readonly type: DefensiveFoulType;
  /** Solo en falta de tiro. */
  readonly shotType?: "close_finish" | "three_point";
  readonly madeShot?: boolean;
  readonly teamFoulsInPeriodBefore: number;
  readonly foulerPersonalFoulsBefore: number;
}

export type FoulSanction =
  | { readonly kind: "libres"; readonly count: number; readonly byBonus: boolean }
  | { readonly kind: "saque" };

export interface DefensiveFoulAdjudication {
  readonly personalFoulsAfter: number;
  readonly teamFoulsAfter: number;
  /** El equipo ya había cometido `teamFoulPenaltyThreshold` faltas en el período antes de esta. */
  readonly teamInPenalty: boolean;
  readonly sanction: FoulSanction;
  /** Quinta falta personal: excluido, debe salir antes de reanudar y no puede volver (art. 41). */
  readonly disqualified: boolean;
}

/**
 * Falta personal defensiva ordinaria (arts. 34, 41, 42). Cada falta suma
 * **una** al autor y **una** al equipo en el período. La de tiro conserva
 * su sanción de 1/2/3 libres con independencia del bonus. La de sin tiro
 * da **dos libres** si el equipo infractor ya tenía cuatro faltas en el
 * período antes de esta (es decir, a partir de la quinta); si no, saque.
 */
export function adjudicateDefensiveFoul(profile: GameRulesProfile, facts: DefensiveFoulFacts): DefensiveFoulAdjudication {
  const personalFoulsAfter = facts.foulerPersonalFoulsBefore + 1;
  const teamFoulsAfter = facts.teamFoulsInPeriodBefore + 1;
  const teamInPenalty = facts.teamFoulsInPeriodBefore >= profile.teamFoulPenaltyThreshold;
  let sanction: FoulSanction;
  if (facts.type === "tiro") {
    const award = awardFreeThrowsForShootingFoul(facts.shotType ?? "close_finish", facts.madeShot ?? false);
    sanction = { kind: "libres", count: award.count, byBonus: false };
  } else if (teamInPenalty) {
    sanction = { kind: "libres", count: profile.bonusFreeThrows, byBonus: true };
  } else {
    sanction = { kind: "saque" };
  }
  return {
    personalFoulsAfter,
    teamFoulsAfter,
    teamInPenalty,
    sanction,
    disqualified: personalFoulsAfter >= profile.personalFoulLimit,
  };
}

/**
 * Reloj de lanzamiento del saque que sigue a una falta defensiva sin
 * libres (art. 29.2.2): en pista trasera, 24 s; en pista delantera, se
 * conserva si muestra 14 s o más y se pone a 14 s si muestra 13 s o menos.
 * Convención de milisegundos del repositorio: «14 s o más» = ≥ 14 000 ms.
 * No es la rama de balón fuera de ME-03, que conserva el reloj.
 */
export function shotClockAfterDefensiveFoulThrowIn(args: {
  readonly inThrowingTeamFrontcourt: boolean;
  readonly remainingMs: Milliseconds;
}): Milliseconds {
  if (!args.inThrowingTeamFrontcourt) return SHOT_CLOCK_FULL_MS;
  return args.remainingMs >= SHOT_CLOCK_RESET_14_MS ? args.remainingMs : SHOT_CLOCK_RESET_14_MS;
}

// --- salto inicial y alternancia --------------------------------------------------------

/** Aproximación explícita de laboratorio para el primer salto (ME-04 §3), no una ley universal de salto. */
export const JUMP_BALL_APPROXIMATION_VERSION = "ME-04-JUMP-1";

/**
 * Alcance efectivo del saltador, cm: `C04 + 2 × (F06 − 8) + variación`,
 * con la variación sembrada uniforme en [−5, +5] cm. C01 **no** se suma:
 * el alcance de pie C04 ya incorpora la talla.
 */
export function effectiveJumpReachCm(standingReachCm: number, f06: number, variationCm: number): number {
  return standingReachCm + 2 * (f06 - 8) + variationCm;
}

export interface JumperFacts {
  readonly teamId: string;
  readonly playerId: string;
  readonly standingReachCm: number;
  readonly f06: number;
  readonly variationCm: number;
}

export interface OpeningJumpAdjudication {
  readonly reachCm: readonly [number, number];
  readonly winnerIndex: 0 | 1;
  readonly tiedBySeed: boolean;
}

/** Vence el mayor alcance; empate exacto, sorteo sembrado (`tieBreakDraw` en [0, 1)). */
export function adjudicateOpeningJump(jumpers: readonly [JumperFacts, JumperFacts], tieBreakDraw: number): OpeningJumpAdjudication {
  const reach = jumpers.map((j) => effectiveJumpReachCm(j.standingReachCm, j.f06, j.variationCm)) as [number, number];
  if (reach[0] === reach[1]) return { reachCm: reach, winnerIndex: tieBreakDraw < 0.5 ? 0 : 1, tiedBySeed: true };
  return { reachCm: reach, winnerIndex: reach[0] > reach[1] ? 0 : 1, tiedBySeed: false };
}

/** La flecha inicial apunta al equipo que **no** obtiene el primer control vivo (art. 12.5). */
export function initialArrowTeam(firstControlTeamId: string, teamIds: readonly [string, string]): string {
  return firstControlTeamId === teamIds[0] ? teamIds[1] : teamIds[0];
}

/**
 * Tras un saque de alternancia la flecha pasa al rival: cuando el saque
 * termina legalmente (toque en la cancha) y también si el equipo que saca
 * comete violación, porque pierde ese derecho (art. 12.5). No cambia solo
 * por empezar un período ni por saltos de lucha no simulados.
 */
export function arrowAfterAlternatingThrowIn(throwingTeamId: string, teamIds: readonly [string, string]): string {
  return throwingTeamId === teamIds[0] ? teamIds[1] : teamIds[0];
}

// --- oportunidades de sustitución --------------------------------------------------------

export type DeadBallCause =
  | "falta"
  | "libre_anotado"
  | "fuera"
  | "violacion"
  | "canasta"
  | "inicio_periodo";

/**
 * Qué equipos tienen oportunidad de sustitución (art. 19.2) cuando el
 * balón queda muerto: con el reloj de partido parado, ambos (falta, fuera,
 * violación, último libre anotado, inicio de período). Tras canasta, solo
 * si detiene el reloj (desde 2:00 en C4/prórroga) y **solo el equipo que
 * la recibe**; con el reloj en marcha, nadie.
 */
export function substitutionOpportunity(args: {
  readonly cause: DeadBallCause;
  readonly gameClockStopped: boolean;
  readonly receivingTeamId: string | null;
  readonly teamIds: readonly [string, string];
}): readonly string[] {
  if (!args.gameClockStopped) return [];
  if (args.cause === "canasta") return args.receivingTeamId ? [args.receivingTeamId] : [];
  return [...args.teamIds];
}
