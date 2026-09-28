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
