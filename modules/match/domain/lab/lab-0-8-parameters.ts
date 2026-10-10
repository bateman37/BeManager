/**
 * LAB-0.8 (ME-07B v2 §4, «Libro por fase: Horns→bloqueo»): geometría de la
 * colocación **Horns** (cuernos). Son puntos de la disposición en el marco
 * local del equipo que ataca (aro atacado en (26,425; 7,5), ataque hacia x
 * creciente; `geometry/court.ts`), no coeficientes de acierto: toda llegada
 * sigue saliendo de distancia, velocidad (F01/F04), latencias (M01/M05/M09)
 * y alcance (C03).
 *
 * Horns: manejador arriba, **los dos interiores en los codos** (uno sube a
 * bloquear y el otro se queda en el codo contrario) y **las dos esquinas
 * ocupadas**; el ala débil queda vacía. Frente al 4-out/1-in de la central
 * cambian el espacio y la responsabilidad, no el bloqueo en sí:
 *
 * - El bloqueador y el manejador ocupan los mismos puntos que en la central
 *   (misma pantalla, misma distancia 2,46 m, mismo short roll), así que la
 *   pantalla, su retraso y la continuación no cambian por nombre.
 * - El segundo interior (`HORNS_SECOND_HORN_SPOT`) está en el codo
 *   contrario, en la zona de tiro medio (LAB-0.5), y su defensor está entre
 *   él y el aro: es la ayuda más cercana al roll (≈2,0 m del short roll,
 *   frente a ≈3,8 m del defensor de la esquina débil en la central). Si
 *   ayuda, deja libre un tiro medio en el codo (T03), no un triple de
 *   esquina (T04).
 * - La reparación sale del defensor de la esquina débil, que ya no es un
 *   ala: tiene más camino hasta el codo y deja la esquina.
 *
 * - Unidad: metros. Caso neutro: la colocación `central` no cambia
 *   (`SCENARIOS.drop_con_ayuda`); nada de este archivo la toca.
 * - Intervalo: el codo es la esquina de la línea de libres (x = 22,2; y =
 *   7,5 ± 2,45); el segundo cuerno se sitúa 0,2 m por encima, a 5,1 m del
 *   aro (zona de tiro medio (4,5; 6,75]); la pantalla queda dentro de la
 *   franja de la zona (no es lateral: ICE no elegible).
 * - Sensibilidad: `lab-0-8-parameters.test.ts` comprueba la zona del codo,
 *   que el defensor del segundo cuerno llega antes al short roll que el de
 *   la esquina débil central, que el punto de uso sigue detrás del arco y
 *   que la pantalla no es lateral.
 * - No duplicación: no se crea un bloqueo nuevo; se reutiliza el mismo
 *   árbol de coberturas (drop, under, show, a la altura, cambio, trampa)
 *   con otra disposición y otro responsable de la ayuda.
 */
import type { Point2D } from "../geometry/point";

export const LAB_0_8_PARAMETERS_VERSION = "LAB-0.8";

/** Punto del segundo cuerno (codo contrario al bloqueo), donde lo deja libre su defensor si ayuda. */
export const HORNS_SECOND_HORN_SPOT: Point2D = { x: 22.0, y: 5.0 };

/** Punto donde espera el jugador que deja libre la ayuda en las colocaciones 4-out/1-in (esquina débil). */
export const WEAK_CORNER_HELP_LEFT_SPOT: Point2D = { x: 24.0, y: 13.9 };

/**
 * Disposición Horns, por rol canónico del árbol del bloqueo: O1 manejador,
 * O5 cuerno que bloquea, **O3 segundo cuerno** (el jugador que deja la
 * ayuda), O2 esquina fuerte, **O4 esquina débil** (el que deja la
 * reparación). Los defensores siguen a su marca: D3 entre el segundo cuerno
 * y el aro, D4 hundido en la esquina débil.
 */
export const HORNS_PNR_TARGETS: Readonly<Record<string, Point2D>> = {
  O1: { x: 18.0, y: 7.5 },
  O2: { x: 24.0, y: 1.1 },
  O3: HORNS_SECOND_HORN_SPOT,
  O4: WEAK_CORNER_HELP_LEFT_SPOT,
  O5: { x: 20.2, y: 8.6 },
  D1: { x: 19.1, y: 7.5 },
  D2: { x: 23.4, y: 1.5 },
  // 1 m del segundo cuerno hacia el aro.
  D3: { x: 22.85, y: 5.5 },
  D4: { x: 23.4, y: 11.3 },
  D5: { x: 22.3, y: 7.7 },
};
