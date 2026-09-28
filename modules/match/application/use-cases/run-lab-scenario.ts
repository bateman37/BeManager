import { runPossession } from "../../domain/simulation/possession-engine";
import type { MatchInput } from "../../domain/lab/match-input";
import type { MatchState } from "../../domain/simulation/match-state";

/**
 * Ejecuta el escenario detallado de laboratorio hasta un estado terminal.
 * Misma entrada (perfiles, escenario y semilla) produce siempre el mismo
 * resultado: repetir el escenario es solo volver a llamar con la misma
 * `MatchInput`.
 */
export async function runLabScenario(input: MatchInput): Promise<MatchState> {
  return runPossession(input);
}
