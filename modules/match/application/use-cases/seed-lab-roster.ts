import type { LabSeedStore } from "../ports/lab-seed-store.port";
import type { LabTeamFixture } from "../../domain/players/lab-roster-fixture";

export interface SeedLabRosterResult {
  readonly created: number;
  readonly overwritten: number;
  readonly preserved: number;
}

/**
 * Siembra no destructiva del laboratorio (ME-02 §3, ME-04 §4): por
 * defecto solo **crea** los equipos y jugadores que falten (por ejemplo,
 * los siete suplentes nuevos de ME-04) y deja intactos los existentes con
 * sus ediciones. `forceReset` es el restablecimiento deliberado
 * (`LAB_SEED_FORCE_RESET=1`): sobrescribe los perfiles con el fixture y
 * nunca se usa en las pruebas normales ni en el plan manual.
 */
export async function seedLabRoster(
  store: LabSeedStore,
  fixture: readonly LabTeamFixture[],
  forceReset: boolean,
): Promise<SeedLabRosterResult> {
  let created = 0;
  let overwritten = 0;
  let preserved = 0;
  for (const team of fixture) {
    if (!(await store.teamExists(team.id))) {
      await store.createTeam(team.id, team.name);
    } else if (forceReset) {
      await store.renameTeam(team.id, team.name);
    }
    for (const player of team.players) {
      if (!(await store.playerExists(team.id, player.id))) {
        await store.createPlayer(team.id, player);
        created++;
      } else if (forceReset) {
        await store.overwritePlayer(team.id, player);
        overwritten++;
      } else {
        preserved++;
      }
    }
  }
  return { created, overwritten, preserved };
}
