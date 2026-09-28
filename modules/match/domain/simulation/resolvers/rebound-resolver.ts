import type { Point2D } from "../../geometry/point";
import { add, scale } from "../../geometry/point";
import { isInsideCourt } from "../../geometry/court";
import type { Rating } from "../../players/attribute";
import type { SeededRandom } from "../../random/seeded-random";
import {
  REBOUND_SEED_RADIUS_CLOSE_METERS,
  REBOUND_SEED_RADIUS_THREE_METERS,
  REBOUND_FLIGHT_TIME_CLOSE_SECONDS,
  REBOUND_FLIGHT_TIME_THREE_SECONDS,
  closeoutReboundDelaySeconds,
  reboundCaptureProbability,
} from "../../lab/lab-0-1-parameters";
import type { ShotType } from "./shot-resolver";

export interface ReboundSeed {
  readonly landingPoint: Point2D;
  readonly flightTimeSeconds: number;
}

/**
 * Genera una salida de balón tras un fallo que toca aro (estudio §9.5,
 * prompt §3): radial 0.8–2.5 m para tiro cercano, 2–5 m para triple;
 * dirección base desde el aro hacia el punto de tiro más variación
 * sembrada uniforme entre −π/2 y +π/2.
 */
export function seedReboundLanding(
  hoop: Point2D,
  shotOrigin: Point2D,
  shotType: ShotType,
  rng: SeededRandom,
): ReboundSeed {
  const [minRadius, maxRadius] =
    shotType === "close_finish" ? REBOUND_SEED_RADIUS_CLOSE_METERS : REBOUND_SEED_RADIUS_THREE_METERS;
  const radius = rng.nextInRange(minRadius, maxRadius);
  const flightTimeSeconds =
    shotType === "close_finish" ? REBOUND_FLIGHT_TIME_CLOSE_SECONDS : REBOUND_FLIGHT_TIME_THREE_SECONDS;

  const baseAngle = Math.atan2(shotOrigin.y - hoop.y, shotOrigin.x - hoop.x);
  const variation = rng.nextInRange(-Math.PI / 2, Math.PI / 2);
  const angle = baseAngle + variation;

  const landingPoint = add(hoop, scale({ x: Math.cos(angle), y: Math.sin(angle) }, radius));

  return { landingPoint, flightTimeSeconds };
}

export interface ReboundCandidate {
  readonly playerId: string;
  readonly arrivalTimeSeconds: number;
  readonly closedOut: boolean;
  readonly t19: Rating;
  readonly f05: Rating;
  readonly t20: Rating;
}

export type ReboundOutcome =
  | { readonly kind: "secured"; readonly playerId: string }
  | { readonly kind: "loose_ball_tip"; readonly nearestPlayerId: string }
  | { readonly kind: "out_of_bounds" };

/**
 * Resuelve la disputa del rebote: el cierre puede retrasar el acceso rival
 * aunque quien cierra no capture (estudio §9.5). Solo participan candidatos
 * que realmente llegan dentro del tiempo de vuelo.
 */
export function resolveRebound(
  seed: ReboundSeed,
  candidates: readonly ReboundCandidate[],
  rng: SeededRandom,
): ReboundOutcome {
  if (!isInsideCourt(seed.landingPoint)) {
    return { kind: "out_of_bounds" };
  }

  const eligible = candidates
    .map((c) => {
      const delay = c.closedOut ? closeoutReboundDelaySeconds(c.t19, c.f05) : 0;
      return { ...c, effectiveArrival: c.arrivalTimeSeconds + (c.closedOut ? 0 : delay) };
    })
    .filter((c) => c.arrivalTimeSeconds <= seed.flightTimeSeconds + 0.5)
    .sort((a, b) => a.effectiveArrival - b.effectiveArrival);

  if (eligible.length === 0) {
    return { kind: "out_of_bounds" };
  }

  const first = eligible[0]!;
  const disputa: 0 | 1 = eligible.length > 1 ? 1 : 0;
  const captureProbability = reboundCaptureProbability(first.t20, disputa);

  if (rng.next() < captureProbability) {
    return { kind: "secured", playerId: first.playerId };
  }

  return { kind: "loose_ball_tip", nearestPlayerId: first.playerId };
}
