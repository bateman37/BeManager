import type { PlayerProfile } from "../../domain/players/player-profile";

/**
 * Duplica un perfil con un nuevo identificador y nombre. No modifica el
 * original ni reescribe medidas o capacidades: es una copia editable.
 */
export function duplicateLabPlayer(
  source: PlayerProfile,
  newId: string,
  newName: string,
): PlayerProfile {
  return {
    ...source,
    id: newId,
    name: newName,
    attributes: { ...source.attributes },
    measures: { ...source.measures },
  };
}
