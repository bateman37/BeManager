import type { LabTeamRepository } from "../ports/lab-team-repository.port";
import { ACTIVE_ATTRIBUTE_IDS, RATING_MAX, type Rating } from "../../domain/players/attribute";
import type { PlayerProfile } from "../../domain/players/player-profile";

/** Únicos incrementos permitidos (ME-06 §4): ninguna otra magnitud. */
export const LAB_BULK_INCREMENT_AMOUNTS = [1, 3, 5] as const;
export type LabBulkIncrementAmount = (typeof LAB_BULK_INCREMENT_AMOUNTS)[number];

export type BulkIncrementLabAttributesResult =
  | {
      readonly status: "applied";
      readonly playersChanged: number;
      /** Suma de atributos que cambiaron de valor en los jugadores aplicados. */
      readonly attributesChanged: number;
      /** Atributos que ya estaban en 15 antes de aplicar (no cambiaron). */
      readonly attributesAlreadyAtMax: number;
      /** De los que cambiaron, cuántos quedaron limitados a 15 por el tope. */
      readonly attributesClampedToMax: number;
      /** Los perfiles ya persistidos, para refrescar la interfaz sin recalcular en el navegador. */
      readonly updatedPlayers: readonly PlayerProfile[];
    }
  | { readonly status: "error"; readonly message: string };

/**
 * Incremento masivo (ME-06 §4) sobre los 27 atributos activos de los
 * jugadores seleccionados de un equipo: `min(15, valor_guardado_actual +
 * incremento)`, entero por entero. Nombres, medidas, edades, roles,
 * equipos y tendencias no cambian. Validación en servidor: equipo
 * existente, todos los IDs pertenecen a ese equipo, selección no vacía,
 * incremento uno de los permitidos. Operación atómica por equipo: si
 * falla a mitad, no queda ningún jugador a medio modificar.
 */
export async function bulkIncrementLabAttributes(
  repository: LabTeamRepository,
  teamId: string,
  playerIds: readonly string[],
  amount: LabBulkIncrementAmount,
): Promise<BulkIncrementLabAttributesResult> {
  if (playerIds.length === 0) {
    return { status: "error", message: "No hay jugadores seleccionados." };
  }
  if (!LAB_BULK_INCREMENT_AMOUNTS.includes(amount)) {
    return { status: "error", message: `Incremento no permitido: ${amount}.` };
  }
  const uniqueIds = new Set(playerIds);

  let team;
  try {
    team = await repository.getTeam(teamId);
  } catch {
    return {
      status: "error",
      message: "No se pudo leer el equipo. Comprueba que PostgreSQL esté disponible e inténtalo de nuevo.",
    };
  }
  if (!team) return { status: "error", message: `El equipo "${teamId}" no existe.` };

  const targets = team.players.filter((p) => uniqueIds.has(p.id));
  if (targets.length !== uniqueIds.size) {
    const foundIds = new Set(targets.map((p) => p.id));
    const missing = [...uniqueIds].filter((id) => !foundIds.has(id));
    return {
      status: "error",
      message: `Los siguientes IDs no pertenecen al equipo "${teamId}": ${missing.join(", ")}.`,
    };
  }

  let attributesChanged = 0;
  let attributesAlreadyAtMax = 0;
  let attributesClampedToMax = 0;
  const updated: PlayerProfile[] = targets.map((player) => {
    const attributes = { ...player.attributes };
    for (const id of ACTIVE_ATTRIBUTE_IDS) {
      const current = attributes[id];
      if (current >= RATING_MAX) {
        attributesAlreadyAtMax += 1;
        continue;
      }
      const next = Math.min(RATING_MAX, current + amount) as Rating;
      if (next !== current) {
        attributesChanged += 1;
        if (next === RATING_MAX) attributesClampedToMax += 1;
        attributes[id] = next;
      }
    }
    return { ...player, attributes };
  });

  try {
    await repository.savePlayers(teamId, updated);
    return {
      status: "applied",
      playersChanged: updated.length,
      attributesChanged,
      attributesAlreadyAtMax,
      attributesClampedToMax,
      updatedPlayers: updated,
    };
  } catch {
    return {
      status: "error",
      message: "No se pudo aplicar el incremento. Comprueba que PostgreSQL esté disponible e inténtalo de nuevo.",
    };
  }
}
