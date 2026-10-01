/**
 * LAB-0.7 (ME-07B v2 §4–§5): geometría del **bloqueo directo lateral** y de
 * las coberturas que solo existen en él o se distinguen por su profundidad
 * (ICE, a la altura frente a show). Son puntos de referencia de la
 * disposición, en el marco local del equipo que ataca (aro atacado en
 * (26,425; 7,5), ataque hacia x creciente; `geometry/court.ts`), no
 * coeficientes de acierto: toda llegada sigue saliendo de distancia,
 * velocidad (F01/F04), latencias (M01/M05/M09) y alcance (C03).
 *
 * - Unidad: metros (posiciones en la cancha).
 * - Caso neutro: la colocación `central` conserva exactamente la geometría
 *   de ME-01/ME-02 (`SCENARIOS.drop_con_ayuda`, `SHORT_ROLL_SPOT`,
 *   `DEEP_CONTINUATION_SPOT`); nada de este archivo la cambia.
 * - Intervalo: el bloqueo es «lateral» solo si su punto queda fuera de la
 *   franja de la zona (|y − 7,5| > 2,45 m, `isLateralScreenSpot`); el punto
 *   aquí (y = 4,2) está a 3,3 m del eje.
 * - Sensibilidad: `lab-0-7-parameters.test.ts` comprueba que la pantalla es
 *   lateral, que el punto de uso queda detrás del arco (el triple tras la
 *   pantalla es legal), que el punto ICE de D1 está en la línea del manejador
 *   hacia la pantalla y que la profundidad del show es mayor que la de «a la
 *   altura».
 * - No duplicación: el lado débil (O3 esquina, O4 ala, D3, D4) y la esquina
 *   fuerte (O2, D2) son los mismos puntos de la disposición central; cambian
 *   solo el manejador, el bloqueador, sus dos defensores y la continuación.
 */
import type { Point2D } from "../geometry/point";
import { SHORT_ROLL_SPOT, DEEP_CONTINUATION_SPOT } from "./lab-0-2-parameters";

export const LAB_0_7_PARAMETERS_VERSION = "LAB-0.7";

/** Colocación del bloqueo directo: central (ME-01) o lateral (ME-07B v2). */
export type ScreenPlacement = "central" | "lateral";

/** Colocación pedida por el entrenador: `auto` la decide el poseedor real por proyección. */
export type ScreenPlacementChoice = "auto" | ScreenPlacement;

/**
 * Disposición del bloqueo lateral (lado izquierdo del ataque, el de la
 * esquina fuerte O2): el manejador en el ala, el bloqueador por encima de su
 * defensor hacia el centro, de modo que usar la pantalla lleva al centro de
 * la pista y negarla (ICE) empuja hacia la línea de fondo.
 */
export const LATERAL_PNR_TARGETS: Readonly<Record<string, Point2D>> = {
  // Misma distancia manejador–bloqueador que la central (2,46 m), saliendo
  // hacia el centro (dirección (0,6; 0,8)).
  O1: { x: 19.32, y: 2.23 },
  O2: { x: 24.0, y: 1.1 },
  O3: { x: 24.0, y: 13.9 },
  O4: { x: 18.0, y: 12.5 },
  O5: { x: 20.8, y: 4.2 },
  // D1 a 1,1 m de O1 hacia el aro (como en la central); D5 a 2,2 m del
  // bloqueador hacia el aro, en drop.
  D1: { x: 20.2, y: 2.89 },
  D2: { x: 23.4, y: 1.5 },
  D3: { x: 23.4, y: 11.3 },
  D4: { x: 19.0, y: 12.2 },
  D5: { x: 22.7, y: 5.31 },
};

/** Continuación del bloqueador lateral: 3,0 m de la pantalla hacia el aro (como la central) y 1,8 m más. */
export const LATERAL_SHORT_ROLL_SPOT: Point2D = { x: 23.4, y: 5.7 };
export const LATERAL_DEEP_CONTINUATION_SPOT: Point2D = { x: 24.9, y: 6.6 };

/**
 * ICE (impedir el centro): D1 se coloca en el lado de la pantalla del
 * manejador, a 0,70 m (contacto) de él hacia el bloqueador, antes de que la
 * use; el manejador solo puede ir hacia la línea de fondo, donde espera la
 * ayuda baja del pívot.
 *
 * - `ICE_BASELINE_DRIVE_SPOT`: paso por la línea de fondo, fuera de la zona,
 *   hacia el aro.
 * - `ICE_LOW_HELP_SPOT`: ayuda baja de D5, en el poste bajo del lado del
 *   balón, entre ese paso y el aro.
 * - `ICE_BASELINE_PULL_UP_SPOT`: tiro medio tras rechazar hacia fondo, a
 *   5,9 m del aro (zona de media distancia de LAB-0.5).
 * - `ICE_POP_SPOT`: el bloqueador, cuya pantalla se ha negado, se abre al
 *   centro (codo) mientras su defensor está abajo: la concesión típica del
 *   ICE.
 */
export const ICE_BASELINE_DRIVE_SPOT: Point2D = { x: 24.6, y: 3.6 };
export const ICE_LOW_HELP_SPOT: Point2D = { x: 24.6, y: 5.2 };
export const ICE_BASELINE_PULL_UP_SPOT: Point2D = { x: 22.6, y: 3.0 };
export const ICE_POP_SPOT: Point2D = { x: 22.2, y: 6.2 };

/** Puntos de la disposición del bloqueo según su colocación (el central es el de siempre). */
export interface PnrSetGeometry {
  readonly placement: ScreenPlacement;
  readonly shortRoll: Point2D;
  readonly deepContinuation: Point2D;
}

export function pnrSetGeometry(placement: ScreenPlacement): PnrSetGeometry {
  return placement === "lateral"
    ? { placement, shortRoll: LATERAL_SHORT_ROLL_SPOT, deepContinuation: LATERAL_DEEP_CONTINUATION_SPOT }
    : { placement, shortRoll: SHORT_ROLL_SPOT, deepContinuation: DEEP_CONTINUATION_SPOT };
}
