import type { PlayerProfile } from "../players/player-profile";
import type { ScenarioId } from "./scenario";
import { LAB_PARAMETERS_VERSION } from "./lab-0-1-parameters";
import { LAB_0_2_PARAMETERS_VERSION } from "./lab-0-2-parameters";
import { LAB_0_3_PARAMETERS_VERSION } from "./lab-0-3-parameters";

/**
 * Cobertura defensiva ante el bloqueo directo (ME-02 §3): `drop` conserva el
 * árbol de ME-01 (D3 ayuda al continuador o no, según el escenario), y
 * `trampa` compromete a O1 con D1 y D5, pasa a D3 a low man y hace rotar a
 * D4 sobre la amenaza que deja D3, exponiendo a O4. La cobertura es un
 * parámetro de la corrida, no del escenario: la misma entrada de media
 * pista, quintetos y bloqueo central puede resolverse con cualquiera de
 * las dos.
 */
export type DefensiveCoverage = "drop" | "trampa";

/**
 * Entrada compartida por el motor detallado y el motor rápido (estudio de
 * referencia §13.2): una copia estable de perfiles y versiones. Modificar un
 * jugador en otra pantalla no altera una corrida ya iniciada, porque cada
 * corrida conserva su propio snapshot de perfiles (prompt §2).
 */
export interface MatchInput {
  readonly scenarioId: ScenarioId;
  readonly coverage: DefensiveCoverage;
  readonly seed: number;
  readonly rulesetVersion: "FIBA-2026";
  readonly labParametersVersion:
    | typeof LAB_PARAMETERS_VERSION
    | typeof LAB_0_2_PARAMETERS_VERSION
    | typeof LAB_0_3_PARAMETERS_VERSION;
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
