import type { Point2D } from "./point";
import { ATTACKED_HOOP, COURT_LENGTH_METERS, COURT_WIDTH_METERS } from "./court";
import { BODY_CONTACT_RADIUS_METERS } from "../lab/lab-0-2-parameters";

/**
 * Marco de ataque (ME-03, ADR-0006). La cancha que ve el usuario es
 * **global** y única: origen en la esquina inferior izquierda, 28 × 15 m.
 * El núcleo de posesión (`possession-core.ts`) calcula en un marco
 * **local** canónico en el que el equipo atacante siempre ataca hacia x
 * creciente, al aro `ATTACKED_HOOP`. Para el equipo que ataca el aro
 * izquierdo, el marco local es la cancha girada 180°: `(x, y) → (28 − x,
 * 15 − y)`. El giro es su propia inversa, conserva distancias y
 * orientación (no refleja la mano de nadie) y solo se aplica dentro del
 * cálculo: toda posición que sale del núcleo se devuelve a coordenadas
 * globales antes de guardarse en el historial o mostrarse.
 */
export type AttackDirection = "hacia_x_creciente" | "hacia_x_decreciente";

export function toLocal(direction: AttackDirection, global: Point2D): Point2D {
  if (direction === "hacia_x_creciente") return global;
  return { x: COURT_LENGTH_METERS - global.x, y: COURT_WIDTH_METERS - global.y };
}

export function toGlobal(direction: AttackDirection, local: Point2D): Point2D {
  // El giro de 180° es una involución: la misma operación deshace el cambio.
  return toLocal(direction, local);
}

/** Línea central (FIBA: pertenece a la pista trasera). */
export const MIDCOURT_LINE_X = COURT_LENGTH_METERS / 2;

/** Aro atacado por un equipo, en coordenadas globales. */
export function attackedHoopGlobal(direction: AttackDirection): Point2D {
  return toGlobal(direction, ATTACKED_HOOP);
}

/** Pista delantera en el marco local del equipo atacante (x > línea central). */
export function isFrontcourtLocal(local: Point2D): boolean {
  return local.x > MIDCOURT_LINE_X;
}

/**
 * Punto del espacio de saque: fuera de la línea, a un radio corporal
 * (LAB-0.2, 0,35 m) para que el cuerpo del sacador quede completamente
 * fuera de la cancha sin inventar una distancia nueva.
 */
const OUTSIDE_OFFSET = BODY_CONTACT_RADIUS_METERS;

/** FIBA: tablero de 1,80 m centrado; no se saca "directamente detrás del tablero". */
const BACKBOARD_HALF_WIDTH_METERS = 0.9;

function clampY(y: number): number {
  return Math.min(COURT_WIDTH_METERS, Math.max(0, y));
}

function clampX(x: number): number {
  return Math.min(COURT_LENGTH_METERS, Math.max(0, x));
}

/**
 * Saque tras canasta o último libre anotado (ME-03 §3): desde detrás de la
 * línea de fondo del aro donde se anotó, en el punto de esa línea más
 * cercano al sacador (FIBA art. 17: cualquier lugar detrás de la línea de
 * fondo).
 */
export function endLineThrowInSpot(scoredHoopGlobal: Point2D, throwerGlobal: Point2D): Point2D {
  const x = scoredHoopGlobal.x > MIDCOURT_LINE_X ? COURT_LENGTH_METERS + OUTSIDE_OFFSET : -OUTSIDE_OFFSET;
  return { x, y: clampY(throwerGlobal.y) };
}

function avoidBehindBackboard(y: number): number {
  const center = COURT_WIDTH_METERS / 2;
  if (Math.abs(y - center) < BACKBOARD_HALF_WIDTH_METERS) {
    return y < center ? center - BACKBOARD_HALF_WIDTH_METERS : center + BACKBOARD_HALF_WIDTH_METERS;
  }
  return y;
}

/**
 * Saque tras balón fuera (FIBA art. 17): lugar más cercano a donde salió,
 * salvo directamente detrás del tablero. `exitGlobal` es el punto (fuera
 * de la cancha) donde cayó el balón.
 */
export function outOfBoundsThrowInSpot(exitGlobal: Point2D): Point2D {
  const overEnd = Math.max(exitGlobal.x - COURT_LENGTH_METERS, -exitGlobal.x, 0);
  const overSide = Math.max(exitGlobal.y - COURT_WIDTH_METERS, -exitGlobal.y, 0);
  if (overEnd >= overSide) {
    const x = exitGlobal.x > MIDCOURT_LINE_X ? COURT_LENGTH_METERS + OUTSIDE_OFFSET : -OUTSIDE_OFFSET;
    return { x, y: avoidBehindBackboard(clampY(exitGlobal.y)) };
  }
  const y = exitGlobal.y > COURT_WIDTH_METERS / 2 ? COURT_WIDTH_METERS + OUTSIDE_OFFSET : -OUTSIDE_OFFSET;
  return { x: clampX(exitGlobal.x), y };
}

/**
 * Saque tras una violación con el balón dentro de la cancha (reloj de
 * lanzamiento, 8 s, 5 s): simplificación declarada en `RULES.md`, se toma
 * en la banda lateral más próxima a la posición del balón, a la misma
 * altura de la cancha (nunca detrás del tablero).
 */
export function sidelineThrowInSpot(ballGlobal: Point2D): Point2D {
  const y = ballGlobal.y > COURT_WIDTH_METERS / 2 ? COURT_WIDTH_METERS + OUTSIDE_OFFSET : -OUTSIDE_OFFSET;
  return { x: clampX(ballGlobal.x), y };
}
