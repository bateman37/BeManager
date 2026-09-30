import type { Point2D } from "../../geometry/point";
import { add, distance, scale } from "../../geometry/point";
import { COMBINED_CONTACT_RADIUS_METERS } from "../../lab/lab-0-2-parameters";
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

/**
 * Geometría del cierre de rebote (ME-07B v2 §2.1). Presente solo cuando el
 * balón sale de un tiro o libre que tocó aro y el balón está en el aire
 * (`flightTimeSeconds > 0`): un balón suelto ya en el suelo no admite cierre.
 */
export interface ReboundBoxOutGeometry {
  /** Aro de referencia: el cerrador debe estar más cerca de él que su rival. */
  readonly hoop: Point2D;
  /** Velocidad con la que el cerrador alcanza el contacto (la misma de llegada al rebote). */
  readonly speedMps: number;
}

export interface ReboundCandidate {
  readonly playerId: string;
  /** Equipo real del candidato: solo se cierra a un rival. */
  readonly teamId: string;
  /** Posición real en el instante del fallo (no la de destino). */
  readonly position: Point2D;
  readonly arrivalTimeSeconds: number;
  readonly t19: Rating;
  readonly f05: Rating;
  readonly t20: Rating;
  /**
   * `false` para quien no puede iniciar un cierre durante el vuelo: el
   * tirador completa su gesto de lanzamiento (ACTIONS §carga y balance) y
   * el lanzador de libres sigue en su línea. Puede ser cerrado igualmente.
   */
  readonly canBoxOut?: boolean;
}

/**
 * Un cierre efectivo (ME-01 §LAB-0.1, «un cierre legal y próximo retrasa el
 * acceso rival»): `closerId` gana la posición interior y, con **sus** T19/F05,
 * retrasa `rivalId`. El retraso lo sufre el rival, nunca el cerrador.
 */
export interface ReboundBoxOut {
  readonly closerId: string;
  readonly rivalId: string;
  /** Segundos desde el fallo hasta que el cerrador alcanza el contacto. */
  readonly contactSeconds: number;
  readonly delaySeconds: number;
  readonly closerT19: Rating;
  readonly closerF05: Rating;
}

export interface ReboundArrival {
  readonly playerId: string;
  readonly rawArrivalSeconds: number;
  readonly effectiveArrivalSeconds: number;
  readonly inPool: boolean;
}

export interface ReboundTrace {
  readonly boxOuts: readonly ReboundBoxOut[];
  readonly arrivals: readonly ReboundArrival[];
}

export type ReboundOutcome =
  | { readonly kind: "secured"; readonly playerId: string; readonly trace: ReboundTrace }
  | {
      readonly kind: "loose_ball_tip";
      readonly nearestPlayerId: string;
      readonly contestPoolPlayerIds: readonly string[];
      readonly trace: ReboundTrace;
    }
  | { readonly kind: "out_of_bounds" };

/**
 * Cierres de rebote legales y próximos, emparejados uno a uno (ME-07B v2
 * §2.1). Sin coeficientes nuevos: un cerrador C cierra a un rival R solo si
 * (1) C está más cerca del aro que R (posición interior real en el instante
 * del fallo) y no es el tirador que completa su gesto, (2) C alcanza el contacto — distancia menos los dos radios
 * corporales de LAB-0.2, a la velocidad de llegada al rebote — mientras el
 * balón sigue en el aire y (3) antes de que R llegue al balón. Los rivales se
 * atienden por orden de llegada real (el más peligroso primero); cada uno lo
 * cierra el cerrador elegible que antes contacta (desempate por ID) y nadie
 * cierra a dos a la vez. El retraso es `closeoutReboundDelaySeconds` del
 * **cerrador** y se suma a la llegada del **rival**.
 */
export function computeReboundBoxOuts(
  candidates: readonly ReboundCandidate[],
  geometry: ReboundBoxOutGeometry,
  flightTimeSeconds: number,
): ReboundBoxOut[] {
  if (flightTimeSeconds <= 0) return [];
  const rivals = [...candidates].sort(
    (a, b) => a.arrivalTimeSeconds - b.arrivalTimeSeconds || (a.playerId < b.playerId ? -1 : 1),
  );
  const usedClosers = new Set<string>();
  const boxOuts: ReboundBoxOut[] = [];
  for (const rival of rivals) {
    let best: { closer: ReboundCandidate; contactSeconds: number } | null = null;
    for (const closer of candidates) {
      if (closer.teamId === rival.teamId || closer.canBoxOut === false || usedClosers.has(closer.playerId)) continue;
      if (distance(closer.position, geometry.hoop) >= distance(rival.position, geometry.hoop)) continue;
      const gap = Math.max(0, distance(closer.position, rival.position) - COMBINED_CONTACT_RADIUS_METERS);
      const contactSeconds = geometry.speedMps > 0 ? gap / geometry.speedMps : gap === 0 ? 0 : Infinity;
      if (contactSeconds > flightTimeSeconds || contactSeconds > rival.arrivalTimeSeconds) continue;
      if (
        !best ||
        contactSeconds < best.contactSeconds ||
        (contactSeconds === best.contactSeconds && closer.playerId < best.closer.playerId)
      ) {
        best = { closer, contactSeconds };
      }
    }
    if (!best) continue;
    usedClosers.add(best.closer.playerId);
    boxOuts.push({
      closerId: best.closer.playerId,
      rivalId: rival.playerId,
      contactSeconds: best.contactSeconds,
      delaySeconds: closeoutReboundDelaySeconds(best.closer.t19, best.closer.f05),
      closerT19: best.closer.t19,
      closerF05: best.closer.f05,
    });
  }
  return boxOuts;
}

