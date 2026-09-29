/**
 * Geometría 2D en metros. Dominio puro: sin dependencias de React, Next.js
 * ni Prisma. Ver docs/match/reference/BeManager-del-estudio-al-motor-de-partidos-v1.md §4.2.
 */

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function subtract(a: Point2D, b: Point2D): Point2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: Point2D, b: Point2D): Point2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(a: Point2D, factor: number): Point2D {
  return { x: a.x * factor, y: a.y * factor };
}

/** Vector unitario de `from` hacia `to`. Devuelve {0,0} si coinciden. */
export function direction(from: Point2D, to: Point2D): Point2D {
  const d = distance(from, to);
  if (d === 0) return { x: 0, y: 0 };
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
}

/**
 * Avanza desde `from` hacia `to` a velocidad `speedMetersPerSecond` durante
 * `elapsedSeconds`, sin sobrepasar el objetivo (no teletransporta).
 */
export function moveToward(
  from: Point2D,
  to: Point2D,
  speedMetersPerSecond: number,
  elapsedSeconds: number,
): Point2D {
  const remaining = distance(from, to);
  const travel = speedMetersPerSecond * elapsedSeconds;
  if (travel >= remaining || remaining === 0) return to;
  const dir = direction(from, to);
  return add(from, scale(dir, travel));
}

/** Tiempo de llegada en segundos, o Infinity si la velocidad es 0 y no ha llegado. */
export function timeToReach(
  from: Point2D,
  to: Point2D,
  speedMetersPerSecond: number,
): number {
  const d = distance(from, to);
  if (d === 0) return 0;
  if (speedMetersPerSecond <= 0) return Infinity;
  return d / speedMetersPerSecond;
}

/**
 * Punto sobre el segmento `from`→`to`, a `standoffMeters` de distancia antes
 * de llegar a `to` (ME-04B §3.1): dos jugadores no ocupan el mismo punto, así
 * que "usar la pantalla" es llegar junto al bloqueador, no sobre su posición
 * exacta. Si el segmento ya es más corto que el margen, devuelve `from`.
 */
export function pointShortOfTarget(from: Point2D, to: Point2D, standoffMeters: number): Point2D {
  const total = distance(from, to);
  if (total <= standoffMeters) return from;
  const t = (total - standoffMeters) / total;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}
