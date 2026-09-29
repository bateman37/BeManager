import type { Point2D } from "../geometry/point";
import type { Milliseconds } from "../time/clock";
import type { MatchInput } from "../lab/match-input";
import type { Fact } from "./fact";

export type BallStatus = "held" | "in_flight_pass" | "in_flight_shot" | "loose" | "dead";

export interface BallState {
  readonly status: BallStatus;
  readonly holderId: string | null;
  readonly position: Point2D;
}

export interface OnCourtPlayerState {
  readonly playerId: string;
  readonly position: Point2D;
}

/**
 * Estado legal en el que puede terminar cada rama generable (prompt §2):
 * control conservado, pérdida viva, tiro anotado, fallo con rebote,
 * tapón con balón vivo, falta de tiro con libres y continuación, balón
 * fuera con saque adjudicado, o fin por reloj.
 */
export type TerminalOutcome =
  | { readonly kind: "made_basket"; readonly points: 2 | 3; readonly andOnePending: boolean }
  | { readonly kind: "missed_shot_defensive_rebound" }
  | { readonly kind: "missed_shot_offensive_rebound_continues" }
  | { readonly kind: "live_turnover" }
  | { readonly kind: "steal_by_defense" }
  | { readonly kind: "blocked_shot_live_ball" }
  | {
      readonly kind: "shooting_foul";
      readonly basketCounted: boolean;
      readonly freeThrowsAwarded: number;
      /** Libres realmente ejecutados y anotados con T05 y semilla (HF-002 §2). */
      readonly freeThrowsMade: number;
      readonly pointsFromFreeThrows: number;
      /** Puntos totales de la jugada: canasta contada (si aplica) + libres anotados. */
      readonly totalPoints: number;
    }
  /**
   * Solo en el partido de ME-04 (reglas de partido activas en el núcleo
   * enlazado): la falta de tiro se ha pitado y la canasta (si la hubo) ya
   * está adjudicada, pero los libres se ejecutan después, cuando quien
   * orquesta el partido haya abierto la oportunidad de sustitución.
   */
  | {
      readonly kind: "shooting_foul_free_throws_pending";
      readonly shooterId: string;
      readonly foulerId: string;
      readonly shotType: "close_finish" | "three_point";
      readonly basketCounted: boolean;
      readonly freeThrowsAwarded: number;
    }
  /**
   * Solo en el partido de ME-04: falta personal defensiva ordinaria sin
   * tiro (contacto ilegal al contener o cerrar el paso, antes del gesto de
   * tiro). La sanción (saque o dos libres por bonus) la adjudica el perfil
   * de reglas del partido, no el núcleo.
   */
  | {
      readonly kind: "non_shooting_foul";
      readonly foulerId: string;
      readonly fouledId: string;
    }
  /**
   * Solo en el partido de ME-04: la primera lectura del bloqueo quedó
   * negada y el continuador sacó el balón con un pase real a un exterior,
   * que inicia la segunda entrada del mismo bloqueo directo. Los roles y
   * destinos (marco local) los calcula `second-entry-read.ts`.
   */
  | {
      readonly kind: "second_entry_kick_out";
      readonly passerId: string;
      readonly creatorId: string;
      readonly slotSwap: Readonly<Record<string, string>>;
      readonly targets: Readonly<Record<string, Point2D>>;
      readonly screenSetSeconds: number;
      readonly reason: string;
    }
  | { readonly kind: "out_of_bounds"; readonly lastTouchPlayerId: string }
  | { readonly kind: "shot_clock_violation" }
  | { readonly kind: "possession_reorganized_control_kept"; readonly outletPlayerId: string }
  | { readonly kind: "simulation_guard_stopped"; readonly reason: string };

export interface MatchState {
  readonly input: MatchInput;
  readonly clockMs: Milliseconds;
  readonly gameClockMs: Milliseconds;
  readonly shotClockMs: Milliseconds;
  readonly players: Readonly<Record<string, OnCourtPlayerState>>;
  readonly ball: BallState;
  readonly facts: readonly Fact[];
  readonly terminal: TerminalOutcome | null;
  /** Se incrementa al iniciar otra fase dentro de la misma posesión estadística (rebote ofensivo). */
  readonly possessionPhase: number;
}

export function isTerminal(state: MatchState): boolean {
  return state.terminal !== null;
}
