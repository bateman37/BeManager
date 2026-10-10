/**
 * LAB-0.4 (ME-07B v2 §2): hipótesis locales de laboratorio introducidas al
 * reparar el flujo causal del rebote. Misma convención que LAB-0.1/0.2/0.3:
 * datos tipados con unidad, intervalo, caso neutro y prueba de sensibilidad
 * (`lab-0-4-parameters.test.ts`), nunca porcentajes de liga ni ajustes
 * universales de acierto, ritmo o rebote.
 */
import { jumpCeilingMeters } from "./lab-0-1-parameters";
import type { Rating } from "../players/attribute";

export const LAB_0_4_PARAMETERS_VERSION = "LAB-0.4";

/** Aceleración de la gravedad, m/s² (constante física, no parámetro ajustable). */
export const GRAVITY_MPS2 = 9.81;

/**
 * Tiempo de caída del tirador tras soltar el balón, en segundos.
 *
 * Hipótesis: el motor ya suelta el tiro con el salto ejecutado completo
 * (`shotReleaseHeightMeters(..., jumpCeilingMeters(F06))`), es decir, en el
 * vértice del salto; desde ahí el tirador cae libremente `h = jumpCeiling(F06)`
 * y no puede correr hacia el rebote hasta tocar el suelo: `√(2h/g)`.
 *
 * - Unidad: s. Intervalo para F06 ∈ [1, 15] (h ∈ [0,27; 0,55] m): [0,235; 0,335] s.
 * - Caso neutro F06 = 8 (h = 0,41 m): ≈ 0,289 s.
 * - No duplicación: F06 ya decide altura de liberación y alcance de tapón;
 *   aquí solo retrasa la salida del propio tirador hacia un balón que cae,
 *   no modifica captura (T20), cierre (T19/F05) ni acierto del tiro.
 * - Sin ella, un tirador que falla una bandeja «llega» al rebote desde el
 *   aro en el mismo instante del fallo, como si no hubiera saltado.
 */
export function shooterLandingSeconds(f06: Rating): number {
  return Math.sqrt((2 * jumpCeilingMeters(f06)) / GRAVITY_MPS2);
}

/**
 * Peso previo de la proyección frente a lo observado en el propio partido,
 * en «usos equivalentes» (ME-07B v2 §2.3 y §5: el rival automático aprende
 * de muestras visibles, nunca de datos ocultos ni de la tirada futura).
 *
 * Valor efectivo de una opción ya usada `n` veces con `p` puntos concedidos
 * (defensa) o anotados (ataque) en esas posesiones desde la decisión:
 * `(p + K · proyección) / (n + K)`.
 *
 * - Unidad: usos (posesiones con esa decisión). Intervalo razonable [2, 20].
 * - Caso neutro: sin muestras (`n = 0`) el valor es la proyección pura.
 * - Sensibilidad: `K → ∞` reproduce el comportamiento sin aprendizaje;
 *   `K` pequeño reacciona más a rachas (probado en `lab-0-4-parameters.test.ts`).
 * - No duplicación: la proyección solo valora la primera acción; lo
 *   observado incluye además rebotes, faltas y segundas acciones que esa
 *   proyección no contiene. No toca ningún acierto ni ritmo.
 */
export const OBSERVATION_PRIOR_WEIGHT_USES = 6;

export interface ObservedOutcome {
  readonly uses: number;
  readonly points: number;
}

export function blendProjectionWithObservation(
  projection: number,
  observed: ObservedOutcome | undefined,
  priorWeight: number = OBSERVATION_PRIOR_WEIGHT_USES,
): number {
  if (!observed || observed.uses <= 0) return projection;
  return (observed.points + priorWeight * projection) / (observed.uses + priorWeight);
}

/**
 * Tendencia observada de la defensa rival ante el bloqueo directo (ME-07B v2
 * §2.2 y §5: «auto pondera lo observable y realizable, sin conocer la tirada
 * futura»). El ataque no sabe qué cobertura le espera en la próxima pantalla;
 * sí ha visto cuántas veces el rival ha usado cada una en este partido. Peso
 * de cada cobertura: `(usos_c + K · [c = plan base]) / (Σ usos + K)`, con el
 * mismo `K` de `blendProjectionWithObservation` (usos equivalentes) y el
 * plan base de la defensa (drop) como previa.
 *
 * - Unidad: probabilidad [0, 1] por cobertura; suman 1.
 * - Caso neutro: sin muestras, todo el peso es del plan base (la proyección
 *   anterior, solo contra drop).
 * - Sensibilidad: `K → ∞` reproduce la proyección solo contra el plan base;
 *   con muchos usos de una cobertura, su peso tiende a su frecuencia
 *   (`lab-0-4-parameters.test.ts`).
 * - No duplicación: solo pondera concesiones ya proyectadas con la geometría
 *   real de cada cobertura; no cambia ninguna llegada, acierto ni sorteo, ni
 *   usa ratings ni la orden interna del rival.
 */
export function shownCoverageWeights<C extends string>(
  shown: Readonly<Partial<Record<C, ObservedOutcome>>> | undefined,
  base: C,
  priorWeight: number = OBSERVATION_PRIOR_WEIGHT_USES,
): Partial<Record<C, number>> {
  const raw: Partial<Record<C, number>> = { [base]: priorWeight } as Partial<Record<C, number>>;
  let total = priorWeight;
  for (const [c, o] of Object.entries(shown ?? {}) as [C, ObservedOutcome | undefined][]) {
    if (!o || o.uses <= 0) continue;
    raw[c] = (raw[c] ?? 0) + o.uses;
    total += o.uses;
  }
  const out: Partial<Record<C, number>> = {};
  for (const [c, v] of Object.entries(raw) as [C, number][]) out[c] = v / total;
  return out;
}
