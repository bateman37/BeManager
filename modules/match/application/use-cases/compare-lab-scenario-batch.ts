import { compareHelpToggle, type HelpComparisonResult } from "../../domain/fast/fast-resolver";
import type { MatchInput } from "../../domain/lab/match-input";

/**
 * Compara, en modo rápido, el mismo escenario con y sin la ayuda de D3,
 * usando las mismas semillas por índice para que la comparación sea
 * atribuible al cambio de instrucción y no al azar de la muestra.
 */
export async function compareLabScenarioBatch(
  baseInput: Omit<MatchInput, "scenarioId">,
  sampleSize: number,
): Promise<HelpComparisonResult> {
  return compareHelpToggle(baseInput, sampleSize);
}
