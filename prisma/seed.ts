/**
 * Siembra los dos equipos y los diez jugadores de laboratorio del prompt
 * ME-01 (fixture del repositorio, sin generación aleatoria). Ejecutar con
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

const forceReset = process.env.LAB_SEED_FORCE_RESET === "1";

async function main() {
  let created = 0;
  let skipped = 0;

  for (const team of LAB_ROSTER_FIXTURE) {
    const existingTeam = await prisma.labTeam.findUnique({ where: { id: team.id } });
    if (!existingTeam) {
      await prisma.labTeam.create({ data: { id: team.id, name: team.name } });
    } else if (forceReset) {
      await prisma.labTeam.update({ where: { id: team.id }, data: { name: team.name } });
    }

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

      const existingPlayer = await prisma.labPlayer.findUnique({
        where: { teamId_id: { teamId: team.id, id: player.id } },
      });

      if (!existingPlayer) {
        await prisma.labPlayer.create({ data: { teamId: team.id, id: player.id, ...data } });
        created++;
      } else if (forceReset) {
        await prisma.labPlayer.update({
          where: { teamId_id: { teamId: team.id, id: player.id } },
          data,
        });
        created++;
      } else {
        skipped++;
      }
    }
  }

  console.log(
    forceReset
      ? `Restablecimiento deliberado: ${created} jugadores escritos desde el fixture.`
      : `Sembrado no destructivo: ${created} jugadores creados, ${skipped} ya existían y se conservaron tal cual (ediciones de Dennis intactas).`,
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
