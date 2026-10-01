import type { PlayerProfile } from "../players/player-profile";
import type { ScenarioId } from "./scenario";
import { LAB_PARAMETERS_VERSION } from "./lab-0-1-parameters";
import { LAB_0_2_PARAMETERS_VERSION } from "./lab-0-2-parameters";
import { LAB_0_3_PARAMETERS_VERSION } from "./lab-0-3-parameters";
import type { ScreenPlacement } from "./lab-0-7-parameters";

/**
 * Cobertura defensiva ante el bloqueo directo (ME-02 §3): `drop` conserva el
 * árbol de ME-01 (D3 ayuda al continuador o no, según el escenario), y
 * `trampa` compromete a O1 con D1 y D5, pasa a D3 a low man y hace rotar a
 * D4 sobre la amenaza que deja D3, exponiendo a O4. La cobertura es un
 * parámetro de la corrida, no del escenario: la misma entrada de media
 * pista, quintetos y bloqueo central puede resolverse con cualquiera de
 * las dos.
 *
 * ME-07B v2 §5: `cambio` (switch) — D5 sale a tomar al manejador a la altura
 * de la pantalla y D1 se queda con el bloqueador; el emparejamiento cambiado
 * (posible desajuste) persiste el resto de la posesión. `show` (hedge) — D5
 * sale a frenar al manejador delante de la pantalla y vuelve a su marca
 * cuando D1 ha superado el bloqueo. `por_debajo` (under) — drop con D1
 * pasando por detrás del bloqueador: concede la preparación exterior de O1.
 * `ice` — solo aplicable en un bloqueo lateral (impedir el centro: D1 se
 * pone del lado de la pantalla y D5 espera abajo); ante el bloqueo central no
 * es elegible y la defensa juega drop, con el motivo registrado.
 * `a_la_altura` (at the level) — D5 sube a la altura del bloqueador, a su
 * lado, sin meterse en la salida del manejador: le deja doblar la esquina,
 * le contiene desde cerca y vuelve con el continuador en cuanto D1 se
 * recupera; el show sale más arriba, a la línea del manejador, y le frena.
 */
export type DefensiveCoverage = "drop" | "trampa" | "cambio" | "show" | "a_la_altura" | "por_debajo" | "ice";

/**
 * Cobertura elegida desde `/lab` (ME-07A §4): `auto` deja que la defensa
 * decida en cada oportunidad defensiva pertinente cuál de las dos
 * respuestas existentes intenta, con `drop` como plan base cuando la
 * trampa no es elegible o ninguna respuesta distingue claramente la
 * concesión (ver `resolveCoverageChoice`). Valor por defecto: `auto`.
 */
export type DefensiveCoverageChoice = "auto" | DefensiveCoverage;

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
 * Orden sin balón elegida desde `/lab` (ME-07A §4): `auto` decide entre
 * las dos respuestas existentes en cada lectura donde esa orden aplica,
 * con `guardar_espacio` como plan base cuando ambas conceden igual o la
 * información no distingue una respuesta claramente mejor. `no_aplica`
 * (ME-06) sigue siendo distinto de `guardar_espacio` elegido: solo se usa
 * donde esa lectura no existe.
 */
export type OffBallDefensiveCallChoice = "auto" | OffBallDefensiveCall;

/**
 * Prioridad de creación del entrenador (ME-07A §3.1): instrucción previa al
 * partido, independiente de `offensivePlan`. Cambia qué oportunidades
 * intenta preparar y reconocer primero el poseedor real en cada frontera
 * significativa; nunca un bono al acierto del tiro. `equilibrado` deja
 * competir ambas familias de vías (aro/triple) sin favorecer ninguna
 * dentro de la banda de empate. Valor por defecto: `equilibrado`.
 */
export type OffensiveCreationPriority = "equilibrado" | "buscar_aro" | "buscar_triple";

