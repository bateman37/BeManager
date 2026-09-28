import type { PlayerProfile } from "../players/player-profile";
import type { ScenarioId } from "./scenario";
import { LAB_PARAMETERS_VERSION } from "./lab-0-1-parameters";

/**
 * Entrada compartida por el motor detallado y el motor rápido (estudio de
 * referencia §13.2): una copia estable de perfiles y versiones. Modificar un
 * jugador en otra pantalla no altera una corrida ya iniciada, porque cada
 * corrida conserva su propio snapshot de perfiles (prompt §2).
 */
export interface MatchInput {
  readonly scenarioId: ScenarioId;
  readonly seed: number;
  readonly rulesetVersion: "FIBA-2026";
  readonly labParametersVersion: typeof LAB_PARAMETERS_VERSION;
  /** Snapshot de los diez perfiles usados por esta corrida concreta. */
  readonly offensePlayers: readonly PlayerProfile[];
  readonly defensePlayers: readonly PlayerProfile[];
}

export function findPlayerInInput(input: MatchInput, playerId: string): PlayerProfile {
  const found = [...input.offensePlayers, ...input.defensePlayers].find(
    (p) => p.id === playerId,
  );
  if (!found) throw new Error(`Jugador no encontrado en MatchInput: ${playerId}`);
  return found;
}
