/**
 * Siembra los dos equipos y los diez jugadores de laboratorio del prompt
 * ME-01 (fixture del repositorio, sin generación aleatoria). Ejecutar con
 * `npm run prisma:seed` tras aplicar las migraciones.
 */
import { prisma } from "../src/shared/infrastructure/db/prisma-client";
import { LAB_ROSTER_FIXTURE } from "../modules/match/domain/players/lab-roster-fixture";

async function main() {
  for (const team of LAB_ROSTER_FIXTURE) {
    await prisma.labTeam.upsert({
      where: { id: team.id },
      create: { id: team.id, name: team.name },
      update: { name: team.name },
    });

    for (const player of team.players) {
      const data = {
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

      await prisma.labPlayer.upsert({
        where: { teamId_id: { teamId: team.id, id: player.id } },
        create: { teamId: team.id, id: player.id, ...data },
        update: data,
      });
    }
  }

  console.log(
    `Sembrados ${LAB_ROSTER_FIXTURE.length} equipos y ${LAB_ROSTER_FIXTURE.reduce((n, t) => n + t.players.length, 0)} jugadores de laboratorio.`,
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
