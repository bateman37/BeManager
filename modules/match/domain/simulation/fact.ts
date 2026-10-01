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
  // ME-07B v2 §5: cambio (switch) y show.
  | "switch_committed"
  | "show_committed"
  | "show_recovery"
  | "coverage_not_applicable"
  // ME-07B v2 §5 (LAB-0.7): ICE ante el bloqueo lateral y «a la altura».
  | "ice_committed"
  | "ice_late"
  | "at_level_committed"
  | "at_level_recovery"
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
  | "possession_continues"
  // ME-03: tramo de posesiones enlazadas. Amplían la taxonomía sin cambiar
  // el significado de las anteriores (el resolvedor rápido las ignora).
  | "rebound_duties_assigned"
  | "possession_started"
  | "possession_ended"
  | "phase_started"
  | "transition_outlet"
  | "transition_read"
  | "second_chance_read"
  | "organized_entry"
  | "throw_in_awarded"
  | "throw_in_completed"
  | "loose_ball_recovered"
  | "backcourt_violation"
  | "throw_in_violation"
  | "tramo_stopped"
  // ME-04: partido completo. Amplían la taxonomía sin cambiar las anteriores.
  | "legal_containment"
  | "non_shooting_foul"
  | "personal_foul"
  | "player_disqualified"
  | "substitution"
  | "jump_ball"
  | "jump_ball_control"
  | "period_started"
  | "period_ended"
  | "buzzer"
  | "game_ended"
  | "alternating_arrow"
  | "second_entry"
  // ME-06: segunda familia posicional (mano a mano sin balón).
  | "handoff_action_started";

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
