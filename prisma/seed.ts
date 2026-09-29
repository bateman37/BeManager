/**
 * Siembra los dos equipos de laboratorio y sus doce jugadores (diez de
 * ME-01 + catorce suplentes de ME-04; fixture del repositorio, sin
 * generación aleatoria). La lógica vive en el caso de uso
 * `seedLabRoster` (probado sin base de datos). Ejecutar con
 * `npm run prisma:seed` tras aplicar las migraciones.
 *
 * ME-02 §3: el seed no debe sobrescribir un jugador o equipo que Dennis ya
 * haya editado y guardado. Por eso, salvo restablecimiento deliberado, solo
 * **crea** los equipos/jugadores que falten; los que ya existen se dejan
 * intactos (por ejemplo, para que reciban M09 solo cuando el usuario edite y
 * guarde ese perfil, no porque el seed lo sobrescriba). Para restablecer el
 * fixture de forma deliberada (perder ediciones manuales a propósito),
 * ejecuta con `LAB_SEED_FORCE_RESET=1 npm run prisma:seed`.
 */
import { prisma } from "../src/shared/infrastructure/db/prisma-client";
import { LAB_ROSTER_FIXTURE } from "../modules/match/domain/players/lab-roster-fixture";
import type { PlayerProfile } from "../modules/match/domain/players/player-profile";
import type { LabSeedStore } from "../modules/match/application/ports/lab-seed-store.port";
import { seedLabRoster } from "../modules/match/application/use-cases/seed-lab-roster";

const forceReset = process.env.LAB_SEED_FORCE_RESET === "1";

function toRow(player: PlayerProfile) {
  return {
    name: player.name,
    age: player.age,
    positionLabel: player.positionLabel,
    template: player.template,
    heightCm: player.measures.heightCm,
    weightKg: player.measures.weightKg,
    wingspanCm: player.measures.wingspanCm,
    standingReachCm: player.measures.standingReachCm,
    attributes: player.attributes as unknown as Record<string, number>,
    pnrTendency: player.pnrTendency,
  };
}

/** Adaptador Prisma del puerto de siembra (solo usado por este script). */
const prismaSeedStore: LabSeedStore = {
  async teamExists(teamId) {
    return (await prisma.labTeam.findUnique({ where: { id: teamId } })) !== null;
  },
  async createTeam(teamId, name) {
    await prisma.labTeam.create({ data: { id: teamId, name } });
  },
  async renameTeam(teamId, name) {
    await prisma.labTeam.update({ where: { id: teamId }, data: { name } });
  },
  async playerExists(teamId, playerId) {
    return (await prisma.labPlayer.findUnique({ where: { teamId_id: { teamId, id: playerId } } })) !== null;
  },
  async createPlayer(teamId, player) {
    await prisma.labPlayer.create({ data: { teamId, id: player.id, ...toRow(player) } });
  },
  async overwritePlayer(teamId, player) {
    await prisma.labPlayer.update({ where: { teamId_id: { teamId, id: player.id } }, data: toRow(player) });
  },
};

async function main() {
  const result = await seedLabRoster(prismaSeedStore, LAB_ROSTER_FIXTURE, forceReset);
  console.log(
    forceReset
      ? `Restablecimiento deliberado: ${result.overwritten} jugadores sobrescritos y ${result.created} creados desde el fixture.`
      : `Sembrado no destructivo: ${result.created} jugadores creados, ${result.preserved} ya existían y se conservaron tal cual (ediciones de Dennis intactas).`,
  );
}

main()
  .catch((error) => {
    console.error("Error al sembrar el laboratorio:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
