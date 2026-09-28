import type { LabTeamRecord, LabTeamRepository } from "../ports/lab-team-repository.port";
import { LAB_ROSTER_FIXTURE } from "../../domain/players/lab-roster-fixture";

export type LoadLabRosterResult =
  | { readonly status: "loaded"; readonly teams: readonly LabTeamRecord[] }
  | {
      readonly status: "unavailable";
      /** Perfiles de referencia del fixture, mostrados como solo lectura. */
      readonly teams: readonly LabTeamRecord[];
      readonly reason: string;
    };

/**
 * Carga los equipos y jugadores de laboratorio. Si PostgreSQL no está
 * disponible, no inventa un guardado efímero: devuelve un estado
 * `unavailable` explícito con los perfiles de referencia del prompt para que
 * la interfaz pueda seguir mostrando algo coherente, marcado como tal.
 */
export async function loadLabRoster(repository: LabTeamRepository): Promise<LoadLabRosterResult> {
  try {
    const summaries = await repository.listTeams();
    if (summaries.length === 0) {
      return { status: "loaded", teams: [] };
    }
    const teams = await Promise.all(summaries.map((s) => repository.getTeam(s.id)));
    return { status: "loaded", teams: teams.filter((t): t is LabTeamRecord => t !== null) };
  } catch {
    return {
      status: "unavailable",
      teams: LAB_ROSTER_FIXTURE,
      reason: "No se pudo conectar con la base de datos de laboratorio.",
    };
  }
}
