/**
 * LAB-0.10 (ME-07B v2 §4, «Libro por fase: Delay→DHO/corte y entrada a poste
 * con salidas»): geometría de la colocación **Delay**. Son puntos de la
 * disposición en el marco local del equipo que ataca (aro atacado en
 * (26,425; 7,5), ataque hacia x creciente; `geometry/court.ts`), no
 * coeficientes de acierto: toda llegada sigue saliendo de distancia,
 * velocidad (F01/F04), latencias (M01/M05/M09), retraso de pantalla
 * (T13/F05/T16, peso) y alcance (C03).
 *
 * Delay: en lugar de iniciar un bloqueo directo, el ataque **retrasa** la
 * acción con un interior arriba (`DELAY_HUB_SPOT`, por encima del arco: su
 * defensor sale de la pintura). El manejador, en el ala derecha, entra el
 * balón al pívot de arriba y sigue su pase a recibir una **entrega en mano
 * (DHO)**; el otro interior está **en el poste bajo** del mismo lado
 * (`DELAY_POST_SPOT`), con la esquina fuerte (O2) y el ala débil (O3)
 * ocupadas. Frente al 4-out/1-in de la central y a Horns cambian el inicio
 * (pase de entrada y entrega, no pantalla), quién decide (el pívot de arriba
 * conserva o entrega; el poste lee su salida) y quién ayuda (el defensor de
 * la esquina fuerte «dig» sobre el poste; el defensor del pívot puede saltar
 * a la entrega y dejar su pintura).
 *
 * - Unidad: metros. Caso neutro: ninguna colocación anterior cambia; nada de
 *   este archivo toca la central, la lateral ni Horns.
 * - Intervalo: el pívot de arriba y el punto de entrega quedan detrás del
 *   arco (el triple tras la entrega es legal); el poste queda en zona de
 *   floater (2,0; 4,5] m del aro, fuera de la zona restringida; la esquina
 *   fuerte detrás del arco.
 * - Sensibilidad: `lab-0-10-parameters.test.ts` comprueba esas zonas, que
 *   cada defensor está entre su marca y el aro y que el defensor del pívot
 *   llega antes al punto de entrega que el manejador si sale a saltarla
 *   (concesión: deja la pintura), mientras que el del manejador no.
 * - No duplicación: la entrega reutiliza la primitiva de pantalla corporal
 *   (retraso T13/F05/T16 y peso) del mano a mano; las lecturas reutilizan
 *   cierre, finalización, tiro parado y pase con desvío; aquí solo hay la
 *   disposición y los puntos de poste, esquina y corte.
 */
import type { Point2D } from "../geometry/point";

export const LAB_0_10_PARAMETERS_VERSION = "LAB-0.10";

/** Pívot de arriba en Delay: por encima del arco, en el eje. */
export const DELAY_HUB_SPOT: Point2D = { x: 19.2, y: 7.5 };

/** Poste bajo del lado del balón (el otro interior). */
export const DELAY_POST_SPOT: Point2D = { x: 24.8, y: 10.1 };

/** Esquina fuerte (O2), adonde sale el pase si su defensor ayuda al poste. */
export const DELAY_STRONG_CORNER_SPOT: Point2D = { x: 24.0, y: 13.9 };

/** Corte del ala débil (O3) hacia el aro por detrás de su defensor cuando el balón está en el poste. */
export const DELAY_WEAK_CUT_SPOT: Point2D = { x: 25.4, y: 6.6 };

/**
 * Disposición Delay por rol canónico: O1 manejador en el ala derecha con el
 * balón, O5 pívot de arriba, O4 poste bajo del lado del balón, O2 esquina
 * fuerte, O3 ala débil. Cada defensor entre su marca y el aro: D5 hundido
 * 1,6 m hacia el aro (protege la pintura frente a un pívot lejos del aro),
 * D4 a contacto por detrás del poste, D3 hundido en el lado de ayuda.
 */
export const DELAY_TARGETS: Readonly<Record<string, Point2D>> = {
  O1: { x: 20.2, y: 12.4 },
  O2: DELAY_STRONG_CORNER_SPOT,
  O3: { x: 20.2, y: 2.6 },
  O4: DELAY_POST_SPOT,
  O5: DELAY_HUB_SPOT,
  D1: { x: 20.99, y: 11.78 },
  D2: { x: 24.35, y: 12.96 },
  D3: { x: 21.14, y: 3.34 },
  D4: { x: 25.17, y: 9.51 },
  D5: { x: 20.8, y: 7.5 },
};
