"use client";

import { COURT_LENGTH_METERS, COURT_WIDTH_METERS, ATTACKED_HOOP } from "@match/domain/geometry/court";
import type { Point2D } from "@match/domain/geometry/point";

interface CourtViewProps {
  readonly positions: Readonly<Record<string, Point2D>>;
}

const SCALE = 16; // px por metro

function toSvg(p: Point2D): { x: number; y: number } {
  // El origen del dominio está en la esquina inferior izquierda; SVG crece
  // hacia abajo, así que invertimos el eje Y para dibujar en orientación
  // natural de cancha vista desde arriba.
  return { x: p.x * SCALE, y: (COURT_WIDTH_METERS - p.y) * SCALE };
}

export function CourtView({ positions }: CourtViewProps) {
  const width = COURT_LENGTH_METERS * SCALE;
  const height = COURT_WIDTH_METERS * SCALE;
  const hoop = toSvg(ATTACKED_HOOP);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full max-w-2xl rounded-lg border border-slate-300 bg-emerald-50 dark:border-slate-700 dark:bg-emerald-950"
      role="img"
      aria-label="Cancha esquemática con las posiciones actuales de los diez jugadores"
    >
      <rect x={0} y={0} width={width} height={height} fill="none" stroke="currentColor" strokeWidth={2} />
      <circle cx={hoop.x} cy={hoop.y} r={6} fill="none" stroke="#dc2626" strokeWidth={2} />

      {Object.entries(positions).map(([playerId, position]) => {
        const point = toSvg(position);
        const isOffense = playerId.startsWith("O");
        return (
          <g key={playerId}>
            <circle
              cx={point.x}
              cy={point.y}
              r={10}
              fill={isOffense ? "#4338ca" : "#b91c1c"}
              opacity={0.85}
            />
            <text
              x={point.x}
              y={point.y + 4}
              textAnchor="middle"
              fontSize={10}
              fill="white"
              fontWeight="bold"
            >
              {playerId}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
