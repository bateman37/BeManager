import type { Rating } from "../../players/attribute";
import type { SeededRandom } from "../../random/seeded-random";
import {
  shotProbability,
  blockDeflectionProbability,
  CLOSE_FINISH_BASE_PROBABILITY,
  THREE_POINT_BASE_PROBABILITY,
  type EffectiveOpposition,
} from "../../lab/lab-0-1-parameters";

export type ShotType = "close_finish" | "three_point";

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

  const base =
    attempt.type === "close_finish" ? CLOSE_FINISH_BASE_PROBABILITY : THREE_POINT_BASE_PROBABILITY;
  const probability = shotProbability(base, attempt.shooterSkillRating, attempt.opposition);

  if (rng.next() < probability) {
    return { kind: "made", points: attempt.type === "close_finish" ? 2 : 3 };
  }
  return { kind: "missed" };
}
