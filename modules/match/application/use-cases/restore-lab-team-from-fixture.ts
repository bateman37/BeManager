import type { LabTeamRepository } from "../ports/lab-team-repository.port";
import { LAB_ROSTER_FIXTURE } from "../../domain/players/lab-roster-fixture";

export type RestoreLabTeamResult =
  | { readonly status: "restored"; readonly restoredCount: number; readonly playerIds: readonly string[] }
  | { readonly status: "error"; readonly message: string };

/**
 * Restablece los doce perfiles del fixture versionado de un equipo (ME-06
 * §4): única fuente `LAB_ROSTER_FIXTURE`, nunca un segundo JSON ni valores
 * inferidos del último partido. Operación atómica por equipo: si falla,
 * no queda ningún jugador del equipo a medio restablecer. Los perfiles
 * añadidos a mano que no pertenezcan al fixture (IDs distintos) quedan
 * intactos, porque solo se sobrescriben los IDs del propio fixture.
 */
export async function restoreLabTeamFromFixture(
  repository: LabTeamRepository,
  teamId: string,
): Promise<RestoreLabTeamResult> {
  const fixtureTeam = LAB_ROSTER_FIXTURE.find((t) => t.id === teamId);
  if (!fixtureTeam) {
    return { status: "error", message: `El equipo "${teamId}" no tiene un fixture de laboratorio versionado.` };
  }
  try {
    await repository.savePlayers(teamId, fixtureTeam.players);
    return {
      status: "restored",
      restoredCount: fixtureTeam.players.length,
      playerIds: fixtureTeam.players.map((p) => p.id),
    };
  } catch {
    return {
      status: "error",
      message: "No se pudo restablecer el equipo. Comprueba que PostgreSQL esté disponible e inténtalo de nuevo.",
    };
  }
}