/**
 * Resuelve la disputa del rebote: el cierre puede retrasar el acceso rival
 * aunque quien cierra no capture (estudio §9.5). Solo participan como
 * primer optante los candidatos que realmente llegan —con su llegada ya
 * retrasada por un cierre— dentro de la ventana de vuelo; si nadie llega en
 * esa ventana pero el balón sigue dentro de la cancha, no se declara "fuera"
 * solo por eso (prompt HF-002 §1.4): el balón sigue vivo y lo recupera quien
 * de verdad llegue, aunque sea más tarde.
 *
 * ME-07B v2 §2.1 corrige un defecto de ME-01: el retraso se calculaba solo
 * para el defensor que había cerrado el tiro y se sumaba solo a quien no lo
 * había hecho, así que siempre valía cero, y la ventana usaba la llegada
 * sin ajustar.
 */
export function resolveRebound(
  seed: ReboundSeed,
  candidates: readonly ReboundCandidate[],
  rng: SeededRandom,
  boxOutGeometry?: ReboundBoxOutGeometry,
): ReboundOutcome {
  if (!isInsideCourt(seed.landingPoint)) {
    return { kind: "out_of_bounds" };
  }

  const boxOuts = boxOutGeometry ? computeReboundBoxOuts(candidates, boxOutGeometry, seed.flightTimeSeconds) : [];
  const delayOf = new Map(boxOuts.map((b) => [b.rivalId, b.delaySeconds]));

  const withEffectiveArrival = candidates
    .map((c) => ({ ...c, effectiveArrival: c.arrivalTimeSeconds + (delayOf.get(c.playerId) ?? 0) }))
    .sort((a, b) => a.effectiveArrival - b.effectiveArrival);

  const withinFlightWindow = withEffectiveArrival.filter(
    (c) => c.effectiveArrival <= seed.flightTimeSeconds + 0.5,
  );

  // Si nadie llega dentro de la ventana de vuelo, el balón sigue en la
  // cancha y lo recupera quien realmente llegue antes, aunque sea después
  // de esa ventana: no hay "eligibilidad" artificial, solo llegada real.
  const pool = withinFlightWindow.length > 0 ? withinFlightWindow : withEffectiveArrival;

  if (pool.length === 0) {
    return { kind: "out_of_bounds" };
  }

  const poolIds = new Set(pool.map((c) => c.playerId));
  const trace: ReboundTrace = {
    boxOuts,
    arrivals: withEffectiveArrival.map((c) => ({
      playerId: c.playerId,
      rawArrivalSeconds: c.arrivalTimeSeconds,
      effectiveArrivalSeconds: c.effectiveArrival,
      inPool: poolIds.has(c.playerId),
    })),
  };

  const first = pool[0]!;
  const disputa: 0 | 1 = pool.length > 1 ? 1 : 0;
  const captureProbability = reboundCaptureProbability(first.t20, disputa);

  if (rng.next() < captureProbability) {
    return { kind: "secured", playerId: first.playerId, trace };
  }

  return {
    kind: "loose_ball_tip",
    nearestPlayerId: first.playerId,
    contestPoolPlayerIds: pool.map((c) => c.playerId),
    trace,
  };
}

/** Llegada efectiva (con cierre) de un jugador según la traza del rebote. */
export function effectiveReboundArrival(trace: ReboundTrace, playerId: string): number | undefined {
  return trace.arrivals.find((a) => a.playerId === playerId)?.effectiveArrivalSeconds;
}

/**
 * Palmeo o balón dividido sin captura limpia: lo controla, entre quienes
 * realmente llegaron, el de mayor T20 (empate: el primero en llegar). Misma
 * regla que HF-002 §1.4; compartida por el rebote y, en ME-03, por la
 * disputa de un balón suelto tras tapón o desvío.
 */
export function pickTipWinnerByT20(
  tip: Extract<ReboundOutcome, { kind: "loose_ball_tip" }>,
  t20Of: (playerId: string) => Rating,
): string {
  let best = tip.nearestPlayerId;
  let bestT20 = t20Of(best);
  for (const id of tip.contestPoolPlayerIds) {
    const t20 = t20Of(id);
    if (t20 > bestT20) {
      best = id;
      bestT20 = t20;
    }
  }
  return best;
}
