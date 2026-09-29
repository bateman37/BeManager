import { buildRuleBoundaryCases, type RuleBoundaryCase } from "../../domain/game/rule-boundary-fixtures";

/**
 * Casos de frontera reglamentarios de ME-04 §7 (fixtures de prueba, no
 * partidos): se construyen en el dominio con las mismas funciones puras que
 * adjudican el partido y la interfaz solo los muestra.
 */
export function listRuleBoundaryCases(): readonly RuleBoundaryCase[] {
  return buildRuleBoundaryCases();
}
