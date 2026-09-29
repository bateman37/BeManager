import { playTramo } from "../../domain/sequence/play-tramo";
import { buildTramoInput, type BuildTramoTeamArgs, type TramoResult } from "../../domain/sequence/tramo-model";
import type { DefensiveCoverage } from "../../domain/lab/match-input";

export type PlayLabTramoResult =
  | { readonly status: "played"; readonly result: TramoResult }
  | { readonly status: "error"; readonly message: string };

/**
 * Juega un tramo de hasta cuatro posesiones enlazadas (ME-03) con un
 * snapshot de los perfiles que la interfaz muestra en ese momento. No lee
 * ni escribe la base de datos: un tramo ya generado no cambia si después se
 * edita un jugador, y los perfiles guardados no se tocan para obtenerlo.
 */
export async function playLabTramo(args: {
  readonly seed: number;
  readonly coverage: DefensiveCoverage;
  readonly offenseTeam: BuildTramoTeamArgs;
  readonly defenseTeam: BuildTramoTeamArgs;
}): Promise<PlayLabTramoResult> {
  try {
    return { status: "played", result: playTramo(buildTramoInput(args)) };
  } catch (error) {
    // Los errores de dominio (quinteto incompleto) ya vienen en español y
    // no contienen datos de infraestructura.
    const message = error instanceof Error ? error.message : "Error desconocido al jugar el tramo.";
    return { status: "error", message: `No se pudo jugar el tramo: ${message}` };
  }
}
