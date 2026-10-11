import type { Point2D } from "./point";

/**
 * Convención espacial del fixture ME-01 (prompt §2): cancha 28 × 15 m,
 * origen en la esquina inferior de la línea de fondo izquierda, ataque
 * hacia x creciente, aro atacado centrado en (26,425; 7,5) m.
 */
export const COURT_LENGTH_METERS = 28;
export const COURT_WIDTH_METERS = 15;

export const ATTACKED_HOOP: Point2D = { x: 26.425, y: 7.5 };

/**
 * Distancia FIBA de la línea de 3 puntos al aro (arco), en metros.
 * Usada para decidir si O1 está "detrás de la línea FIBA" en el escenario.
 * Fuente: reglamento FIBA vigente citado en el estudio de referencia.
 */
export const FIBA_THREE_POINT_RADIUS_METERS = 6.75;

/**
 * Punto del tiro libre, centrado en la línea de fondo atacada. FIBA fija la
 * línea de tiro libre a 5,80 m de la cara interior del tablero; se usa solo
 * como origen geométrico para sembrar el rebote del último libre fallado
 * (HF-002 §2), no como una fórmula deportiva nueva.
 */
export const FREE_THROW_LINE_SPOT: Point2D = { x: ATTACKED_HOOP.x - 5.8, y: ATTACKED_HOOP.y };

/**
 * Semianchura de la zona restringida rectangular FIBA (4,90 m de ancho), en
 * metros. Una pantalla cuyo punto queda fuera de esa franja respecto al eje
 * del aro es lateral (ME-07B v2 §5: ICE solo tiene sentido en un bloqueo
 * lateral, para impedir el centro).
 */
export const FIBA_LANE_HALF_WIDTH_METERS = 2.45;

export function isLateralScreenSpot(position: Point2D): boolean {
  return Math.abs(position.y - ATTACKED_HOOP.y) > FIBA_LANE_HALF_WIDTH_METERS;
}

export function isBehindThreePointLine(position: Point2D): boolean {
  return distanceToHoop(position) > FIBA_THREE_POINT_RADIUS_METERS;
}

export function distanceToHoop(position: Point2D): number {
  return Math.hypot(ATTACKED_HOOP.x - position.x, ATTACKED_HOOP.y - position.y);
}

export function isInsideCourt(position: Point2D): boolean {
  return (
    position.x >= 0 &&
    position.x <= COURT_LENGTH_METERS &&
    position.y >= 0 &&
    position.y <= COURT_WIDTH_METERS
  );
}
