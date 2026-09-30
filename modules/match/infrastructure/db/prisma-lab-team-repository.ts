import { prisma } from "@/shared/infrastructure/db/prisma-client";
import type {
  LabTeamRecord,
  LabTeamRepository,
  LabTeamSummary,
} from "../../application/ports/lab-team-repository.port";
import type { PlayerProfile, PlayerTemplate, PnrTendency, ShotTendency } from "../../domain/players/player-profile";
import { ACTIVE_ATTRIBUTE_IDS, type ActiveAttributeId, type Rating } from "../../domain/players/attribute";
import { M09_BACKFILL_NEUTRAL_RATING, SHOT_TENDENCY_BACKFILL_DEFAULT } from "../../domain/players/player-profile";

function toDomainPlayer(row: {
  id: string;
  name: string;
  age: number;
  positionLabel: string;
  template: string;
  heightCm: number;
  weightKg: number;
  wingspanCm: number;
  standingReachCm: number;
  attributes: unknown;
  pnrTendency: string;
  shotTendency?: string | null;
}): PlayerProfile {
  const rawAttributes = row.attributes as Record<string, number>;
  const attributes = {} as Record<ActiveAttributeId, Rating>;
  for (const id of ACTIVE_ATTRIBUTE_IDS) {
    const value = rawAttributes[id];
    if (typeof value !== "number") {
      // M09 (Comunicación) se añadió en ME-02; un registro persistido antes
      // de esa entrega no lo tiene guardado. Se backfillea con el valor
      // neutro explícito 8 hasta que el usuario lo edite y guarde
      // (ME-02 §3), en vez de romper la carga de perfiles ya existentes.
      if (id === "M09") {
        attributes[id] = M09_BACKFILL_NEUTRAL_RATING;
        continue;
      }
      throw new Error(`Falta la capacidad ${id} en el registro persistido de ${row.id}`);
    }
    attributes[id] = value;
  }

  return {
    id: row.id,
    name: row.name,
    age: row.age,
    positionLabel: row.positionLabel,
    template: row.template as PlayerTemplate,
    measures: {
      heightCm: row.heightCm,
      weightKg: row.weightKg,
      wingspanCm: row.wingspanCm,
      standingReachCm: row.standingReachCm,
    },
    attributes,
    pnrTendency: row.pnrTendency as PnrTendency,
    // La columna tiene DEFAULT 'equilibrada' desde su migración, así que
    // esto solo cubre una fila cargada por un cliente que aún no la
    // selecciona (mismo patrón que M09_BACKFILL_NEUTRAL_RATING).
    shotTendency: (row.shotTendency ?? SHOT_TENDENCY_BACKFILL_DEFAULT) as ShotTendency,
  };
}

/**
 * Adaptador de infraestructura: implementa `LabTeamRepository` con Prisma.
 * No contiene reglas de juego; solo traduce entre el modelo de persistencia
 * y los perfiles de dominio.
 */
export class PrismaLabTeamRepository implements LabTeamRepository {
  async listTeams(): Promise<LabTeamSummary[]> {
    const teams = await prisma.labTeam.findMany({
      include: { _count: { select: { players: true } } },
    });
    return teams.map((t) => ({ id: t.id, name: t.name, playerCount: t._count.players }));
  }

  async getTeam(teamId: string): Promise<LabTeamRecord | null> {
    const team = await prisma.labTeam.findUnique({
      where: { id: teamId },
      include: { players: true },
    });
    if (!team) return null;

    return {
      id: team.id,
      name: team.name,
      players: team.players.map(toDomainPlayer),
    };
  }

  async savePlayer(teamId: string, player: PlayerProfile): Promise<void> {
    await prisma.labPlayer.upsert(toUpsertArgs(teamId, player));
  }

  async savePlayers(teamId: string, players: readonly PlayerProfile[]): Promise<void> {
    if (players.length === 0) return;
    // Transacción atómica (ME-06 §4): si cualquier upsert falla, ninguno se
    // aplica. No toca ningún jugador de `teamId` fuera de esta lista.
    await prisma.$transaction(players.map((player) => prisma.labPlayer.upsert(toUpsertArgs(teamId, player))));
  }
}

function toUpsertArgs(teamId: string, player: PlayerProfile) {
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
    shotTendency: player.shotTendency,
  };
  return {
    where: { teamId_id: { teamId, id: player.id } },
    create: { teamId, id: player.id, ...data },
    update: data,
  };
}
