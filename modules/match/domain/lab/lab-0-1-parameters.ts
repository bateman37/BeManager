import { d, type Rating } from "../players/attribute";

/**
 * Hipótesis numéricas del laboratorio, perfil LAB-0.1 (prompt §3).
 *
 * Son hipótesis provisionales de prototipo para verificar mecanismos, no
 * porcentajes de liga FIBA. Cada función documenta su fórmula, unidad y
 * origen exactos tal y como los fija el prompt ME-01, para que un cambio de
 * coeficiente sea una decisión de diseño explícita y no un ajuste oculto.
 *
 * Unidades: tiempos en segundos, distancias en metros salvo que se indique
 * cm/kg explícitamente (medidas corporales C01–C04).
 */
export const LAB_PARAMETERS_VERSION = "LAB-0.1";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// --- Movimiento y timing ---------------------------------------------------

/** Velocidad de movimiento inicial de un atacante, m/s. */
export function attackerMoveSpeedMps(f01: Rating): number {
  return 3.4 + 0.1 * d(f01);
}

/** Velocidad lateral defensiva, m/s. */
export function defenderLateralSpeedMps(f04: Rating): number {
  return 2.8 + 0.08 * d(f04);
}

/** Tiempo extra de frenada de un closeout, s. */
export function closeoutBrakingExtraSeconds(f03: Rating): number {
  return Math.max(0.06, 0.16 - 0.01 * d(f03));
}

/** Reducción del tiempo de salida sin balón de un cortador cuando hay ruta, s. */
export function cutterStartTimeReductionSeconds(t21: Rating): number {
  return 0.012 * d(t21);
}

/** Latencia de reconocer una oportunidad, s, acotada [0.10, 0.40]. */
export function recognitionLatencySeconds(m01: Rating, m05: Rating): number {
  return clamp(0.25 - 0.008 * d(m01) - 0.005 * d(m05), 0.1, 0.4);
}

/** Probabilidad de M03 de preferir la segunda opción, acotada [0.03, 0.20]. */
export function secondOptionProbability(m03: Rating): number {
  return clamp(0.1 - 0.006 * d(m03), 0.03, 0.2);
}

/** Ajuste, aplicado una vez, de la coordinación del bloqueo y su continuación, s. */
export function screenCoordinationShiftSeconds(m04: Rating): number {
  return 0.01 * d(m04);
}

/** Retraso si el perseguidor intercepta un bloqueo legal preparado, s, acotado [0.04, 0.55]. */
export function screenInterceptDelaySeconds(t13: Rating, f05: Rating, t16: Rating): number {
  return clamp(0.24 + 0.017 * d(t13) + 0.009 * d(f05) - 0.017 * d(t16), 0.04, 0.55);
}

/**
 * Ajuste por contacto corporal plausible en el bloqueo, s, acotado ±0.03 s.
 * Solo se suma si realmente hay contacto/intersección.
 */
export function screenContactAdjustmentSeconds(weightDiffKg: number): number {
  return clamp(0.001 * weightDiffKg, -0.03, 0.03);
}

// --- Presión, robo y pase ---------------------------------------------------

/** Probabilidad de perder control ante presión real y balón expuesto, acotada [0.01, 0.16]. */
export function turnoverUnderPressureProbability(t07: Rating, t15: Rating): number {
  return clamp(0.06 - 0.004 * d(t07) + 0.005 * d(t15), 0.01, 0.16);
}

/**
 * Probabilidad de que un defensor físicamente elegible toque el balón en una
 * línea de pase, acotada [0.01, 0.30]. Un toque no es necesariamente robo.
 */
export function deflectionProbability(t17: Rating, t09: Rating): number {
  return clamp(0.12 + 0.015 * d(t17) - 0.005 * d(t09), 0.01, 0.3);
}

/** Velocidad de vuelo de un pase liberado, m/s (constante LAB-0.1). */
export const PASS_FLIGHT_SPEED_MPS = 11;

/** Probabilidad de error de trayectoria de un pase, acotada [0.01, 0.14]. `pressure` es 0 o 1. */
export function passTrajectoryErrorProbability(t09: Rating, pressure: 0 | 1): number {
  return clamp(0.05 - 0.003 * d(t09) + 0.02 * pressure, 0.01, 0.14);
}

/** Probabilidad de recepción limpia (una sola resolución), acotada [0.60, 0.99]. */
export function cleanReceptionProbability(t11: Rating, pressure: 0 | 1): number {
  return clamp(0.9 + 0.006 * d(t11) - 0.06 * pressure, 0.6, 0.99);
}

/** Demora de control incómodo tras una recepción no limpia, s (constante). */
export const AWKWARD_CONTROL_DELAY_SECONDS = 0.3;

/** Desviación lateral de un error de trayectoria de pase, m (constante; el signo se siembra). */
export const PASS_TRAJECTORY_DEVIATION_METERS = 0.6;

