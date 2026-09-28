/**
 * Tiempo interno de simulación en milisegundos enteros (§5.1–5.2 del
 * estudio de referencia). El motor detallado no usa `Date.now()`: todo
 * reloj es lógico y reproducible.
 */
export type Milliseconds = number;

/** Paso espacial máximo del motor detallado, en ms (hipótesis LAB-0.1, §5.2). */
export const MAX_SIMULATION_STEP_MS: Milliseconds = 100;

export interface RegulationClocks {
  /** Reloj de partido restante, en ms. Empieza en 7:12 = 432000 ms. */
  readonly gameClockMs: Milliseconds;
  /** Reloj de lanzamiento restante, en ms. Empieza en 18000 ms. */
  readonly shotClockMs: Milliseconds;
}

export function secondsToMs(seconds: number): Milliseconds {
  return Math.round(seconds * 1000);
}

export function msToSeconds(ms: Milliseconds): number {
  return ms / 1000;
}

/** Recorta el siguiente instante de avance al primero de: paso máximo o frontera de evento. */
export function nextBoundary(
  currentMs: Milliseconds,
  nextEventMs: Milliseconds | null,
): Milliseconds {
  const maxStep = currentMs + MAX_SIMULATION_STEP_MS;
  if (nextEventMs === null) return maxStep;
  return Math.min(maxStep, nextEventMs);
}
