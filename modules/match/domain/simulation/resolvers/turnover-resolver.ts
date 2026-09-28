import type { Rating } from "../../players/attribute";
import type { SeededRandom } from "../../random/seeded-random";
import { turnoverUnderPressureProbability } from "../../lab/lab-0-1-parameters";

/**
 * Ante presión real y balón expuesto, probabilidad de perder control
 * (estudio §9.6, prompt §3). No se aplica si no hay presión real.
 */
export function resolvesTurnoverUnderPressure(
  ballHandlerT07: Rating,
  defenderT15: Rating,
  rng: SeededRandom,
): boolean {
  const probability = turnoverUnderPressureProbability(ballHandlerT07, defenderT15);
  return rng.next() < probability;
}
