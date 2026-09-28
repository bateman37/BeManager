import type { Rating } from "../../players/attribute";
import type { SeededRandom } from "../../random/seeded-random";
import {
  passTrajectoryErrorProbability,
  cleanReceptionProbability,
  deflectionProbability,
  AWKWARD_CONTROL_DELAY_SECONDS,
} from "../../lab/lab-0-1-parameters";

export type PassOutcome =
  | { readonly kind: "clean_reception" }
  | { readonly kind: "awkward_control"; readonly extraDelaySeconds: number }
  | { readonly kind: "deflected_loose_ball" }
  | { readonly kind: "control_lost" };

/**
 * Resuelve un pase siguiendo el orden del estudio §9.3: liberar → trayectoria
 * real → posibles toques elegibles → recepción/control o balón vivo. Un
 * toque no es automáticamente robo; un error de trayectoria consume tiempo
 * de ajuste pero no obliga a perder el balón.
 */
export function resolvePass(
  passerT09: Rating,
  receiverT11: Rating,
  defenderEligible: boolean,
  defenderT17: Rating,
  pressure: 0 | 1,
  rng: SeededRandom,
): PassOutcome {
  if (defenderEligible) {
    const touchProbability = deflectionProbability(defenderT17, passerT09);
    if (rng.next() < touchProbability) {
      return { kind: "deflected_loose_ball" };
    }
  }

  const trajectoryErrorProbability = passTrajectoryErrorProbability(passerT09, pressure);
  const hasTrajectoryError = rng.next() < trajectoryErrorProbability;

  const receptionProbability = cleanReceptionProbability(receiverT11, pressure);
  const isCleanReception = rng.next() < receptionProbability;

  if (!hasTrajectoryError && isCleanReception) {
    return { kind: "clean_reception" };
  }

  return { kind: "awkward_control", extraDelaySeconds: AWKWARD_CONTROL_DELAY_SECONDS };
}