/**
 * Ayuda al continuador del bloqueo directo en drop («tag», ME-07B v2 §2.4 y
 * §5): `siempre` obliga al defensor de la esquina débil a ayudar; `auto`
 * deja que lo lea comparando lo que concede ayudando y sin ayudar («no
 * dejar tirador de esquina»). En la posesión de laboratorio el escenario ya
 * es una orden explícita (`drop_con_ayuda`/`drop_sin_ayuda`) y equivale a
 * `siempre`; en el partido enlazado el valor por defecto es `auto`.
 */
export type RollHelpCall = "auto" | "siempre";

/**
 * Variante encadenada que el ataque puede llamar sobre la ficha en vigor
 * (ME-07B v2 §4, «variantes encadenadas»; LAB-0.9): `spain` añade, desde
 * Horns, el bloqueo ciego del segundo cuerno sobre el defensor que protege
 * el roll; `ninguna` juega la ficha base; `auto` (por defecto) compara la
 * ficha base y cada variante aplicable con la misma proyección en seco
 * frente a la defensa observada. Sin efecto fuera de una colocación que la
 * admita (Spain solo desde Horns).
 */
export type ChainedVariantChoice = "auto" | "ninguna" | "spain";

/**
 * Respuesta de la defensa al bloqueo ciego de Spain (ME-07B v2 §4–§5,
 * LAB-0.9): `seguir` — el defensor del bloqueador ciego (D3) va con él y
 * decide si ayuda al roll o sigue al pop; `cambiar` — D3 y D5 cambian en el
 * bloqueo ciego (D3 toma al continuador, D5 sale al pop), solo si D3 lo
 * reconoce (M01/M05) y lo canta (M09) antes de que el bloqueo llegue; `auto`
 * (por defecto) compara la concesión de ambas desde la misma geometría.
 */
export type BackScreenCall = "seguir" | "cambiar";
export type BackScreenCallChoice = "auto" | BackScreenCall;

/**
 * Entrada compartida por el motor detallado y el motor rápido (estudio de
 * referencia §13.2): una copia estable de perfiles y versiones. Modificar un
 * jugador en otra pantalla no altera una corrida ya iniciada, porque cada
 * corrida conserva su propio snapshot de perfiles (prompt §2).
 */
export interface MatchInput {
  readonly scenarioId: ScenarioId;
  /**
   * Cobertura de esta corrida. Acepta `"auto"` desde ME-07A §4: se resuelve
   * una sola vez por posesión, de forma pura (sin RNG), antes de despachar
   * al bloqueo directo o a la mano a mano (`resolveCoverageChoice`).
   */
  readonly coverage: DefensiveCoverageChoice;
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
  readonly offBallDefensiveCall?: OffBallDefensiveCallChoice;
  /**
   * Prioridad de creación del equipo atacante (ME-07A §3.1). Opcional, con
   * valor por defecto `"equilibrado"` para no alterar ninguna corrida ni
   * prueba existente que no la declare.
   */
  readonly creationPriority?: OffensiveCreationPriority;
  /** Ayuda al continuador del equipo que defiende (ME-07B v2 §2.4). Ver `RollHelpCall`. */
  readonly rollHelpCall?: RollHelpCall;
  /**
   * Colocación del bloqueo directo de esta acción (ME-07B v2 §4, LAB-0.7):
   * `central` (por defecto, la de ME-01) o `lateral`. Las posiciones de
   * partida deben ser las de esa disposición; la colocación lateral es del
   * bloqueo directo (la mano a mano se juega desde la central).
   */
  readonly screenPlacement?: ScreenPlacement;
  /** Variante encadenada pedida por el ataque (ME-07B v2 §4, LAB-0.9). Por defecto `ninguna` en el núcleo. */
  readonly chainedVariant?: ChainedVariantChoice;
  /** Respuesta del equipo que defiende al bloqueo ciego de Spain (LAB-0.9). Por defecto `auto`. */
  readonly backScreenCall?: BackScreenCallChoice;
}

export function findPlayerInInput(input: MatchInput, playerId: string): PlayerProfile {
  const found = [...input.offensePlayers, ...input.defensePlayers].find(
    (p) => p.id === playerId,
  );
  if (!found) throw new Error(`Jugador no encontrado en MatchInput: ${playerId}`);
  return found;
}
