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
 * Familia posicional ofensiva (ME-06 §3): `bloqueo_directo` es el bloqueo
 * directo central ya existente; `mano_a_mano_sin_balon` es la segunda
 * familia (mano a mano de O5 a O2 con bloqueo indirecto y corte de O3 en
 * el lado débil). Es un parámetro de la corrida, análogo a `coverage`: la
 * misma disposición de media pista, quintetos y cobertura defensiva puede
 * resolverse con cualquiera de las dos familias.
 */
export type OffensivePlan = "bloqueo_directo" | "mano_a_mano_sin_balon";

/**
 * Plan ofensivo previo por equipo elegido desde `/lab` (ME-06 §3.2):
 * `auto` evalúa de forma pura, sin RNG y sin ejecutar la vía descartada,
 * la oportunidad situacional de cada familia desde el estado heredado y
 * elige la de mejor oportunidad comparable; los otros dos valores fuerzan
 * siempre la misma familia, para poder estudiarla con la misma semilla y
 * plantillas. Valor por defecto: `auto`.
 */
export type OffensivePlanChoice = "auto" | OffensivePlan;

/**
 * Orden fija de defensa sin balón para la familia de mano a mano (ME-06
 * §3.1), elegida antes del partido por el equipo que defiende:
 * `negar_primera_salida` prioriza que D3/D2 sigan y nieguen a los
 * receptores directos; `guardar_espacio` (valor por defecto) prioriza
 * proteger el carril y la ayuda, aceptando un posible tiro exterior.
 * Ninguna garantiza robo, tiro o falta.
 */
export type OffBallDefensiveCall = "negar_primera_salida" | "guardar_espacio";

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
  /**
   * Familia ofensiva de esta corrida (ME-06 §3.2). Opcional y con valor
   * por defecto `"bloqueo_directo"` para no alterar ninguna corrida ni
   * prueba existente que no lo declare.
   */
  readonly offensivePlan?: OffensivePlanChoice;
  /**
   * Orden de defensa sin balón del equipo que defiende (ME-06 §3.1).
   * Opcional, con valor por defecto `"guardar_espacio"`; sin efecto
   * alguno cuando la familia resuelta es `bloqueo_directo`.
   */
  readonly offBallDefensiveCall?: OffBallDefensiveCall;
}

export function findPlayerInInput(input: MatchInput, playerId: string): PlayerProfile {
  const found = [...input.offensePlayers, ...input.defensePlayers].find(
    (p) => p.id === playerId,
  );
  if (!found) throw new Error(`Jugador no encontrado en MatchInput: ${playerId}`);
  return found;
}
