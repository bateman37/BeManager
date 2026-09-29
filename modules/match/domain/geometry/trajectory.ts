import type { Point2D } from "./point";

/**
 * Trayectoria de un jugador como lista de puntos de paso ordenados en el
 * tiempo (ME-03). Un punto con `moving: true` indica que el jugador se
 * desplazó en línea recta y a velocidad constante desde el punto anterior
 * hasta él; sin esa marca, la posición cambia en ese instante (semántica
 * escalonada del historial de llegadas de HF-002). Así se puede
 * reconstruir dónde estaba cada jugador en cualquier instante, sin mostrar
 * una posición futura como ya alcanzada.
 */
export interface TrajectoryPoint {
  readonly atMs: number;
  readonly position: Point2D;
  readonly moving?: boolean;
}

export function positionOnTrajectory(points: readonly TrajectoryPoint[], atMs: number): Point2D {
  if (points.length === 0) throw new Error("Trayectoria vacía");
  let index = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.atMs <= atMs) index = i;
    else break;
  }
  if (index < 0) return points[0]!.position;
  const current = points[index]!;
  const next = points[index + 1];
  if (next && next.moving && next.atMs > current.atMs && atMs > current.atMs) {
    const fraction = Math.min(1, (atMs - current.atMs) / (next.atMs - current.atMs));
    return {
      x: current.position.x + (next.position.x - current.position.x) * fraction,
      y: current.position.y + (next.position.y - current.position.y) * fraction,
    };
  }
  return current.position;
}

/**
 * Recorta la trayectoria en `atMs`: elimina los puntos posteriores y, si
 * el jugador estaba en pleno desplazamiento, deja un punto de paso con su
 * posición real en ese instante. Se usa al cambiar de objetivo: la nueva
 * orden parte de donde el jugador está de verdad, sin teletransporte.
 */
export function truncateTrajectory(points: readonly TrajectoryPoint[], atMs: number): TrajectoryPoint[] {
  if (points.length === 0) return [];
  const position = positionOnTrajectory(points, atMs);
  const kept = points.filter((p) => p.atMs <= atMs);
  const last = kept[kept.length - 1];
  if (!last || last.atMs < atMs) {
    // Punto de paso en el instante exacto del cambio: si iba en marcha, es
    // un punto de su recorrido (sigue siendo lineal desde el anterior).
    const next = points[kept.length];
    kept.push({ atMs, position, moving: next?.moving === true });
  }
  return kept;
}
