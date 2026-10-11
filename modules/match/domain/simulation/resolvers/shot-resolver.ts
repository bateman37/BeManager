import type { Rating } from "../../players/attribute";
import type { SeededRandom } from "../../random/seeded-random";
import {
  shotProbability,
  blockDeflectionProbability,
  CLOSE_FINISH_BASE_PROBABILITY,
  THREE_POINT_BASE_PROBABILITY,
  type EffectiveOpposition,
} from "../../lab/lab-0-1-parameters";
import { FLOATER_BASE_PROBABILITY, MID_RANGE_BASE_PROBABILITY } from "../../lab/lab-0-5-parameters";

/**
 * Tipos de tiro de campo (ME-07B v2 §2.4/§6): finalización pegada al aro
 * (T01), floater (T02), tiro medio de dos (T03) y triple (T04).
 */
export type ShotType = "close_finish" | "floater" | "mid_range" | "three_point";

export function shotBaseProbability(type: ShotType): number {
  switch (type) {
    case "close_finish":
      return CLOSE_FINISH_BASE_PROBABILITY;
    case "floater":
      return FLOATER_BASE_PROBABILITY;
    case "mid_range":
      return MID_RANGE_BASE_PROBABILITY;
    case "three_point":
      return THREE_POINT_BASE_PROBABILITY;
  }
}

export function shotPoints(type: ShotType): 2 | 3 {
  return type === "three_point" ? 3 : 2;
}

export interface ShotAttempt {
  readonly type: ShotType;
  readonly shooterSkillRating: Rating;
  readonly opposition: EffectiveOpposition;
  /** true si el defensor puede intervenir sobre el balón para intentar taponar. */
  readonly blockEligible: boolean;
  readonly blockerT18: Rating;
}

export type ShotOutcome =
  | { readonly kind: "made"; readonly points: 2 | 3 }
  | { readonly kind: "missed" }
  | { readonly kind: "blocked" };

/**
 * Un lanzamiento es una única interacción con hechos ordenados: oposición,
 * posible tapón y, solo si no hay tapón, trayectoria resultante (estudio
 * §9.4). No se sortean canasta y tapón como sucesos independientes.
 */
export function resolveShot(attempt: ShotAttempt, rng: SeededRandom): ShotOutcome {
  if (attempt.blockEligible) {
    const blockProbability = blockDeflectionProbability(attempt.blockerT18);
    if (rng.next() < blockProbability) {
      return { kind: "blocked" };
    }
  }

  const probability = shotProbability(shotBaseProbability(attempt.type), attempt.shooterSkillRating, attempt.opposition);

  if (rng.next() < probability) {
    return { kind: "made", points: shotPoints(attempt.type) };
  }
  return { kind: "missed" };
}
