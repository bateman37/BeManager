/**
 * LAB-0.5 (ME-07B v2 §2.4 y §6): hipótesis locales de laboratorio para los
 * dos tiros de dos que el resolvedor no distinguía (solo existían
 * `close_finish` y `three_point`): el **floater** (T02, toque intermedio por
 * encima de la primera contención y antes del aro) y el **tiro medio** (T03,
 * lanzamiento de dos fuera del aro). Misma convención que LAB-0.1/0.4:
 * unidad, intervalo, caso neutro, sensibilidad probada en
 * `lab-0-5-parameters.test.ts` y razón de no duplicación. No son
 * porcentajes de liga ni ajustes universales de acierto: la oposición real
 * (R_contest de LAB-0.3), el tapón y la falta se siguen resolviendo con la
 * misma geometría que los otros dos tipos.
 */
import { distanceToHoop } from "../geometry/court";
import type { Point2D } from "../geometry/point";

export const LAB_0_5_PARAMETERS_VERSION = "LAB-0.5";

/**
 * Probabilidad base (rating neutro 8, sin oposición) de un floater.
 *
 * - Unidad: probabilidad [0, 1]. Intervalo razonable [0,40; 0,55].
 * - Caso neutro: T02 = 8 y oposición 0 → 0,48 (misma pendiente 0,017·d y
 *   misma penalización 0,18·oposición de `shotProbability`, sin fórmula nueva).
 * - Orden: entre la finalización cercana (0,60, pegada al aro) y el tiro
 *   medio (0,42): se suelta más lejos del aro que una bandeja y más cerca que
 *   un tiro medio. Hipótesis de prototipo, no dato de competición.
 * - No duplicación: T01 sigue siendo la finalización pegada al aro; T02 solo
 *   se consulta cuando el jugador suelta antes del protector de aro
 *   (`isFloaterZone`), nunca como segundo premio de la bandeja.
 */
export const FLOATER_BASE_PROBABILITY = 0.48;

/**
 * Probabilidad base (rating neutro 8, sin oposición) de un tiro medio de dos.
 *
 * - Unidad: probabilidad [0, 1]. Intervalo razonable [0,36; 0,48].
 * - Caso neutro: T03 = 8 y oposición 0 → 0,42.
 * - Orden: por debajo del floater (más lejos del aro) y por encima del
 *   triple (0,34), que se lanza desde más lejos todavía.
 * - No duplicación: T04 sigue reservado al tiro detrás de la línea; T06
 *   solo acorta la preparación tras bote (igual que en el triple), sin
 *   segundo premio de acierto.
 */
export const MID_RANGE_BASE_PROBABILITY = 0.42;

/**
 * Zonas de lanzamiento de dos por distancia al aro atacado, en metros.
 *
 * - Floater: (FINISH_MAX, FLOATER_MAX]. Tiro medio: (FLOATER_MAX, arco de 6,75].
 * - Unidad: m. Intervalos razonables: FINISH_MAX ∈ [1,5; 2,5], FLOATER_MAX ∈ [4; 5].
 * - Caso neutro: 2,0 m y 4,5 m (la zona restringida FIBA tiene 1,25 m de
 *   radio; la finalización cercana del motor se suelta en el propio aro).
 * - No duplicación: solo clasifica el punto real de liberación que ya decide
 *   la geometría; no cambia llegadas ni oposición.
 */
export const CLOSE_FINISH_MAX_DISTANCE_METERS = 2.0;
export const FLOATER_MAX_DISTANCE_METERS = 4.5;

export function isFloaterZone(position: Point2D): boolean {
  const d = distanceToHoop(position);
  return d > CLOSE_FINISH_MAX_DISTANCE_METERS && d <= FLOATER_MAX_DISTANCE_METERS;
}

export function isMidRangeZone(position: Point2D): boolean {
  const d = distanceToHoop(position);
  return d > FLOATER_MAX_DISTANCE_METERS && d <= 6.75;
}
