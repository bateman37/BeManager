import type { PlayerProfile } from "../../domain/players/player-profile";

export interface LabTeamRecord {
  readonly id: string;
  readonly name: string;
  readonly players: readonly PlayerProfile[];
}

export interface LabTeamSummary {
  readonly id: string;
  readonly name: string;
  readonly playerCount: number;
}

/**
 * Puerto de persistencia de equipos y jugadores de laboratorio. La
 * implementación real (Prisma) vive en infraestructura; aquí solo se
 * declara el contrato (prompt §7, límites de dependencia de Foundation).
 */
export interface LabTeamRepository {
  listTeams(): Promise<LabTeamSummary[]>;
  getTeam(teamId: string): Promise<LabTeamRecord | null>;
  /** Crea o actualiza (upsert) un jugador dentro de un equipo existente. */
  savePlayer(teamId: string, player: PlayerProfile): Promise<void>;
}
