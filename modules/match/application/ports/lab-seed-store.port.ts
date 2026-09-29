import type { PlayerProfile } from "../../domain/players/player-profile";

/**
 * Puerto mínimo que necesita la siembra del laboratorio (ME-02 §3, ME-04
 * §4): saber si existe un equipo/jugador, crearlo o, solo en el
 * restablecimiento deliberado, sobrescribirlo. La implementación Prisma
 * vive en `prisma/seed.ts`; las pruebas usan una versión en memoria.
 */
export interface LabSeedStore {
  teamExists(teamId: string): Promise<boolean>;
  createTeam(teamId: string, name: string): Promise<void>;
  renameTeam(teamId: string, name: string): Promise<void>;
  playerExists(teamId: string, playerId: string): Promise<boolean>;
  createPlayer(teamId: string, player: PlayerProfile): Promise<void>;
  overwritePlayer(teamId: string, player: PlayerProfile): Promise<void>;
}
