import type { Milliseconds } from "../time/clock";

/**
 * Reglas de reloj y reanudación FIBA 2026 que el tramo de ME-03 puede
 * alcanzar (arts. 17, 28, 29 y 50 de las Official Basketball Rules 2026).
 * Funciones puras con fronteras exactas en milisegundos enteros, para que
 * cada adjudicación sea comprobable por separado. No cubren bonus, finales
 * de cuarto ni prórrogas (ME-04).
 *
 * Convención de frontera: una cuenta de N segundos se agota en el
 * milisegundo N·1000. Una acción que debe completarse "dentro" de la
 * cuenta (liberar un tiro, pasar a pista delantera, soltar un saque) es
 * legal si ocurre estrictamente antes de ese instante.
 */
export const SHOT_CLOCK_FULL_MS: Milliseconds = 24_000;
export const SHOT_CLOCK_RESET_14_MS: Milliseconds = 14_000;
export const BACKCOURT_COUNT_MS: Milliseconds = 8_000;
export const THROW_IN_COUNT_MS: Milliseconds = 5_000;

/**
 * Primer cuarto: una canasta de campo o un libre anotado no detienen por sí
 * solos el reloj de partido (solo en los dos últimos minutos del cuarto
 * período y de las prórrogas, que el tramo no alcanza).
 */
export const GAME_CLOCK_STOPS_ON_MADE_BASKET_IN_FIRST_QUARTER = false;

/** Control vivo nuevo o recuperado tras tocar aro (art. 29). */
export type LiveControlChange =
  /** El equipo que tiraba recupera el balón después de que tocara el aro. */
  | "rebote_ofensivo_tras_aro"
  /** El rival gana el control vivo (rebote defensivo, robo, balón suelto). */
  | "control_rival"
  /** El mismo equipo recupera un balón suelto que **no** tocó el aro (p. ej. tras tapón). */
  | "recuperacion_propia_sin_aro";

/** Reloj de lanzamiento tras un cambio de control en balón vivo (art. 29.2). */
export function shotClockAfterLiveControl(change: LiveControlChange, remainingMs: Milliseconds): Milliseconds {
  switch (change) {
    case "rebote_ofensivo_tras_aro":
      return SHOT_CLOCK_RESET_14_MS;
    case "control_rival":
      return SHOT_CLOCK_FULL_MS;
    case "recuperacion_propia_sin_aro":
      // Un tapón o desvío sin toque de aro no reinicia nada por sí solo.
      return remainingMs;
  }
}

export interface ThrowInClockArgs {
  /** El equipo que ya controlaba conserva el saque (p. ej. fuera tocado por el rival). */
  readonly sameTeamKeepsBall: boolean;
  /** Reloj de lanzamiento restante cuando se detuvo el juego. */
  readonly remainingMs: Milliseconds;
  /** El saque se efectúa en la pista delantera del equipo que saca. */
  readonly inThrowingTeamFrontcourt: boolean;
}

/**
 * Reloj de lanzamiento de un saque de banda o fondo (arts. 17 y 29.2): si
 * el mismo equipo conserva el saque tras un balón fuera, conserva el reloj
 * restante; si saca el rival, 24 s en su pista trasera o 14 s en la
 * delantera. Tras canasta o último libre anotado el saque es desde la
 * línea de fondo propia (pista trasera): 24 s. El reloj no arranca al
 * entregar el balón al sacador, sino con el toque legal en la cancha.
 */
export function shotClockForThrowIn(args: ThrowInClockArgs): Milliseconds {
  if (args.sameTeamKeepsBall) return args.remainingMs;
  return args.inThrowingTeamFrontcourt ? SHOT_CLOCK_RESET_14_MS : SHOT_CLOCK_FULL_MS;
}

/** El tiro se libera a tiempo si sale de las manos antes de agotarse el reloj. */
export function isReleasedBeforeShotClock(releaseMs: Milliseconds, shotClockExpiryMs: Milliseconds): boolean {
  return releaseMs < shotClockExpiryMs;
}

export interface BackcourtCountResult {
  readonly violation: boolean;
  /** Instante absoluto de la violación (solo si `violation`). */
  readonly violationAtMs: Milliseconds | null;
}

/**
 * Cuenta de 8 s (art. 28): desde que el equipo obtiene el control en su
 * pista trasera, el balón debe pasar a la delantera antes de 8 s.
 * `alreadyElapsedMs` conserva los segundos ya consumidos si el mismo equipo
 * vuelve a sacar en su pista trasera (art. 28.1.2).
 */
export function evaluateBackcourtCount(
  controlStartMs: Milliseconds,
  crossingMs: Milliseconds | null,
  alreadyElapsedMs: Milliseconds = 0,
): BackcourtCountResult {
  const expiryMs = controlStartMs + (BACKCOURT_COUNT_MS - alreadyElapsedMs);
  if (crossingMs !== null && crossingMs < expiryMs) return { violation: false, violationAtMs: null };
  return { violation: true, violationAtMs: expiryMs };
}

/**
 * Segundos de la cuenta de 8 que conserva un equipo en un nuevo saque en
 * su pista trasera (art. 28): el mismo equipo conserva lo consumido; un
 * rival empieza desde cero.
 */
export function backcourtElapsedAfterThrowIn(sameTeamKeepsBall: boolean, elapsedMs: Milliseconds): Milliseconds {
  return sameTeamKeepsBall ? elapsedMs : 0;
}

export interface ThrowInCountResult {
  readonly violation: boolean;
  readonly violationAtMs: Milliseconds | null;
}

/**
 * Cuenta de 5 s del saque (art. 17): empieza cuando el balón está a
 * disposición del sacador; debe soltarlo antes de 5 s.
 */
export function evaluateThrowInCount(disposalMs: Milliseconds, releaseMs: Milliseconds): ThrowInCountResult {
  const expiryMs = disposalMs + THROW_IN_COUNT_MS;
  if (releaseMs < expiryMs) return { violation: false, violationAtMs: null };
  return { violation: true, violationAtMs: expiryMs };
}
