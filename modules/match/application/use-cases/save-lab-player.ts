import type { LabTeamRepository } from "../ports/lab-team-repository.port";
import type { PlayerProfile } from "../../domain/players/player-profile";
import { checkPlayerCoherence, type CoherenceWarning } from "../../domain/players/player-validation";

export type SaveLabPlayerResult =
  | { readonly status: "saved"; readonly warnings: readonly CoherenceWarning[] }
  | { readonly status: "error"; readonly message: string };

/**
 * Guarda un jugador de laboratorio (creación, edición o duplicado ya
 * resuelto por el llamador). Los avisos de coherencia informan sin
 * bloquear el guardado (prompt §2). Un fallo de base de datos devuelve un
 * error controlado y genérico, sin filtrar detalles de conexión.
 */
export async function saveLabPlayer(
  repository: LabTeamRepository,
  teamId: string,
  player: PlayerProfile,
): Promise<SaveLabPlayerResult> {
  const warnings = checkPlayerCoherence(player);

  try {
    await repository.savePlayer(teamId, player);
    return { status: "saved", warnings };
  } catch {
    return {
      status: "error",
      message: "No se pudo guardar el jugador. Comprueba que PostgreSQL esté disponible e inténtalo de nuevo.",
    };
  }
}