/** Reducción de la preparación de un tiro tras bote/movimiento, s. */
export function movingShotPrepReductionSeconds(t06: Rating): number {
  return 0.012 * d(t06);
}

/** Ajuste de llegada a recepción/closeout exterior, s (puede ser negativo). */
export function perimeterArrivalAdjustmentSeconds(t22: Rating): number {
  return 0.01 * d(t22);
}

/** Ajuste de protección y recepción interior, s (puede ser negativo). */
export function interiorArrivalAdjustmentSeconds(t23: Rating): number {
  return 0.01 * d(t23);
}

// --- Duraciones de preparación (constantes LAB-0.1) -------------------------

export const SCREEN_SET_AFTER_ARRIVAL_SECONDS = 0.3;
export const PASS_RELEASE_SECONDS = 0.18;
export const CATCH_AND_SHOOT_PREP_SECONDS = 0.55;
export const MOVING_SHOT_PREP_BASE_SECONDS = 0.7;
export const CLOSE_FINISH_PREP_SECONDS = 0.4;
export const FREE_THROW_PREP_SECONDS = 2.0;

export function movingShotPrepSeconds(t06: Rating): number {
  return MOVING_SHOT_PREP_BASE_SECONDS - movingShotPrepReductionSeconds(t06);
}

// --- Geometría vertical (C01-C04, F06) --------------------------------------

/** Techo inicial del salto ejecutable, m. Usa la calificación bruta de F06, no d(F06). */
export function jumpCeilingMeters(f06: Rating): number {
  return 0.25 + 0.02 * f06;
}

/**
 * Altura de liberación de un tiro preparado, m. C01/C04 en cm se convierten a
 * metros. Nunca supera la mano alcanzable (alcance + salto ejecutado).
 */
export function shotReleaseHeightMeters(
  heightCm: number,
  standingReachCm: number,
  executedJumpMeters: number,
): number {
  const hypothesis = 0.25 * (heightCm / 100) + 0.75 * (standingReachCm / 100);
  const maxReachable = standingReachCm / 100 + executedJumpMeters;
  return Math.min(hypothesis + executedJumpMeters, maxReachable);
}

/** Ventana cómoda de recepción alta, m. */
export function receptionComfortWindowMeters(heightCm: number, standingReachCm: number): number {
  return 0.55 * (heightCm / 100) + 0.45 * (standingReachCm / 100);
}

/** Máximo de tocar un balón alto, m: alcance de pie + salto disponible. */
export function maxTouchHeightMeters(standingReachCm: number, availableJumpMeters: number): number {
  return standingReachCm / 100 + availableJumpMeters;
}

/** Probabilidad de desvío de un tapón elegible, acotada [0.02, 0.30]. */
export function blockDeflectionProbability(t18: Rating): number {
  return clamp(0.12 + 0.012 * d(t18), 0.02, 0.3);
}

// --- Tiro --------------------------------------------------------------------

export const CLOSE_FINISH_BASE_PROBABILITY = 0.6;
export const THREE_POINT_BASE_PROBABILITY = 0.34;

/** Oposición efectiva: 0 nadie llega, 0.5 cierre parcial, 1 contestación legal antes de soltar. */
export type EffectiveOpposition = 0 | 0.5 | 1;

/** Probabilidad de acierto de un lanzamiento, acotada [0.04, 0.82]. */
export function shotProbability(
  base: number,
  shotSkillRating: Rating,
  opposition: EffectiveOpposition,
): number {
  return clamp(base + 0.017 * d(shotSkillRating) - 0.18 * opposition, 0.04, 0.82);
}

/** Probabilidad de acierto de un tiro libre, sin oposición, acotada [0.40, 0.94]. */
export function freeThrowProbability(t05: Rating): number {
  return clamp(0.74 + 0.017 * d(t05), 0.4, 0.94);
}

// --- Rebote --------------------------------------------------------------------

export const REBOUND_SEED_RADIUS_CLOSE_METERS: readonly [number, number] = [0.8, 2.5];
export const REBOUND_SEED_RADIUS_THREE_METERS: readonly [number, number] = [2, 5];
export const REBOUND_FLIGHT_TIME_CLOSE_SECONDS = 0.8;
export const REBOUND_FLIGHT_TIME_THREE_SECONDS = 1.1;

/** Retraso al acceso rival de un cierre legal y próximo, s, acotado [0.02, 0.35]. */
export function closeoutReboundDelaySeconds(t19: Rating, f05: Rating): number {
  return clamp(0.16 + 0.012 * d(t19) + 0.008 * d(f05), 0.02, 0.35);
}

/** Probabilidad de captura de un rebote disputado, acotada [0.45, 0.96]. `disputa` es 0 o 1. */
export function reboundCaptureProbability(t20: Rating, disputa: 0 | 1): number {
  return clamp(0.78 + 0.015 * d(t20) - 0.12 * disputa, 0.45, 0.96);
}
