import { playFullGame } from "../../domain/game/play-full-game";
import { buildGameInput, type BuildGameTeamArgs, type GameResult } from "../../domain/game/game-model";
import { reconcileBoxScore, type ReconciliationCheck } from "../../domain/game/box-score";
import type { Point2D } from "../../domain/geometry/point";

/**
 * Vista de un partido ya resuelto para la interfaz de laboratorio: los
 * mismos hechos, acta y registros del dominio, con las posiciones
 * redondeadas al centímetro solo para el transporte (la foto de cancha no
 * necesita más) y con las comprobaciones de conciliación calculadas sobre
 * el resultado exacto antes de redondear. `responsibilities` viaja aunque el
 * visor del partido no la muestre: la exportación de auditoría (ME-04A) la
 * necesita para `continuity` y solo dispone del resultado ya enviado al
 * navegador, sin volver a jugar el partido.
 */
export type LabGameView = GameResult & {
  readonly reconciliation: readonly ReconciliationCheck[];
};

export type PlayLabGameResult =
  | { readonly status: "played"; readonly game: LabGameView }
  | { readonly status: "error"; readonly message: string };

function round(p: Point2D): Point2D {
  return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 };
}

export function toLabGameView(result: GameResult): LabGameView {
  const reconciliation = reconcileBoxScore({
    box: result.box,
    finalScore: result.finalScore,
    effectivePlayedMs: result.effectivePlayedMs,
    engineMinutesMs: result.engineMinutesMs,
    teamIds: result.input.teams.map((t) => t.id),
  });
  return {
    ...result,
    events: result.events.map((e) => ({
      ...e,
      positions: e.positions.map((p) => ({ playerId: p.playerId, position: round(p.position) })),
      ball: { ...e.ball, position: round(e.ball.position) },
    })),
    reconciliation,
  };
}

/**
 * Juega un partido completo de laboratorio (ME-04) con una única foto de
 * los perfiles que muestra la interfaz. No lee ni escribe la base de
 * datos: el partido resuelto no cambia si después se edita un jugador, y
 * no se guarda historial de partidos (ME-09).
 */
export async function playLabGame(args: {
  readonly seed: number;
  readonly home: BuildGameTeamArgs;
  readonly away: BuildGameTeamArgs;
  /** Registrar auditoría (ME-04A): activado por defecto en el laboratorio. */
  readonly auditEnabled?: boolean;
}): Promise<PlayLabGameResult> {
  try {
    return { status: "played", game: toLabGameView(playFullGame(buildGameInput(args))) };
  } catch (error) {
    // Los errores de dominio (quinteto incompleto, plantilla > 12) ya vienen
    // en español y no contienen datos de infraestructura.
    const message = error instanceof Error ? error.message : "Error desconocido al jugar el partido.";
    return { status: "error", message: `No se pudo jugar el partido: ${message}` };
  }
}
