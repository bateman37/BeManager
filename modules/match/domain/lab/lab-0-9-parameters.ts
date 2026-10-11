/**
 * LAB-0.9 (ME-07B v2 §4, «Libro por fase: Horns→Spain»): geometría de la
 * variante **Spain** desde la colocación Horns (LAB-0.8). Son puntos de la
 * disposición en el marco local del equipo que ataca (aro atacado en
 * (26,425; 7,5), ataque hacia x creciente; `geometry/court.ts`), no
 * coeficientes de acierto: toda llegada sigue saliendo de distancia,
 * velocidad (F01/F04), latencias (M01/M05/M09), retraso de pantalla
 * (T13/F05/T16, peso) y alcance (C03).
 *
 * Spain: el bloqueo directo del cuerno (O5) es el mismo de Horns; el
 * **segundo cuerno (O3) baja desde el codo contrario a poner un bloqueo
 * ciego (por la espalda) al defensor que protege el roll en drop (D5)**, a
 * contacto suyo en la línea por la que retrocederá al aro, y después se abre
 * a tirar (pop) por encima del arco. El manejador sincroniza el uso de su
 * pantalla con la llegada del bloqueador ciego (cuesta reloj real: espera en
 * el punto de uso, sin teletransporte), de modo que el roll empieza cuando
 * el bloqueo ciego ya está puesto. El continuador, en lugar de pararse en el
 * short roll (donde retrocede D5 en drop), sigue hasta el poste bajo del lado
 * débil (`SPAIN_ROLL_SPOT`, roll profundo) por fuera del bloqueo ciego.
 *
 * - Unidad: metros. Caso neutro: la ficha Horns→bloqueo (LAB-0.8) y la
 *   central no cambian; nada de este archivo las toca.
 * - Intervalo: solo hay a quién bloquear si D5 está a más de
 *   `CLOSE_FINISH_MAX_DISTANCE_METERS` (2,0 m, LAB-0.5) más un contacto del
 *   aro (si ya está en el aro, no hay retroceso que cortar) y si la defensa
 *   juega con D5 detrás de la pantalla (drop o por debajo); ante cambio,
 *   trampa, show o «a la altura» D5 está arriba, en el balón.
 * - Sensibilidad: `lab-0-9-parameters.test.ts` comprueba que el pop queda
 *   detrás del arco, que el roll profundo es zona de floater y su camino no
 *   choca con D5 ni con el bloqueador ciego, y que el punto del bloqueo ciego
 *   está a contacto de D5 hacia el aro.
 * - No duplicación: el bloqueo directo, su retraso, las lecturas del
 *   receptor (aro/floater/pase) y el cierre del tiro son las primitivas
 *   compartidas; aquí solo hay el punto del roll profundo, el del pop y el
 *   punto del bloqueo ciego.
 */
import type { Point2D } from "../geometry/point";
import { distance, moveToward } from "../geometry/point";
import { ATTACKED_HOOP } from "../geometry/court";
import { COMBINED_CONTACT_RADIUS_METERS } from "./lab-0-2-parameters";
import { CLOSE_FINISH_MAX_DISTANCE_METERS } from "./lab-0-5-parameters";

export const LAB_0_9_PARAMETERS_VERSION = "LAB-0.9";

/** Roll profundo del bloqueador en Spain: poste bajo del lado débil, por fuera del bloqueo ciego. */
export const SPAIN_ROLL_SPOT: Point2D = { x: 24.5, y: 8.9 };

/** Pop del bloqueador ciego tras el bloqueo: por encima del arco, en el lado del codo de donde salió. */
export const SPAIN_POP_SPOT: Point2D = { x: 19.7, y: 5.4 };

/** Punto del bloqueo ciego: a contacto del defensor, en su línea de retroceso al aro. */
export function spainBackScreenPoint(defender: Point2D): Point2D {
  return moveToward(defender, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS);
}

/** Hay retroceso que cortar: el defensor está fuera del radio de protección del aro (más un contacto). */
export function isBackScreenTarget(defender: Point2D): boolean {
  return distance(defender, ATTACKED_HOOP) > CLOSE_FINISH_MAX_DISTANCE_METERS + COMBINED_CONTACT_RADIUS_METERS;
}
