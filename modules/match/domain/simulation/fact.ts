import type { Point2D } from "../geometry/point";
import type { Milliseconds } from "../time/clock";

/**
 * Relato por pasos (prompt §2): "ordenado → reconocido → intentado →
 * ejecutado → concedido". Cada hecho pertenece a una de estas fases; el
 * texto se construye desde los hechos, nunca al revés (estudio §12.1).
 */
export type FactPhase = "ordenado" | "reconocido" | "intentado" | "ejecutado" | "concedido";

export type FactKind =
  | "screen_ordered"
  | "screen_set"
  | "screen_navigated"
  | "roll_continuation"
  | "help_decision"
  | "help_left_assignment"
  | "help_repair_attempt"
  | "trap_committed"
  | "trap_broken_advantage"
  | "trap_recovered"
  | "read_option"
  | "pass_released"
  | "pass_deflected"
  | "pass_received"
  | "pass_control_lost"
  | "shot_prepared"
  | "shot_contested"
  | "shot_blocked"
  | "shot_result"
  | "field_goal_attempt"
  | "shooting_foul"
  | "free_throws_result"
  | "rebound_seeded"
  | "rebound_contested"
  | "rebound_secured"
  | "turnover"
  | "out_of_bounds"
  | "shot_clock_violation"
  | "possession_continues";

export interface PlayerSnapshot {
  readonly playerId: string;
  readonly position: Point2D;
}

export interface Fact {
  readonly sequence: number;
  readonly atMs: Milliseconds;
  readonly phase: FactPhase;
  readonly kind: FactKind;
  readonly actors: readonly string[];
  readonly text: string;
  /** "Quién estaba dónde" en el instante del hecho, para el detalle seleccionable. */
  readonly positions: readonly PlayerSnapshot[];
  readonly detail: Readonly<Record<string, unknown>>;
}

export function createFact(
  sequence: number,
  atMs: Milliseconds,
  phase: FactPhase,
  kind: FactKind,
  actors: readonly string[],
  text: string,
  positions: readonly PlayerSnapshot[],
  detail: Readonly<Record<string, unknown>> = {},
): Fact {
  return { sequence, atMs, phase, kind, actors, text, positions, detail };
}
