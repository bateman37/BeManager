/**
 * Núcleo compartido de la posesión de laboratorio (HF-002). Contiene el
 * árbol de decisión, los tiempos LAB-0.1 y los estados terminales legales
 * (idéntico contrato deportivo al motor detallado de ME-01), pero no
 * construye por sí mismo el relato de hechos con foto de posiciones: eso lo
 * hace `possession-engine.ts` a partir de la línea de tiempo ligera que
 * devuelve este módulo. `domain/fast/fast-resolver.ts` consume este mismo
 * núcleo directamente, sin generar snapshots ni pasar por el motor
 * detallado, para que el camino rápido sea una resolución real y no un
 * descarte del relato (HF-002 §1.1, §3).
 */
import type { Point2D } from "../geometry/point";
import { timeToReach, distance, moveToward, pointShortOfTarget } from "../geometry/point";
import { positionOnTrajectory, truncateTrajectory, type TrajectoryPoint } from "../geometry/trajectory";
import { ATTACKED_HOOP, FREE_THROW_LINE_SPOT, FIBA_LANE_HALF_WIDTH_METERS, COURT_WIDTH_METERS, isBehindThreePointLine, isLateralScreenSpot } from "../geometry/court";
import { MIDCOURT_LINE_X } from "../geometry/frame";
import { createSeededRandom, type SeededRandom } from "../random/seeded-random";
import { secondsToMs, type Milliseconds } from "../time/clock";
import type {
  MatchInput,
  OffensivePlan,
  OffensivePlanChoice,
  OffBallDefensiveCall,
  OffBallDefensiveCallChoice,
  DefensiveCoverage,
  DefensiveCoverageChoice,
  OffensiveCreationPriority,
  BackScreenCallChoice,
} from "../lab/match-input";
import { findPlayerInInput } from "../lab/match-input";
import { getScenario, type ScenarioDefinition } from "../lab/scenario";
import type { PlayerProfile } from "../players/player-profile";
import {
  attackerMoveSpeedMps,
  deflectionProbability,
  turnoverUnderPressureProbability,
  defenderLateralSpeedMps,
  recognitionLatencySeconds,
  screenInterceptDelaySeconds,
  screenContactAdjustmentSeconds,
  screenCoordinationShiftSeconds,
  secondOptionProbability,
  closeoutBrakingExtraSeconds,
  movingShotPrepSeconds,
  perimeterArrivalAdjustmentSeconds,
  interiorArrivalAdjustmentSeconds,
  cutterStartTimeReductionSeconds,
  jumpCeilingMeters,
  shotReleaseHeightMeters,
  maxTouchHeightMeters,
  freeThrowProbability,
  CATCH_AND_SHOOT_PREP_SECONDS,
  CLOSE_FINISH_PREP_SECONDS,
  SCREEN_SET_AFTER_ARRIVAL_SECONDS,
  PASS_RELEASE_SECONDS,
  PASS_FLIGHT_SPEED_MPS,
  FREE_THROW_PREP_SECONDS,
} from "../lab/lab-0-1-parameters";
import type { EffectiveOpposition } from "../lab/lab-0-1-parameters";
import { COMBINED_CONTACT_RADIUS_METERS, m09CoordinationLatencySeconds } from "../lab/lab-0-2-parameters";
import {
  pnrSetGeometry,
  ICE_BASELINE_DRIVE_SPOT,
  ICE_LOW_HELP_SPOT,
  ICE_BASELINE_PULL_UP_SPOT,
  ICE_POP_SPOT,
  type PnrSetGeometry,
} from "../lab/lab-0-7-parameters";
import { blendProjectionWithObservation, shooterLandingSeconds, shownCoverageWeights, type ObservedOutcome } from "../lab/lab-0-4-parameters";
import { contestReachMeters, evaluateContestLevel, FIRST_READ_TIE_BAND_POINTS } from "../lab/lab-0-3-parameters";
import { isFloaterZone, isMidRangeZone } from "../lab/lab-0-5-parameters";
import { contactFoulProbability } from "../lab/lab-0-6-parameters";
import type { TerminalOutcome, BallState } from "./match-state";
import type { FactPhase, FactKind } from "./fact";
import { resolvePass } from "./resolvers/pass-resolver";
import { resolveShot, shotBaseProbability, type ShotType } from "./resolvers/shot-resolver";
import {
  seedReboundLanding,
  resolveRebound,
  pickTipWinnerByT20,
  effectiveReboundArrival,
  type ReboundBoxOutGeometry,
  type ReboundCandidate,
  type ReboundOutcome,
  type ReboundTrace,
} from "./resolvers/rebound-resolver";
import { resolvesTurnoverUnderPressure } from "./resolvers/turnover-resolver";
import { planSecondEntry, type SecondEntryPlan } from "./second-entry-read";
import type { RaceParticipant } from "../sequence/transition";
import {
  evaluateCloseoutLegality,
  awardFreeThrowsForShootingFoul,
  evaluateContainmentContact,
} from "./resolvers/foul-resolver";
import { shotProbability, blockDeflectionProbability, CLOSE_FINISH_BASE_PROBABILITY, THREE_POINT_BASE_PROBABILITY } from "../lab/lab-0-1-parameters";
import { createNoopAuditCollector, type AuditCollector } from "../audit/audit-collector";
import type { AuditDecisionPoint, AuditOptionRecord, AuditReasonCode } from "../audit/audit-types";
import { cardFor, type PlaybookCardId } from "../tactics/playbook-card";
import { SPAIN_POP_SPOT, SPAIN_ROLL_SPOT, isBackScreenTarget, spainBackScreenPoint } from "../lab/lab-0-9-parameters";
import { DELAY_WEAK_CUT_SPOT } from "../lab/lab-0-10-parameters";

/**
 * Tiro de recepción de O3 en el punto que deja libre la ayuda al roll
 * (`ctx.set.helpLeftSpot`): triple detrás de la línea (esquina débil en las
 * colocaciones 4-out/1-in); si no, la zona real del punto decide tiro medio
 * o floater (LAB-0.5), p. ej. el codo del segundo cuerno en Horns (LAB-0.8).
 */
function helpLeftShotType(ctx: CoreContext): ShotType {
  const spot = ctx.set.helpLeftSpot;
  if (isBehindThreePointLine(spot)) return "three_point";
  if (isMidRangeZone(spot)) return "mid_range";
  return isFloaterZone(spot) ? "floater" : "close_finish";
}

/** Valor del tiro de recepción de O3 en ese punto con la oposición dada (misma regla LAB-0.1 que el resto de vías). */
function helpLeftShotValue(ctx: CoreContext, opposition: EffectiveOpposition): number {
  const type = helpLeftShotType(ctx);
  return (type === "three_point" ? 3 : 2) * shotProbability(shotBaseProbability(type), shotSkill(player(ctx, "O3"), type), opposition);
}
/**
 * Solo para `closeout_tardío_con_contacto`: representa que D4 ya había
 * rotado a proteger el aro (X-out) antes de tener que recuperar sobre O3,
 * en vez de partir directamente desde su posición inicial de ala débil.
 * Es una condición geométrica propia de este escenario, no una fórmula
 * LAB-0.1 compartida. Recalibrado en ME-04B tras corregir el desplazamiento
 * real de O1 hasta el punto de uso de la pantalla (§3.1): O1 pasa a O3 desde
 * una posición más cercana a la esquina que antes (cuando permanecía
 * inmóvil en su punto de partida), así que O3 recibe antes y antes se
 * necesita el mismo margen negativo para que el cierre tardío de D4 siga
 * siendo alcanzable de verdad.
 */
const LATE_CLOSEOUT_D4_START: Point2D = { x: 24.5, y: 9.4 };

/**
 * Geometría sintética propia de la segunda familia posicional (mano a mano
 * sin balón, ME-06 §3.1), no una fórmula LAB-0.1 compartida: punto real de
 * bloqueo indirecto de O4 sobre D3 y ventana de recepción/corte de O3 tras
 * usarlo, en el lado débil de la misma disposición 4-out/1-in. O5 recibe
 * la entrada de O1 en el codo alto ya versionado `FREE_THROW_LINE_SPOT`
 * (reutilizado, no un punto nuevo).
 */
const WEAK_SIDE_SCREEN_SPOT: Point2D = { x: 22.9, y: 12.1 };
const WEAK_SIDE_CUT_SPOT: Point2D = { x: 22.5, y: 12.8 };
/**
 * Ajuste local (no LAB-0.1) de la orden fija de defensa sin balón (ME-06
 * §3.1) sobre la navegación real de D3 al bloqueo indirecto: con
 * `negar_primera_salida`, D3 persigue más apretado (llega antes);con
 * `guardar_espacio`, D3 prioriza proteger el carril y concede más
 * separación real (llega después). Ninguna magnitud garantiza robo, tiro
 * o falta: solo desplaza el instante real de navegación de D3.
 */
const OFF_BALL_CALL_NAVIGATION_ADJUSTMENT_SECONDS = 0.15;
const MAX_PROGRESS_ITERATIONS = 12;
/** Velocidad común de llegada a un balón suelto/rebote (HF-002); la reutiliza el tramo de ME-03. */
export const REBOUND_CANDIDATE_SPEED_MPS = 3.2;

export interface RawEvent {
  sequence: number;
  readonly atMs: Milliseconds;
  readonly phase: FactPhase;
  readonly kind: FactKind;
  readonly actors: readonly string[];
  readonly text: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

/**
 * Entrada del historial de llegadas. `moving` solo lo usa el modo enlazado
 * de ME-03 (desplazamiento lineal desde la entrada anterior); el motor
 * detallado de ME-01/ME-02 nunca lo activa y conserva su semántica
 * escalonada.
 */
export type PositionHistoryEntry = TrajectoryPoint;

export type PositionHistory = Readonly<Record<string, readonly PositionHistoryEntry[]>>;

export interface PossessionCoreResult {
  readonly terminal: TerminalOutcome;
  readonly timeline: readonly RawEvent[];
  readonly finalPositions: Readonly<Record<string, Point2D>>;
  /** Solo se rellena cuando `trackPositionHistory` está activo (motor detallado). */
  readonly positionHistory: PositionHistory | null;
  readonly gameClockMs: Milliseconds;
  readonly shotClockMs: Milliseconds;
  readonly possessionPhase: number;
  readonly ball: BallState;
  /** Familia y cobertura efectivamente aplicadas si este tramo fue un ataque organizado (ME-07B v2). */
  readonly organizedChoice?: { readonly plan: OffensivePlan; readonly coverage: DefensiveCoverage; readonly card: PlaybookCardId };
  /**
   * Roles defensivos que han intercambiado su marca en este tramo (ME-07B v2
   * §5, cambio): quien llama mantiene el intercambio el resto de la posesión.
   */
  readonly defensiveSwap?: readonly [string, string];
}

export interface ComputePossessionCoreOptions {
  /** Activa el historial de posiciones para reconstruir snapshots por hecho (motor detallado). */
  readonly trackPositionHistory?: boolean;
  /**
   * Modo enlazado (ME-03, ADR-0006): el núcleo calcula un tramo de juego
   * dentro de un tramo de varias posesiones, partiendo de posiciones,
   * relojes y azar reales en vez del fixture. Sin esta opción, el
   * comportamiento es exactamente el de ME-01/ME-02.
   */
  readonly linked?: LinkedSegmentOptions;
  /**
   * Colector opcional de auditoría (ME-04A §3): registra, en el punto
   * exacto en que ya se decidió, las opciones evaluadas y su motivo. Con
   * el colector nulo (por defecto) el coste y el comportamiento son
   * exactamente los de antes de ME-04A.
   */
  readonly audit?: AuditCollector;
}

/** Prioridad tras tiro elegida por cada equipo antes del tramo (ME-03 §4). */
export type ReboundPriority = "proteger_balance" | "cargar_rebote";

/**
 * Desplazamiento ya planificado al comenzar el tramo de cálculo (en el
 * marco local): el jugador sale de su posición inicial en `departSeconds`
 * y llega a `to` en `arriveSeconds`, en línea recta. Lo usa la transición
 * para que los diez sigan moviéndose mientras se resuelve una ventaja.
 */
export interface PlannedLeg {
  readonly departSeconds: number;
  readonly arriveSeconds: number;
  readonly to: Point2D;
}

/**
 * Qué acción ejecuta el núcleo en modo enlazado. `organized_set` es el
 * bloqueo directo central ya existente (drop o trampa según la cobertura),
 * que solo se usa cuando los diez están situados en la disposición. En
 * `direct_finish` la decisión (penetración, pase adelantado o segunda
 * oportunidad) la toma quien llama con tiempos reales; el núcleo solo
 * ejecuta pase/recepción y lanzamiento con el mismo `resolveShotAttempt`
 * (oposición por geometría real, tapón, falta y rebote), sin un segundo
 * árbol de tiro.
 */
export type LinkedEntry =
  | { readonly kind: "organized_set" }
  | {
      readonly kind: "direct_finish";
      readonly shooterSlot: string;
      readonly finishSpot: Point2D;
      /** Instante en que el tirador alcanza `finishSpot` (su pierna ya planificada). */
      readonly shooterAtSpotSeconds: number;
      /**
       * Tipo de tiro (ME-07A §3.2): `"close_finish"` (por defecto, T01) o
       * `"three_point"` (T04, preparación de catch-and-shoot) para el
       * triple del propio portador en transición cuando el aro está
       * contenido pero queda una ventana real detrás de la línea.
       */
      readonly shotType?: ShotType;
      /** Preparación explícita (p. ej. tiro tras bote, T06); por defecto la del tipo. */
      readonly prepSeconds?: number;
      readonly pass: {
        readonly passerSlot: string;
        readonly releaseSeconds: number;
        readonly arrivalSeconds: number;
      } | null;
      readonly contesterSlot: string;
      readonly contesterArrivalSeconds: number;
      readonly contesterGeometry: ContestGeometry;
    }
  | {
      /**
       * ME-04: serie de libres ya concedida (falta de tiro o bonus), que
       * el partido ejecuta después de abrir la oportunidad de sustitución.
       * Mismo bucle T05 + rebote del último libre fallado que ME-01; si el
       * período ya terminó, el último fallo no genera rebote.
       */
      readonly kind: "free_throws";
      readonly shooterSlot: string;
      readonly count: number;
      readonly liveReboundOnLastMiss: boolean;
    };

/**
 * Reglas de partido activas en el núcleo enlazado (ME-04). Ausentes en la
 * posesión individual y en el tramo de ME-03, que conservan exactamente su
 * comportamiento.
 */
export interface LinkedGameRules {
  /** La falta de tiro devuelve sus libres pendientes en vez de ejecutarlos. */
  readonly deferFreeThrows: boolean;
  /** Adjudica la vía ordinaria sin tiro (contención ilegal del continuador). */
  readonly ordinaryFouls: boolean;
  /** Permite la segunda entrada del bloqueo si la primera lectura queda negada (una por acción). */
  readonly secondEntryAllowed: boolean;
}

export interface LinkedSegmentOptions {
  /** Rol canónico de la acción (O1..O5 ataca, D1..D5 defiende) → ID real del jugador. */
  readonly binding: Readonly<Record<string, string>>;
  /** Posiciones de partida en el marco local, por rol canónico. */
  readonly startPositions: Readonly<Record<string, Point2D>>;
  readonly legs?: Readonly<Record<string, PlannedLeg>>;
  readonly shotClockMs: Milliseconds;
  readonly gameClockMs: Milliseconds;
  /** Mismo flujo de azar para todo el tramo: no se reinicia con la semilla. */
  readonly rng: SeededRandom;
  readonly attackingPriority: ReboundPriority;
  readonly entry: LinkedEntry;
  readonly rules?: LinkedGameRules;
  /** Instante absoluto (partido/tramo) del inicio de este tramo de cálculo, para fechar la auditoría. */
  readonly t0?: Milliseconds;
  readonly possessionIndex?: number | null;
  readonly phaseIndex?: number | null;
  /**
   * ME-07B v2 §2.3/§5: lo que cada equipo ha visto en este partido hasta
   * ahora (usos y puntos por familia al atacar y por cobertura al
   * defender). Solo resultados ya ocurridos y visibles, nunca ratings.
   */
  readonly observations?: {
    readonly offenseByFamily: Readonly<Partial<Record<OffensivePlan, ObservedOutcome>>>;
    readonly defenseByCoverage: Readonly<Partial<Record<DefensiveCoverage, ObservedOutcome>>>;
    /**
     * Respuestas a la entrega de Delay vistas en este partido, con la etiqueta
     * de cobertura con que se registran (`DELAY_RESPONSE_COVERAGE`), separadas
     * de las coberturas de pantalla (sesión v2-6).
     */
    readonly defenseByHandoffResponse?: Readonly<Partial<Record<DefensiveCoverage, ObservedOutcome>>>;
  };
}

/**
 * Contención del continuador por el defensor que ayuda (ME-04 §3): se
 * guarda al programar ambos desplazamientos y se adjudica al cerrar el
 * tramo de cálculo, con las trayectorias reales ya conocidas.
 */
interface PendingContainment {
  readonly defenderSlot: string;
  readonly attackerSlot: string;
  /** Inicio del desplazamiento del atacante (s). */
  readonly attackerDepartSeconds: number;
  /** Llegada del atacante a su punto (s): a partir de ahí ya no se desplaza. */
  readonly attackerArrivalSeconds: number;
  readonly defenderDepartSeconds: number;
  readonly defenderArrivalSeconds: number;
  readonly brakingExtraSeconds: number;
}

interface LinkedState {
  readonly binding: Readonly<Record<string, string>>;
  readonly priority: ReboundPriority;
  readonly rules: LinkedGameRules | null;
  containment: PendingContainment | null;
  /** Primer instante en que empieza un gesto de tiro en este tramo de cálculo. */
  firstGestureSeconds: number;
  /** Atacantes con encargo de balance en el tiro vigente: no disputan el rebote. */
  balancers: ReadonlySet<string>;
}

interface CoreContext {
  readonly input: MatchInput;
  readonly rng: SeededRandom;
  readonly timeline: RawEvent[];
  sequence: number;
  readonly positions: Record<string, Point2D>;
  readonly positionHistory: Record<string, PositionHistoryEntry[]> | null;
  readonly gameClockMs: Milliseconds;
  readonly shotClockMs: Milliseconds;
  possessionPhase: number;
  /**
   * Cobertura resuelta de esta posesión (ME-07A §4): igual a `input.coverage`
   * cuando ya es `"drop"`/`"trampa"`; si `input.coverage` es `"auto"`, se
   * fija una sola vez, antes de despachar el árbol, con `resolveCoverage`.
   * Los puntos que necesitan un valor concreto (el despacho drop/trampa y
   * el compromiso de D5 en la mano a mano) leen este campo, nunca
   * `input.coverage` directamente.
   */
  resolvedCoverage: DefensiveCoverage;
  readonly linked: LinkedState | null;
  readonly audit: AuditCollector;
  readonly auditMeta: { readonly t0: Milliseconds; readonly possessionIndex: number | null; readonly phaseIndex: number | null } | null;
  /**
   * ME-07B v2 §2.2: contexto de proyección en seco. La misma función de
   * familia avanza hasta su primera lectura sin azar ni auditoría y devuelve
   * los valores de esa lectura (`ReadProjectionReached`), de modo que el
   * selector compara las familias en la misma frontera y con los mismos
   * costes que su ejecución real.
   */
  readonly projecting?: boolean;
  /**
   * Puntos de la disposición del bloqueo directo de esta acción (central o
   * lateral, LAB-0.7; Horns, LAB-0.8). Mutable solo para que Horns→Spain
   * (LAB-0.9) cambie, al ejecutarse, el punto del roll (profundo) y el del
   * jugador que deja libre la ayuda (el pop) sobre el mismo contexto.
   */
  set: PnrSetGeometry;
}

/**
 * ID real en pista de un código de rol/opción (ME-04B §4.1): en modo
 * enlazado, `O1`/`D3`/... son códigos de rol del núcleo, no el ID del
 * jugador que realmente ocupa ese rol en este instante (puede haber
 * cambiado por sustitución). Fuera del modo enlazado (posesión de
 * laboratorio) el código ya es el ID real. No traduce identificadores de
 * *opción* (`"pase_o5"`, `"O1+O4"`...), que son símbolos del árbol, no
 * jugadores.
 */
function realId(ctx: CoreContext, roleOrId: string): string {
  return ctx.linked ? (ctx.linked.binding[roleOrId] ?? roleOrId) : roleOrId;
}

/**
 * Enlace al hecho de `ctx.timeline` **efectivamente emitido** (ME-04B §4.2):
 * busca hacia atrás el último hecho ya registrado de ese tipo (los
 * llamadores deben emitir el hecho antes de invocar `auditDecision` con
 * `factLinkKind`) y usa su instante real, nunca el instante propio de la
 * decisión. Si el hecho no llegó a ocurrir (desvío previo, bocina, guardián,
 * o un error de quien llama que aún no lo emitió), el enlace queda `null` en
 * vez de inventar un instante — el caso ya se distingue de un enlace roto
 * porque nunca coincide por casualidad con la marca de la decisión.
 */
function resolveFactLink(ctx: CoreContext, kind: string): { atMs: number; kind: string } | null {
  for (let i = ctx.timeline.length - 1; i >= 0; i--) {
    if (ctx.timeline[i]!.kind === kind) {
      return { atMs: (ctx.auditMeta?.t0 ?? 0) + ctx.timeline[i]!.atMs, kind };
    }
  }
  return null;
}

/**
 * Registra un punto de decisión ya evaluado (ME-04A §3, corregido en
 * ME-04B §4). No hace nada (coste cero) cuando el colector está desactivado.
 * `atSeconds` es local al tramo de cálculo; se fecha con `auditMeta.t0` para
 * quedar en el reloj absoluto del partido, igual que hace `runCore` con los
 * hechos. `holderId`/`participants` se traducen aquí, en un único punto, a
 * IDs reales de pista; `factLink` se resuelve buscando el hecho ya emitido
 * en vez de reutilizar el instante de la decisión.
 */
function auditDecision(
  ctx: CoreContext,
  atSeconds: number,
  input: {
    readonly point: AuditDecisionPoint;
    readonly holderId: string | null;
    readonly participants: readonly string[];
    readonly options: readonly AuditOptionRecord[];
    readonly chosenOptionId: string | null;
    readonly factLinkKind?: string;
    readonly rngStateBefore?: number | null;
    readonly rngStateAfter?: number | null;
    readonly note?: string;
  },
): void {
  if (!ctx.audit.enabled) return;
  const atMs = (ctx.auditMeta?.t0 ?? 0) + secondsToMs(atSeconds);
  ctx.audit.recordDecision({
    atMs,
    point: input.point,
    possessionIndex: ctx.auditMeta?.possessionIndex ?? null,
    phaseIndex: ctx.auditMeta?.phaseIndex ?? null,
    holderId: input.holderId === null ? null : realId(ctx, input.holderId),
    participants: input.participants.map((p) => realId(ctx, p)),
    options: input.options,
    chosenOptionId: input.chosenOptionId,
    factLink: input.factLinkKind ? resolveFactLink(ctx, input.factLinkKind) : null,
    rngStateBefore: input.rngStateBefore ?? null,
    rngStateAfter: input.rngStateAfter ?? null,
    note: input.note,
  });
}

/** Estado del generador si es reanudable (modo enlazado); `null` si no aplica. */
function rngStateOf(rng: SeededRandom): number | null {
  return "state" in rng && typeof rng.state === "function" ? rng.state() : null;
}

/** Opción no alcanzada porque el árbol ya había decidido antes (ME-04A §3). */
function shortCircuited(id: string): AuditOptionRecord {
  return { id, status: "no_evaluada_por_cortocircuito", reasonCode: "not_evaluated_short_circuit" };
}

/**
 * Clasifica el motivo de rechazo de `planSecondEntry` (4 plantillas fijas
 * de `second-entry-read.ts`, no lenguaje libre de usuario) en un código
 * estable. El texto original se conserva en `reasonNote` como referencia.
 */
function secondEntryRejectionCode(reason: string): AuditReasonCode {
  if (reason.includes("posición exterior") || reason.includes("no es un exterior")) return "second_entry_not_exterior_frontcourt";
  if (reason.includes("línea de pase")) return "second_entry_pass_line_blocked";
  if (reason.includes("fuera de la pista delantera")) return "second_entry_screen_spot_illegal";
  if (reason.includes("recolocar el bloqueo")) return "second_entry_shot_clock_insufficient";
  return "not_available";
}

function player(ctx: CoreContext, id: string): PlayerProfile {
  return findPlayerInInput(ctx.input, ctx.linked ? (ctx.linked.binding[id] ?? id) : id);
}

function event(
  ctx: CoreContext,
  atSeconds: number,
  phase: FactPhase,
  kind: FactKind,
  actors: readonly string[],
  text: string,
  detail: Record<string, unknown> = {},
): void {
  ctx.timeline.push({
    sequence: ctx.sequence++,
    atMs: secondsToMs(atSeconds),
    phase,
    kind,
    actors,
    text,
    detail,
  });
}

/**
 * Actualiza la posición de cálculo inmediatamente (necesaria para los
 * tiempos de llegada de las siguientes fases) y, si el historial está
 * activo, registra la llegada en su instante real, no en el instante en
 * que el código la ejecuta (HF-002 §1.3: un hecho representa el instante en
 * que ocurrió, no una posición futura adelantada).
 */
function setArrival(
  ctx: CoreContext,
  playerId: string,
  arrivalAtSeconds: number,
  position: Point2D,
  departAtSeconds?: number,
): void {
  if (ctx.linked && ctx.positionHistory) {
    // Modo enlazado (ME-03): la llegada es un desplazamiento real desde la
    // posición que el jugador ocupaba al salir, no un salto en el instante
    // de llegada.
    redirect(ctx, playerId, departAtSeconds ?? arrivalAtSeconds, arrivalAtSeconds, position);
    return;
  }
  ctx.positions[playerId] = position;
  if (ctx.positionHistory) {
    (ctx.positionHistory[playerId] ??= []).push({ atMs: secondsToMs(arrivalAtSeconds), position });
  }
}

/** Posición real (historial) de un jugador en un instante, solo en modo enlazado. */
function historyPositionAt(ctx: CoreContext, playerId: string, atSeconds: number): Point2D {
  const entries = ctx.positionHistory?.[playerId];
  if (!entries || entries.length === 0) return ctx.positions[playerId]!;
  return positionOnTrajectory(entries, secondsToMs(atSeconds));
}

/**
 * Cambia el objetivo de un jugador en `departSeconds` (ME-03): recorta lo
 * que tenía previsto después de ese instante y le hace recorrer en línea
 * recta el camino desde donde realmente está hasta `to`.
 */
function redirect(ctx: CoreContext, playerId: string, departSeconds: number, arriveSeconds: number, to: Point2D): void {
  const history = ctx.positionHistory!;
  const departMs = secondsToMs(Math.max(0, departSeconds));
  const arriveMs = Math.max(departMs, secondsToMs(arriveSeconds));
  const truncated = truncateTrajectory(history[playerId] ?? [{ atMs: 0, position: ctx.positions[playerId]! }], departMs);
  truncated.push({ atMs: arriveMs, position: to, moving: arriveMs > departMs });
  history[playerId] = truncated;
  ctx.positions[playerId] = to;
}

/** Velocidad de carrera sin balón o con bote (F01), reutilizada del movimiento atacante LAB-0.1. */
function runSpeed(ctx: CoreContext, slot: string): number {
  return attackerMoveSpeedMps(player(ctx, slot).attributes.F01);
}

function distanceSeconds(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y) / PASS_FLIGHT_SPEED_MPS;
}

function isOffensivePlayer(playerId: string): boolean {
  return playerId.startsWith("O");
}

function finalize(ctx: CoreContext, outcome: TerminalOutcome, ball: BallState): PossessionCoreResult {
  const foul = ctx.linked?.rules?.ordinaryFouls ? adjudicatePendingContainment(ctx) : null;
  if (foul) return foul;
  const orderedTimeline = [...ctx.timeline]
    .sort((a, b) => a.atMs - b.atMs || a.sequence - b.sequence)
    .map((raw, index) => ({ ...raw, sequence: index }));

  const positionHistory: PositionHistory | null = ctx.positionHistory
    ? Object.fromEntries(Object.entries(ctx.positionHistory).map(([id, entries]) => [id, entries]))
    : null;

  return {
    terminal: outcome,
    timeline: orderedTimeline,
    finalPositions: { ...ctx.positions },
    positionHistory,
    gameClockMs: ctx.gameClockMs,
    shotClockMs: ctx.shotClockMs,
    possessionPhase: ctx.possessionPhase,
    ball,
  };
}

/**
 * Calcula el desenlace completo de una posesión de laboratorio (HF-002 §2):
 * misma entrada (perfiles, escenario y semilla) produce siempre el mismo
 * árbol de decisión. No decide por sí mismo cómo presentarse: eso vive en
 * el motor detallado o en el resolvedor rápido que lo consuman.
 */
/** Una vía de la primera lectura proyectada, con su probabilidad de completar el pase previo. */
interface ProjectedReadOption {
  readonly id: string;
  readonly value: number;
  /** Probabilidad de que los pases necesarios para llegar a la vía no se desvíen (LAB-0.1). */
  readonly completion: number;
}

interface ReadProjection {
  readonly tDecisionSeconds: number;
  readonly options: readonly ProjectedReadOption[];
}

class ReadProjectionReached {
  constructor(readonly projection: ReadProjection) {}
}

/**
 * Concesión proyectada de la trampa (ME-07B v2 §2.3): la misma función
 * `runTrapPhase` avanza en seco hasta la decisión de O1 (desplazamientos,
 * aviso M09, low man y rotación desde posiciones reales) y, desde esa misma
 * geometría, se valora cada rama del árbol ya existente por la probabilidad
 * de sus sorteos (presión T07/T15, desvío de pase T17/T09), sin sortear.
 */
interface TrapProjection {
  readonly trapClosed: boolean;
  readonly concession: number;
  readonly branch: "carril_o1" | "trap_broken_o4" | "invertir_o3" | "finalizar_bajo_contencion";
  readonly stealProbability: number;
  readonly tD5TrapArrivalSeconds: number;
  readonly tPassArrivalToO5Seconds: number;
}

class TrapProjectionReached {
  constructor(readonly projection: TrapProjection) {}
}

function projectTrapConcession(ctx: CoreContext): TrapProjection | null {
  try {
    runTrapPhase(dryContext(ctx));
    return null;
  } catch (e) {
    if (e instanceof TrapProjectionReached) return e.projection;
    throw e;
  }
}

const DRY_RUN_RNG: SeededRandom = {
  next(): number {
    throw new Error("Proyección en seco: una familia intentó consumir azar antes de su primera lectura.");
  },
  nextInRange(): number {
    return DRY_RUN_RNG.next();
  },
  nextInt(): number {
    return DRY_RUN_RNG.next();
  },
  nextSign(): 1 | -1 {
    DRY_RUN_RNG.next();
    return 1;
  },
};

/** Copia aislada del contexto para proyectar sin tocar hechos, azar, auditoría ni posiciones reales. */
function dryContext(ctx: CoreContext): CoreContext {
  return {
    ...ctx,
    rng: DRY_RUN_RNG,
    timeline: [],
    positions: { ...ctx.positions },
    positionHistory: ctx.positionHistory
      ? Object.fromEntries(Object.entries(ctx.positionHistory).map(([id, entries]) => [id, [...entries]]))
      : null,
    linked: ctx.linked ? { ...ctx.linked, balancers: new Set(ctx.linked.balancers) } : null,
    audit: createNoopAuditCollector(),
    projecting: true,
  };
}

/**
 * Proyecta la primera lectura de una familia desde el estado heredado
 * (ME-07B v2 §2.2): `null` si la familia no llega a su lectura (p. ej.
 * reloj insuficiente).
 */
function projectFamilyRead(ctx: CoreContext, run: (dry: CoreContext) => PossessionCoreResult): ReadProjection | null {
  try {
    run(dryContext(ctx));
    return null;
  } catch (e) {
    if (e instanceof ReadProjectionReached) return e.projection;
    throw e;
  }
}

/** Oportunidad comparable de una familia: la mejor vía viable por su probabilidad de completarse. */
interface FamilyOpportunity extends EntryOpportunity {
  readonly bestOptionId: string | null;
  /** Valor situacional de esa vía en la primera lectura proyectada, antes del riesgo de pase. */
  readonly bestRawValue: number | null;
  readonly bestCompletion: number | null;
  readonly tDecisionSeconds: number | null;
}

function familyOpportunity(projection: ReadProjection | null): FamilyOpportunity {
  if (!projection) return { viable: false, value: -Infinity, bestOptionId: null, bestRawValue: null, bestCompletion: null, tDecisionSeconds: null };
  let best = 0;
  let bestOption: ProjectedReadOption | null = null;
  for (const o of projection.options) {
    if (!Number.isFinite(o.value)) continue;
    const expected = o.value * o.completion;
    if (expected > best) {
      best = expected;
      bestOption = o;
    }
  }
  return {
    viable: best > 0,
    value: best,
    bestOptionId: bestOption?.id ?? null,
    bestRawValue: bestOption?.value ?? null,
    bestCompletion: bestOption?.completion ?? null,
    tDecisionSeconds: projection.tDecisionSeconds,
  };
}

function familyAuditValues(o: FamilyOpportunity): Record<string, number | string | boolean | null> {
  return {
    situationalValue: o.value,
    viable: o.viable,
    bestReadOption: o.bestOptionId,
    bestReadRawValue: o.bestRawValue,
    bestReadCompletion: o.bestCompletion,
    projectedDecisionSeconds: o.tDecisionSeconds,
  };
}

/**
 * Proyección del bloqueo directo frente a la defensa que el ataque **ha visto**
 * (ME-07B v2 §2.2/§5). Antes el ataque proyectaba siempre contra drop aunque
 * el rival pudiera cambiar, hacer trampa, show, «a la altura», por debajo o
 * ICE. Ahora proyecta en seco la concesión de cada cobertura que el rival ha
 * usado en este partido (misma ejecución, misma frontera y costes que usa la
 * defensa para elegir) y la pondera por la tendencia observada
 * (`shownCoverageWeights`, LAB-0.4: drop como previa). No conoce la cobertura
 * que vendrá ni la orden del rival: solo frecuencias visibles. ICE ante una
 * pantalla no lateral no es aplicable y se juega drop, así que pesa como drop.
 */
interface BloqueoOverCoverages {
  readonly drop: FamilyOpportunity;
  readonly expectedValue: number;
  /**
   * Instante esperado de la primera lectura real desde que los cinco están
   * situados (s), con los mismos pesos que el valor: la frontera temporal con
   * la que se comparan fichas distintas (ME-07B v2 §2.2). La trampa, sin
   * lectura propia proyectada, usa la de drop.
   */
  readonly decisionSeconds: number;
  readonly decisionByCoverage: Readonly<Partial<Record<DefensiveCoverage, number>>>;
  readonly weights: Readonly<Partial<Record<DefensiveCoverage, number>>>;
  readonly valueByCoverage: Readonly<Partial<Record<DefensiveCoverage, number>>>;
}

function projectBloqueoOverShownCoverages(
  ctx: CoreContext,
  scenario: ScenarioDefinition,
  shown: Readonly<Partial<Record<DefensiveCoverage, ObservedOutcome>>> | undefined,
): BloqueoOverCoverages {
  const drop = familyOpportunity(projectFamilyRead(ctx, (dry) => runDropPhase(dry, scenario)));
  const dropValue = drop.viable ? drop.value : 0;
  const weights = shownCoverageWeights<DefensiveCoverage>(shown, "drop");
  const lateral = isLateralScreenSpot(ctx.positions.O5!);
  const dropDecision = drop.tDecisionSeconds ?? 0;
  const valueByCoverage: Partial<Record<DefensiveCoverage, number>> = {};
  let expectedValue = 0;
  let decisionSeconds = 0;
  const decisionByCoverage: Partial<Record<DefensiveCoverage, number>> = {};
  for (const [c, w] of Object.entries(weights) as [DefensiveCoverage, number][]) {
    let o: FamilyOpportunity | null = null;
    let v: number;
    switch (c) {
      case "drop":
        o = drop;
        break;
      case "por_debajo":
        o = familyOpportunity(projectFamilyRead(ctx, (dry) => runDropPhase(dry, scenario, "por_debajo")));
        break;
      case "cambio":
        o = familyOpportunity(projectFamilyRead(ctx, (dry) => runSwitchPhase(dry)));
        break;
      case "show":
        o = familyOpportunity(projectFamilyRead(ctx, (dry) => runShowPhase(dry, scenario)));
        break;
      case "a_la_altura":
        o = familyOpportunity(projectFamilyRead(ctx, (dry) => runShowPhase(dry, scenario, "a_la_altura")));
        break;
      case "ice":
        o = lateral ? familyOpportunity(projectFamilyRead(ctx, (dry) => runIcePhase(dry, scenario))) : drop;
        break;
      case "trampa":
        break;
    }
    if (c === "trampa") {
      const trap = projectTrapConcession(ctx);
      v = trap ? Math.max(0, trap.concession) : dropValue;
    } else {
      v = o!.viable ? o!.value : 0;
    }
    valueByCoverage[c] = v;
    expectedValue += w * v;
    decisionByCoverage[c] = o?.tDecisionSeconds ?? dropDecision;
    decisionSeconds += w * decisionByCoverage[c]!;
  }
  return { drop, expectedValue, decisionSeconds, decisionByCoverage, weights, valueByCoverage };
}

/**
 * Valor esperado de Horns→Spain frente a la defensa observada (ME-07B v2 §4,
 * LAB-0.9): ante drop y por debajo, la propia ejecución de Spain en seco
 * hasta la lectura del manejador (suponiendo la mejor respuesta del rival al
 * bloqueo ciego: el ataque no conoce su orden); ante el resto de coberturas
 * no hay a quién bloquear y la ficha se juega como Horns, así que vale lo
 * mismo que la base frente a esa cobertura. Misma ponderación por frecuencia
 * observada que `projectBloqueoOverShownCoverages`.
 */
function projectSpainOverShownCoverages(ctx: CoreContext, scenario: ScenarioDefinition, plain: BloqueoOverCoverages): { readonly expectedValue: number; readonly decisionSeconds: number; readonly valueByCoverage: Readonly<Partial<Record<DefensiveCoverage, number>>> } {
  const valueByCoverage: Partial<Record<DefensiveCoverage, number>> = {};
  let expectedValue = 0;
  // Fuera de drop/por debajo se juega Horns: su lectura llega cuando la de la base.
  let decisionSeconds = plain.decisionSeconds;
  for (const [c, w] of Object.entries(plain.weights) as [DefensiveCoverage, number][]) {
    let v = plain.valueByCoverage[c] ?? 0;
    if (c === "drop" || c === "por_debajo") {
      const route: ScreenRoute = c === "por_debajo" ? "por_debajo" : "por_encima";
      const o = familyOpportunity(
        projectFamilyRead(ctx, (dry) => {
          dry.resolvedCoverage = c;
          const read = readSpainBackScreen(dry);
          return read.timing ? runSpainPhase(dry, route, read.timing, "auto") : runDropPhase(dry, scenario, route);
        }),
      );
      v = o.viable ? o.value : 0;
      const base = plain.decisionByCoverage[c] ?? 0;
      decisionSeconds += w * ((o.tDecisionSeconds ?? base) - base);
    }
    valueByCoverage[c] = v;
    expectedValue += w * v;
  }
  return { expectedValue, decisionSeconds, valueByCoverage };
}

/**
 * Valor esperado de Delay (LAB-0.10) frente a la defensa observada: cada
 * cobertura mostrada se traduce a su respuesta ante la entrega (hundirse,
 * cambiar o saltar) y se proyecta en seco hasta la primera lectura, con la
 * misma ponderación por frecuencia (`shownCoverageWeights`, previa drop).
 */
interface HandoffOverResponses {
  readonly expectedValue: number;
  readonly decisionSeconds: number;
  readonly valueByResponse: Readonly<Partial<Record<DelayResponse, number>>>;
  readonly weights: Readonly<Partial<Record<DefensiveCoverage, number>>>;
  readonly base: FamilyOpportunity;
}

/**
 * Sesión v2-8: la misma proyección sirve a las dos entregas en mano (Delay y
 * la mano a mano central): ambas se juegan ante una respuesta a la entrega
 * (hundirse, cambiar o saltar), no ante una cobertura de pantalla.
 */
function projectDelayOverShownCoverages(
  ctx: CoreContext,
  shown: Readonly<Partial<Record<DefensiveCoverage, ObservedOutcome>>> | undefined,
  run: (dry: CoreContext, response: DelayResponse) => PossessionCoreResult = runDelayPhase,
): HandoffOverResponses {
  const weights = shownCoverageWeights<DefensiveCoverage>(shown, "drop");
  const byResponse = new Map<DelayResponse, FamilyOpportunity>();
  let expectedValue = 0;
  let decisionSeconds = 0;
  for (const [c, w] of Object.entries(weights) as [DefensiveCoverage, number][]) {
    const r = delayResponseFor(c);
    if (!byResponse.has(r)) byResponse.set(r, familyOpportunity(projectFamilyRead(ctx, (dry) => run(dry, r))));
    const o = byResponse.get(r)!;
    expectedValue += w * (o.viable ? o.value : 0);
    // Sin lectura proyectada (el reloj se acaba antes): no hay lectura antes del fin del reloj.
    decisionSeconds += w * (o.tDecisionSeconds ?? ctx.shotClockMs / 1000);
  }
  const valueByResponse: Partial<Record<DelayResponse, number>> = {};
  for (const [r, o] of byResponse) valueByResponse[r] = o.viable ? o.value : 0;
  const base = byResponse.get("hundirse") ?? familyOpportunity(projectFamilyRead(ctx, (dry) => run(dry, "hundirse")));
  return { expectedValue, decisionSeconds, valueByResponse, weights, base };
}

/**
 * Variante encadenada que llama el ataque en Horns (`seleccion_variante`,
 * LAB-0.9): `ninguna` o `spain` por orden; `auto` compara la ficha base y
 * Spain con la misma proyección frente a la defensa observada (empate: la
 * base). Se decide antes de ver la cobertura: es la llamada de la jugada.
 */
function resolveChainedVariant(ctx: CoreContext, scenario: ScenarioDefinition, shown: Readonly<Partial<Record<DefensiveCoverage, ObservedOutcome>>> | undefined): boolean {
  const choice = ctx.input.chainedVariant ?? "ninguna";
  if (choice !== "auto") {
    const spain = choice === "spain";
    auditDecision(ctx, 0, {
      point: "seleccion_variante",
      holderId: "O1",
      participants: ["O1", "O3", "O5"],
      chosenOptionId: spain ? "horns_spain" : "horns_bloqueo",
      options: [
        { id: "horns_bloqueo", status: spain ? "no_evaluada_por_cortocircuito" : "elegida", reasonCode: spain ? "not_evaluated_short_circuit" : "variant_forced_by_plan", values: { choice } },
        { id: "horns_spain", status: spain ? "elegida" : "no_evaluada_por_cortocircuito", reasonCode: spain ? "variant_forced_by_plan" : "not_evaluated_short_circuit", values: { choice } },
      ],
    });
    return spain;
  }
  const plain = projectBloqueoOverShownCoverages(ctx, scenario, shown);
  const spain = projectSpainOverShownCoverages(ctx, scenario, plain);
  const spainChosen = spain.expectedValue > plain.expectedValue;
  const values = (v: Readonly<Partial<Record<DefensiveCoverage, number>>>, ev: number): Record<string, number | string | boolean | null> => {
    const out: Record<string, number | string | boolean | null> = { choice, expectedValueOverShownCoverages: ev };
    for (const [c, x] of Object.entries(v)) out[`valueAgainst_${c}`] = x ?? null;
    for (const [c, w] of Object.entries(plain.weights)) out[`coverageWeight_${c}`] = w ?? null;
    return out;
  };
  auditDecision(ctx, 0, {
    point: "seleccion_variante",
    holderId: "O1",
    participants: ["O1", "O3", "O5"],
    chosenOptionId: spainChosen ? "horns_spain" : "horns_bloqueo",
    options: [
      { id: "horns_bloqueo", status: spainChosen ? "descartada_por_condicion" : "elegida", reasonCode: spainChosen ? "variant_projected_value_lower" : "variant_projected_value_higher", values: values(plain.valueByCoverage, plain.expectedValue) },
      { id: "horns_spain", status: spainChosen ? "elegida" : "descartada_por_condicion", reasonCode: spainChosen ? "variant_projected_value_higher" : "variant_projected_value_lower", values: values(spain.valueByCoverage, spain.expectedValue) },
    ],
  });
  return spainChosen;
}

function coverageExpectationAuditValues(p: BloqueoOverCoverages): Record<string, number | string | boolean | null> {
  const out: Record<string, number | string | boolean | null> = { expectedValueOverShownCoverages: p.expectedValue };
  for (const [c, w] of Object.entries(p.weights)) out[`coverageWeight_${c}`] = w ?? null;
  for (const [c, v] of Object.entries(p.valueByCoverage)) out[`valueAgainst_${c}`] = v ?? null;
  return out;
}

/**
 * Valor proyectado de la acción organizada con una asignación de roles
 * concreta (ME-07B v2 §2.4, primitiva de asignación de funciones): la misma
 * proyección en seco que usa el selector de familia (§2.2), desde las
 * posiciones que ocuparán los diez al estar situados, sin azar, hechos ni
 * auditoría. Permite comparar quién crea y quién bloquea con la misma
 * frontera y los mismos costes, en vez de devolver siempre el balón al rol
 * fijo O1 del orden del quinteto.
 */
export interface OrganizedProjection {
  readonly value: number;
  readonly plan: OffensivePlan;
  readonly bestReadOption: string | null;
  /**
   * Segundos desde que los cinco están situados hasta la primera lectura real
   * de la ficha (esperados con los mismos pesos que el valor). Es la frontera
   * con la que se desempata entre fichas (sesión v2-6, §2.2): Delay necesita
   * pase de entrada y entrega antes de leer; el bloqueo, solo la pantalla.
   */
  readonly decisionSeconds: number;
  /** Desglose auditable (valor frente a cada cobertura/respuesta vista, su peso y la mejor vía ante el plan base). */
  readonly breakdown: Readonly<Record<string, number | string | null>>;
}

function breakdownOf(
  valueBy: Readonly<Partial<Record<string, number>>>,
  weights: Readonly<Partial<Record<string, number>>>,
  base: FamilyOpportunity | null,
): Record<string, number | string | null> {
  const out: Record<string, number | string | null> = {};
  for (const [c, v] of Object.entries(valueBy)) out[`valueAgainst_${c}`] = v ?? null;
  for (const [c, w] of Object.entries(weights)) out[`coverageWeight_${c}`] = w ?? null;
  if (base) {
    out.baseBestRead = base.bestOptionId;
    out.baseBestReadRawValue = base.bestRawValue;
    out.baseBestReadCompletion = base.bestCompletion;
    out.baseDecisionSeconds = base.tDecisionSeconds;
  }
  return out;
}

export function projectOrganizedOpportunity(
  input: MatchInput,
  linked: Omit<LinkedSegmentOptions, "rng" | "entry" | "legs">,
): OrganizedProjection {
  const scenario = getScenario(input.scenarioId);
  const positions: Record<string, Point2D> = {};
  const positionHistory: Record<string, PositionHistoryEntry[]> = {};
  for (const slot of [...scenario.offense, ...scenario.defense]) {
    const start = linked.startPositions[slot.playerId];
    if (!start) throw new Error(`Falta la posición de partida del rol ${slot.playerId}`);
    positions[slot.playerId] = start;
    positionHistory[slot.playerId] = [{ atMs: 0, position: start }];
  }
  const ctx: CoreContext = {
    input,
    rng: DRY_RUN_RNG,
    timeline: [],
    sequence: 0,
    positions,
    positionHistory,
    gameClockMs: linked.gameClockMs,
    shotClockMs: linked.shotClockMs,
    possessionPhase: 0,
    resolvedCoverage: "drop",
    linked: {
      binding: linked.binding,
      priority: linked.attackingPriority,
      balancers: new Set(),
      rules: linked.rules ?? null,
      containment: null,
      firstGestureSeconds: Infinity,
    },
    audit: createNoopAuditCollector(),
    auditMeta: null,
    projecting: true,
    set: pnrSetGeometry(input.screenPlacement ?? "central"),
  };
  const planChoice: OffensivePlanChoice = input.offensivePlan ?? "bloqueo_directo";
  if (ctx.set.placement === "delay") {
    // LAB-0.10: Delay se proyecta frente a cada respuesta a la entrega que el rival ha mostrado.
    const delay = projectDelayOverShownCoverages(ctx, linked.observations?.defenseByHandoffResponse);
    return { value: Math.max(0, delay.expectedValue), plan: "mano_a_mano_sin_balon", bestReadOption: delay.base.bestOptionId, decisionSeconds: delay.decisionSeconds, breakdown: breakdownOf(delay.valueByResponse, delay.weights, delay.base) };
  }
  // ME-07B v2 §2.2/§5: el bloqueo se valora frente a la defensa observada, no solo contra drop.
  const bloqueo =
    planChoice === "mano_a_mano_sin_balon" ? null : projectBloqueoOverShownCoverages(ctx, scenario, linked.observations?.defenseByCoverage);
  // Sesión v2-8: la mano a mano central también se proyecta frente a las respuestas a la entrega vistas.
  const handoff =
    planChoice === "bloqueo_directo" || ctx.set.placement !== "central" ? null : projectDelayOverShownCoverages(ctx, linked.observations?.defenseByHandoffResponse, runHandoffPhase);
  if (handoff && (!bloqueo || handoff.expectedValue > bloqueo.expectedValue)) {
    return { value: Math.max(0, handoff.expectedValue), plan: "mano_a_mano_sin_balon", bestReadOption: handoff.base.bestOptionId, decisionSeconds: handoff.decisionSeconds, breakdown: breakdownOf(handoff.valueByResponse, handoff.weights, handoff.base) };
  }
  // ME-07B v2 §4 (LAB-0.9): en Horns, la variante Spain compite (o se impone) con la misma proyección.
  const variant = input.chainedVariant ?? "ninguna";
  if (ctx.set.placement === "horns" && variant !== "ninguna") {
    const spain = projectSpainOverShownCoverages(ctx, scenario, bloqueo!);
    const spainWins = variant === "spain" || spain.expectedValue > bloqueo!.expectedValue;
    const value = spainWins ? spain.expectedValue : bloqueo!.expectedValue;
    return {
      value: Math.max(0, value),
      plan: "bloqueo_directo",
      bestReadOption: bloqueo!.drop.bestOptionId,
      decisionSeconds: spainWins ? spain.decisionSeconds : bloqueo!.decisionSeconds,
      breakdown: { ...breakdownOf(spainWins ? spain.valueByCoverage : bloqueo!.valueByCoverage, bloqueo!.weights, bloqueo!.drop), spainCalled: spainWins ? "si" : "no" },
    };
  }
  return { value: Math.max(0, bloqueo!.expectedValue), plan: "bloqueo_directo", bestReadOption: bloqueo!.drop.bestOptionId, decisionSeconds: bloqueo!.decisionSeconds, breakdown: breakdownOf(bloqueo!.valueByCoverage, bloqueo!.weights, bloqueo!.drop) };
}

export function computePossessionCore(
  input: MatchInput,
  options: ComputePossessionCoreOptions = {},
): PossessionCoreResult {
  const linked = options.linked ?? null;
  const rng = linked ? linked.rng : createSeededRandom(input.seed);
  const scenario = getScenario(input.scenarioId);
  const trackPositionHistory = linked ? true : (options.trackPositionHistory ?? false);

  const positions: Record<string, Point2D> = {};
  const positionHistory: Record<string, PositionHistoryEntry[]> | null = trackPositionHistory ? {} : null;

  for (const slot of [...scenario.offense, ...scenario.defense]) {
    // Modo enlazado: la posición de partida es la real heredada, nunca la
    // del fixture (ME-03 §2).
    const start = linked ? linked.startPositions[slot.playerId] : slot.initialPosition;
    if (!start) throw new Error(`Falta la posición de partida del rol ${slot.playerId}`);
    positions[slot.playerId] = start;
    if (positionHistory) {
      positionHistory[slot.playerId] = [{ atMs: 0, position: start }];
    }
  }

  const ctx: CoreContext = {
    input,
    rng,
    timeline: [],
    sequence: 0,
    positions,
    positionHistory,
    gameClockMs: linked ? linked.gameClockMs : scenario.initialGameClockMs,
    shotClockMs: linked ? linked.shotClockMs : scenario.initialShotClockMs,
    possessionPhase: 0,
    // Valor provisional para entradas enlazadas (`direct_finish`/
    // `free_throws`) que no llegan a consultar la cobertura; se resuelve de
    // verdad más abajo antes de despachar al árbol organizado.
    resolvedCoverage: input.coverage === "auto" ? "drop" : input.coverage,
    linked: linked
      ? {
          binding: linked.binding,
          priority: linked.attackingPriority,
          balancers: new Set(),
          rules: linked.rules ?? null,
          containment: null,
          firstGestureSeconds: Infinity,
        }
      : null,
    audit: options.audit ?? createNoopAuditCollector(),
    auditMeta: linked
      ? { t0: linked.t0 ?? 0, possessionIndex: linked.possessionIndex ?? null, phaseIndex: linked.phaseIndex ?? null }
      : null,
    set: pnrSetGeometry(input.screenPlacement ?? "central"),
  };

  if (linked) {
    for (const [slot, leg] of Object.entries(linked.legs ?? {})) {
      redirect(ctx, slot, leg.departSeconds, leg.arriveSeconds, leg.to);
    }
    if (linked.entry.kind === "direct_finish") {
      return runDirectFinish(ctx, linked.entry);
    }
    if (linked.entry.kind === "free_throws") {
      return runFreeThrowSeries(ctx, {
        shooterId: linked.entry.shooterSlot,
        count: linked.entry.count,
        atSeconds: 0,
        basketCounted: false,
        basketPoints: 0,
        liveReboundOnLastMiss: linked.entry.liveReboundOnLastMiss,
      });
    }
  }

  const planChoice: OffensivePlanChoice = ctx.input.offensivePlan ?? "bloqueo_directo";
  let resolvedPlan: OffensivePlan;
  let spainCalled = false;
  if (ctx.set.placement !== "central") {
    // LAB-0.7/LAB-0.8: las colocaciones lateral y Horns son del bloqueo
    // directo; quien la eligió (`colocacion_bloqueo`, al organizar) ya la
    // comparó con la central, que es donde se juega la mano a mano.
    // LAB-0.10: Delay es de la entrega en mano (familia mano a mano).
    const placement = ctx.set.placement;
    resolvedPlan = placement === "delay" ? "mano_a_mano_sin_balon" : "bloqueo_directo";
    // ME-07B v2 §4 (LAB-0.9): desde Horns, el ataque llama o no la variante Spain.
    spainCalled = placement === "horns" && resolveChainedVariant(ctx, scenario, linked?.observations?.defenseByCoverage);
    auditDecision(ctx, 0, {
      point: "seleccion_familia",
      holderId: "O1",
      participants: ["O1", "O2", "O3", "O4", "O5"],
      chosenOptionId: resolvedPlan,
      options:
        placement === "delay"
          ? [
              { id: "bloqueo_directo", status: "no_evaluada_por_cortocircuito", reasonCode: "family_not_in_card_placement", values: { placement, cardId: null } },
              { id: "mano_a_mano_sin_balon", status: "elegida", reasonCode: "placement_forced_by_plan", values: { placement, cardId: cardFor("mano_a_mano_sin_balon", placement).id } },
            ]
          : [
              { id: "bloqueo_directo", status: "elegida", reasonCode: "placement_forced_by_plan", values: { placement, cardId: cardFor("bloqueo_directo", placement, spainCalled ? "spain" : null).id } },
              { id: "mano_a_mano_sin_balon", status: "no_evaluada_por_cortocircuito", reasonCode: placement === "lateral" ? "family_not_in_lateral_placement" : "family_not_in_card_placement", values: { placement, cardId: null } },
            ],
    });
  } else if (planChoice === "auto") {
    // ME-06 §3.2: evaluación pura de la oportunidad de entrada de cada
    // familia desde el estado real heredado, sin RNG y sin ejecutar la vía
    // descartada. Solo se ejecuta (con su propio árbol de lectura, sorteos
    // y hechos) la familia elegida aquí.
    // ME-07B v2 §2.2: cada familia se proyecta con su propia ejecución, en
    // seco, hasta su primera lectura real (misma frontera temporal, mismas
    // respuestas defensivas y mismos costes de pase), en vez de dos
    // estimadores distintos que suponían recepciones limpias futuras.
    // ME-07B v2 §2.2/§5: el bloqueo se proyecta frente a cada cobertura que
    // el rival ha mostrado, ponderada por su frecuencia observada (antes,
    // solo contra drop); la mano a mano no depende de la cobertura.
    const bloqueoOverCoverages = projectBloqueoOverShownCoverages(ctx, scenario, linked?.observations?.defenseByCoverage);
    const bloqueoOpportunity = bloqueoOverCoverages.drop;
    const bloqueoViable = bloqueoOpportunity.viable || bloqueoOverCoverages.expectedValue > 0;
    // Sesión v2-8: la mano a mano se proyecta frente a las respuestas a la entrega que el rival ha mostrado.
    const handoffOverResponses = projectDelayOverShownCoverages(ctx, linked?.observations?.defenseByHandoffResponse, runHandoffPhase);
    const handoffOpportunity: FamilyOpportunity = { ...handoffOverResponses.base, viable: handoffOverResponses.base.viable || handoffOverResponses.expectedValue > 0 };
    // ME-07B v2 §5: el ataque combina esa proyección con lo que ya ha visto
    // en este partido de cada familia (puntos por uso), LAB-0.4.
    const seenFamily = linked?.observations?.offenseByFamily;
    const bloqueoBlended = bloqueoViable ? blendProjectionWithObservation(bloqueoOverCoverages.expectedValue, seenFamily?.bloqueo_directo) : -Infinity;
    const handoffBlended = handoffOpportunity.viable ? blendProjectionWithObservation(handoffOverResponses.expectedValue, seenFamily?.mano_a_mano_sin_balon) : -Infinity;
    // Empate exacto: regla estable vinculada a las opciones reales (no una
    // alternancia por número de posesión) — se conserva el bloqueo directo,
    // la familia central ya versionada.
    resolvedPlan = handoffBlended > bloqueoBlended ? "mano_a_mano_sin_balon" : "bloqueo_directo";
    auditDecision(ctx, 0, {
      point: "seleccion_familia",
      holderId: "O1",
      participants: ["O1", "O2", "O3", "O4", "O5"],
      chosenOptionId: resolvedPlan,
      options: [
        {
          id: "bloqueo_directo",
          status: resolvedPlan === "bloqueo_directo" ? "elegida" : "descartada_por_condicion",
          reasonCode: resolvedPlan === "bloqueo_directo" ? "family_opportunity_higher" : "family_opportunity_lower",
          values: {
            ...familyAuditValues(bloqueoOpportunity),
            cardId: "bloqueo_directo_central",
            // `situationalValue` y la mejor vía son la proyección contra drop;
            // la comparación usa el valor esperado frente a lo observado.
            projectedCoverage: "observada",
            ...coverageExpectationAuditValues(bloqueoOverCoverages),
            observedUses: seenFamily?.bloqueo_directo?.uses ?? 0,
            observedPoints: seenFamily?.bloqueo_directo?.points ?? 0,
            blendedValue: bloqueoBlended,
          },
        },
        {
          id: "mano_a_mano_sin_balon",
          status: resolvedPlan === "mano_a_mano_sin_balon" ? "elegida" : "descartada_por_condicion",
          reasonCode: resolvedPlan === "mano_a_mano_sin_balon" ? "family_opportunity_higher" : "family_opportunity_lower",
          values: {
            ...familyAuditValues(handoffOpportunity),
            cardId: "mano_a_mano_central",
            projectedCoverage: "observada",
            expectedValueOverShownResponses: handoffOverResponses.expectedValue,
            ...Object.fromEntries(Object.entries(handoffOverResponses.valueByResponse).map(([r, v]) => [`valueAgainst_${r}`, v ?? null])),
            observedUses: seenFamily?.mano_a_mano_sin_balon?.uses ?? 0,
            observedPoints: seenFamily?.mano_a_mano_sin_balon?.points ?? 0,
            blendedValue: handoffBlended,
          },
        },
      ],
    });
  } else {
    resolvedPlan = planChoice;
    auditDecision(ctx, 0, {
      point: "seleccion_familia",
      holderId: "O1",
      participants: ["O1", "O2", "O3", "O4", "O5"],
      chosenOptionId: resolvedPlan,
      options: [
        { id: "bloqueo_directo", status: resolvedPlan === "bloqueo_directo" ? "elegida" : "no_evaluada_por_cortocircuito", reasonCode: resolvedPlan === "bloqueo_directo" ? "family_forced_by_plan" : "not_evaluated_short_circuit", values: { cardId: "bloqueo_directo_central" } },
        { id: "mano_a_mano_sin_balon", status: resolvedPlan === "mano_a_mano_sin_balon" ? "elegida" : "no_evaluada_por_cortocircuito", reasonCode: resolvedPlan === "mano_a_mano_sin_balon" ? "family_forced_by_plan" : "not_evaluated_short_circuit", values: { cardId: "mano_a_mano_central" } },
      ],
    });
  }

  const coverageChoice: DefensiveCoverageChoice = ctx.input.coverage;
  let delayResponse: DelayResponse | null = null;
  // Sesión v2-8: la mano a mano central es también una entrega en mano y la defensa responde con
  // las mismas tres respuestas que en Delay (antes elegía una cobertura de pantalla que la entrega
  // solo consultaba para la trampa).
  const handoffRunner = ctx.set.placement === "delay" ? runDelayPhase : resolvedPlan === "mano_a_mano_sin_balon" ? runHandoffPhase : null;
  if (handoffRunner) {
    // LAB-0.10: ante la entrega en mano solo aplican tres respuestas (hundirse,
    // cambiar o saltar la entrega); en `auto`, la de menor concesión proyectada.
    const responses: readonly DelayResponse[] = ["hundirse", "cambiar_entrega", "saltar_entrega"];
    if (coverageChoice === "auto") {
      // Sesión v2-6: lo que esta defensa ha concedido ante la entrega, no ante pantallas.
      const seenCoverage = linked?.observations?.defenseByHandoffResponse;
      const projected = responses.map((r) => familyOpportunity(projectFamilyRead(ctx, (dry) => handoffRunner(dry, r))));
      const blended = projected.map((o, i) => blendProjectionWithObservation(o.viable ? o.value : 0, seenCoverage?.[DELAY_RESPONSE_COVERAGE[responses[i]!]]));
      let best = 0;
      for (let i = 1; i < responses.length; i++) if (blended[i]! < blended[best]!) best = i;
      delayResponse = responses[best]!;
      ctx.resolvedCoverage = DELAY_RESPONSE_COVERAGE[delayResponse];
      const ALL: readonly DefensiveCoverage[] = ["drop", "trampa", "cambio", "show", "a_la_altura", "por_debajo", "ice"];
      auditDecision(ctx, 0, {
        point: "seleccion_cobertura",
        holderId: null,
        participants: ["D1", "D5"],
        chosenOptionId: ctx.resolvedCoverage,
        options: ALL.map((c): AuditOptionRecord => {
          const i = responses.findIndex((r) => DELAY_RESPONSE_COVERAGE[r] === c);
          if (i < 0) return { id: c, status: "descartada_por_condicion", reasonCode: "coverage_not_in_card", values: { delayResponse: delayResponseFor(c) } };
          return {
            id: c,
            status: i === best ? "elegida" : "descartada_por_condicion",
            reasonCode: i === best ? (blended.some((v, j) => j !== i && v === blended[i]) ? "coverage_tied_base_kept" : "coverage_lower_concession") : "coverage_higher_concession",
            values: { delayResponse: responses[i]!, concessionValue: projected[i]!.viable ? projected[i]!.value : 0, offenseBestReadOption: projected[i]!.bestOptionId, blendedValue: blended[i]! },
          };
        }),
      });
    } else {
      ctx.resolvedCoverage = coverageChoice;
      delayResponse = delayResponseFor(coverageChoice);
      if (coverageChoice !== "drop" && coverageChoice !== "cambio" && coverageChoice !== "show" && coverageChoice !== "trampa") {
        event(ctx, 0, "reconocido", "coverage_not_applicable", [ctx.set.placement === "delay" ? "D1" : "D2", "D5"], "La orden es de pantalla, pero la acción es una entrega en mano: D5 se hunde entre O5 y el aro.", { coverage: coverageChoice, delayResponse });
      }
    }
  } else if (coverageChoice === "auto") {
    const estimate = estimateCoverageChoice(ctx, scenario);
    // ME-07B v2 §2.3/§5: la defensa combina la concesión proyectada de cada
    // cobertura con lo que ya ha concedido de verdad con ella en este
    // partido; gana la menor concesión combinada entre las elegibles. Empate
    // exacto: se conserva el orden de plan base (drop, trampa, cambio, show).
    const seenCoverage = linked?.observations?.defenseByCoverage;
    const candidates: { id: DefensiveCoverage; eligible: boolean; projected: number; values: Record<string, number | string | boolean | null> }[] = [
      { id: "drop", eligible: true, projected: estimate.dropConcessionValue, values: { offenseBestReadOption: estimate.dropBestReadOption } },
      {
        id: "trampa",
        eligible: estimate.trapEligible,
        projected: estimate.trapConcessionValue,
        values: {
          trapEligible: estimate.trapEligible,
          projectedBranch: estimate.trap?.branch ?? null,
          stealProbability: estimate.trap?.stealProbability ?? null,
          tD5TrapArrivalSeconds: estimate.trap?.tD5TrapArrivalSeconds ?? null,
          tPassArrivalToO5Seconds: estimate.trap?.tPassArrivalToO5Seconds ?? null,
        },
      },
      { id: "cambio", eligible: estimate.switchProjection.viable, projected: estimate.switchProjection.value, values: { offenseBestReadOption: estimate.switchProjection.bestOptionId } },
      { id: "show", eligible: estimate.showProjection.viable, projected: estimate.showProjection.value, values: { offenseBestReadOption: estimate.showProjection.bestOptionId } },
      { id: "a_la_altura", eligible: estimate.atLevelProjection.viable, projected: estimate.atLevelProjection.value, values: { offenseBestReadOption: estimate.atLevelProjection.bestOptionId } },
      { id: "por_debajo", eligible: estimate.underProjection.viable, projected: estimate.underProjection.value, values: { offenseBestReadOption: estimate.underProjection.bestOptionId } },
      {
        id: "ice",
        eligible: estimate.iceEligible && (estimate.iceProjection?.viable ?? false),
        projected: estimate.iceProjection?.value ?? Infinity,
        values: { lateralScreen: estimate.iceEligible, offenseBestReadOption: estimate.iceProjection?.bestOptionId ?? null },
      },
    ];
    // ME-07A §4: una cobertura cuya concesión proyectada es indistinguible de
    // la de drop no es una alternativa distinta: se conserva drop como plan
    // base (evita elegirla solo por ruido de lo observado).
    const indistinguishable = (c: (typeof candidates)[number]) => c.id !== "drop" && c.eligible && Math.abs(c.projected - estimate.dropConcessionValue) < 1e-9;
    const blended = candidates.map((c) => (c.eligible && !indistinguishable(c) ? blendProjectionWithObservation(c.projected, seenCoverage?.[c.id]) : Infinity));
    let bestIndex = 0;
    for (let i = 1; i < candidates.length; i++) if (blended[i]! < blended[bestIndex]!) bestIndex = i;
    ctx.resolvedCoverage = candidates[bestIndex]!.id;
    auditDecision(ctx, 0, {
      point: "seleccion_cobertura",
      holderId: null,
      participants: ["D1", "D5"],
      chosenOptionId: ctx.resolvedCoverage,
      options: candidates.map((c, i) => ({
        id: c.id,
        status: i === bestIndex ? "elegida" : "descartada_por_condicion",
        reasonCode: indistinguishable(c)
          ? "coverage_tied_base_kept"
          : !c.eligible
          ? c.id === "trampa"
            ? "coverage_trap_not_eligible"
            : c.id === "ice" && !estimate.iceEligible
              ? "coverage_ice_central_not_eligible"
              : "read_option_not_viable"
          : i === bestIndex
            ? blended.some((v, j) => j !== i && v === blended[i])
              ? "coverage_tied_base_kept"
              : "coverage_lower_concession"
            : "coverage_higher_concession",
        values: {
          ...c.values,
          concessionValue: Number.isFinite(c.projected) ? c.projected : null,
          observedUses: seenCoverage?.[c.id]?.uses ?? 0,
          observedPoints: seenCoverage?.[c.id]?.points ?? 0,
          blendedValue: Number.isFinite(blended[i]!) ? blended[i]! : null,
        },
      })),
    });
  } else {
    ctx.resolvedCoverage = coverageChoice;
  }

  const placementAtEntry = ctx.set.placement;
  let spainRead: ReturnType<typeof readSpainBackScreen> | null = null;
  if (spainCalled) {
    // Lectura del bloqueador ciego (LAB-0.9): ¿hay a quién bloquear?
    spainRead = readSpainBackScreen(ctx);
    const goes = spainRead.timing !== null;
    auditDecision(ctx, 0, {
      point: "lectura_spain_bloqueador",
      holderId: "O1",
      participants: ["O3", "D5"],
      chosenOptionId: goes ? "bloqueo_ciego" : "quedarse_en_codo",
      options: [
        { id: "bloqueo_ciego", status: goes ? "elegida" : "descartada_por_condicion", reasonCode: spainRead.reason, values: spainRead.values },
        { id: "quedarse_en_codo", status: goes ? "descartada_por_condicion" : "elegida", reasonCode: goes ? "back_screen_target_present" : spainRead.reason, values: spainRead.values },
      ],
    });
  }
  const organized =
    delayResponse && handoffRunner
      ? handoffRunner(ctx, delayResponse)
      : spainRead?.timing
      ? runSpainPhase(ctx, ctx.resolvedCoverage === "por_debajo" ? "por_debajo" : "por_encima", spainRead.timing)
      : ctx.resolvedCoverage === "trampa"
        ? runTrapPhase(ctx)
        : ctx.resolvedCoverage === "cambio"
          ? runSwitchPhase(ctx)
          : ctx.resolvedCoverage === "show"
            ? runShowPhase(ctx, scenario)
            : ctx.resolvedCoverage === "a_la_altura"
              ? runShowPhase(ctx, scenario, "a_la_altura")
            : ctx.resolvedCoverage === "por_debajo"
              ? runDropPhase(ctx, scenario, "por_debajo")
              : ctx.resolvedCoverage === "ice"
                ? runIcePhase(ctx, scenario)
                : runDropPhase(ctx, scenario);
  return { ...organized, organizedChoice: { plan: resolvedPlan, coverage: ctx.resolvedCoverage, card: cardFor(resolvedPlan, placementAtEntry, spainCalled ? "spain" : null).id } };
}

/**
 * Ejecución enlazada de una finalización cercana decidida fuera del árbol
 * del bloqueo (ventaja temprana o segunda oportunidad, ME-03 §3-§4): pase
 * opcional sin defensor elegible en la línea (quien llama ya comprobó que
 * ningún defensor llega antes que el balón) y lanzamiento con el mismo
 * `resolveShotAttempt` que el resto de ramas.
 */
function runDirectFinish(
  ctx: CoreContext,
  entry: Extract<LinkedEntry, { kind: "direct_finish" }>,
): PossessionCoreResult {
  const shooter = player(ctx, entry.shooterSlot);
  let tCatch = entry.shooterAtSpotSeconds;
  let readyDelay = 0;

  if (entry.pass) {
    const passer = player(ctx, entry.pass.passerSlot);
    event(
      ctx,
      entry.pass.releaseSeconds,
      "ejecutado",
      "pass_released",
      [entry.pass.passerSlot, entry.shooterSlot],
      `${entry.pass.passerSlot} adelanta el balón a ${entry.shooterSlot}, que corre hacia el aro.`,
    );
    const outcome = resolvePass(passer.attributes.T09, shooter.attributes.T11, false, 0, 0, ctx.rng);
    readyDelay = outcome.kind === "awkward_control" ? outcome.extraDelaySeconds : 0;
    event(
      ctx,
      entry.pass.arrivalSeconds,
      "concedido",
      "pass_received",
      [entry.shooterSlot],
      readyDelay > 0
        ? `${entry.shooterSlot} recibe en carrera con control incómodo.`
        : `${entry.shooterSlot} recibe en carrera.`,
    );
    tCatch = Math.max(entry.shooterAtSpotSeconds, entry.pass.arrivalSeconds);
  }

  const shotType = entry.shotType ?? "close_finish";
  const prepSeconds =
    entry.prepSeconds ?? (shotType === "three_point" || shotType === "mid_range" ? CATCH_AND_SHOOT_PREP_SECONDS : CLOSE_FINISH_PREP_SECONDS);
  return resolveShotAttempt(ctx, {
    shooterId: entry.shooterSlot,
    shooterSkill: shotSkill(shooter, shotType),
    shotType,
    shooterPos: entry.finishSpot,
    tReady: tCatch + readyDelay + prepSeconds,
    prepSeconds,
    contesterId: entry.contesterSlot,
    contesterArrival: entry.contesterArrivalSeconds,
    contesterGeometry: entry.contesterGeometry,
  });
}

/**
 * Violación del reloj de lanzamiento en modo enlazado (ME-03 §3): el
 * balón muere en el instante exacto en que se agota el reloj, nunca con
 * tiempo negativo. Se descartan los hechos y llegadas posteriores, que ya
 * no pudieron ocurrir.
 */
function linkedShotClockViolation(ctx: CoreContext, holderSlot: string): PossessionCoreResult {
  const expirySeconds = ctx.shotClockMs / 1000;
  const expiryMs = ctx.shotClockMs;
  for (let i = ctx.timeline.length - 1; i >= 0; i--) {
    if (ctx.timeline[i]!.atMs > expiryMs) ctx.timeline.splice(i, 1);
  }
  if (ctx.positionHistory) {
    for (const id of Object.keys(ctx.positionHistory)) {
      ctx.positionHistory[id] = truncateTrajectory(ctx.positionHistory[id]!, expiryMs);
      ctx.positions[id] = historyPositionAt(ctx, id, expirySeconds);
    }
  }
  const ballPos = historyPositionAt(ctx, holderSlot, expirySeconds);
  event(
    ctx,
    expirySeconds,
    "concedido",
    "shot_clock_violation",
    [holderSlot],
    `Se agota el reloj de lanzamiento con el balón en poder de ${holderSlot}: violación, balón muerto.`,
  );
  return finalize(ctx, { kind: "shot_clock_violation" }, { status: "dead", holderId: null, position: ballPos });
}

/**
 * Plan de ayuda al continuador («tag», ME-07B v2 §2.4): D3 sale desde la
 * esquina débil hacia el short roll tras reconocer el bloqueo (M01/M05,
 * T23) y D4 rota a la esquina que D3 deja (M01/M05, T22). Se calcula en
 * puro antes de decidir si se ejecuta; lo comparten drop y show.
 *
 * ME-07B v2 §4 (Horns): si D3 llegaría al punto del short roll **mientras
 * el continuador aún corre hacia él** y sin haber frenado antes del contacto,
 * no se mete en ese mismo punto: contiene a contacto del continuador, en su
 * línea de llegada (`pointShortOfTarget`, mismo criterio técnico que el punto
 * de uso de la pantalla: dos cuerpos no ocupan el mismo punto). Antes ambos
 * corrían al mismo punto y chocaban de frente en carrera: con el defensor
 * del segundo cuerno de Horns, a 2 m, cada ayuda era falta sin tiro. Si D3
 * llega antes y frenado, o después de que el continuador se detenga, nada
 * cambia (central y lateral de siempre).
 */
/**
 * Punto de contención del defensor que sale hacia el continuador: el propio
 * punto de llegada del continuador, salvo que el defensor fuera a llegar
 * mientras este aún corre y sin estar frenado antes del contacto (chocarían
 * en carrera): entonces se queda a contacto, en su línea de llegada.
 */
function containmentPoint(
  origin: Point2D,
  spot: Point2D,
  departSeconds: number,
  speedMps: number,
  brakingExtraSeconds: number,
  t23: PlayerProfile["attributes"]["T23"],
  roll: { readonly tRollReady: number; readonly speedMps: number },
): Point2D {
  const tAtSpot = Math.max(0, departSeconds + timeToReach(origin, spot, speedMps) - interiorArrivalAdjustmentSeconds(t23));
  // Entra en el radio de contacto del punto antes de que el continuador se
  // detenga, y no está frenado cuando este entra en ese radio: chocarían en carrera.
  const entersContactBeforeRollStops = tAtSpot - COMBINED_CONTACT_RADIUS_METERS / speedMps < roll.tRollReady;
  const notSetBeforeContact = tAtSpot + brakingExtraSeconds > roll.tRollReady - COMBINED_CONTACT_RADIUS_METERS / roll.speedMps;
  const collides = entersContactBeforeRollStops && notSetBeforeContact;
  return collides ? pointShortOfTarget(origin, spot, COMBINED_CONTACT_RADIUS_METERS) : spot;
}

interface HelpPlan {
  readonly origin: Point2D;
  /** Punto de contención de D3: a contacto del short roll en su línea de llegada. */
  readonly point: Point2D;
  readonly decision: number;
  readonly arrival: number;
  readonly geometry: ContestGeometry;
  readonly d4Start: number;
  readonly d4Arrival: number;
  readonly d4Geometry: ContestGeometry;
}

function buildTagHelpPlan(ctx: CoreContext, scenario: ScenarioDefinition, tUseScreen: number, roll: { readonly tRollReady: number; readonly speedMps: number }): HelpPlan {
  const d3 = player(ctx, "D3");
  const d4 = player(ctx, "D4");
  const tHelpDecision = scenario.startsWithHelpAlreadyCommitted ? 0 : tUseScreen + recognitionLatencySeconds(d3.attributes.M01, d3.attributes.M05);
  const d3HelpSpeed = defenderLateralSpeedMps(d3.attributes.F04);
  const d4RepairSpeed = defenderLateralSpeedMps(d4.attributes.F04);
  const d3StartPoint = scenario.startsWithHelpAlreadyCommitted ? ctx.set.shortRoll : ctx.positions.D3!;
  const helpPoint = containmentPoint(d3StartPoint, ctx.set.shortRoll, tHelpDecision, d3HelpSpeed, closeoutBrakingExtraSeconds(d3.attributes.F03), d3.attributes.T23, roll);
  const rawD3Arrival = scenario.startsWithHelpAlreadyCommitted ? 0.1 : tHelpDecision + timeToReach(d3StartPoint, helpPoint, d3HelpSpeed);
  const tD3Arrive = Math.max(0, rawD3Arrival - interiorArrivalAdjustmentSeconds(d3.attributes.T23));
  const d4OriginalPos = scenario.startsWithHelpAlreadyCommitted ? LATE_CLOSEOUT_D4_START : ctx.positions.D4!;
  const tD4Start = tD3Arrive + recognitionLatencySeconds(d4.attributes.M01, d4.attributes.M05);
  const tD4Arrive = Math.max(tD4Start, tD4Start + timeToReach(d4OriginalPos, ctx.set.helpLeftSpot, d4RepairSpeed) - perimeterArrivalAdjustmentSeconds(d4.attributes.T22));
  return {
    origin: d3StartPoint,
    point: helpPoint,
    decision: tHelpDecision,
    arrival: tD3Arrive,
    geometry: { originPos: d3StartPoint, destinationPos: helpPoint, speedMps: d3HelpSpeed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d3.attributes.F03) },
    d4Start: tD4Start,
    d4Arrival: tD4Arrive,
    d4Geometry: { originPos: d4OriginalPos, destinationPos: ctx.set.helpLeftSpot, speedMps: d4RepairSpeed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d4.attributes.F03) },
  };
}

/**
 * Lectura del receptor del continuador (ME-07B v2 §2.4, primitiva compartida
 * de §3 «lectura»): quien recibe en el short roll decide atacar el aro (T01),
 * soltar un floater por encima de la primera contención (T02) o invertir a la
 * esquina débil que dejó el ayudador (T04 del receptor de la inversión), cada
 * vía frente al mejor cierre real que pasa quien llama (drop, show o cambio
 * aportan sus propias trayectorias defensivas). Pura: la usan tanto la
 * proyección del pase como la lectura real al recibir, con su instante.
 */
type ReceiverOptionId = "finalizar_aro" | "flotadora" | "invertir_o3";
interface ReceiverOption {
  readonly id: ReceiverOptionId;
  readonly value: number;
  readonly shot: ShotAttemptArgs | null;
  readonly values: Record<string, number | string | boolean | null>;
}
interface RollReceiverEnv {
  readonly receiverId: string;
  readonly receiverPos: Point2D;
  readonly rimCandidates: readonly ContestCandidate[];
  readonly floaterCandidates: readonly ContestCandidate[];
  /** Inversión a la esquina débil, solo si el ayudador dejó a O3: quién puede desviar y quién cierra. */
  readonly invert: {
    readonly deflectorId: string;
    readonly closerId: string;
    readonly closerGeometry: ContestGeometry;
    readonly closerArrival: number;
    /**
     * Instante en que O3 llega al punto de la inversión (ME-07B v2 §4, Spain:
     * el bloqueador ciego aún se está abriendo al pop). Sin valor, ya está ahí.
     */
    readonly targetReadySeconds?: number;
  } | null;
}

function readRollReceiver(ctx: CoreContext, env: RollReceiverEnv, tAct: number): ReceiverOption[] {
  const receiver = player(ctx, env.receiverId);
  const pos = env.receiverPos;
  const clock = ctx.shotClockMs / 1000;
  const options: ReceiverOption[] = [];
  const tRimReady = tAct + timeToReach(pos, ATTACKED_HOOP, attackerMoveSpeedMps(receiver.attributes.F01)) + CLOSE_FINISH_PREP_SECONDS;
  const rim = bestContest(ctx, env.rimCandidates, ATTACKED_HOOP, tRimReady, CLOSE_FINISH_PREP_SECONDS)!;
  const rimValue = tRimReady < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, receiver.attributes.T01, rim.level) : -Infinity;
  options.push({
    id: "finalizar_aro",
    value: rimValue,
    shot: {
      shooterId: env.receiverId,
      shooterSkill: receiver.attributes.T01,
      shotType: "close_finish",
      shooterPos: ATTACKED_HOOP,
      tReady: tRimReady,
      prepSeconds: CLOSE_FINISH_PREP_SECONDS,
      contesterId: rim.id,
      contesterArrival: rim.arrival,
      contesterGeometry: rim.geometry,
    },
    values: { situationalValue: rimValue, contesterId: realId(ctx, rim.id), opposition: rim.level, readySeconds: tRimReady, rimOccupied: rim.occupied },
  });
  const tFloatReady = tAct + CLOSE_FINISH_PREP_SECONDS;
  const floater = bestContest(ctx, env.floaterCandidates, pos, tFloatReady, CLOSE_FINISH_PREP_SECONDS)!;
  const floaterValue =
    isFloaterZone(pos) && tFloatReady < clock ? 2 * shotProbability(shotBaseProbability("floater"), receiver.attributes.T02, floater.level) : -Infinity;
  options.push({
    id: "flotadora",
    value: floaterValue,
    shot: {
      shooterId: env.receiverId,
      shooterSkill: receiver.attributes.T02,
      shotType: "floater",
      shooterPos: pos,
      tReady: tFloatReady,
      prepSeconds: CLOSE_FINISH_PREP_SECONDS,
      contesterId: floater.id,
      contesterArrival: floater.arrival,
      contesterGeometry: floater.geometry,
    },
    values: { situationalValue: floaterValue, contesterId: realId(ctx, floater.id), opposition: floater.level, readySeconds: tFloatReady },
  });
  const inv = env.invert;
  const tInvertReady = Math.max(tAct + PASS_RELEASE_SECONDS + distanceSeconds(pos, ctx.set.helpLeftSpot), inv?.targetReadySeconds ?? 0) + CATCH_AND_SHOOT_PREP_SECONDS;
  const invertLevel = inv ? estimateContestLevel(ctx, inv.closerId, inv.closerGeometry, inv.closerArrival, ctx.set.helpLeftSpot, tInvertReady, CATCH_AND_SHOOT_PREP_SECONDS) : 1;
  const invertCompletion = inv ? 1 - deflectionProbability(player(ctx, inv.deflectorId).attributes.T17, receiver.attributes.T09) : 0;
  const invertValue = inv && tInvertReady < clock ? invertCompletion * helpLeftShotValue(ctx, invertLevel) : -Infinity;
  options.push({
    id: "invertir_o3",
    value: invertValue,
    shot: null,
    values: { situationalValue: invertValue, completion: invertCompletion, opposition: invertLevel, marginO3Seconds: inv ? inv.closerArrival - tInvertReady : null, d3LeftO3: inv !== null, shotType: helpLeftShotType(ctx) },
  });
  return options;
}

/** Elección del receptor: mayor valor; en la banda de empate decide su tendencia de tiro (ME-07A §2). */
/**
 * El receptor del roll no tiene ninguna vía viable porque el reloj de
 * lanzamiento expira antes de que cualquiera quede lista (sesión v2-6: un
 * pase al roll con menos de ~2 s, alcanzado en partido natural con la
 * pantalla lateral): se audita su lectura sin opción y la posesión termina
 * en violación de 24/14 s al expirar, como en el resto de ramas. Cualquier
 * otra lectura sin vía viable es un estado no modelado y se señala.
 */
function rollReceiverOutOfClock(ctx: CoreContext, tAct: number, options: readonly ReceiverOption[]): PossessionCoreResult | null {
  if (options.some((o) => Number.isFinite(o.value))) return null;
  const readies = options.map((o) => o.values?.readySeconds).filter((v): v is number => typeof v === "number");
  const clock = ctx.shotClockMs / 1000;
  if (readies.length === 0 || clock >= Math.min(...readies)) {
    throw new Error(`Lectura del receptor del roll sin vía viable con ${clock.toFixed(2)} s de reloj: estado no modelado.`);
  }
  auditDecision(ctx, tAct, {
    point: "lectura_segunda_o5",
    holderId: "O5",
    participants: ["O5"],
    chosenOptionId: null,
    options: options.map((o) => ({ id: o.id, status: "descartada_por_condicion", reasonCode: "receiver_option_not_viable", values: { ...o.values, shotClockSeconds: clock } })),
  });
  if (ctx.linked) return linkedShotClockViolation(ctx, "O5");
  return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: "O5", position: ctx.positions.O5! });
}

function chooseRollReceiverOption(ctx: CoreContext, receiverId: string, options: readonly ReceiverOption[]): { chosen: ReceiverOption; byTendency: boolean } {
  const viable = options.filter((o) => Number.isFinite(o.value)).sort((a, b) => b.value - a.value);
  let chosen = viable[0]!;
  let byTendency = false;
  const band = viable.filter((o) => chosen.value - o.value <= FIRST_READ_TIE_BAND_POINTS);
  if (band.length > 1) {
    const tendency = player(ctx, receiverId).shotTendency;
    const pick = tendency === "decidida" ? band.find((o) => o.shot !== null) : tendency === "prudente" ? band.find((o) => o.shot === null) : undefined;
    if (pick && pick !== chosen) {
      chosen = pick;
      byTendency = true;
    }
  }
  return { chosen, byTendency };
}

/**
 * Recorrido de D1 ante la pantalla en drop (ME-07B v2 §5): `por_encima`
 * navega por delante del bloqueo con el retraso real de la pantalla (drop de
 * siempre); `por_debajo` (under) pasa por detrás del bloqueador, entre él y
 * su defensor, sin ser bloqueado: no hay retraso de pantalla que cree el dos
 * contra uno (el pase al roll y la penetración quedan negados si D1 ya está
 * ahí), pero concede la preparación exterior de O1, que tira por encima del
 * bloqueo mientras D1 tiene que rodear al bloqueador para cerrar.
 */
type ScreenRoute = "por_encima" | "por_debajo";

/**
 * Camino de `from` a `to` rodeando un cuerpo en `obstacle` de radio `radius`
 * (un bloqueador): si el segmento recto pasa a menos de `radius` del
 * obstáculo, se rodea por el lado más corto a través de un punto desplazado
 * `radius` en perpendicular (`waypoint`); si no, el camino es recto
 * (`waypoint` nulo). Geometría pura, sin parámetro nuevo.
 */
function detourAround(from: Point2D, to: Point2D, obstacle: Point2D, radius: number): { readonly waypoint: Point2D | null; readonly length: number } {
  const straight = distance(from, to);
  if (straight <= 0) return { waypoint: null, length: 0 };
  const ux = (to.x - from.x) / straight;
  const uy = (to.y - from.y) / straight;
  const t = (obstacle.x - from.x) * ux + (obstacle.y - from.y) * uy;
  if (t <= 0 || t >= straight) return { waypoint: null, length: straight };
  const px = from.x + ux * t;
  const py = from.y + uy * t;
  const gap = Math.hypot(obstacle.x - px, obstacle.y - py);
  if (gap >= radius) return { waypoint: null, length: straight };
  const side = gap === 0 ? 1 : Math.sign((px - obstacle.x) * -uy + (py - obstacle.y) * ux) || 1;
  const waypoint = { x: obstacle.x - uy * radius * side, y: obstacle.y + ux * radius * side };
  return { waypoint, length: distance(from, waypoint) + distance(waypoint, to) };
}

function runDropPhase(ctx: CoreContext, scenario: ScenarioDefinition, d1Route: ScreenRoute = "por_encima"): PossessionCoreResult {
  const o1 = player(ctx, "O1");
  const o3 = player(ctx, "O3");
  const o5 = player(ctx, "O5");
  const d1 = player(ctx, "D1");
  const d3 = player(ctx, "D3");
  const d4 = player(ctx, "D4");
  const d5 = player(ctx, "D5");

  const screenPoint = ctx.positions.O5!;
  // Punto real de uso de la pantalla (ME-04B §3.1): O1 llega junto a O5, no
  // sobre su posición exacta (dos jugadores no ocupan el mismo punto). Es un
  // detalle técnico local y reversible del mismo bloqueo ya aprobado.
  const o1UsePoint = pointShortOfTarget(ctx.positions.O1!, screenPoint, COMBINED_CONTACT_RADIUS_METERS);

  // --- Pantalla ---------------------------------------------------------
  const tScreenSet = scenario.startsWithHelpAlreadyCommitted ? 0 : SCREEN_SET_AFTER_ARRIVAL_SECONDS;
  const tHandlerArrival = timeToReach(ctx.positions.O1!, o1UsePoint, attackerMoveSpeedMps(o1.attributes.F01));
  const tUseScreen = Math.max(tScreenSet, tHandlerArrival);
  event(ctx, tScreenSet, "ejecutado", "screen_set", ["O5"], `O5 llega y coloca su pantalla ${ctx.set.placement}.`, { placement: ctx.set.placement });

  const weightDiff = o5.measures.weightKg - d1.measures.weightKg;
  const screenDelay =
    screenInterceptDelaySeconds(o5.attributes.T13, o5.attributes.F05, d1.attributes.T16) +
    screenContactAdjustmentSeconds(weightDiff);
  const underRoute = d1Route === "por_debajo";
  // Por debajo, D1 pasa entre el bloqueador y su defensor (D5), sin tocar a
  // ninguno de los dos: el punto medio si caben dos contactos entre ellos; si
  // D5 está pegado a la pantalla, justo detrás del bloqueador hacia el aro.
  const d5AtScreen = ctx.positions.D5!;
  const underPoint =
    distance(screenPoint, d5AtScreen) >= 2 * COMBINED_CONTACT_RADIUS_METERS
      ? { x: (screenPoint.x + d5AtScreen.x) / 2, y: (screenPoint.y + d5AtScreen.y) / 2 }
      : moveToward(screenPoint, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS);
  const tD1UnderCall = recognitionLatencySeconds(d1.attributes.M01, d1.attributes.M05);
  const tD1Under = tD1UnderCall + distance(ctx.positions.D1!, underPoint) / defenderLateralSpeedMps(d1.attributes.F04);
  // Punto e instante en que D1 queda de nuevo en disposición de defender a O1.
  const d1SetPoint = underRoute ? underPoint : o1UsePoint;
  const tD1Set = underRoute ? tD1Under : tUseScreen + screenDelay;
  event(
    ctx,
    tUseScreen,
    "ejecutado",
    "screen_navigated",
    ["O1", "D1"],
    underRoute
      ? `O1 usa la pantalla de O5; D1 pasa por debajo del bloqueo, entre O5 y su defensor.`
      : `O1 usa la pantalla de O5; D1 navega con un retraso de ${screenDelay.toFixed(2)} s.`,
    underRoute ? { screenDelay: 0, route: "por_debajo", underPoint } : { screenDelay },
  );
  // O1 se desplaza de verdad hasta el punto de uso de la pantalla, saliendo
  // desde el principio del tramo de cálculo (nadie más lo mueve antes); si
  // llega antes de que la pantalla esté lista (`tHandlerArrival < tScreenSet`)
  // espera ahí, sin teletransportarse a un punto de paso que coincidiera con
  // `tUseScreen`. D1 lo sigue con el retraso real de navegación
  // (`screenDelay`) desde el instante en que el bloqueo se usa de verdad, en
  // vez de quedarse inmóvil en su posición de partida durante todo el resto
  // de la posesión (ME-04B §2, diagnóstico de la auditoría 210 A).
  setArrival(ctx, "O1", tHandlerArrival, o1UsePoint, 0);
  if (underRoute) setArrival(ctx, "D1", tD1Set, underPoint, tD1UnderCall);
  else setArrival(ctx, "D1", tUseScreen + screenDelay, o1UsePoint, 0);

  // --- Continuación real de O5 (C1): O5 recorre su continuación desde la
  // pantalla hasta una posición de recepción/finalización alcanzable
  // (short roll), en vez de recibir/finalizar desde la posición original
  // del bloqueo por tener asignado el rol de continuador.
  const continuationShift = screenCoordinationShiftSeconds(o5.attributes.M04);
  const rollTravelSeconds = timeToReach(screenPoint, ctx.set.shortRoll, attackerMoveSpeedMps(o5.attributes.F01));
  const tRollReady = Math.max(0.05, tUseScreen - continuationShift + rollTravelSeconds);
  setArrival(ctx, "O5", tRollReady, ctx.set.shortRoll, tRollReady - rollTravelSeconds);
  event(ctx, tRollReady, "ejecutado", "roll_continuation", ["O5"], "O5 continúa hacia el short roll tras la pantalla.", {
    rollSpot: ctx.set.shortRoll,
    // Punto de referencia de la continuación profunda (ME-02 §3): O5 no lo
    // ocupa en esta secuencia (se detiene en el short roll), se deja
    // trazable como el punto de referencia aprobado si una lectura futura
    // lo necesita.
    deepContinuationSpot: ctx.set.deepContinuation,
  });

  // --- Ayuda de D3 (protección interior, T23) ------------------------------
  const tHelpDecision = scenario.startsWithHelpAlreadyCommitted
    ? 0
    : tUseScreen + recognitionLatencySeconds(d3.attributes.M01, d3.attributes.M05);
  const d3HelpSpeed = defenderLateralSpeedMps(d3.attributes.F04);
  const d3BrakingExtra = closeoutBrakingExtraSeconds(d3.attributes.F03);
  const d5DropPos = ctx.positions.D5!;
  const tRollStart = tRollReady - rollTravelSeconds;
  const d5DropSpeed = defenderLateralSpeedMps(d5.attributes.F04);
  const d5DropBraking = closeoutBrakingExtraSeconds(d5.attributes.F03);

  const candidateHelp = buildTagHelpPlan(ctx, scenario, tUseScreen, { tRollReady, speedMps: attackerMoveSpeedMps(o5.attributes.F01) });

  // D5 en drop tiene una sola trayectoria real: desde que empieza el roll
  // retrocede a proteger el aro (T23). Todas las vías del receptor se valoran
  // contra esa misma trayectoria (dónde está D5 al empezar el gesto y al
  // soltar), no contra una respuesta ideal distinta para cada vía.
  const d5DropArrival = Math.max(tRollStart, tRollStart + distance(d5DropPos, ATTACKED_HOOP) / d5DropSpeed - interiorArrivalAdjustmentSeconds(d5.attributes.T23));
  const d5DropRetreat: ContestCandidate = {
    id: "D5",
    geometryTo: () => ({
      geometry: { originPos: d5DropPos, destinationPos: ATTACKED_HOOP, speedMps: d5DropSpeed, brakingExtraSeconds: d5DropBraking },
      arrivalSeconds: d5DropArrival,
    }),
  };

  function rollReceiverRead(tAct: number, help: HelpPlan | null): { options: ReceiverOption[]; contained: boolean } {
    // Contenido: D3 a contacto del receptor (tolerancia numérica del punto a contacto).
    const contained = help !== null && distance(positionAtInstant(help.geometry, help.arrival, tAct + CLOSE_FINISH_PREP_SECONDS), ctx.set.shortRoll) <= COMBINED_CONTACT_RADIUS_METERS + 1e-6;
    const rimCandidates: ContestCandidate[] = [d5DropRetreat];
    const floaterCandidates: ContestCandidate[] = [d5DropRetreat];
    if (help) {
      rimCandidates.push({
        id: "D3",
        geometryTo: (spot) => ({
          geometry: { originPos: help.origin, destinationPos: spot, speedMps: d3HelpSpeed, brakingExtraSeconds: d3BrakingExtra },
          arrivalSeconds: Math.max(help.decision, help.decision + distance(help.origin, spot) / d3HelpSpeed - interiorArrivalAdjustmentSeconds(d3.attributes.T23)),
        }),
      });
      floaterCandidates.push({ id: "D3", geometryTo: () => ({ geometry: help.geometry, arrivalSeconds: help.arrival }) });
    }
    const options = readRollReceiver(ctx, {
      receiverId: "O5",
      receiverPos: ctx.set.shortRoll,
      rimCandidates,
      floaterCandidates,
      invert: help ? { deflectorId: "D3", closerId: "D4", closerGeometry: help.d4Geometry, closerArrival: help.d4Arrival } : null,
    }, tAct);
    return { options, contained };
  }
  const chooseReceiverOption = (options: readonly ReceiverOption[]) => chooseRollReceiverOption(ctx, "O5", options);

  // Decisión de D3 (ME-07B v2 §2.4/§5, «tag» frente a «no dejar tirador de
  // esquina»): con la orden de ayudar al continuador activa, D3 compara, en
  // el instante en que reconoce el bloqueo, lo que concedería el mejor
  // recurso del receptor sin su ayuda (O5 frente a D5 en drop) con lo que
  // concedería ayudando (O5 frente a D5 y D3, o la esquina que deja a O3,
  // cerrada por la rotación real de D4), con la recepción prevista cuando O5
  // termina su roll. Ayuda solo si concede menos; si el pívot de drop ya
  // basta o el tirador de esquina es más peligroso, conserva la marca.
  // Con la ayuda ya comprometida (`closeout_tardio_con_contacto`) no hay
  // decisión que tomar.
  const bestOf = (opts: readonly ReceiverOption[]) => Math.max(0, ...opts.filter((o) => Number.isFinite(o.value)).map((o) => o.value));
  const concessionWithoutHelp = scenario.d3HelpsRoller ? bestOf(rollReceiverRead(tRollReady, null).options) : 0;
  const concessionWithHelp = scenario.d3HelpsRoller ? bestOf(rollReceiverRead(tRollReady, candidateHelp).options) : 0;
  // En la posesión de laboratorio (sin modo enlazado) el escenario es una
  // orden explícita («D3 ayuda» / «D3 no ayuda»); en el partido enlazado la
  // orden `drop_con_ayuda` habilita la ayuda y D3 la lee.
  const helpIsRead = ctx.linked !== null && (ctx.input.rollHelpCall ?? "auto") === "auto";
  const d3Helps =
    scenario.d3HelpsRoller &&
    (scenario.startsWithHelpAlreadyCommitted || !helpIsRead || concessionWithHelp < concessionWithoutHelp);
  const helpPlan: HelpPlan | null = d3Helps ? candidateHelp : null;
  const tD3ArriveHelp = helpPlan ? helpPlan.arrival : Infinity;
  const tD4RepairStart = helpPlan ? helpPlan.d4Start : Infinity;
  const tD4ArriveAtCorner = helpPlan ? helpPlan.d4Arrival : Infinity;
  const d4CornerGeometry: ContestGeometry = candidateHelp.d4Geometry;

  event(
    ctx,
    tHelpDecision,
    "reconocido",
    "help_decision",
    ["D3"],
    d3Helps
      ? "D3 reconoce el bloqueo y decide ayudar al continuador."
      : "D3 reconoce el bloqueo y decide no ayudar; conserva la marca de O3.",
    { helps: d3Helps, concessionWithHelp, concessionWithoutHelp },
  );

  if (helpPlan) {
    setArrival(ctx, "D3", tD3ArriveHelp, helpPlan.point, tHelpDecision);
    registerContainment(ctx, "D3", tHelpDecision, tD3ArriveHelp, d3BrakingExtra, tRollReady - rollTravelSeconds, tRollReady);
    event(
      ctx,
      tD3ArriveHelp,
      "concedido",
      "help_left_assignment",
      ["D3", "O3"],
      `La ayuda de D3 deja libre a O3 ${ctx.set.helpLeftLabel}.`,
    );
    event(
      ctx,
      tD4RepairStart,
      "concedido",
      "help_repair_attempt",
      ["D4", "O4"],
      ctx.set.placement === "horns" ? "D4 intenta reparar hacia el codo y deja libre a O4 en la esquina débil." : "D4 intenta reparar hacia la esquina débil y deja libre a O4.",
      { arrivesAt: tD4ArriveAtCorner },
    );
    setArrival(ctx, "D4", tD4ArriveAtCorner, ctx.set.helpLeftSpot, tD4RepairStart);
  }

  // --- Árbol de decisión de O1: varias opciones reales, ponderadas por
  // valor de tiro situacional provisional (ME-04B §3.2) --------------------
  const tDecision = tUseScreen + recognitionLatencySeconds(o1.attributes.M01, o1.attributes.M05);

  const shotClockRemainingSeconds = ctx.shotClockMs / 1000 - tDecision;
  if (shotClockRemainingSeconds <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, "O1");
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: "O1", position: ctx.positions.O1! });
  }

  // Vía "finalizar": O1 conduce al aro. ME-06 §2 corrige un descarte
  // prematuro de ME-04B: antes, cualquier carrera de reloj perdida por poco
  // (`o1TimeToHoop >= d5TimeToHoop`, sin margen) excluía la vía entera con
  // -Infinity, sin comparar valor, aunque D5 solo llegara a contestar y no a
  // contener de verdad. Ahora se reutiliza la misma comprobación geométrica
  // de contención real ya usada para D3/O5 más abajo (solape de radios
  // corporales sobre la posición reconstruida con `positionAtInstant`, no
  // una comparación de instantes de llegada): solo si D5 de verdad ocupa el
  // punto de finalización cuando O1 estaría listo para liberar el tiro se
  // excluye la vía; si D5 llega pero no llega a solapar, la vía sigue
  // viable y se puntúa contestada (oposición 1) en vez de asumir un tiro
  // limpio.
  const o1TimeToHoop = timeToReach(ctx.positions.O1!, ATTACKED_HOOP, attackerMoveSpeedMps(o1.attributes.F01));
  // T23 (defensa interior): D5 protege el aro contra la finalización directa.
  const d5RawTimeToHoop = timeToReach(ctx.positions.D5!, ATTACKED_HOOP, defenderLateralSpeedMps(d5.attributes.F04));
  const d5TimeToHoop = Math.max(0, d5RawTimeToHoop - interiorArrivalAdjustmentSeconds(d5.attributes.T23));
  const d5HoopGeometry: ContestGeometry = {
    originPos: ctx.positions.D5!,
    destinationPos: ATTACKED_HOOP,
    speedMps: defenderLateralSpeedMps(d5.attributes.F04),
    brakingExtraSeconds: closeoutBrakingExtraSeconds(d5.attributes.F03),
  };
  const tO1FinishReady = tDecision + o1TimeToHoop + CLOSE_FINISH_PREP_SECONDS;
  const d5PosAtO1FinishReady = positionAtInstant(d5HoopGeometry, tDecision + d5TimeToHoop, tO1FinishReady);
  const d5TrulyBlockingFinish = distance(d5PosAtO1FinishReady, ATTACKED_HOOP) <= COMBINED_CONTACT_RADIUS_METERS;
  const finishMarginSeconds = tDecision + d5TimeToHoop - tO1FinishReady;
  const finishViable = !d5TrulyBlockingFinish && shotClockRemainingSeconds > 2;
  // Por debajo (ME-07B v2 §5), D1 espera entre la pantalla y el aro: si ya
  // está allí cuando O1 llegaría a ese punto de su conducción, la entrada
  // queda contestada por D1 aunque D5 no llegue (under niega la penetración).
  const tO1AtUnderPoint = tDecision + timeToReach(ctx.positions.O1!, underPoint, attackerMoveSpeedMps(o1.attributes.F01));
  const d1WallsDrive = underRoute && tD1Under <= tO1AtUnderPoint;
  const finishOpposition: EffectiveOpposition = finishMarginSeconds >= 0.25 && !d1WallsDrive ? 0 : 1;
  const finishValue = finishViable
    ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o1.attributes.T01, finishOpposition)
    : -Infinity;

  // Vía "pase_o5": bate al perseguidor por >=0,2 s de retraso de pantalla,
  // hay línea, y D3 no negó el roll *antes* de esta decisión (si ya lo negó,
  // la esquina se lee directamente desde O1 en la vía "pase_o3", sin pasar
  // antes por O5 — C2 §2). El valor de esta vía estima, de forma pura y sin
  // consumir RNG, la mejor salida legal que la geometría ya permite desde la
  // próxima recepción de O5 (§3.2): O5 la reevaluará de verdad con el estado
  // real en el momento de recibir, más abajo, si esta vía resulta elegida.
  const rollDeniedBeforeDecision = d3Helps && tD3ArriveHelp <= tDecision;
  // Por debajo (ME-07B v2 §5), D1 no choca con la pantalla: no hay retraso
  // que cree el dos contra uno sobre D5 y el pase al roll sigue la misma
  // regla con retraso nulo (la ventaja que concede el under es exterior).
  const effectiveScreenDelay = underRoute ? 0 : screenDelay;
  const o5PassViable = effectiveScreenDelay >= 0.2 && !rollDeniedBeforeDecision;
  const tPassArrivalO5 = Math.max(
    tRollReady,
    tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, ctx.positions.O5!),
  );
  let o5PassValue = -Infinity;
  if (o5PassViable) {
    const projected = rollReceiverRead(tPassArrivalO5, helpPlan);
    const viable = projected.options.filter((o) => Number.isFinite(o.value));
    o5PassValue = viable.length > 0 ? Math.max(...viable.map((o) => o.value)) : -Infinity;
  }
  const d3TrulyContainingEstimate = o5PassViable && rollReceiverRead(tPassArrivalO5, helpPlan).contained;

  // Vía "pase_o3": pase directo de O1 a la esquina débil, viable en cuanto
  // D3 ya dejó su marca (el escenario la carga así comprometida, o D3 ya
  // ayudó antes de esta decisión) — ya no depende de que la vía "pase_o5"
  // esté cerrada: ambas compiten de verdad por valor situacional (ME-04B
  // §3.2), en vez de que una sea siempre subsidiaria de la otra.
  const o3PassViable = d3Helps && (scenario.startsWithHelpAlreadyCommitted || rollDeniedBeforeDecision);
  const tPassArrivalO3Direct = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, ctx.set.helpLeftSpot);
  const tPrepReadyO3Direct = tPassArrivalO3Direct + CATCH_AND_SHOOT_PREP_SECONDS;
  const marginO3Direct = tD4ArriveAtCorner - tPrepReadyO3Direct;
  // ME-07B v2 §2.4: la oposición es la que resultará de la carrera real de D4
  // (misma regla que resolverá el tiro), no un umbral de margen aparte.
  const o3PassOpposition: EffectiveOpposition = estimateContestLevel(ctx, "D4", d4CornerGeometry, tD4ArriveAtCorner, ctx.set.helpLeftSpot, tPrepReadyO3Direct, CATCH_AND_SHOOT_PREP_SECONDS);
  const o3PassValue = o3PassViable ? helpLeftShotValue(ctx, o3PassOpposition) : -Infinity;

  // Vía "triple_o1": O1 detrás de la línea con reloj suficiente (ya
  // comprobado arriba). ME-07B §2 elimina el veto absoluto de capacidad
  // (T04>=9): un triple legal siempre es una vía real; calidad (T04 en
  // `shotProbability`), oposición (ventana de cierre de D5) y reloj deciden
  // su conveniencia frente a las demás vías, no una capacidad binaria.
  const behindLine = isBehindThreePointLine(ctx.positions.O1!);
  const tShotReadyO1 = tDecision + movingShotPrepSeconds(o1.attributes.T06);
  const d5RawContestTime = d5RawTimeToHoop;
  const tD5Contest = Math.max(0, tDecision + d5RawContestTime - perimeterArrivalAdjustmentSeconds(d5.attributes.T22));
  const windowD5 = tD5Contest - tShotReadyO1;
  const tripleViable = behindLine;
  // ME-07B v2 §2.4: el cierre del triple lo hace el mejor de D1 (que sale de
  // la pantalla por detrás con su retraso real) y D5 (solo si el continuador
  // ya está contenido y puede salir), con la geometría real hasta O1; antes
  // solo se miraba a D5 con su tiempo hasta el aro y D1 nunca contestaba.
  const tripleSpot = ctx.positions.O1!;
  const d1Origin = underRoute ? underPoint : historyPositionAt(ctx, "D1", tUseScreen);
  const d1TripleCloser: ContestCandidate = {
    id: "D1",
    geometryTo: (spot) => {
      const d1Speed = defenderLateralSpeedMps(d1.attributes.F04);
      const braking = closeoutBrakingExtraSeconds(d1.attributes.F03);
      if (!underRoute) {
        return { geometry: { originPos: d1Origin, destinationPos: spot, speedMps: d1Speed, brakingExtraSeconds: braking }, arrivalSeconds: tUseScreen + screenDelay };
      }
      // Por debajo, D1 sale desde detrás de la pantalla a cerrar el tiro y
      // tiene que rodear el cuerpo del bloqueador (radio de contacto). Si
      // al soltar O1 aún no lo ha rodeado, el bloqueador queda entre los
      // dos: D1 sigue detrás de la pantalla y no puede contestar.
      const tD1Start = Math.max(tD1Under, tUseScreen);
      const detour = detourAround(underPoint, spot, screenPoint, COMBINED_CONTACT_RADIUS_METERS);
      const arrivalSeconds = tD1Start + detour.length / d1Speed - perimeterArrivalAdjustmentSeconds(d1.attributes.T22);
      const tClearsScreen = detour.waypoint ? tD1Start + distance(underPoint, detour.waypoint) / d1Speed : tD1Start;
      if (detour.waypoint && tClearsScreen > tShotReadyO1) {
        return { geometry: { originPos: underPoint, destinationPos: underPoint, speedMps: d1Speed, brakingExtraSeconds: braking }, arrivalSeconds };
      }
      return { geometry: { originPos: detour.waypoint ?? underPoint, destinationPos: spot, speedMps: d1Speed, brakingExtraSeconds: braking }, arrivalSeconds };
    },
  };
  const tripleContest = bestContest(
    ctx,
    [
      d1TripleCloser,
      rollDeniedBeforeDecision
        ? {
            id: "D5",
            geometryTo: (spot) => ({
              geometry: { ...d5HoopGeometry, destinationPos: spot },
              arrivalSeconds: tDecision + distance(ctx.positions.D5!, spot) / d5HoopGeometry.speedMps - perimeterArrivalAdjustmentSeconds(d5.attributes.T22),
            }),
          }
        : { id: "D5", geometryTo: () => ({ geometry: { ...d5HoopGeometry, destinationPos: ctx.positions.D5! }, arrivalSeconds: 0 }) },
    ],
    tripleSpot,
    tShotReadyO1,
    movingShotPrepSeconds(o1.attributes.T06),
  )!;
  const tripleOpposition: EffectiveOpposition = tripleContest.level;
  const tripleValue = tripleViable
    ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o1.attributes.T04, tripleOpposition)
    : -Infinity;

  // Vías "parada_o1" y "flotadora_o1" (ME-07B v2 §2.4): O1 sigue hacia el
  // aro tras la pantalla y se detiene antes del protector de aro, fuera de su
  // alcance (tiro medio T03 o floater T02 según la zona real de parada) o
  // justo antes del contacto (floater). El drop protege el aro y concede
  // esta otra ventana: mientras el continuador no está contenido por la
  // ayuda (D3 aún no llegó), D5 no puede abandonar el aro para salir al tiro
  // y solo cierra desde donde está; D1 persigue desde el punto de uso con
  // el retraso real de la pantalla.
  const d5Free = rollDeniedBeforeDecision;
  const d5Pos = ctx.positions.D5!;
  const d1ChaseSpeed = defenderLateralSpeedMps(d1.attributes.F04);
  const d1Chase: ContestCandidate = {
    id: "D1",
    geometryTo: (spot) => ({
      geometry: { originPos: d1SetPoint, destinationPos: spot, speedMps: d1ChaseSpeed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d1.attributes.F03) },
      arrivalSeconds: tD1Set + distance(d1SetPoint, spot) / d1ChaseSpeed,
    }),
  };
  const d5StepSpeed = defenderLateralSpeedMps(d5.attributes.F04);
  const d5Contest: ContestCandidate = {
    id: "D5",
    geometryTo: (spot) =>
      d5Free
        ? {
            geometry: { originPos: d5Pos, destinationPos: spot, speedMps: d5StepSpeed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d5.attributes.F03) },
            arrivalSeconds: Math.max(tDecision, tDecision + distance(d5Pos, spot) / d5StepSpeed - perimeterArrivalAdjustmentSeconds(d5.attributes.T22)),
          }
        : { geometry: { originPos: d5Pos, destinationPos: d5Pos, speedMps: d5StepSpeed, brakingExtraSeconds: 0 }, arrivalSeconds: 0 },
  };
  const d5Reach = contestReachMeters(d5.measures.wingspanCm);
  // 0,05 m: el punto de parada queda justo fuera del alcance (el alcance se compara con `<=`).
  const pullUpPlan = planPullUp(ctx, { shooterId: "O1", from: ctx.positions.O1!, tStart: tDecision, protectorPos: d5Pos, standoffMeters: d5Reach + 0.05, contesters: [d1Chase, d5Contest] });
  const floaterCandidate = planPullUp(ctx, { shooterId: "O1", from: ctx.positions.O1!, tStart: tDecision, protectorPos: d5Pos, standoffMeters: COMBINED_CONTACT_RADIUS_METERS, contesters: [d1Chase, d5Contest] });
  const floaterPlan = floaterCandidate && floaterCandidate.shotType === "floater" ? floaterCandidate : null;
  const shotClockSeconds = ctx.shotClockMs / 1000;
  const pullUpValue = pullUpPlan && pullUpPlan.tReady < shotClockSeconds ? pullUpPlan.value : -Infinity;
  const floaterValue = floaterPlan && floaterPlan.tReady < shotClockSeconds ? floaterPlan.value : -Infinity;

  // Vía "salida_segura": último recurso, siempre viable, sin puntos
  // esperados (conserva el control, no arriesga un tiro).
  const outletTarget = distanceSeconds(ctx.positions.O1!, ctx.positions.O4!) <
    distanceSeconds(ctx.positions.O1!, ctx.positions.O2!)
    ? "O4"
    : "O2";
  const safeOutletValue = 0;

  type FirstReadOptionId = "finalizar" | "pase_o5" | "pase_o3" | "triple_o1" | "parada_o1" | "flotadora_o1" | "salida_segura";
  const candidateValues: Readonly<Record<FirstReadOptionId, number>> = {
    finalizar: finishValue,
    pase_o5: o5PassValue,
    pase_o3: o3PassValue,
    triple_o1: tripleValue,
    parada_o1: pullUpValue,
    flotadora_o1: floaterValue,
    salida_segura: safeOutletValue,
  };
  const FIRST_READ_ORDER: readonly FirstReadOptionId[] = ["finalizar", "pase_o5", "pase_o3", "triple_o1", "parada_o1", "flotadora_o1", "salida_segura"];
  if (ctx.projecting) {
    const completionOf: Readonly<Record<FirstReadOptionId, number>> = {
      finalizar: 1,
      pase_o5: 1 - deflectionProbability(d1.attributes.T17, o1.attributes.T09),
      pase_o3: 1 - deflectionProbability(d4.attributes.T17, o1.attributes.T09),
      triple_o1: 1,
      parada_o1: 1,
      flotadora_o1: 1,
      salida_segura: 1,
    };
    throw new ReadProjectionReached({
      tDecisionSeconds: tDecision,
      options: FIRST_READ_ORDER.map((id) => ({ id, value: candidateValues[id], completion: completionOf[id] })),
    });
  }
  const viableCandidates = FIRST_READ_ORDER.filter((id) => Number.isFinite(candidateValues[id]))
    .map((id) => ({ id, value: candidateValues[id] }))
    .sort((a, b) => b.value - a.value);
  const topValue = viableCandidates[0]!.value;

  // Entre vías viables que difieren en <=0,15 puntos esperados
  // (`FIRST_READ_TIE_BAND_POINTS`), decide la tendencia del jugador en vez
  // del valor mayor a secas (ME-04B §3.2): `priorizar_primera_opcion`
  // escoge la mejor vía de manejador/continuador de la banda;
  // `explorar_segunda_opcion` tira una vez `secondOptionProbability(M03)`
  // para escoger la mejor vía exterior de la banda. Fuera de la banda, o sin
  // vía alternativa del tipo que pide la tendencia, gana el valor mayor sin
  // tirada de preferencia.
  let chosen: FirstReadOptionId = viableCandidates[0]!.id;
  let tieBandResolvedByTendency = false;
  let tieBandResolvedByPriority = false;
  let tieRngBefore: number | null = null;
  let tieRngAfter: number | null = null;
  if (viableCandidates.length > 1 && topValue - viableCandidates[1]!.value <= FIRST_READ_TIE_BAND_POINTS) {
    const band = viableCandidates.filter((c) => topValue - c.value <= FIRST_READ_TIE_BAND_POINTS);
    // ME-07A §2 (regla piloto): dentro de la banda, la prioridad de creación
    // del entrenador favorece primero una vía compatible; `pnrTendency`
    // conserva su papel específico en esta lectura (la del bloqueo) solo
    // cuando la prioridad no la resuelve (incluido `equilibrado`, que deja
    // exactamente el comportamiento anterior a ME-07A).
    const creationPriority: OffensiveCreationPriority = ctx.input.creationPriority ?? "equilibrado";
    let priorityBand: readonly { readonly id: FirstReadOptionId; readonly value: number }[] | null = null;
    if (creationPriority === "buscar_aro") {
      priorityBand = band.filter((c) => c.id === "finalizar" || c.id === "pase_o5" || c.id === "flotadora_o1").sort((a, b) => b.value - a.value);
    } else if (creationPriority === "buscar_triple") {
      priorityBand = band.filter((c) => c.id === "pase_o3" || c.id === "triple_o1").sort((a, b) => b.value - a.value);
    }
    if (priorityBand && priorityBand.length > 0) {
      tieBandResolvedByPriority = true;
      if (priorityBand[0]!.id !== chosen) chosen = priorityBand[0]!.id;
    } else if (o1.pnrTendency === "priorizar_primera_opcion") {
      const handlerBand = band.filter((c) => c.id === "finalizar" || c.id === "pase_o5" || c.id === "parada_o1" || c.id === "flotadora_o1").sort((a, b) => b.value - a.value);
      if (handlerBand.length > 0 && handlerBand[0]!.id !== chosen) {
        chosen = handlerBand[0]!.id;
        tieBandResolvedByTendency = true;
      }
    } else {
      tieRngBefore = rngStateOf(ctx.rng);
      const preferSecondOption = ctx.rng.next() < secondOptionProbability(o1.attributes.M03);
      tieRngAfter = rngStateOf(ctx.rng);
      if (preferSecondOption) {
        const exteriorBand = band.filter((c) => c.id === "pase_o3" || c.id === "triple_o1").sort((a, b) => b.value - a.value);
        if (exteriorBand.length > 0 && exteriorBand[0]!.id !== chosen) {
          chosen = exteriorBand[0]!.id;
          tieBandResolvedByTendency = true;
        }
      }
    }
  }

  const firstReadReasonCodes: Readonly<Record<FirstReadOptionId, { chosen: AuditReasonCode; notViable: AuditReasonCode }>> = {
    finalizar: { chosen: "lane_open_before_help", notViable: "lane_closed_help_ready" },
    pase_o5: { chosen: "screen_delay_sufficient", notViable: rollDeniedBeforeDecision ? "roll_denied_before_decision" : "screen_delay_insufficient" },
    pase_o3: { chosen: "corner_window_open", notViable: d3Helps ? "corner_window_closed" : "not_available" },
    triple_o1: {
      chosen: "three_point_eligible",
      notViable: "three_point_window_closed",
    },
    parada_o1: { chosen: "pull_up_spot_available", notViable: "pull_up_no_spot" },
    flotadora_o1: { chosen: "pull_up_spot_available", notViable: "pull_up_no_spot" },
    salida_segura: { chosen: "safe_outlet_default", notViable: "not_available" },
  };
  const pullUpValues = (plan: PullUpPlan | null, value: number): Record<string, number | string | boolean | null> => ({
    situationalValue: value,
    shotType: plan?.shotType ?? null,
    spotDistanceToHoop: plan ? Math.hypot(ATTACKED_HOOP.x - plan.spot.x, ATTACKED_HOOP.y - plan.spot.y) : null,
    contesterId: plan ? realId(ctx, plan.contesterId) : null,
    opposition: plan?.opposition ?? null,
    readySeconds: plan?.tReady ?? null,
    rimProtectorFree: d5Free,
  });
  const firstReadValues: Readonly<Record<FirstReadOptionId, Record<string, number | string | boolean | null>>> = {
    finalizar: {
      situationalValue: finishValue,
      o1TimeToHoopSeconds: o1TimeToHoop,
      d5TimeToHoopSeconds: d5TimeToHoop,
      shotClockRemainingSeconds,
      d5TrulyBlockingFinish,
      finishMarginSeconds,
      d1WallsDrive,
    },
    pase_o5: {
      situationalValue: o5PassValue,
      screenDelaySeconds: effectiveScreenDelay,
      rollDeniedBeforeDecision,
      estimatedD3TrulyContaining: d3TrulyContainingEstimate,
    },
    pase_o3: { situationalValue: o3PassValue, marginSeconds: marginO3Direct, d3AlreadyLeft: rollDeniedBeforeDecision || scenario.startsWithHelpAlreadyCommitted, shotType: helpLeftShotType(ctx) },
    triple_o1: {
      situationalValue: tripleValue,
      windowD5Seconds: windowD5,
      opposition: tripleOpposition,
      contesterId: realId(ctx, tripleContest.id),
      // Margen del cierre de D1: su llegada al punto de tiro menos el instante
      // en que O1 está listo para soltar (ME-07B v2 §5: el under lo agranda).
      d1CloseoutMarginSeconds: d1TripleCloser.geometryTo(tripleSpot).arrivalSeconds - tShotReadyO1,
      t04: o1.attributes.T04,
      behindLine,
    },
    parada_o1: pullUpValues(pullUpPlan, pullUpValue),
    flotadora_o1: pullUpValues(floaterPlan, floaterValue),
    salida_segura: { situationalValue: safeOutletValue },
  };
  function firstReadOptionRecord(id: FirstReadOptionId): AuditOptionRecord {
    const value = candidateValues[id];
    if (id === chosen) {
      return { id, status: "elegida", reasonCode: firstReadReasonCodes[id].chosen, values: firstReadValues[id] };
    }
    if (!Number.isFinite(value)) {
      // "pase_o3" en un escenario donde D3 nunca ayuda (`drop_sin_ayuda`) es
      // estructuralmente inaplicable, no una condición evaluada y perdida:
      // no hay esquina débil liberada que pasar en absoluto.
      const structurallyUnavailable = id === "pase_o3" && !d3Helps;
      return {
        id,
        status: structurallyUnavailable ? "no_evaluada_por_cortocircuito" : "descartada_por_condicion",
        reasonCode: firstReadReasonCodes[id].notViable,
        values: firstReadValues[id],
      };
    }
    const inBand = topValue - value <= FIRST_READ_TIE_BAND_POINTS;
    return {
      id,
      status: "descartada_por_condicion",
      reasonCode: inBand && tieBandResolvedByPriority ? "creation_priority_resolved_band" : inBand && tieBandResolvedByTendency ? "tie_band_resolved_by_tendency" : "situational_value_lower",
      values: firstReadValues[id],
    };
  }
  const firstReadOptions: AuditOptionRecord[] = FIRST_READ_ORDER.map(firstReadOptionRecord);

  if (chosen === "finalizar") {
    auditDecision(ctx, tDecision, {
      point: "lectura_bloqueo_o1",
      holderId: "O1",
      participants: ["O1", "D5"],
      chosenOptionId: "finalizar",
      rngStateBefore: tieRngBefore,
      rngStateAfter: tieRngAfter,
      options: firstReadOptions,
    });
    return resolveShotAttempt(ctx, {
      shooterId: "O1",
      shooterSkill: o1.attributes.T01,
      shotType: "close_finish",
      shooterPos: ATTACKED_HOOP,
      tReady: tDecision + o1TimeToHoop + CLOSE_FINISH_PREP_SECONDS,
      prepSeconds: CLOSE_FINISH_PREP_SECONDS,
      contesterId: "D5",
      contesterArrival: tDecision + d5TimeToHoop,
      contesterGeometry: d5HoopGeometry,
    });
  }

  if (chosen === "pase_o5") {
    const tPassArrival = tPassArrivalO5;
    const passOutcome = resolvePass(
      o1.attributes.T09,
      o5.attributes.T11,
      true,
      d1.attributes.T17,
      1,
      ctx.rng,
    );
    event(ctx, tPassArrival, "ejecutado", "pass_released", ["O1", "O5"], "O1 pasa al continuador O5.");
    auditDecision(ctx, tDecision, {
      point: "lectura_bloqueo_o1",
      holderId: "O1",
      participants: ["O1", "O5", "D3"],
      chosenOptionId: "pase_o5",
      factLinkKind: "pass_released",
      rngStateBefore: tieRngBefore,
      rngStateAfter: tieRngAfter,
      options: firstReadOptions,
    });

    if (passOutcome.kind === "deflected_loose_ball") {
      return resolveLooseBallAfterPass(ctx, tPassArrival, "O1", "D1");
    }

    const readyDelay = passOutcome.kind === "awkward_control" ? passOutcome.extraDelaySeconds : 0;
    const tAct = tPassArrival + readyDelay;
    const tO5Ready = tAct + CLOSE_FINISH_PREP_SECONDS;
    event(ctx, tPassArrival, "concedido", "pass_received", ["O5"], "O5 recibe el balón en el roll.");

    // Segunda lectura de O5 (ME-07B v2 §2.4), con el estado real de este
    // instante: aro, floater o inversión frente al mejor cierre real. Si D3
    // ya contiene su cuerpo y la inversión no es la mejor vía, se mantiene la
    // salida de segunda entrada de ME-04 (reorganizar sin reiniciar el reloj)
    // antes de forzar un tiro contenido.
    const read = rollReceiverRead(tAct, helpPlan);
    const outOfClock = rollReceiverOutOfClock(ctx, tAct, read.options);
    if (outOfClock) return outOfClock;
    const { chosen: receiverChoice, byTendency } = chooseReceiverOption(read.options);
    const receiverRecords = (chosenId: string, extra: AuditOptionRecord[] = []): AuditOptionRecord[] => [
      ...read.options.map((o): AuditOptionRecord => {
        if (o.id === chosenId) return { id: o.id, status: "elegida", reasonCode: byTendency ? (o.shot ? "shot_tendency_favors_shot" : "shot_tendency_favors_continuation") : "receiver_value_higher", values: o.values };
        if (!Number.isFinite(o.value)) return { id: o.id, status: "descartada_por_condicion", reasonCode: o.id === "invertir_o3" && !d3Helps ? "corner_window_closed" : "receiver_option_not_viable", values: o.values };
        return { id: o.id, status: "descartada_por_condicion", reasonCode: byTendency ? "tie_band_resolved_by_tendency" : "receiver_value_lower", values: o.values };
      }),
      ...extra,
    ];

    if (receiverChoice.id === "invertir_o3") {
      const tPassArrivalO3 = tAct + PASS_RELEASE_SECONDS + distanceSeconds(ctx.set.shortRoll, ctx.set.helpLeftSpot);
      const tPrepReadyO3 = tPassArrivalO3 + CATCH_AND_SHOOT_PREP_SECONDS;
      const invertOutcome = resolvePass(o5.attributes.T09, o3.attributes.T11, true, d3.attributes.T17, 1, ctx.rng);
      event(ctx, tPassArrivalO3, "ejecutado", "pass_released", ["O5", "O3"], `O5 invierte hacia O3 ${ctx.set.helpLeftLabel}.`);
      auditDecision(ctx, tAct, {
        point: "lectura_segunda_o5",
        holderId: "O5",
        participants: ["O5", "O3", "D3", "D4"],
        chosenOptionId: "invertir_o3",
        factLinkKind: "pass_released",
        options: receiverRecords("invertir_o3", [shortCircuited("segunda_entrada")]),
        note: read.contained ? "D3 contiene a O5 en la recepción." : undefined,
      });

      if (invertOutcome.kind === "deflected_loose_ball") {
        return resolveLooseBallAfterPass(ctx, tPassArrivalO3, "O5", "D3");
      }

      const invertReadyDelay = invertOutcome.kind === "awkward_control" ? invertOutcome.extraDelaySeconds : 0;
      event(ctx, tPassArrivalO3, "concedido", "pass_received", ["O3"], "O3 recibe la inversión.");

      return resolveShotAttempt(ctx, {
        shooterId: "O3",
        shooterSkill: shotSkill(o3, helpLeftShotType(ctx)),
        shotType: helpLeftShotType(ctx),
        shooterPos: ctx.set.helpLeftSpot,
        tReady: tPrepReadyO3 + invertReadyDelay,
        prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + invertReadyDelay,
        contesterId: "D4",
        contesterArrival: tD4ArriveAtCorner,
        contesterGeometry: d4CornerGeometry,
      });
    }

    if (read.contained) {
      // Primera lectura negada: O5 contenido y la inversión no es la mejor vía (ME-04 §5).
      const kickOut = tryLinkedKickOut(ctx, tO5Ready, "D3");
      if (kickOut) {
        auditDecision(ctx, tAct, {
          point: "lectura_segunda_o5",
          holderId: "O5",
          participants: ["O5", "D3"],
          chosenOptionId: "segunda_entrada",
          options: [
            ...read.options.map((o): AuditOptionRecord => ({ id: o.id, status: "descartada_por_condicion", reasonCode: Number.isFinite(o.value) ? "second_read_contained" : "receiver_option_not_viable", values: o.values })),
            { id: "segunda_entrada", status: "elegida", reasonCode: "second_entry_viable_shortest_pass" },
          ],
        });
        return kickOut;
      }
    }

    const shot = receiverChoice.shot!;
    auditDecision(ctx, tAct, {
      point: "lectura_segunda_o5",
      holderId: "O5",
      participants: ["O5", shot.contesterId],
      chosenOptionId: receiverChoice.id,
      options: receiverRecords(receiverChoice.id, [
        read.contained
          ? { id: "segunda_entrada", status: "descartada_por_condicion", reasonCode: "second_entry_pass_line_blocked", reasonNote: "Ningún exterior fue viable; el detalle por candidato está en la decisión «segunda_entrada» del mismo instante." }
          : shortCircuited("segunda_entrada"),
      ]),
      note: read.contained ? "D3 contiene a O5 en la recepción: tiro bajo contención." : undefined,
    });
    return resolveShotAttempt(ctx, { ...shot, prepSeconds: shot.prepSeconds + readyDelay });
  }

  if (chosen === "pase_o3") {
    const passOutcome = resolvePass(o1.attributes.T09, o3.attributes.T11, true, d4.attributes.T17, 1, ctx.rng);
    event(ctx, tPassArrivalO3Direct, "ejecutado", "pass_released", ["O1", "O3"], `O1 encuentra a O3 ${ctx.set.helpLeftLabel}.`);
    auditDecision(ctx, tDecision, {
      point: "lectura_bloqueo_o1",
      holderId: "O1",
      participants: ["O1", "O3", "D4"],
      chosenOptionId: "pase_o3",
      factLinkKind: "pass_released",
      rngStateBefore: tieRngBefore,
      rngStateAfter: tieRngAfter,
      options: firstReadOptions,
    });

    if (passOutcome.kind === "deflected_loose_ball") {
      return resolveLooseBallAfterPass(ctx, tPassArrivalO3Direct, "O1", "D4");
    }

    const readyDelay = passOutcome.kind === "awkward_control" ? passOutcome.extraDelaySeconds : 0;
    event(ctx, tPassArrivalO3Direct, "concedido", "pass_received", ["O3"], ctx.set.placement === "horns" ? "O3 recibe en el codo." : "O3 recibe en la esquina.");

    return resolveShotAttempt(ctx, {
      shooterId: "O3",
      shooterSkill: shotSkill(o3, helpLeftShotType(ctx)),
      shotType: helpLeftShotType(ctx),
      shooterPos: ctx.set.helpLeftSpot,
      tReady: tPrepReadyO3Direct + readyDelay,
      prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + readyDelay,
      contesterId: "D4",
      contesterArrival: tD4ArriveAtCorner,
      contesterGeometry: d4CornerGeometry,
    });
  }

  if (chosen === "triple_o1") {
    auditDecision(ctx, tDecision, {
      point: "lectura_bloqueo_o1",
      holderId: "O1",
      participants: ["O1", "D5"],
      chosenOptionId: "triple_o1",
      rngStateBefore: tieRngBefore,
      rngStateAfter: tieRngAfter,
      options: firstReadOptions,
    });
    return resolveShotAttempt(ctx, {
      shooterId: "O1",
      shooterSkill: o1.attributes.T04,
      shotType: "three_point",
      shooterPos: ctx.positions.O1!,
      tReady: tShotReadyO1,
      prepSeconds: movingShotPrepSeconds(o1.attributes.T06),
      contesterId: tripleContest.id,
      contesterArrival: tripleContest.arrival,
      contesterGeometry: tripleContest.geometry,
    });
  }

  if (chosen === "parada_o1" || chosen === "flotadora_o1") {
    const plan = (chosen === "parada_o1" ? pullUpPlan : floaterPlan)!;
    auditDecision(ctx, tDecision, {
      point: "lectura_bloqueo_o1",
      holderId: "O1",
      participants: ["O1", plan.contesterId],
      chosenOptionId: chosen,
      rngStateBefore: tieRngBefore,
      rngStateAfter: tieRngAfter,
      options: firstReadOptions,
    });
    setArrival(ctx, "O1", tDecision + plan.travelSeconds, plan.spot, tDecision);
    return resolveShotAttempt(ctx, {
      shooterId: "O1",
      shooterSkill: shotSkill(o1, plan.shotType),
      shotType: plan.shotType,
      shooterPos: plan.spot,
      tReady: plan.tReady,
      prepSeconds: plan.prepSeconds,
      contesterId: plan.contesterId,
      contesterArrival: plan.contesterArrival,
      contesterGeometry: plan.contesterGeometry,
    });
  }

  // chosen === "salida_segura": último recurso. Control conservado, sin tiro forzado.
  const tOutlet = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, ctx.positions[outletTarget]!);
  event(
    ctx,
    tOutlet,
    "concedido",
    "possession_continues",
    ["O1", outletTarget],
    `O1 elige la salida segura hacia ${outletTarget}; el ataque conserva el control y se reorganiza.`,
  );
  auditDecision(ctx, tDecision, {
    point: "lectura_bloqueo_o1",
    holderId: "O1",
    participants: ["O1", outletTarget],
    chosenOptionId: "salida_segura",
    factLinkKind: "possession_continues",
    rngStateBefore: tieRngBefore,
    rngStateAfter: tieRngAfter,
    options: firstReadOptions,
  });

  return finalize(
    ctx,
    { kind: "possession_reorganized_control_kept", outletPlayerId: outletTarget },
    { status: "held", holderId: outletTarget, position: ctx.positions[outletTarget]! },
  );
}

/**
 * Cobertura de trampa (ME-02 §3): D1 sigue a O1 por la pantalla y D5 sale
 * desde su posición a comprometer a O1 —dos defensores, solo si de verdad
 * llegan—; D3 pasa a low man sobre el short roll de O5 (misma geometría de
 * continuación que en drop); D4 rota hacia la amenaza que deja D3 (O3),
 * exponiendo a O4; D2 mantiene el lado fuerte sobre O2 y no participa en
 * esta secuencia. El aviso de D5 a D3 y de D3 a D4 son avisos defensivos
 * con emisor y receptor: cada uno suma una vez la latencia de M09.
 */
function runTrapPhase(ctx: CoreContext): PossessionCoreResult {
  const o1 = player(ctx, "O1");
  const o3 = player(ctx, "O3");
  const o4 = player(ctx, "O4");
  const o5 = player(ctx, "O5");
  const d1 = player(ctx, "D1");
  const d3 = player(ctx, "D3");
  const d4 = player(ctx, "D4");
  const d5 = player(ctx, "D5");

  const screenPoint = ctx.positions.O5!;
  // Punto real de uso de la pantalla (ME-04B §3.1), igual que en drop.
  const o1UsePoint = pointShortOfTarget(ctx.positions.O1!, screenPoint, COMBINED_CONTACT_RADIUS_METERS);

  // --- Pantalla: D1 sigue navegando, igual que en drop -------------------
  const tScreenSet = SCREEN_SET_AFTER_ARRIVAL_SECONDS;
  const tHandlerArrival = timeToReach(ctx.positions.O1!, o1UsePoint, attackerMoveSpeedMps(o1.attributes.F01));
  const tUseScreen = Math.max(tScreenSet, tHandlerArrival);
  event(ctx, tScreenSet, "ejecutado", "screen_set", ["O5"], `O5 llega y coloca su pantalla ${ctx.set.placement}.`, { placement: ctx.set.placement });

  const weightDiff = o5.measures.weightKg - d1.measures.weightKg;
  const screenDelay =
    screenInterceptDelaySeconds(o5.attributes.T13, o5.attributes.F05, d1.attributes.T16) +
    screenContactAdjustmentSeconds(weightDiff);
  event(
    ctx,
    tUseScreen,
    "ejecutado",
    "screen_navigated",
    ["O1", "D1"],
    `O1 usa la pantalla de O5; D1 sigue navegando con un retraso de ${screenDelay.toFixed(2)} s.`,
    { screenDelay },
  );
  // O1 se desplaza de verdad hasta el punto de uso de la pantalla, saliendo
  // desde el principio del tramo de cálculo; si llega antes de que la
  // pantalla esté lista, espera ahí en vez de teletransportarse. D1 lo sigue
  // con el retraso real de navegación (ME-04B §3.1).
  setArrival(ctx, "O1", tHandlerArrival, o1UsePoint, 0);
  setArrival(ctx, "D1", tUseScreen + screenDelay, o1UsePoint, 0);

  // --- O5 continúa hacia el short roll, igual geometría que en drop -----
  const continuationShift = screenCoordinationShiftSeconds(o5.attributes.M04);
  const rollTravelSeconds = timeToReach(screenPoint, ctx.set.shortRoll, attackerMoveSpeedMps(o5.attributes.F01));
  const tRollReady = Math.max(0.05, tUseScreen - continuationShift + rollTravelSeconds);
  setArrival(ctx, "O5", tRollReady, ctx.set.shortRoll, tRollReady - rollTravelSeconds);
  event(ctx, tRollReady, "ejecutado", "roll_continuation", ["O5"], "O5 continúa hacia el short roll tras la pantalla.", {
    rollSpot: ctx.set.shortRoll,
    // Punto de referencia de la continuación profunda (ME-02 §3): O5 no lo
    // ocupa en esta secuencia (se detiene en el short roll), se deja
    // trazable como el punto de referencia aprobado si una lectura futura
    // lo necesita.
    deepContinuationSpot: ctx.set.deepContinuation,
  });

  // --- D5 sale a comprometer a O1 (aviso: emisor D5) ----------------------
  // ME-07B v2 §2.3: la respuesta se decide cuando empieza a prepararse la
  // acción (O5 va a bloquear desde el instante 0 de la fase organizada), no
  // cuando O1 ya usa la pantalla: D5 sale tras su propia latencia de
  // reconocimiento desde ese inicio. Si aun así no llega antes del pase, la
  // trampa sigue siendo tardía (rama «trampa no cerrada»).
  const tTrapCall = recognitionLatencySeconds(d5.attributes.M01, d5.attributes.M05);
  const d5TrapSpeed = defenderLateralSpeedMps(d5.attributes.F04);
  const d5TrapOrigin = ctx.positions.D5!;
  const rawD5TrapArrival = tTrapCall + timeToReach(d5TrapOrigin, screenPoint, d5TrapSpeed);
  const tD5TrapArrival = Math.max(0, rawD5TrapArrival - perimeterArrivalAdjustmentSeconds(d5.attributes.T22));
  setArrival(ctx, "D5", tD5TrapArrival, screenPoint, tTrapCall);
  event(
    ctx,
    tD5TrapArrival,
    "ejecutado",
    "trap_committed",
    ["D1", "D5"],
    "D5 sale desde su posición y compromete a O1 junto a D1 en la trampa.",
    { arrivesAt: tD5TrapArrival },
  );

  // --- D3 pasa a low man sobre el short roll (receptor del aviso de D5) --
  const m09LatencyD3 = m09CoordinationLatencySeconds(d5.attributes.M09, d3.attributes.M09);
  const tLowManDecision = tD5TrapArrival + m09LatencyD3;
  const d3LowManOrigin = ctx.positions.D3!;
  const d3LowManSpeed = defenderLateralSpeedMps(d3.attributes.F04);
  // Low man: mismo punto de contención que la ayuda «tag» (no choca en carrera con el continuador).
  const d3LowManPoint = containmentPoint(d3LowManOrigin, ctx.set.shortRoll, tLowManDecision, d3LowManSpeed, closeoutBrakingExtraSeconds(d3.attributes.F03), d3.attributes.T23, { tRollReady, speedMps: attackerMoveSpeedMps(o5.attributes.F01) });
  const rawD3LowManArrival = tLowManDecision + timeToReach(d3LowManOrigin, d3LowManPoint, d3LowManSpeed);
  const tD3LowManArrival = Math.max(0, rawD3LowManArrival - interiorArrivalAdjustmentSeconds(d3.attributes.T23));
  const d3BrakingExtra = closeoutBrakingExtraSeconds(d3.attributes.F03);
  setArrival(ctx, "D3", tD3LowManArrival, d3LowManPoint, tLowManDecision);
  registerContainment(ctx, "D3", tLowManDecision, tD3LowManArrival, d3BrakingExtra, tRollReady - rollTravelSeconds, tRollReady);
  event(
    ctx,
    tLowManDecision,
    "reconocido",
    "help_decision",
    ["D3"],
    `D3 recibe el aviso de la trampa (latencia M09 ${m09LatencyD3.toFixed(2)} s) y pasa a low man sobre el short roll.`,
    { m09LatencySeconds: m09LatencyD3 },
  );
  event(
    ctx,
    tD3LowManArrival,
    "concedido",
    "help_left_assignment",
    ["D3", "O3"],
    `D3 en low man deja libre a O3 ${ctx.set.helpLeftLabel}.`,
  );

  // --- D4 rota hacia la amenaza que deja D3 (O3), exponiendo a O4 --------
  const m09LatencyD4 = m09CoordinationLatencySeconds(d3.attributes.M09, d4.attributes.M09);
  const tD4RepairStart = tD3LowManArrival + m09LatencyD4;
  const d4RepairOrigin = ctx.positions.D4!;
  const d4RepairSpeed = defenderLateralSpeedMps(d4.attributes.F04);
  const rawD4Arrival = tD4RepairStart + timeToReach(d4RepairOrigin, ctx.set.helpLeftSpot, d4RepairSpeed);
  const tD4ArriveAtCorner = Math.max(tD4RepairStart, rawD4Arrival - perimeterArrivalAdjustmentSeconds(d4.attributes.T22));
  const d4BrakingExtra = closeoutBrakingExtraSeconds(d4.attributes.F03);
  event(
    ctx,
    tD4RepairStart,
    "concedido",
    "help_repair_attempt",
    ["D4", "O4"],
    `D4 rota hacia la amenaza que deja D3 sobre O3 (latencia M09 ${m09LatencyD4.toFixed(2)} s) y expone a O4.`,
    { arrivesAt: tD4ArriveAtCorner, m09LatencySeconds: m09LatencyD4 },
  );
  setArrival(ctx, "D4", tD4ArriveAtCorner, ctx.set.helpLeftSpot, tD4RepairStart);

  // --- Decisión de O1 bajo trampa -----------------------------------------
  const tDecision = tUseScreen + recognitionLatencySeconds(o1.attributes.M01, o1.attributes.M05);
  const shotClockRemainingSeconds = ctx.shotClockMs / 1000 - tDecision;
  if (shotClockRemainingSeconds <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, "O1");
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: "O1", position: ctx.positions.O1! });
  }

  // La trampa se juzga "cerrada" en el instante en que el pase a O5 en
  // realidad llegaría (no en el instante puramente mental de decidir):
  // "si O1 pasa antes de cerrarse la trampa, el ataque dispone de 4x3
  // solo mientras los dos defensores sigan comprometidos y el pase
  // llegue" (ME-02 §3). Se usa la misma fórmula de llegada de pase que en
  // drop, con la posición real de O5 ya en el short roll.
  const tPassArrivalToO5 = Math.max(
    tRollReady,
    tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, ctx.positions.O5!),
  );
  const trapClosed = tD5TrapArrival <= tPassArrivalToO5;

  const d3RollGeometry: ContestGeometry = {
    originPos: d3LowManOrigin,
    destinationPos: d3LowManPoint,
    speedMps: d3LowManSpeed,
    brakingExtraSeconds: d3BrakingExtra,
  };
  const d4CornerGeometry: ContestGeometry = {
    originPos: d4RepairOrigin,
    destinationPos: ctx.set.helpLeftSpot,
    speedMps: d4RepairSpeed,
    brakingExtraSeconds: d4BrakingExtra,
  };

  if (ctx.projecting) {
    const base = { tD5TrapArrivalSeconds: tD5TrapArrival, tPassArrivalToO5Seconds: tPassArrivalToO5 };
    if (!trapClosed) {
      // Trampa tardía: D5 no protege el aro y O1 tiene el carril (misma rama de abajo).
      throw new TrapProjectionReached({
        ...base,
        trapClosed: false,
        branch: "carril_o1",
        stealProbability: 0,
        concession: shotClockRemainingSeconds > 2 ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o1.attributes.T01, 0) : 0,
      });
    }
    const stealProbability = turnoverUnderPressureProbability(o1.attributes.T07, Math.min(d1.attributes.T15, d5.attributes.T15));
    const passToO5 = 1 - deflectionProbability(d3.attributes.T17, o1.attributes.T09);
    const tO5ReadyProjected = tPassArrivalToO5 + CLOSE_FINISH_PREP_SECONDS;
    const tPrepReadyO3Projected =
      tO5ReadyProjected + PASS_RELEASE_SECONDS + distanceSeconds(ctx.set.shortRoll, ctx.set.helpLeftSpot) + CATCH_AND_SHOOT_PREP_SECONDS;
    let branch: TrapProjection["branch"];
    let next: number;
    if (tD3LowManArrival > tO5ReadyProjected) {
      branch = "trap_broken_o4";
      next = isBehindThreePointLine(ctx.positions.O4!)
        ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o4.attributes.T04, 0)
        : 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o4.attributes.T01, 0);
    } else if (tD4ArriveAtCorner - tPrepReadyO3Projected >= 0.25) {
      branch = "invertir_o3";
      next = (1 - deflectionProbability(d3.attributes.T17, o5.attributes.T09)) * helpLeftShotValue(ctx, 0);
    } else {
      branch = "finalizar_bajo_contencion";
      next = 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o5.attributes.T01, 1);
    }
    throw new TrapProjectionReached({
      ...base,
      trapClosed: true,
      branch,
      stealProbability,
      concession: (1 - stealProbability) * passToO5 * next,
    });
  }

  if (trapClosed) {
    // Presión real de dos defensores sobre el balón (T07 vs el peor T15 de
    // los dos comprometidos): reutiliza el mecanismo de presión ya vigente,
    // no un robo global nuevo. Una trampa cerrada no garantiza robo.
    const worstT15 = Math.min(d1.attributes.T15, d5.attributes.T15);
    // ME-07B v2 §2.5 (LAB-0.6): la trampa cerrada es contacto real sobre el
    // balón; con reglas de partido puede ser falta sin tiro del trampeador
    // menos disciplinado (M07), antes de resolver la presión.
    if (ctx.linked?.rules?.ordinaryFouls && !ctx.projecting) {
      const fouler = d5.attributes.M07 < d1.attributes.M07 ? "D5" : "D1";
      const foulProb = contactFoulProbability("trampa", player(ctx, fouler).attributes.M07);
      const rngBeforeFoul = rngStateOf(ctx.rng);
      if (ctx.rng.next() < foulProb) {
        event(ctx, tDecision, "concedido", "non_shooting_foul", [fouler, "O1"], `Falta personal sin tiro de ${fouler} en la trampa: contacto sobre O1 al cerrarla.`, {
          foulerId: fouler,
          fouledId: "O1",
          situation: "trampa",
          foulProbability: foulProb,
        });
        auditDecision(ctx, tDecision, {
          point: "puerta_falta_sin_tiro",
          holderId: "O1",
          participants: [fouler, "O1"],
          chosenOptionId: "ilegal",
          factLinkKind: "non_shooting_foul",
          rngStateBefore: rngBeforeFoul,
          rngStateAfter: rngStateOf(ctx.rng),
          options: [
            { id: "legal", status: "descartada_por_condicion", reasonCode: "containment_gate_legal", values: { situation: "trampa", foulProbability: foulProb } },
            { id: "ilegal", status: "elegida", reasonCode: "contact_foul_drawn", values: { situation: "trampa", foulProbability: foulProb, foulerM07: player(ctx, fouler).attributes.M07 } },
          ],
        });
        return finalize(ctx, { kind: "non_shooting_foul", foulerId: fouler, fouledId: "O1" }, { status: "dead", holderId: null, position: screenPoint });
      }
    }
    const rngBeforeSteal = rngStateOf(ctx.rng);
    const isStripped = resolvesTurnoverUnderPressure(o1.attributes.T07, worstT15, ctx.rng);
    auditDecision(ctx, tDecision, {
      point: "lectura_trampa",
      holderId: "O1",
      participants: ["O1", "D1", "D5"],
      chosenOptionId: isStripped ? "perdida_bajo_presion" : "pase_o5",
      rngStateBefore: rngBeforeSteal,
      rngStateAfter: rngStateOf(ctx.rng),
      options: [
        { id: "trampa_cerrada", status: "elegida", reasonCode: "trap_closed_before_pass", values: { tD5TrapArrivalSeconds: tD5TrapArrival, tPassArrivalToO5Seconds: tPassArrivalToO5 } },
        { id: "perdida_bajo_presion", status: isStripped ? "elegida" : "descartada_por_condicion", reasonCode: "not_available", values: { t07: o1.attributes.T07, worstT15 } },
        { id: "pase_o5", status: isStripped ? "no_evaluada_por_cortocircuito" : "elegida", reasonCode: "not_available" },
      ],
    });
    if (isStripped) {
      event(
        ctx,
        tDecision,
        "concedido",
        "turnover",
        ["D1", "D5"],
        "La trampa cerrada fuerza la pérdida de O1 bajo presión real de dos defensores.",
      );
      return finalize(ctx, { kind: "steal_by_defense" }, { status: "held", holderId: "D5", position: screenPoint });
    }

    // Sin pérdida: O1 busca a O5 en el short roll antes de que D3 lo niegue.
    const tPassArrival = tPassArrivalToO5;
    const passOutcome = resolvePass(o1.attributes.T09, o5.attributes.T11, true, d3.attributes.T17, 1, ctx.rng);
    event(ctx, tPassArrival, "ejecutado", "pass_released", ["O1", "O5"], "O1, ya comprometido en la trampa, busca a O5 en el short roll.");

    if (passOutcome.kind === "deflected_loose_ball") {
      return resolveLooseBallAfterPass(ctx, tPassArrival, "O1", "D3");
    }

    const readyDelay = passOutcome.kind === "awkward_control" ? passOutcome.extraDelaySeconds : 0;
    const tO5Ready = tPassArrival + readyDelay + CLOSE_FINISH_PREP_SECONDS;
    event(ctx, tPassArrival, "concedido", "pass_received", ["O5"], "O5 recibe el balón en el short roll con la trampa ya cerrada sobre O1.");

    // Si D3 (low man) no llega a contener a O5 a tiempo, el 4x3 sigue vivo:
    // O5 puede leer directamente la salida exterior que dejó D4 (O4).
    if (tD3LowManArrival > tO5Ready) {
      const tPassArrivalO4 = tO5Ready + PASS_RELEASE_SECONDS + distanceSeconds(ctx.set.shortRoll, ctx.positions.O4!);
      const tPrepReadyO4 = tPassArrivalO4 + CATCH_AND_SHOOT_PREP_SECONDS;
      auditDecision(ctx, tO5Ready, {
        point: "lectura_trampa",
        holderId: "O5",
        participants: ["O5", "D3", "O4"],
        chosenOptionId: "trap_broken_o4",
        options: [
          { id: "trap_broken_o4", status: "elegida", reasonCode: "trap_broken_lane_open", values: { tD3LowManArrivalSeconds: tD3LowManArrival, tO5ReadySeconds: tO5Ready } },
          { id: "invertir_o3", status: "no_evaluada_por_cortocircuito", reasonCode: "not_evaluated_short_circuit" },
          shortCircuited("finalizar_bajo_contencion"),
        ],
      });
      event(
        ctx,
        tO5Ready,
        "reconocido",
        "trap_broken_advantage",
        ["O5", "O4"],
        "La trampa se rompe: O5 ve a O4 libre por la rotación de D4 y el ataque juega con ventaja mientras dure.",
      );
      const o4Outcome = resolvePass(o5.attributes.T09, o4.attributes.T11, false, d4.attributes.T17, 0, ctx.rng);
      event(ctx, tPassArrivalO4, "ejecutado", "pass_released", ["O5", "O4"], "O5 encuentra a O4 libre por la salida exterior.");
      const o4ReadyDelay = o4Outcome.kind === "awkward_control" ? o4Outcome.extraDelaySeconds : 0;
      event(ctx, tPassArrivalO4, "concedido", "pass_received", ["O4"], "O4 recibe libre en la salida exterior.");
      const o4ShotType: ShotType = isBehindThreePointLine(ctx.positions.O4!) ? "three_point" : "close_finish";
      return resolveShotAttempt(ctx, {
        shooterId: "O4",
        shooterSkill: o4ShotType === "three_point" ? o4.attributes.T04 : o4.attributes.T01,
        shotType: o4ShotType,
        shooterPos: ctx.positions.O4!,
        tReady: tPrepReadyO4 + o4ReadyDelay,
        prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + o4ReadyDelay,
        contesterId: "D2",
        contesterArrival: Infinity,
        contesterGeometry: {
          originPos: ctx.positions.D2!,
          destinationPos: ctx.positions.O4!,
          speedMps: defenderLateralSpeedMps(d5.attributes.F04),
          brakingExtraSeconds: 0.16,
        },
      });
    }

    // D3 sí contiene el short roll a tiempo: O5 puede todavía invertir hacia
    // O3 en la esquina débil si D4 no ha cerrado esa ventana (misma lectura
    // de inversión que en drop, C2), antes de forzar el tiro bajo contención.
    const tPassArrivalO3 = tO5Ready + PASS_RELEASE_SECONDS + distanceSeconds(ctx.set.shortRoll, ctx.set.helpLeftSpot);
    const tPrepReadyO3 = tPassArrivalO3 + CATCH_AND_SHOOT_PREP_SECONDS;
    const marginO3 = tD4ArriveAtCorner - tPrepReadyO3;
    if (marginO3 >= 0.25) {
      const invertOutcome = resolvePass(o5.attributes.T09, o3.attributes.T11, true, d3.attributes.T17, 1, ctx.rng);
      event(ctx, tPassArrivalO3, "ejecutado", "pass_released", ["O5", "O3"], `O5 invierte hacia O3 ${ctx.set.helpLeftLabel}.`);
      auditDecision(ctx, tO5Ready, {
        point: "lectura_trampa",
        holderId: "O5",
        participants: ["O5", "O3", "D3", "D4"],
        chosenOptionId: "invertir_o3",
        factLinkKind: "pass_released",
        options: [
          { id: "trap_broken_o4", status: "descartada_por_condicion", reasonCode: "trap_broken_lane_open", reasonNote: "D3 (low man) sí llegó a tiempo a contener el short roll." },
          { id: "invertir_o3", status: "elegida", reasonCode: "corner_window_open", values: { marginO3Seconds: marginO3 } },
          shortCircuited("finalizar_bajo_contencion"),
          shortCircuited("segunda_entrada"),
        ],
      });
      if (invertOutcome.kind === "deflected_loose_ball") {
        return resolveLooseBallAfterPass(ctx, tPassArrivalO3, "O5", "D3");
      }
      const invertReadyDelay = invertOutcome.kind === "awkward_control" ? invertOutcome.extraDelaySeconds : 0;
      event(ctx, tPassArrivalO3, "concedido", "pass_received", ["O3"], "O3 recibe la inversión con ventana abierta.");
      return resolveShotAttempt(ctx, {
        shooterId: "O3",
        shooterSkill: shotSkill(o3, helpLeftShotType(ctx)),
        shotType: helpLeftShotType(ctx),
        shooterPos: ctx.set.helpLeftSpot,
        tReady: tPrepReadyO3 + invertReadyDelay,
        prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + invertReadyDelay,
        contesterId: "D4",
        contesterArrival: tD4ArriveAtCorner,
        contesterGeometry: d4CornerGeometry,
      });
    }

    // Primera lectura negada: D3 contiene el short roll y la inversión está cerrada (ME-04 §5).
    const kickOut = tryLinkedKickOut(ctx, tO5Ready, "D3");
    if (kickOut) {
      auditDecision(ctx, tO5Ready, {
        point: "lectura_trampa",
        holderId: "O5",
        participants: ["O5", "D3"],
        chosenOptionId: "segunda_entrada",
        options: [
          { id: "trap_broken_o4", status: "descartada_por_condicion", reasonCode: "trap_broken_lane_open", reasonNote: "D3 sí llegó a tiempo." },
          { id: "invertir_o3", status: "descartada_por_condicion", reasonCode: "corner_window_closed", values: { marginO3Seconds: marginO3 } },
          { id: "segunda_entrada", status: "elegida", reasonCode: "second_entry_viable_shortest_pass" },
        ],
      });
      return kickOut;
    }
    auditDecision(ctx, tO5Ready, {
      point: "lectura_trampa",
      holderId: "O5",
      participants: ["O5", "D3"],
      chosenOptionId: "finalizar_bajo_contencion",
      options: [
        { id: "trap_broken_o4", status: "descartada_por_condicion", reasonCode: "trap_broken_lane_open", reasonNote: "D3 sí llegó a tiempo." },
        { id: "invertir_o3", status: "descartada_por_condicion", reasonCode: "corner_window_closed", values: { marginO3Seconds: marginO3 } },
        { id: "segunda_entrada", status: "descartada_por_condicion", reasonCode: "second_entry_pass_line_blocked", reasonNote: "Ningún exterior fue viable; el detalle por candidato está en la decisión «segunda_entrada» del mismo instante." },
        { id: "finalizar_bajo_contencion", status: "elegida", reasonCode: "second_read_contained" },
      ],
    });

    return resolveShotAttempt(ctx, {
      shooterId: "O5",
      shooterSkill: o5.attributes.T01,
      shotType: "close_finish",
      shooterPos: ctx.positions.O5!,
      tReady: tO5Ready,
      prepSeconds: CLOSE_FINISH_PREP_SECONDS + readyDelay,
      contesterId: "D3",
      contesterArrival: tD3LowManArrival,
      contesterGeometry: d3RollGeometry,
    });
  }

  // --- Trampa aún no cerrada en el instante de decisión: D1/D5 recuperan
  // con trayecto, no por teletransporte; mientras tanto, D5 no protege el
  // aro y O1 puede escapar por el carril si de verdad lo tiene.
  event(
    ctx,
    tDecision,
    "reconocido",
    "trap_broken_advantage",
    ["O1"],
    "La trampa todavía no se ha cerrado cuando O1 decide: D5 no protege el aro y O1 puede intentar el carril.",
  );

  const o1TimeToHoop = timeToReach(ctx.positions.O1!, ATTACKED_HOOP, attackerMoveSpeedMps(o1.attributes.F01));
  const laneOpen = shotClockRemainingSeconds > 2;

  if (laneOpen) {
    auditDecision(ctx, tDecision, {
      point: "lectura_trampa",
      holderId: "O1",
      participants: ["O1", "D5"],
      chosenOptionId: "carril_o1",
      options: [
        { id: "trampa_cerrada", status: "descartada_por_condicion", reasonCode: "trap_broken_lane_open", values: { tD5TrapArrivalSeconds: tD5TrapArrival, tPassArrivalToO5Seconds: tPassArrivalToO5 } },
        { id: "carril_o1", status: "elegida", reasonCode: "trap_broken_lane_open", values: { shotClockRemainingSeconds, o1TimeToHoopSeconds: o1TimeToHoop } },
        shortCircuited("salida_segura"),
      ],
    });
    return resolveShotAttempt(ctx, {
      shooterId: "O1",
      shooterSkill: o1.attributes.T01,
      shotType: "close_finish",
      shooterPos: ATTACKED_HOOP,
      tReady: tDecision + o1TimeToHoop + CLOSE_FINISH_PREP_SECONDS,
      prepSeconds: CLOSE_FINISH_PREP_SECONDS,
      // D5 sigue de camino a la trampa, no protegiendo el aro: se
      // reconstruye su posición real (lejos del aro) con la misma
      // geometría, así que no hay contacto atribuible por defecto.
      contesterId: "D5",
      contesterArrival: tD5TrapArrival,
      contesterGeometry: { originPos: d5TrapOrigin, destinationPos: screenPoint, speedMps: d5TrapSpeed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d5.attributes.F03) },
    });
  }

  // Sin carril ni tiempo: D1/D5 acaban de recuperar su trayecto hacia la
  // trampa y O1 mantiene el control para reorganizarse (recuperación por
  // trayecto, no por teletransporte).
  event(
    ctx,
    tDecision,
    "concedido",
    "trap_recovered",
    ["D1", "D5"],
    "D1 y D5 recuperan su posición de trampa por trayecto; O1 no encontró carril a tiempo.",
  );
  auditDecision(ctx, tDecision, {
    point: "lectura_trampa",
    holderId: "O1",
    participants: ["O1", "D1", "D5", "O2"],
    chosenOptionId: "salida_segura",
    factLinkKind: "trap_recovered",
    options: [
      { id: "trampa_cerrada", status: "descartada_por_condicion", reasonCode: "trap_broken_lane_open", values: { tD5TrapArrivalSeconds: tD5TrapArrival } },
      { id: "carril_o1", status: "descartada_por_condicion", reasonCode: "trap_broken_no_lane_recovered", values: { shotClockRemainingSeconds } },
      { id: "salida_segura", status: "elegida", reasonCode: "safe_outlet_default" },
    ],
  });
  const tOutlet = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, ctx.positions.O2!);
  event(
    ctx,
    tOutlet,
    "concedido",
    "possession_continues",
    ["O1", "O2"],
    "O1 elige la salida segura hacia O2; el ataque conserva el control y se reorganiza.",
  );
  return finalize(
    ctx,
    { kind: "possession_reorganized_control_kept", outletPlayerId: "O2" },
    { status: "held", holderId: "O2", position: ctx.positions.O2! },
  );
}

// ============================================================================
// ME-06 §3: segunda familia posicional — mano a mano sin balón.
// ============================================================================

/**
 * Oportunidad comparable de entrada de cada familia (ME-06 §3.2; rehecha en
 * ME-07B v2 §2.2): sin RNG y sin ejecutar la vía descartada más allá de su
 * primera lectura proyectada en seco (`projectFamilyRead`). Los antiguos
 * estimadores ad hoc de cada familia (recepción limpia futura de O5 frente a
 * otra cadena distinta para la mano a mano) se retiraron.
 */
/**
 * ICE (ME-07B v2 §5, LAB-0.7): solo tiene sentido en un bloqueo lateral,
 * para impedir que el manejador vaya al centro. Ante el bloqueo central no es
 * elegible: se registra el motivo y la defensa juega drop (orden solicitada ≠
 * ejecutada, con su causa).
 *
 * Ante el bloqueo lateral: D1 reconoce la pantalla al prepararse (M01/M05) y
 * se coloca del lado del bloqueador, a contacto del manejador (F04); si llega
 * antes de que O1 use la pantalla, la niega y empuja hacia la línea de fondo,
 * donde D5 espera en la ayuda baja (M01/M05, T23). Si D1 llega tarde, O1 usa
 * la pantalla y se juega drop (`ice_late`). Con el ICE puesto, el bloqueador
 * se abre al centro (codo) y O1 lee: penetrar por fondo contra la ayuda baja,
 * tiro medio tras rechazar hacia fondo, pase al bloqueador abierto (la línea
 * pasa por D1, que puede desviarlo: T17), pase a la esquina fuerte (D2 en
 * casa) o salida segura. El ICE concede el bloqueador abierto y el tiro
 * medio; niega el centro, el triple tras la pantalla y el roll.
 */
function runIcePhase(ctx: CoreContext, scenario: ScenarioDefinition): PossessionCoreResult {
  const screenPoint = ctx.positions.O5!;
  if (!isLateralScreenSpot(screenPoint)) {
    event(ctx, 0, "reconocido", "coverage_not_applicable", ["D1", "D5"], "La orden es ICE, pero la pantalla es central (dentro de la franja de la zona): no hay banda a la que empujar; la defensa juega drop.", {
      requested: "ice",
      applied: "drop",
      screenPoint,
      lateral: false,
    });
    ctx.resolvedCoverage = "drop";
    return runDropPhase(ctx, scenario);
  }
  const o1 = player(ctx, "O1");
  const o2 = player(ctx, "O2");
  const o5 = player(ctx, "O5");
  const d1 = player(ctx, "D1");
  const d2 = player(ctx, "D2");
  const d3 = player(ctx, "D3");
  const d5 = player(ctx, "D5");
  const o1Start = ctx.positions.O1!;
  const o1UsePoint = pointShortOfTarget(o1Start, screenPoint, COMBINED_CONTACT_RADIUS_METERS);
  const tScreenSet = SCREEN_SET_AFTER_ARRIVAL_SECONDS;
  const tHandlerArrival = timeToReach(o1Start, o1UsePoint, attackerMoveSpeedMps(o1.attributes.F01));
  const tUseScreen = Math.max(tScreenSet, tHandlerArrival);
  event(ctx, tScreenSet, "ejecutado", "screen_set", ["O5"], "O5 llega y coloca su pantalla lateral.");

  // D1 se pone del lado de la pantalla, a contacto del manejador.
  const icePoint = moveToward(o1Start, screenPoint, 1, COMBINED_CONTACT_RADIUS_METERS);
  const tIceCall = recognitionLatencySeconds(d1.attributes.M01, d1.attributes.M05);
  const tD1Ice = tIceCall + distance(ctx.positions.D1!, icePoint) / defenderLateralSpeedMps(d1.attributes.F04);
  if (tD1Ice > tUseScreen) {
    event(ctx, tUseScreen, "reconocido", "ice_late", ["D1", "O1"], `D1 llega tarde a ponerse del lado de la pantalla (${tD1Ice.toFixed(2)} s frente a ${tUseScreen.toFixed(2)} s): O1 usa el bloqueo y la defensa juega drop.`, {
      requested: "ice",
      applied: "drop",
      icePoint,
      d1IceAt: tD1Ice,
      screenUsedAt: tUseScreen,
    });
    return runDropPhase(ctx, scenario);
  }
  setArrival(ctx, "D1", tD1Ice, icePoint, tIceCall);
  const tD5Call = recognitionLatencySeconds(d5.attributes.M01, d5.attributes.M05);
  const d5Speed = defenderLateralSpeedMps(d5.attributes.F04);
  const tD5Low = Math.max(tD5Call, tD5Call + distance(ctx.positions.D5!, ICE_LOW_HELP_SPOT) / d5Speed - interiorArrivalAdjustmentSeconds(d5.attributes.T23));
  setArrival(ctx, "D5", tD5Low, ICE_LOW_HELP_SPOT, tD5Call);
  event(ctx, tD1Ice, "ejecutado", "ice_committed", ["D1", "D5"], "ICE: D1 se pone del lado de la pantalla, niega el centro y empuja a O1 hacia la línea de fondo; D5 baja a la ayuda.", {
    icePoint,
    d1IceAt: tD1Ice,
    screenUsedAt: tUseScreen,
    lowHelpSpot: ICE_LOW_HELP_SPOT,
    d5LowAt: tD5Low,
  });
  // El bloqueador, con la pantalla negada, se abre al centro.
  const tO5Read = Math.max(tScreenSet, tD1Ice) + recognitionLatencySeconds(o5.attributes.M01, o5.attributes.M05);
  const tO5Pop = tO5Read + timeToReach(screenPoint, ICE_POP_SPOT, attackerMoveSpeedMps(o5.attributes.F01));
  setArrival(ctx, "O5", tO5Pop, ICE_POP_SPOT, tO5Read);
  event(ctx, tO5Pop, "ejecutado", "roll_continuation", ["O5"], "Con la pantalla negada, O5 se abre al centro mientras su defensor espera abajo.", { rollSpot: ICE_POP_SPOT });

  const tDecision = tD1Ice + recognitionLatencySeconds(o1.attributes.M01, o1.attributes.M05);
  const clock = ctx.shotClockMs / 1000;
  if (clock - tDecision <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, "O1");
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: "O1", position: o1Start });
  }
  const o1Speed = attackerMoveSpeedMps(o1.attributes.F01);
  const d1Slide = chaser(ctx, "D1", icePoint, tDecision, (p) => perimeterArrivalAdjustmentSeconds(p.attributes.T22));
  const d5FromLow = chaser(ctx, "D5", ICE_LOW_HELP_SPOT, Math.max(tD5Low, tDecision), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
  const d3Help = chaser(ctx, "D3", ctx.positions.D3!, tDecision + recognitionLatencySeconds(d3.attributes.M01, d3.attributes.M05), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));

  // Penetrar por fondo contra la ayuda baja.
  const tAtBaseline = tDecision + timeToReach(o1Start, ICE_BASELINE_DRIVE_SPOT, o1Speed);
  const tRimReady = tAtBaseline + timeToReach(ICE_BASELINE_DRIVE_SPOT, ATTACKED_HOOP, o1Speed) + CLOSE_FINISH_PREP_SECONDS;
  const rim = bestContest(ctx, [d5FromLow, d1Slide], ATTACKED_HOOP, tRimReady, CLOSE_FINISH_PREP_SECONDS)!;
  const rimValue = tRimReady < clock && !rim.occupied ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o1.attributes.T01, rim.level) : -Infinity;
  // Tiro medio tras rechazar hacia fondo.
  const pullUpPrep = movingShotPrepSeconds(o1.attributes.T06);
  const tPullUpReady = tDecision + timeToReach(o1Start, ICE_BASELINE_PULL_UP_SPOT, o1Speed) + pullUpPrep;
  const pullUp = bestContest(ctx, [d1Slide, d5FromLow], ICE_BASELINE_PULL_UP_SPOT, tPullUpReady, pullUpPrep)!;
  const pullUpType: ShotType = isMidRangeZone(ICE_BASELINE_PULL_UP_SPOT) ? "mid_range" : "floater";
  const pullUpValue = tPullUpReady < clock ? 2 * shotProbability(shotBaseProbability(pullUpType), shotSkill(o1, pullUpType), pullUp.level) : -Infinity;
  // Pase al bloqueador abierto en el codo: la línea pasa por D1.
  const tPopPass = Math.max(tO5Pop, tDecision + PASS_RELEASE_SECONDS + distanceSeconds(o1Start, ICE_POP_SPOT));
  const envAt = (): RollReceiverEnv => ({
    receiverId: "O5",
    receiverPos: ICE_POP_SPOT,
    rimCandidates: [d5FromLow, d3Help],
    floaterCandidates: [d5FromLow],
    invert: null,
  });
  const projectedReceiver = readRollReceiver(ctx, envAt(), tPopPass);
  const popValue = Math.max(-Infinity, ...projectedReceiver.map((o) => o.value));
  const popCompletion = 1 - deflectionProbability(d1.attributes.T17, o1.attributes.T09);
  // Pase a la esquina fuerte, con D2 en casa.
  const cornerPos = ctx.positions.O2!;
  const tCornerArrival = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(o1Start, cornerPos);
  const tCornerReady = tCornerArrival + CATCH_AND_SHOOT_PREP_SECONDS;
  const d2Home = chaser(ctx, "D2", ctx.positions.D2!, tDecision, (p) => perimeterArrivalAdjustmentSeconds(p.attributes.T22));
  const corner = bestContest(ctx, [d2Home], cornerPos, tCornerReady, CATCH_AND_SHOOT_PREP_SECONDS)!;
  const cornerValue = isBehindThreePointLine(cornerPos) && tCornerReady < clock ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o2.attributes.T04, corner.level) : -Infinity;
  const cornerCompletion = 1 - deflectionProbability(d2.attributes.T17, o1.attributes.T09);

  const options: HandlerReadOption[] = [
    {
      id: "penetrar_fondo",
      value: rimValue,
      completion: 1,
      kind: "tiro",
      values: { contesterId: realId(ctx, rim.id), opposition: rim.level, readySeconds: tRimReady, rimOccupied: rim.occupied, d5LowSeconds: tD5Low },
      execute: (record) => {
        setArrival(ctx, "O1", tAtBaseline, ICE_BASELINE_DRIVE_SPOT, tDecision);
        record();
        return resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: o1.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tRimReady, prepSeconds: CLOSE_FINISH_PREP_SECONDS, contesterId: rim.id, contesterArrival: rim.arrival, contesterGeometry: rim.geometry });
      },
    },
    {
      id: "parada_fondo",
      value: pullUpValue,
      completion: 1,
      kind: "tiro",
      values: { contesterId: realId(ctx, pullUp.id), opposition: pullUp.level, readySeconds: tPullUpReady, shotType: pullUpType },
      execute: (record) => {
        record();
        return resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: shotSkill(o1, pullUpType), shotType: pullUpType, shooterPos: ICE_BASELINE_PULL_UP_SPOT, tReady: tPullUpReady, prepSeconds: pullUpPrep, contesterId: pullUp.id, contesterArrival: pullUp.arrival, contesterGeometry: pullUp.geometry });
      },
    },
    {
      id: "pase_o5",
      value: popValue,
      completion: popCompletion,
      kind: "pase",
      values: { receiverBestOption: [...projectedReceiver].sort((a, b) => b.value - a.value)[0]?.id ?? null, deflectorId: realId(ctx, "D1"), popReadySeconds: tO5Pop },
      execute: (record) => executeRollPass(ctx, { tPassArrival: tPopPass, deflectorId: "D1", envAt, record, note: "O1 pasa al bloqueador, abierto en el codo mientras su defensor espera abajo." }),
    },
    {
      id: "pase_esquina_o2",
      value: cornerValue,
      completion: cornerCompletion,
      kind: "pase",
      values: { contesterId: realId(ctx, corner.id), opposition: corner.level, readySeconds: tCornerReady },
      execute: (record) => {
        const outcome = resolvePass(o1.attributes.T09, o2.attributes.T11, true, d2.attributes.T17, 1, ctx.rng);
        event(ctx, tCornerArrival, "ejecutado", "pass_released", ["O1", "O2"], "O1, empujado hacia fondo, saca el balón a la esquina fuerte.");
        record("pass_released");
        if (outcome.kind === "deflected_loose_ball") return resolveLooseBallAfterPass(ctx, tCornerArrival, "O1", "D2");
        const delay = outcome.kind === "awkward_control" ? outcome.extraDelaySeconds : 0;
        event(ctx, tCornerArrival, "concedido", "pass_received", ["O2"], "O2 recibe en la esquina.");
        return resolveShotAttempt(ctx, { shooterId: "O2", shooterSkill: o2.attributes.T04, shotType: "three_point", shooterPos: cornerPos, tReady: tCornerReady + delay, prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + delay, contesterId: corner.id, contesterArrival: corner.arrival, contesterGeometry: corner.geometry });
      },
    },
    { id: "salida_segura", value: 0, completion: 1, kind: "salida", values: {}, execute: (record) => executeSafeOutlet(ctx, tDecision, record) },
  ];
  return decideHandlerRead(ctx, "lectura_ice", tDecision, ["O1", "O5", "D1", "D5"], options);
}

// --- ME-07B v2 §5: cambio (switch) y show (hedge) ---------------------------

/**
 * Vía de una lectura del manejador descrita como datos (primitiva «lectura»
 * de §3): valor situacional frente al mejor cierre real, probabilidad de
 * completar el pase previo (para la proyección), tipo (tiro, pase o
 * salida) y su ejecución. `execute` recibe el registrador de la decisión
 * para enlazarla con el hecho que realmente emite.
 */
interface HandlerReadOption {
  readonly id: string;
  readonly value: number;
  readonly completion: number;
  readonly kind: "tiro" | "pase" | "salida";
  readonly values: Record<string, number | string | boolean | null>;
  readonly execute: (record: (factLinkKind?: string) => void) => PossessionCoreResult;
}

/**
 * Decide entre las vías del manejador: mayor valor esperado (valor ×
 * completar el pase); en la banda de empate decide su tendencia de tiro
 * (`decidida` → tiro, `prudente` → pase o salida). En proyección en seco
 * devuelve las vías sin ejecutar ninguna.
 */
function decideHandlerRead(
  ctx: CoreContext,
  point: AuditDecisionPoint,
  tDecision: number,
  participants: readonly string[],
  options: readonly HandlerReadOption[],
  /** Quien lee (por defecto el manejador O1; en Delay, el pívot que se la queda o el poste). */
  holderSlot: string = "O1",
): PossessionCoreResult {
  if (ctx.projecting) {
    throw new ReadProjectionReached({ tDecisionSeconds: tDecision, options: options.map((o) => ({ id: o.id, value: o.value, completion: o.completion })) });
  }
  const expected = (o: HandlerReadOption) => (Number.isFinite(o.value) ? o.value * o.completion : -Infinity);
  const viable = options.filter((o) => Number.isFinite(o.value)).sort((a, b) => expected(b) - expected(a));
  let chosen = viable[0]!;
  let byTendency = false;
  const band = viable.filter((o) => expected(chosen) - expected(o) <= FIRST_READ_TIE_BAND_POINTS);
  const tendency = player(ctx, holderSlot).shotTendency;
  const pick = tendency === "decidida" ? band.find((o) => o.kind === "tiro") : tendency === "prudente" ? band.find((o) => o.kind !== "tiro") : undefined;
  if (pick && pick !== chosen) {
    chosen = pick;
    byTendency = true;
  }
  const records: AuditOptionRecord[] = options.map((o) => ({
    id: o.id,
    status: o === chosen ? "elegida" : "descartada_por_condicion",
    reasonCode:
      o === chosen
        ? byTendency
          ? o.kind === "tiro"
            ? "shot_tendency_favors_shot"
            : "shot_tendency_favors_continuation"
          : "read_value_higher"
        : !Number.isFinite(o.value)
          ? "read_option_not_viable"
          : byTendency && expected(chosen) - expected(o) <= FIRST_READ_TIE_BAND_POINTS
            ? "tie_band_resolved_by_tendency"
            : "read_value_lower",
    values: { ...o.values, situationalValue: Number.isFinite(o.value) ? o.value : null, completion: o.completion },
  }));
  return chosen.execute((factLinkKind) =>
    auditDecision(ctx, tDecision, { point, holderId: holderSlot, participants, chosenOptionId: chosen.id, factLinkKind, options: records }),
  );
}

/**
 * Pase al continuador y su lectura al recibir (sin segunda entrada): mismo
 * pase con desvío T09/T17 que el resto del árbol y la misma lectura del
 * receptor (`readRollReceiver`) con el instante real de recepción.
 */
function executeRollPass(
  ctx: CoreContext,
  args: {
    readonly tPassArrival: number;
    readonly deflectorId: string;
    readonly envAt: (tAct: number) => RollReceiverEnv;
    readonly record: (factLinkKind?: string) => void;
    readonly note: string;
  },
): PossessionCoreResult {
  const o1 = player(ctx, "O1");
  const o5 = player(ctx, "O5");
  const passOutcome = resolvePass(o1.attributes.T09, o5.attributes.T11, true, player(ctx, args.deflectorId).attributes.T17, 1, ctx.rng);
  event(ctx, args.tPassArrival, "ejecutado", "pass_released", ["O1", "O5"], args.note);
  args.record("pass_released");
  if (passOutcome.kind === "deflected_loose_ball") return resolveLooseBallAfterPass(ctx, args.tPassArrival, "O1", args.deflectorId);
  const readyDelay = passOutcome.kind === "awkward_control" ? passOutcome.extraDelaySeconds : 0;
  const tAct = args.tPassArrival + readyDelay;
  event(ctx, args.tPassArrival, "concedido", "pass_received", ["O5"], "O5 recibe el balón en el roll.");
  const env = args.envAt(tAct);
  const options = readRollReceiver(ctx, env, tAct);
  const outOfClock = rollReceiverOutOfClock(ctx, tAct, options);
  if (outOfClock) return outOfClock;
  const { chosen, byTendency } = chooseRollReceiverOption(ctx, "O5", options);
  const records: AuditOptionRecord[] = options.map((o) =>
    o === chosen
      ? { id: o.id, status: "elegida", reasonCode: byTendency ? (o.shot ? "shot_tendency_favors_shot" : "shot_tendency_favors_continuation") : "receiver_value_higher", values: o.values }
      : { id: o.id, status: "descartada_por_condicion", reasonCode: Number.isFinite(o.value) ? (byTendency ? "tie_band_resolved_by_tendency" : "receiver_value_lower") : "receiver_option_not_viable", values: o.values },
  );
  if (chosen.id === "invertir_o3" && env.invert) {
    const o3 = player(ctx, "O3");
    const tPassArrivalO3 = Math.max(tAct + PASS_RELEASE_SECONDS + distanceSeconds(env.receiverPos, ctx.set.helpLeftSpot), env.invert.targetReadySeconds ?? 0);
    const invertOutcome = resolvePass(o5.attributes.T09, o3.attributes.T11, true, player(ctx, env.invert.deflectorId).attributes.T17, 1, ctx.rng);
    event(ctx, tPassArrivalO3, "ejecutado", "pass_released", ["O5", "O3"], `O5 invierte hacia O3 ${ctx.set.helpLeftLabel}.`);
    auditDecision(ctx, tAct, { point: "lectura_segunda_o5", holderId: "O5", participants: ["O5", "O3", env.invert.closerId], chosenOptionId: chosen.id, factLinkKind: "pass_released", options: records });
    if (invertOutcome.kind === "deflected_loose_ball") return resolveLooseBallAfterPass(ctx, tPassArrivalO3, "O5", env.invert.deflectorId);
    const invertDelay = invertOutcome.kind === "awkward_control" ? invertOutcome.extraDelaySeconds : 0;
    event(ctx, tPassArrivalO3, "concedido", "pass_received", ["O3"], "O3 recibe la inversión.");
    return resolveShotAttempt(ctx, {
      shooterId: "O3",
      shooterSkill: shotSkill(o3, helpLeftShotType(ctx)),
      shotType: helpLeftShotType(ctx),
      shooterPos: ctx.set.helpLeftSpot,
      tReady: tPassArrivalO3 + CATCH_AND_SHOOT_PREP_SECONDS + invertDelay,
      prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + invertDelay,
      contesterId: env.invert.closerId,
      contesterArrival: env.invert.closerArrival,
      contesterGeometry: env.invert.closerGeometry,
    });
  }
  const shot = chosen.shot!;
  auditDecision(ctx, tAct, { point: "lectura_segunda_o5", holderId: "O5", participants: ["O5", shot.contesterId], chosenOptionId: chosen.id, options: records });
  return resolveShotAttempt(ctx, { ...shot, prepSeconds: shot.prepSeconds + readyDelay });
}

/** Salida segura común: el ataque conserva el control y se reorganiza. */
function executeSafeOutlet(ctx: CoreContext, tDecision: number, record: (factLinkKind?: string) => void, extra: Partial<PossessionCoreResult> = {}): PossessionCoreResult {
  const outletTarget = distanceSeconds(ctx.positions.O1!, ctx.positions.O4!) < distanceSeconds(ctx.positions.O1!, ctx.positions.O2!) ? "O4" : "O2";
  const tOutlet = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, ctx.positions[outletTarget]!);
  event(ctx, tOutlet, "concedido", "possession_continues", ["O1", outletTarget], `O1 elige la salida segura hacia ${outletTarget}; el ataque conserva el control y se reorganiza.`);
  record("possession_continues");
  return {
    ...finalize(ctx, { kind: "possession_reorganized_control_kept", outletPlayerId: outletTarget }, { status: "held", holderId: outletTarget, position: ctx.positions[outletTarget]! }),
    ...extra,
  };
}

/** Pantalla común del bloqueo directo (central o lateral): O1 llega al punto de uso, O5 coloca y continúa al short roll. */
function setUpCentralScreen(ctx: CoreContext): {
  readonly screenPoint: Point2D;
  readonly o1UsePoint: Point2D;
  readonly tUseScreen: number;
  readonly tRollStart: number;
  readonly tRollReady: number;
} {
  const o1 = player(ctx, "O1");
  const o5 = player(ctx, "O5");
  const screenPoint = ctx.positions.O5!;
  const o1UsePoint = pointShortOfTarget(ctx.positions.O1!, screenPoint, COMBINED_CONTACT_RADIUS_METERS);
  const tScreenSet = SCREEN_SET_AFTER_ARRIVAL_SECONDS;
  const tHandlerArrival = timeToReach(ctx.positions.O1!, o1UsePoint, attackerMoveSpeedMps(o1.attributes.F01));
  const tUseScreen = Math.max(tScreenSet, tHandlerArrival);
  event(ctx, tScreenSet, "ejecutado", "screen_set", ["O5"], `O5 llega y coloca su pantalla ${ctx.set.placement}.`, { placement: ctx.set.placement });
  setArrival(ctx, "O1", tHandlerArrival, o1UsePoint, 0);
  const continuationShift = screenCoordinationShiftSeconds(o5.attributes.M04);
  const rollTravelSeconds = timeToReach(screenPoint, ctx.set.shortRoll, attackerMoveSpeedMps(o5.attributes.F01));
  const tRollReady = Math.max(0.05, tUseScreen - continuationShift + rollTravelSeconds);
  setArrival(ctx, "O5", tRollReady, ctx.set.shortRoll, tRollReady - rollTravelSeconds);
  event(ctx, tRollReady, "ejecutado", "roll_continuation", ["O5"], "O5 continúa hacia el short roll tras la pantalla.", { rollSpot: ctx.set.shortRoll });
  return { screenPoint, o1UsePoint, tUseScreen, tRollStart: tRollReady - rollTravelSeconds, tRollReady };
}

/** Candidato a cerrar que sale desde `origin` en `depart` hacia el punto de tiro, con su velocidad lateral y ajuste. */
function chaser(ctx: CoreContext, id: string, origin: Point2D, depart: number, adjustment: (p: PlayerProfile) => number = () => 0): ContestCandidate {
  const p = player(ctx, id);
  const speed = defenderLateralSpeedMps(p.attributes.F04);
  return {
    id,
    geometryTo: (spot) => ({
      geometry: { originPos: origin, destinationPos: spot, speedMps: speed, brakingExtraSeconds: closeoutBrakingExtraSeconds(p.attributes.F03) },
      arrivalSeconds: Math.max(depart, depart + distance(origin, spot) / speed - adjustment(p)),
    }),
  };
}

/**
 * Cambio (switch) ante el bloqueo directo (ME-07B v2 §5). D5 reconoce la
 * pantalla mientras se prepara (M01/M05, como la trampa), canta el cambio y
 * sale a la altura del bloqueo, delante del punto de uso (T22); D1 recibe el
 * aviso (M09) y se queda con el bloqueador, que continúa al short roll (T23).
 * Nadie navega la pantalla. O1 lee frente al pívot que le ha tomado: atacar
 * el aro (lo cierran D5 persiguiendo, D1 desde el roll y D3 desde el lado
 * débil), triple por encima del cambio, pase al continuador emparejado con
 * D1 o salida segura. El emparejamiento cambiado persiste el resto de la
 * posesión (`defensiveSwap`): el desajuste es una consecuencia, no un
 * instante.
 */
function runSwitchPhase(ctx: CoreContext): PossessionCoreResult {
  const o1 = player(ctx, "O1");
  const d1 = player(ctx, "D1");
  const d5 = player(ctx, "D5");
  const swap: Partial<PossessionCoreResult> = { defensiveSwap: ["D1", "D5"] };
  const { o1UsePoint, tUseScreen, tRollReady } = setUpCentralScreen(ctx);

  const tSwitchCall = recognitionLatencySeconds(d5.attributes.M01, d5.attributes.M05);
  const d5Origin = ctx.positions.D5!;
  const switchPoint = moveToward(o1UsePoint, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS);
  const d5Speed = defenderLateralSpeedMps(d5.attributes.F04);
  const tD5Switch = Math.max(tSwitchCall, tSwitchCall + distance(d5Origin, switchPoint) / d5Speed - perimeterArrivalAdjustmentSeconds(d5.attributes.T22));
  setArrival(ctx, "D5", tD5Switch, switchPoint, tSwitchCall);
  const tD1Call = tSwitchCall + m09CoordinationLatencySeconds(d5.attributes.M09, d1.attributes.M09);
  const d1Origin = ctx.positions.D1!;
  const d1Speed = defenderLateralSpeedMps(d1.attributes.F04);
  const tD1OnRoller = Math.max(tD1Call, tD1Call + distance(d1Origin, ctx.set.shortRoll) / d1Speed - interiorArrivalAdjustmentSeconds(d1.attributes.T23));
  setArrival(ctx, "D1", tD1OnRoller, pointShortOfTarget(d1Origin, ctx.set.shortRoll, COMBINED_CONTACT_RADIUS_METERS), tD1Call);
  event(ctx, tSwitchCall, "reconocido", "switch_committed", ["D5", "D1"], `D5 canta el cambio: sale a tomar a O1 a la altura de la pantalla y D1 se queda con O5.`, {
    switchPoint,
    d5ArrivesAt: tD5Switch,
    d1OnRollerAt: tD1OnRoller,
  });

  const tDecision = tUseScreen + recognitionLatencySeconds(o1.attributes.M01, o1.attributes.M05);
  const clock = ctx.shotClockMs / 1000;
  if (clock - tDecision <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, "O1");
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: "O1", position: ctx.positions.O1! });
  }
  const d3 = player(ctx, "D3");
  const d3Help = chaser(ctx, "D3", ctx.positions.D3!, tDecision + recognitionLatencySeconds(d3.attributes.M01, d3.attributes.M05), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
  const d5Chase = chaser(ctx, "D5", switchPoint, Math.max(tD5Switch, tDecision), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
  const d1FromRoll = chaser(ctx, "D1", pointShortOfTarget(d1Origin, ctx.set.shortRoll, COMBINED_CONTACT_RADIUS_METERS), tD1OnRoller);

  // Atacar el cambio: carrera al aro frente al pívot que le ha tomado.
  const tRimReady = tDecision + timeToReach(o1UsePoint, ATTACKED_HOOP, attackerMoveSpeedMps(o1.attributes.F01)) + CLOSE_FINISH_PREP_SECONDS;
  const rim = bestContest(ctx, [d5Chase, d1FromRoll, d3Help], ATTACKED_HOOP, tRimReady, CLOSE_FINISH_PREP_SECONDS)!;
  const rimValue = tRimReady < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o1.attributes.T01, rim.level) : -Infinity;
  // Triple por encima del cambio: D5 ya delante (o llegando) cierra desde su trayectoria real.
  const tTripleReady = tDecision + movingShotPrepSeconds(o1.attributes.T06);
  const d5AtLevel: ContestCandidate = {
    id: "D5",
    geometryTo: () => ({ geometry: { originPos: d5Origin, destinationPos: switchPoint, speedMps: d5Speed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d5.attributes.F03) }, arrivalSeconds: tD5Switch }),
  };
  const triple = bestContest(ctx, [d5AtLevel], o1UsePoint, tTripleReady, movingShotPrepSeconds(o1.attributes.T06))!;
  const tripleValue = isBehindThreePointLine(o1UsePoint) && tTripleReady < clock ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o1.attributes.T04, triple.level) : -Infinity;
  // Pase al continuador, emparejado con D1 (posible desajuste interior).
  const tPassArrival = Math.max(tRollReady, tDecision + PASS_RELEASE_SECONDS + distanceSeconds(o1UsePoint, ctx.set.shortRoll));
  const envAt = (): RollReceiverEnv => ({
    receiverId: "O5",
    receiverPos: ctx.set.shortRoll,
    rimCandidates: [d1FromRoll, d3Help],
    floaterCandidates: [d1FromRoll],
    invert: null,
  });
  const projectedReceiver = readRollReceiver(ctx, envAt(), tPassArrival);
  const passValue = Math.max(-Infinity, ...projectedReceiver.map((o) => o.value));
  const passCompletion = 1 - deflectionProbability(d5.attributes.T17, o1.attributes.T09);

  const options: HandlerReadOption[] = [
    {
      id: "atacar_cambio",
      value: rimValue,
      completion: 1,
      kind: "tiro",
      values: { contesterId: realId(ctx, rim.id), opposition: rim.level, readySeconds: tRimReady, switcherF04: d5.attributes.F04 },
      execute: (record) => {
        record();
        return { ...resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: o1.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tRimReady, prepSeconds: CLOSE_FINISH_PREP_SECONDS, contesterId: rim.id, contesterArrival: rim.arrival, contesterGeometry: rim.geometry }), ...swap };
      },
    },
    {
      id: "triple_o1",
      value: tripleValue,
      completion: 1,
      kind: "tiro",
      values: { contesterId: realId(ctx, triple.id), opposition: triple.level, behindLine: isBehindThreePointLine(o1UsePoint) },
      execute: (record) => {
        record();
        return { ...resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: o1.attributes.T04, shotType: "three_point", shooterPos: o1UsePoint, tReady: tTripleReady, prepSeconds: movingShotPrepSeconds(o1.attributes.T06), contesterId: triple.id, contesterArrival: triple.arrival, contesterGeometry: triple.geometry }), ...swap };
      },
    },
    {
      id: "pase_o5",
      value: passValue,
      completion: passCompletion,
      kind: "pase",
      values: { receiverBestOption: [...projectedReceiver].sort((a, b) => b.value - a.value)[0]?.id ?? null, mismatchDefenderId: realId(ctx, "D1") },
      execute: (record) => ({ ...executeRollPass(ctx, { tPassArrival, deflectorId: "D5", envAt, record, note: "O1 pasa al continuador O5, emparejado con D1 tras el cambio." }), ...swap }),
    },
    { id: "salida_segura", value: 0, completion: 1, kind: "salida", values: {}, execute: (record) => executeSafeOutlet(ctx, tDecision, record, swap) },
  ];
  return decideHandlerRead(ctx, "lectura_cambio", tDecision, ["O1", "O5", "D1", "D5"], options);
}

/**
 * Show (hedge) y «a la altura» (at the level) ante el bloqueo directo
 * (ME-07B v2 §5, LAB-0.7). Comparten la primitiva «el pívot sube al bloqueo»
 * pero se distinguen en profundidad, orden y responsabilidad:
 *
 * - **Show:** D5 sale **a la línea del manejador**, a contacto del punto de
 *   uso (M01/M05 desde la preparación, T22), y le frena: si llega antes de
 *   que O1 decida, O1 no puede arrancar hacia el aro hasta que D5 se retira
 *   (cuando D1 ha superado la pantalla, aviso M09) y D5 vuelve **al aro**
 *   (T23). Concede el roll mientras vuelve.
 * - **A la altura:** D5 sube solo **a la altura del bloqueador**, a su lado
 *   hacia el aro, sin meterse en la salida del manejador: O1 dobla la
 *   esquina sin pausa, pero D5 le contiene desde cerca (sale con él al
 *   decidir) y, cuando D1 se recupera (M09), vuelve **con el continuador**
 *   (camino corto). Concede menos roll y más penetración contenida.
 *
 * D1 navega la pantalla con su retraso real; D3 decide la ayuda al
 * continuador comparando concesiones, como en drop. O1 lee: atacar el aro,
 * triple, pase al roll o salida segura.
 */
type BigUpDepth = "show" | "a_la_altura";

function runShowPhase(ctx: CoreContext, scenario: ScenarioDefinition, depth: BigUpDepth = "show"): PossessionCoreResult {
  const o1 = player(ctx, "O1");
  const o5 = player(ctx, "O5");
  const d1 = player(ctx, "D1");
  const d5 = player(ctx, "D5");
  const atLevel = depth === "a_la_altura";
  const { screenPoint, o1UsePoint, tUseScreen, tRollReady } = setUpCentralScreen(ctx);
  const screenDelay =
    screenInterceptDelaySeconds(o5.attributes.T13, o5.attributes.F05, d1.attributes.T16) + screenContactAdjustmentSeconds(o5.measures.weightKg - d1.measures.weightKg);
  const tD1Back = tUseScreen + screenDelay;
  setArrival(ctx, "D1", tD1Back, o1UsePoint, 0);
  event(ctx, tUseScreen, "ejecutado", "screen_navigated", ["O1", "D1"], `O1 usa la pantalla de O5; D1 navega con un retraso de ${screenDelay.toFixed(2)} s.`, { screenDelay });

  const tCall = recognitionLatencySeconds(d5.attributes.M01, d5.attributes.M05);
  const d5Origin = ctx.positions.D5!;
  // Show: a contacto del punto de uso, en la línea del manejador. A la
  // altura: a contacto del bloqueador, a su lado hacia el aro.
  const upPoint = atLevel
    ? moveToward(screenPoint, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS)
    : moveToward(o1UsePoint, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS);
  const d5Speed = defenderLateralSpeedMps(d5.attributes.F04);
  const tD5Up = Math.max(tCall, tCall + distance(d5Origin, upPoint) / d5Speed - perimeterArrivalAdjustmentSeconds(d5.attributes.T22));
  const tRecoverStart = Math.max(tD5Up, tD1Back) + m09CoordinationLatencySeconds(d1.attributes.M09, d5.attributes.M09);
  // Show: vuelve al aro. A la altura: vuelve con el continuador.
  const recoverTo = atLevel ? ctx.set.shortRoll : ATTACKED_HOOP;
  const tD5Home = tRecoverStart + distance(upPoint, recoverTo) / d5Speed - interiorArrivalAdjustmentSeconds(d5.attributes.T23);
  setArrival(ctx, "D5", tD5Up, upPoint, tCall);
  const depthToHoop = distance(upPoint, ATTACKED_HOOP);
  if (atLevel) {
    event(ctx, tD5Up, "ejecutado", "at_level_committed", ["D5"], "D5 sube a la altura del bloqueo, al lado de O5, para contener a O1 sin salirle a la línea.", { atLevelPoint: upPoint, depthToHoop, recoverStart: tRecoverStart, withRollerAt: tD5Home });
    event(ctx, tRecoverStart, "reconocido", "at_level_recovery", ["D5", "D1"], "D1 ya ha superado la pantalla: D5 vuelve con el continuador.");
  } else {
    event(ctx, tD5Up, "ejecutado", "show_committed", ["D5"], "D5 sale a la línea de O1, delante de la pantalla, a frenarle.", { showPoint: upPoint, depthToHoop, recoverStart: tRecoverStart, backAtRim: tD5Home });
    event(ctx, tRecoverStart, "reconocido", "show_recovery", ["D5", "D1"], "D1 ya ha superado la pantalla: D5 recibe el aviso y vuelve a proteger el aro.");
  }
  setArrival(ctx, "D5", Math.max(tRecoverStart, tD5Home), recoverTo, tRecoverStart);

  const tDecision = tUseScreen + recognitionLatencySeconds(o1.attributes.M01, o1.attributes.M05);
  const clock = ctx.shotClockMs / 1000;
  if (clock - tDecision <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, "O1");
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: "O1", position: ctx.positions.O1! });
  }

  // Trayectoria real de D5: arriba hasta que vuelve. Show: retrocede al aro
  // (una sola trayectoria). A la altura: sale con el continuador hacia donde
  // éste vaya a finalizar (cierra el punto real del tiro).
  const d5Recovering: ContestCandidate = atLevel
    ? chaser(ctx, "D5", upPoint, tRecoverStart, (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23))
    : {
        id: "D5",
        geometryTo: () => ({ geometry: { originPos: upPoint, destinationPos: recoverTo, speedMps: d5Speed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d5.attributes.F03) }, arrivalSeconds: Math.max(tRecoverStart, tD5Home) }),
      };
  const d5Up: ContestCandidate = {
    id: "D5",
    geometryTo: () => ({ geometry: { originPos: d5Origin, destinationPos: upPoint, speedMps: d5Speed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d5.attributes.F03) }, arrivalSeconds: tD5Up }),
  };
  const d1Trail = chaser(ctx, "D1", o1UsePoint, tD1Back);

  // D3: ayuda al continuador leída con las mismas concesiones que en drop.
  const help = buildTagHelpPlan(ctx, scenario, tUseScreen, { tRollReady, speedMps: attackerMoveSpeedMps(o5.attributes.F01) });
  const envFor = (withHelp: boolean): RollReceiverEnv => {
    const rim: ContestCandidate[] = [d5Recovering];
    const floater: ContestCandidate[] = [d5Recovering];
    if (withHelp) {
      rim.push(chaser(ctx, "D3", help.origin, help.decision, (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23)));
      floater.push({ id: "D3", geometryTo: () => ({ geometry: help.geometry, arrivalSeconds: help.arrival }) });
    }
    return {
      receiverId: "O5",
      receiverPos: ctx.set.shortRoll,
      rimCandidates: rim,
      floaterCandidates: floater,
      invert: withHelp ? { deflectorId: "D3", closerId: "D4", closerGeometry: help.d4Geometry, closerArrival: help.d4Arrival } : null,
    };
  };
  const bestOf = (opts: readonly ReceiverOption[]) => Math.max(0, ...opts.filter((o) => Number.isFinite(o.value)).map((o) => o.value));
  const helpIsRead = ctx.linked !== null && (ctx.input.rollHelpCall ?? "auto") === "auto";
  const d3Helps =
    scenario.d3HelpsRoller && (!helpIsRead || bestOf(readRollReceiver(ctx, envFor(true), tRollReady)) < bestOf(readRollReceiver(ctx, envFor(false), tRollReady)));
  const pivotText = atLevel ? "D5 sigue a la altura del bloqueo" : "D5 vuelve del show";
  event(ctx, help.decision, "reconocido", "help_decision", ["D3"], d3Helps ? `D3 ayuda al continuador mientras ${pivotText}.` : `D3 conserva la marca de O3 mientras ${pivotText}.`, { helps: d3Helps });
  if (d3Helps) {
    setArrival(ctx, "D3", help.arrival, help.point, help.decision);
    setArrival(ctx, "D4", help.d4Arrival, ctx.set.helpLeftSpot, help.d4Start);
    event(ctx, help.arrival, "concedido", "help_left_assignment", ["D3", "O3"], `La ayuda de D3 deja libre a O3 ${ctx.set.helpLeftLabel}.`);
  }

  // Show: si D5 ya está en la línea de O1 al decidir, O1 no arranca hacia el
  // aro hasta que D5 se retira. A la altura: O1 dobla la esquina sin pausa,
  // pero D5 sale con él desde el lado del bloqueador al decidir.
  // O1 llegaría al punto del show `distance(o1UsePoint, upPoint)` después de decidir.
  const tO1AtUpPoint = tDecision + distance(o1UsePoint, upPoint) / attackerMoveSpeedMps(o1.attributes.F01);
  const o1Halted = !atLevel && tD5Up <= tO1AtUpPoint;
  const tDriveStart = o1Halted ? Math.max(tDecision, tRecoverStart) : tDecision;
  const tRimReady = tDriveStart + timeToReach(o1UsePoint, ATTACKED_HOOP, attackerMoveSpeedMps(o1.attributes.F01)) + CLOSE_FINISH_PREP_SECONDS;
  const d5Contains = chaser(ctx, "D5", upPoint, Math.max(tD5Up, tDecision), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
  const rim = bestContest(ctx, atLevel ? [d5Contains, d1Trail] : [d5Recovering, d1Trail], ATTACKED_HOOP, tRimReady, CLOSE_FINISH_PREP_SECONDS)!;
  const rimValue = tRimReady < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o1.attributes.T01, rim.level) : -Infinity;
  const tTripleReady = tDecision + movingShotPrepSeconds(o1.attributes.T06);
  const triple = bestContest(ctx, [d5Up, d1Trail], o1UsePoint, tTripleReady, movingShotPrepSeconds(o1.attributes.T06))!;
  const tripleValue = isBehindThreePointLine(o1UsePoint) && tTripleReady < clock ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o1.attributes.T04, triple.level) : -Infinity;
  // El pase al roll tiene que superar a D5 arriba: desvío por D5 (T17).
  const tPassArrival = Math.max(tRollReady, tDecision + PASS_RELEASE_SECONDS + distanceSeconds(o1UsePoint, ctx.set.shortRoll));
  const envAt = () => envFor(d3Helps);
  const projectedReceiver = readRollReceiver(ctx, envAt(), tPassArrival);
  const passValue = Math.max(-Infinity, ...projectedReceiver.map((o) => o.value));
  const passCompletion = 1 - deflectionProbability(d5.attributes.T17, o1.attributes.T09);

  const options: HandlerReadOption[] = [
    {
      id: "finalizar",
      value: rimValue,
      completion: 1,
      kind: "tiro",
      values: { contesterId: realId(ctx, rim.id), opposition: rim.level, readySeconds: tRimReady, halted: o1Halted, driveStartSeconds: tDriveStart },
      execute: (record) => {
        record();
        return resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: o1.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tRimReady, prepSeconds: CLOSE_FINISH_PREP_SECONDS, contesterId: rim.id, contesterArrival: rim.arrival, contesterGeometry: rim.geometry });
      },
    },
    {
      id: "triple_o1",
      value: tripleValue,
      completion: 1,
      kind: "tiro",
      values: { contesterId: realId(ctx, triple.id), opposition: triple.level, behindLine: isBehindThreePointLine(o1UsePoint) },
      execute: (record) => {
        record();
        return resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: o1.attributes.T04, shotType: "three_point", shooterPos: o1UsePoint, tReady: tTripleReady, prepSeconds: movingShotPrepSeconds(o1.attributes.T06), contesterId: triple.id, contesterArrival: triple.arrival, contesterGeometry: triple.geometry });
      },
    },
    {
      id: "pase_o5",
      value: passValue,
      completion: passCompletion,
      kind: "pase",
      values: { receiverBestOption: [...projectedReceiver].sort((a, b) => b.value - a.value)[0]?.id ?? null, d5RecoveredSeconds: tD5Home, d5RecoversTo: atLevel ? "continuador" : "aro", d3Helps },
      execute: (record) => executeRollPass(ctx, { tPassArrival, deflectorId: "D5", envAt, record, note: atLevel ? "O1 pasa al continuador O5 junto a D5, que sigue a la altura del bloqueo." : "O1 pasa por encima del show al continuador O5." }),
    },
    { id: "salida_segura", value: 0, completion: 1, kind: "salida", values: {}, execute: (record) => executeSafeOutlet(ctx, tDecision, record) },
  ];
  return decideHandlerRead(ctx, atLevel ? "lectura_a_la_altura" : "lectura_show", tDecision, ["O1", "O5", "D1", "D5"], options);
}

/**
 * Horns→Spain (ME-07B v2 §4, «Libro por fase»; LAB-0.9). Desde la colocación
 * Horns, el segundo cuerno (O3) baja del codo a poner un **bloqueo ciego** a
 * D5, el defensor que protege el roll en drop, a contacto suyo en su línea de
 * retroceso al aro; el manejador **sincroniza** el uso de la pantalla de O5
 * con ese bloqueo (espera en el punto de uso: cuesta reloj), de modo que el
 * roll arranca con el bloqueo ciego ya puesto. D5 queda retenido el retraso
 * real de esa pantalla (T13/F05 de O3 frente a T16 de D5, peso) y después
 * rodea al bloqueador; O5 rueda **profundo** al poste bajo débil por fuera del
 * bloqueo y O3 se abre (**pop**) por encima del arco al soltar a D5.
 *
 * Respuesta de la defensa (orden `backScreenCall`, LAB-0.9), decidida por el
 * defensor del bloqueador ciego (D3), que reconoce su corte (M01/M05):
 * - `seguir`: D3 va con O3 hasta el pop; el roll solo lo protege D5, retenido.
 * - `ayudar` (lectura dentro de `seguir`/`auto`): D3 se hunde sobre el roll
 *   desde la pintura (contención real) y deja libre el pop; lo cierra él al
 *   recuperar.
 * - `cambiar`: D3 toma al continuador y D5, al soltarse, sale al pop (aviso
 *   M09). Solo si D3 reconoce el corte y lo canta antes de que el roll
 *   arranque; tarde, no hay cambio.
 * En `auto`, la menor concesión proyectada de las aplicables (misma geometría
 * y mismos costes que la lectura del manejador). Quien puede ayudar al roll
 * cambia frente a Horns→bloqueo (allí, el defensor del segundo cuerno desde
 * el codo y deja un tiro medio; aquí, el defensor del bloqueador ciego desde
 * la pintura y deja un triple de pop; o D5 si cambian).
 *
 * O1 lee (`lectura_spain`): atacar el aro, pase al roll profundo (el receptor
 * lee aro/floater/pase al pop), pase al pop, triple tras la pantalla o salida
 * segura. El cambio persiste el resto de la posesión (`defensiveSwap`).
 */
type BackScreenResponse = "seguir" | "ayudar" | "cambiar";

function runSpainPhase(ctx: CoreContext, d1Route: ScreenRoute, timing: SpainTiming, callOverride?: BackScreenCallChoice): PossessionCoreResult {
  const o1 = player(ctx, "O1");
  const o3 = player(ctx, "O3");
  const o5 = player(ctx, "O5");
  const d1 = player(ctx, "D1");
  const d3 = player(ctx, "D3");
  const d5 = player(ctx, "D5");
  const { bsPoint, tO3AtScreen, tBackScreenSet } = timing;
  // Geometría propia de Spain sobre el mismo contexto: roll profundo y pop.
  ctx.set = { ...ctx.set, shortRoll: SPAIN_ROLL_SPOT, helpLeftSpot: SPAIN_POP_SPOT, helpLeftLabel: "en el pop por encima del arco" };

  const o3Start = ctx.positions.O3!;
  const d3Start = ctx.positions.D3!;
  const d5Start = ctx.positions.D5!;
  const screenPoint = ctx.positions.O5!;
  const o1UsePoint = pointShortOfTarget(ctx.positions.O1!, screenPoint, COMBINED_CONTACT_RADIUS_METERS);
  const o3Speed = attackerMoveSpeedMps(o3.attributes.F01);
  const o5Speed = attackerMoveSpeedMps(o5.attributes.F01);
  const d3Speed = defenderLateralSpeedMps(d3.attributes.F04);
  const d5Speed = defenderLateralSpeedMps(d5.attributes.F04);

  // --- Bloqueo ciego y sincronización del bloqueo directo -------------------
  // O3 rodea a su propio defensor si le queda en el camino (dos cuerpos no se cruzan).
  const o3Detour = detourAround(o3Start, bsPoint, d3Start, COMBINED_CONTACT_RADIUS_METERS);
  if (o3Detour.waypoint) setArrival(ctx, "O3", distance(o3Start, o3Detour.waypoint) / o3Speed, o3Detour.waypoint, 0);
  setArrival(ctx, "O3", tO3AtScreen, bsPoint, o3Detour.waypoint ? distance(o3Start, o3Detour.waypoint) / o3Speed : 0);
  const continuationShift = screenCoordinationShiftSeconds(o5.attributes.M04);
  const tHandlerArrival = timeToReach(ctx.positions.O1!, o1UsePoint, attackerMoveSpeedMps(o1.attributes.F01));
  // El manejador espera en el punto de uso a que el bloqueo ciego esté puesto:
  // el roll arranca (uso − ajuste M04) no antes que el bloqueo ciego.
  const tUseScreen = Math.max(SCREEN_SET_AFTER_ARRIVAL_SECONDS, tHandlerArrival, tBackScreenSet + continuationShift);
  const tRollStart = tUseScreen - continuationShift;
  event(ctx, SCREEN_SET_AFTER_ARRIVAL_SECONDS, "ejecutado", "screen_set", ["O5"], "O5 llega y coloca su pantalla horns.", { placement: "horns" });
  const backScreenDelay =
    screenInterceptDelaySeconds(o3.attributes.T13, o3.attributes.F05, d5.attributes.T16) + screenContactAdjustmentSeconds(o3.measures.weightKg - d5.measures.weightKg);
  const tD5Release = tRollStart + backScreenDelay;
  event(ctx, tBackScreenSet, "ejecutado", "back_screen_set", ["O3", "D5"], `O3 baja del codo y pone un bloqueo ciego a D5 en su retroceso al aro; O1 espera a que esté puesto (${(tUseScreen - Math.max(SCREEN_SET_AFTER_ARRIVAL_SECONDS, tHandlerArrival)).toFixed(2)} s).`, {
    screenPoint: bsPoint,
    backScreenDelay,
    d5ReleaseAt: tD5Release,
    handlerWaitSeconds: tUseScreen - Math.max(SCREEN_SET_AFTER_ARRIVAL_SECONDS, tHandlerArrival),
  });
  setArrival(ctx, "O1", tHandlerArrival, o1UsePoint, 0);

  // D1 y la pantalla del cuerno (misma regla que en drop; por debajo, sin retraso).
  const underRoute = d1Route === "por_debajo";
  const screenDelay = screenInterceptDelaySeconds(o5.attributes.T13, o5.attributes.F05, d1.attributes.T16) + screenContactAdjustmentSeconds(o5.measures.weightKg - d1.measures.weightKg);
  const underPoint =
    distance(screenPoint, d5Start) >= 2 * COMBINED_CONTACT_RADIUS_METERS
      ? { x: (screenPoint.x + d5Start.x) / 2, y: (screenPoint.y + d5Start.y) / 2 }
      : moveToward(screenPoint, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS);
  const d1SetPoint = underRoute ? underPoint : o1UsePoint;
  const tD1Set = underRoute
    ? recognitionLatencySeconds(d1.attributes.M01, d1.attributes.M05) + distance(ctx.positions.D1!, underPoint) / defenderLateralSpeedMps(d1.attributes.F04)
    : tUseScreen + screenDelay;
  event(
    ctx,
    tUseScreen,
    "ejecutado",
    "screen_navigated",
    ["O1", "D1"],
    underRoute ? "O1 usa la pantalla de O5; D1 pasa por debajo del bloqueo." : `O1 usa la pantalla de O5; D1 navega con un retraso de ${screenDelay.toFixed(2)} s.`,
    underRoute ? { screenDelay: 0, route: "por_debajo", underPoint } : { screenDelay },
  );
  setArrival(ctx, "D1", tD1Set, d1SetPoint, underRoute ? 0 : tUseScreen);

  // Roll profundo de O5 por fuera del bloqueo ciego.
  const rollTravel = timeToReach(screenPoint, SPAIN_ROLL_SPOT, o5Speed);
  const tRollReady = tRollStart + rollTravel;
  setArrival(ctx, "O5", tRollReady, SPAIN_ROLL_SPOT, tRollStart);
  // Hecho al arrancar el roll (no al llegar): un tiro rápido del manejador puede llegar antes y el relato no adelanta lo que aún no ocurrió.
  event(ctx, tRollStart, "ejecutado", "roll_continuation", ["O5"], "O5 arranca su roll profundo al poste bajo débil, por fuera del bloqueo ciego.", { rollSpot: SPAIN_ROLL_SPOT, deep: true, arrivesAt: tRollReady });

  // Pop de O3 al soltar a D5.
  const tPopReady = tD5Release + timeToReach(bsPoint, SPAIN_POP_SPOT, o3Speed);

  // D5 retenido hasta soltarse; después rodea al bloqueador hacia el aro.
  const rimDetour = detourAround(d5Start, ATTACKED_HOOP, bsPoint, COMBINED_CONTACT_RADIUS_METERS);
  const tD5AtRim = Math.max(tD5Release, tD5Release + rimDetour.length / d5Speed - interiorArrivalAdjustmentSeconds(d5.attributes.T23));
  const d5RimRetreat: ContestCandidate = {
    id: "D5",
    geometryTo: () => ({
      geometry: { originPos: rimDetour.waypoint ?? d5Start, destinationPos: ATTACKED_HOOP, speedMps: d5Speed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d5.attributes.F03) },
      arrivalSeconds: tD5AtRim,
    }),
  };

  // --- D3: reconoce el corte de O3 y le sigue hasta el bloqueo -------------
  const tD3Recognize = recognitionLatencySeconds(d3.attributes.M01, d3.attributes.M05);
  const trailPoint = pointShortOfTarget(d3Start, bsPoint, COMBINED_CONTACT_RADIUS_METERS);
  const tD3Trail = tD3Recognize + timeToReach(d3Start, trailPoint, d3Speed);
  // Cambio: D3 lo canta a D5 (M09); solo vale si llega antes de que D5 empiece a retroceder.
  const tSwitchCall = tD3Recognize + m09CoordinationLatencySeconds(d3.attributes.M09, d5.attributes.M09);
  const switchInTime = tSwitchCall <= tRollStart;

  const roll = { tRollReady, speedMps: o5Speed };
  const tD3RollDepart = Math.max(tD3Trail, tRollStart);
  // Hacia el roll, D3 rodea al bloqueador ciego (lo tiene delante) y contiene a contacto.
  const d3Detour = detourAround(trailPoint, SPAIN_ROLL_SPOT, bsPoint, COMBINED_CONTACT_RADIUS_METERS);
  const d3RollOrigin = d3Detour.waypoint ?? trailPoint;
  const tD3AtWaypoint = tD3RollDepart + distance(trailPoint, d3RollOrigin) / d3Speed;
  const d3RollPoint = containmentPoint(d3RollOrigin, SPAIN_ROLL_SPOT, tD3AtWaypoint, d3Speed, closeoutBrakingExtraSeconds(d3.attributes.F03), d3.attributes.T23, roll);
  const tD3OnRoll = Math.max(tD3RollDepart, tD3AtWaypoint + timeToReach(d3RollOrigin, d3RollPoint, d3Speed) - interiorArrivalAdjustmentSeconds(d3.attributes.T23));
  const d3OnRollGeometry: ContestGeometry = { originPos: d3RollOrigin, destinationPos: d3RollPoint, speedMps: d3Speed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d3.attributes.F03) };

  const tDecision = tUseScreen + recognitionLatencySeconds(o1.attributes.M01, o1.attributes.M05);
  const clock = ctx.shotClockMs / 1000;

  /** Defensores que cierran cada recurso según la respuesta de D3/D5. */
  function responseEnv(response: BackScreenResponse): {
    readonly rimProtectors: ContestCandidate[];
    readonly floaterContesters: ContestCandidate[];
    readonly popCloser: ContestCandidate;
    readonly popCloserArrival: (spot: Point2D) => { geometry: ContestGeometry; arrivalSeconds: number };
    readonly popDeflectorId: string;
  } {
    const d3FromRoll = chaser(ctx, "D3", d3RollPoint, tD3OnRoll, (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
    const d3ToPop = chaser(ctx, "D3", trailPoint, Math.max(tD3Trail, tD5Release), (p) => perimeterArrivalAdjustmentSeconds(p.attributes.T22));
    // Tras contener el roll, D3 reconoce el pop libre (M01/M05) y sale a cerrarlo.
    const d3RecoverToPop = chaser(ctx, "D3", d3RollPoint, tD3OnRoll + recognitionLatencySeconds(d3.attributes.M01, d3.attributes.M05), (p) => perimeterArrivalAdjustmentSeconds(p.attributes.T22));
    const d5ToPop = chaser(ctx, "D5", d5Start, Math.max(tD5Release, tSwitchCall), (p) => perimeterArrivalAdjustmentSeconds(p.attributes.T22));
    const d3OnRoller: ContestCandidate = { id: "D3", geometryTo: () => ({ geometry: d3OnRollGeometry, arrivalSeconds: tD3OnRoll }) };
    if (response === "seguir") return { rimProtectors: [d5RimRetreat], floaterContesters: [d5RimRetreat], popCloser: d3ToPop, popCloserArrival: d3ToPop.geometryTo, popDeflectorId: "D3" };
    if (response === "ayudar") return { rimProtectors: [d5RimRetreat, d3FromRoll], floaterContesters: [d5RimRetreat, d3OnRoller], popCloser: d3RecoverToPop, popCloserArrival: d3RecoverToPop.geometryTo, popDeflectorId: "D3" };
    return { rimProtectors: [d3FromRoll], floaterContesters: [d3OnRoller], popCloser: d5ToPop, popCloserArrival: d5ToPop.geometryTo, popDeflectorId: "D5" };
  }

  const d1Trail = chaser(ctx, "D1", d1SetPoint, tD1Set);
  function handlerOptions(response: BackScreenResponse): HandlerReadOption[] {
    const env = responseEnv(response);
    const swap: Partial<PossessionCoreResult> = response === "cambiar" ? { defensiveSwap: ["D3", "D5"] } : {};
    // Atacar el aro desde el punto de uso.
    const tRimReady = tDecision + timeToReach(o1UsePoint, ATTACKED_HOOP, attackerMoveSpeedMps(o1.attributes.F01)) + CLOSE_FINISH_PREP_SECONDS;
    const rim = bestContest(ctx, [...env.rimProtectors, d1Trail], ATTACKED_HOOP, tRimReady, CLOSE_FINISH_PREP_SECONDS)!;
    const rimValue = tRimReady < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o1.attributes.T01, rim.level) : -Infinity;
    // Triple tras la pantalla: le cierra D1 desde su navegación.
    const tTripleReady = tDecision + movingShotPrepSeconds(o1.attributes.T06);
    const triple = bestContest(ctx, [d1Trail], o1UsePoint, tTripleReady, movingShotPrepSeconds(o1.attributes.T06))!;
    const tripleValue = isBehindThreePointLine(o1UsePoint) && tTripleReady < clock ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o1.attributes.T04, triple.level) : -Infinity;
    // Pase al roll profundo y lectura del receptor (aro, floater o pase al pop).
    const tPassArrivalRoll = Math.max(tRollReady, tDecision + PASS_RELEASE_SECONDS + distanceSeconds(o1UsePoint, SPAIN_ROLL_SPOT));
    const popGeometry = env.popCloserArrival(SPAIN_POP_SPOT);
    const envAt = (): RollReceiverEnv => ({
      receiverId: "O5",
      receiverPos: SPAIN_ROLL_SPOT,
      rimCandidates: env.rimProtectors,
      floaterCandidates: env.floaterContesters,
      invert: { deflectorId: env.popDeflectorId, closerId: env.popCloser.id, closerGeometry: popGeometry.geometry, closerArrival: popGeometry.arrivalSeconds, targetReadySeconds: tPopReady },
    });
    const projectedReceiver = readRollReceiver(ctx, envAt(), tPassArrivalRoll);
    const rollPassValue = Math.max(-Infinity, ...projectedReceiver.map((o) => o.value));
    // El pase al roll sale por encima de D5 retenido (o de D3 si está en el roll).
    const rollDeflectorId = response === "seguir" ? "D5" : "D3";
    const rollCompletion = 1 - deflectionProbability(player(ctx, rollDeflectorId).attributes.T17, o1.attributes.T09);
    // Pase al pop.
    const tPassArrivalPop = Math.max(tPopReady, tDecision + PASS_RELEASE_SECONDS + distanceSeconds(o1UsePoint, SPAIN_POP_SPOT));
    const tPopShotReady = tPassArrivalPop + CATCH_AND_SHOOT_PREP_SECONDS;
    const popLevel = estimateContestLevel(ctx, env.popCloser.id, popGeometry.geometry, popGeometry.arrivalSeconds, SPAIN_POP_SPOT, tPopShotReady, CATCH_AND_SHOOT_PREP_SECONDS);
    const popValue = tPopShotReady < clock ? helpLeftShotValue(ctx, popLevel) : -Infinity;
    const popCompletion = 1 - deflectionProbability(player(ctx, env.popCloser.id).attributes.T17, o1.attributes.T09);
    return [
      {
        id: "finalizar",
        value: rimValue,
        completion: 1,
        kind: "tiro",
        values: { contesterId: realId(ctx, rim.id), opposition: rim.level, readySeconds: tRimReady, d5RimArrivalSeconds: tD5AtRim, response },
        execute: (record) => {
          record();
          return { ...resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: o1.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tRimReady, prepSeconds: CLOSE_FINISH_PREP_SECONDS, contesterId: rim.id, contesterArrival: rim.arrival, contesterGeometry: rim.geometry }), ...swap };
        },
      },
      {
        id: "pase_o5",
        value: rollPassValue,
        completion: rollCompletion,
        kind: "pase",
        values: { receiverBestOption: [...projectedReceiver].sort((a, b) => b.value - a.value)[0]?.id ?? null, rollSpot: "poste_bajo_debil", d5ReleaseSeconds: tD5Release, response },
        execute: (record) => ({ ...executeRollPass(ctx, { tPassArrival: tPassArrivalRoll, deflectorId: rollDeflectorId, envAt, record, note: "O1 pasa al continuador O5 en su roll profundo tras el bloqueo ciego." }), ...swap }),
      },
      {
        id: "pase_pop_o3",
        value: popValue,
        completion: popCompletion,
        kind: "pase",
        values: { closerId: realId(ctx, env.popCloser.id), opposition: popLevel, popReadySeconds: tPopReady, marginSeconds: popGeometry.arrivalSeconds - tPopShotReady, shotType: helpLeftShotType(ctx), response },
        execute: (record) => {
          const outcome = resolvePass(o1.attributes.T09, o3.attributes.T11, true, player(ctx, env.popCloser.id).attributes.T17, 1, ctx.rng);
          event(ctx, tPassArrivalPop, "ejecutado", "pass_released", ["O1", "O3"], "O1 encuentra a O3 en el pop por encima del arco.");
          record("pass_released");
          if (outcome.kind === "deflected_loose_ball") return { ...resolveLooseBallAfterPass(ctx, tPassArrivalPop, "O1", env.popCloser.id), ...swap };
          const delay = outcome.kind === "awkward_control" ? outcome.extraDelaySeconds : 0;
          event(ctx, tPassArrivalPop, "concedido", "pass_received", ["O3"], "O3 recibe en el pop.");
          return {
            ...resolveShotAttempt(ctx, {
              shooterId: "O3",
              shooterSkill: shotSkill(o3, helpLeftShotType(ctx)),
              shotType: helpLeftShotType(ctx),
              shooterPos: SPAIN_POP_SPOT,
              tReady: tPopShotReady + delay,
              prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + delay,
              contesterId: env.popCloser.id,
              contesterArrival: popGeometry.arrivalSeconds,
              contesterGeometry: popGeometry.geometry,
            }),
            ...swap,
          };
        },
      },
      {
        id: "triple_o1",
        value: tripleValue,
        completion: 1,
        kind: "tiro",
        values: { contesterId: realId(ctx, triple.id), opposition: triple.level, behindLine: isBehindThreePointLine(o1UsePoint) },
        execute: (record) => {
          record();
          return { ...resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: o1.attributes.T04, shotType: "three_point", shooterPos: o1UsePoint, tReady: tTripleReady, prepSeconds: movingShotPrepSeconds(o1.attributes.T06), contesterId: triple.id, contesterArrival: triple.arrival, contesterGeometry: triple.geometry }), ...swap };
        },
      },
      { id: "salida_segura", value: 0, completion: 1, kind: "salida", values: {}, execute: (record) => executeSafeOutlet(ctx, tDecision, record, swap) },
    ];
  }
  const concession = (response: BackScreenResponse) => Math.max(0, ...handlerOptions(response).map((o) => (Number.isFinite(o.value) ? o.value * o.completion : 0)));

  // --- Respuesta de D3/D5 al bloqueo ciego ----------------------------------
  // La proyección del ataque no conoce la orden del rival: supone su mejor respuesta (`auto`).
  const call: BackScreenCallChoice = callOverride ?? ctx.input.backScreenCall ?? "auto";
  const applicable: BackScreenResponse[] = call === "cambiar" && switchInTime ? ["cambiar"] : call === "seguir" || (call === "cambiar" && !switchInTime) ? ["seguir", "ayudar"] : switchInTime ? ["seguir", "ayudar", "cambiar"] : ["seguir", "ayudar"];
  const concessions = new Map<BackScreenResponse, number>((["seguir", "ayudar", "cambiar"] as const).map((r) => [r, concession(r)]));
  let response = applicable[0]!;
  for (const r of applicable) if (concessions.get(r)! < concessions.get(response)!) response = r;
  const tResponse = response === "cambiar" ? tSwitchCall : tD3RollDepart;
  auditDecision(ctx, tResponse, {
    point: "respuesta_bloqueo_ciego",
    holderId: null,
    participants: ["D3", "D5", "O3", "O5"],
    chosenOptionId: response,
    options: (["seguir", "ayudar", "cambiar"] as const).map((r): AuditOptionRecord => ({
      id: r,
      status: r === response ? "elegida" : applicable.includes(r) ? "descartada_por_condicion" : "no_evaluada_por_cortocircuito",
      reasonCode:
        r === response
          ? applicable.length === 1
            ? "back_screen_forced_by_call"
            : "back_screen_lower_concession"
          : !applicable.includes(r)
            ? r === "cambiar" && !switchInTime
              ? "back_screen_switch_recognized_late"
              : "back_screen_forced_by_call"
            : "back_screen_higher_concession",
      values: { concessionValue: concessions.get(r)!, call, switchCallSeconds: tSwitchCall, rollStartSeconds: tRollStart, d3RecognizeSeconds: tD3Recognize, d5ReleaseSeconds: tD5Release },
    })),
  });

  // Trayectorias reales de la respuesta elegida.
  setArrival(ctx, "D3", tD3Trail, trailPoint, tD3Recognize);
  if (response === "seguir") {
    const toPop = chaser(ctx, "D3", trailPoint, Math.max(tD3Trail, tD5Release), (p) => perimeterArrivalAdjustmentSeconds(p.attributes.T22)).geometryTo(SPAIN_POP_SPOT);
    setArrival(ctx, "D3", toPop.arrivalSeconds, SPAIN_POP_SPOT, Math.max(tD3Trail, tD5Release));
    setArrival(ctx, "D5", tD5Release, d5Start, tRollStart);
    setArrival(ctx, "D5", tD5AtRim, ATTACKED_HOOP, tD5Release);
    event(ctx, tD3RollDepart, "reconocido", "help_decision", ["D3"], "D3 va con O3 tras el bloqueo ciego: el roll queda para D5, retenido por el bloqueo.", { helps: false, response });
  } else {
    if (d3Detour.waypoint) setArrival(ctx, "D3", tD3AtWaypoint, d3RollOrigin, tD3RollDepart);
    setArrival(ctx, "D3", tD3OnRoll, d3RollPoint, d3Detour.waypoint ? tD3AtWaypoint : tD3RollDepart);
    registerContainment(ctx, "D3", tD3RollDepart, tD3OnRoll, closeoutBrakingExtraSeconds(d3.attributes.F03), tRollStart, tRollReady);
    if (response === "ayudar") {
      setArrival(ctx, "D5", tD5Release, d5Start, tRollStart);
      setArrival(ctx, "D5", tD5AtRim, ATTACKED_HOOP, tD5Release);
      event(ctx, tD3RollDepart, "reconocido", "help_decision", ["D3"], "D3 se hunde desde la pintura sobre el roll profundo de O5.", { helps: true, response });
      event(ctx, tD3OnRoll, "concedido", "help_left_assignment", ["D3", "O3"], "La ayuda de D3 deja libre a O3 en el pop por encima del arco.");
    } else {
      const d5Pop = chaser(ctx, "D5", d5Start, Math.max(tD5Release, tSwitchCall), (p) => perimeterArrivalAdjustmentSeconds(p.attributes.T22)).geometryTo(SPAIN_POP_SPOT);
      setArrival(ctx, "D5", tD5Release, d5Start, tRollStart);
      setArrival(ctx, "D5", d5Pop.arrivalSeconds, SPAIN_POP_SPOT, Math.max(tD5Release, tSwitchCall));
      event(ctx, tSwitchCall, "reconocido", "back_screen_switch", ["D3", "D5"], "D3 canta el cambio en el bloqueo ciego: toma al continuador y D5 saldrá al pop de O3.", { switchCallSeconds: tSwitchCall, d5ReleaseSeconds: tD5Release });
    }
  }
  setArrival(ctx, "O3", tPopReady, SPAIN_POP_SPOT, tD5Release);
  event(ctx, tD5Release, "ejecutado", "back_screen_pop", ["O3"], "O3 suelta el bloqueo ciego y se abre al pop por encima del arco.", { popSpot: SPAIN_POP_SPOT, arrivesAt: tPopReady });

  if (clock - tDecision <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, "O1");
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: "O1", position: ctx.positions.O1! });
  }
  return decideHandlerRead(ctx, "lectura_spain", tDecision, ["O1", "O3", "O5", "D3", "D5"], handlerOptions(response));
}

/** Momentos del bloqueo ciego que el segundo cuerno puede poner (LAB-0.9). */
interface SpainTiming {
  readonly bsPoint: Point2D;
  readonly tO3AtScreen: number;
  readonly tBackScreenSet: number;
}

/**
 * Lectura del bloqueador ciego al empezar la acción (`lectura_spain_bloqueador`):
 * hay a quién bloquear si D5 juega detrás de la pantalla (drop o por debajo)
 * y aún no protege el aro, y si sincronizar el bloqueo directo con el ciego
 * cabe en el reloj. Si no, O3 se queda en el codo y se juega el árbol de
 * Horns con la cobertura real (la ficha sigue siendo Spain: su fallback).
 */
function readSpainBackScreen(ctx: CoreContext): { readonly timing: SpainTiming | null; readonly reason: AuditReasonCode; readonly values: Record<string, number | string | boolean | null> } {
  const coverage = ctx.resolvedCoverage;
  const d5 = ctx.positions.D5!;
  const o3 = player(ctx, "O3");
  const bsPoint = spainBackScreenPoint(d5);
  // Camino real de O3: rodea a su defensor si le queda delante.
  const tO3AtScreen = detourAround(ctx.positions.O3!, bsPoint, ctx.positions.D3!, COMBINED_CONTACT_RADIUS_METERS).length / attackerMoveSpeedMps(o3.attributes.F01);
  const tBackScreenSet = tO3AtScreen + SCREEN_SET_AFTER_ARRIVAL_SECONDS;
  const values = { coverage, d5DistanceToHoop: distance(d5, ATTACKED_HOOP), backScreenSetSeconds: tBackScreenSet };
  // ICE ante una pantalla que no es lateral (la de Horns) se juega drop (`coverage_not_applicable`).
  const playsDrop = coverage === "drop" || coverage === "por_debajo" || (coverage === "ice" && !isLateralScreenSpot(ctx.positions.O5!));
  if (!playsDrop || !isBackScreenTarget(d5)) return { timing: null, reason: "back_screen_target_absent", values };
  // Hace falta reloj para el bloqueo ciego, el uso de la pantalla y una lectura.
  const o1 = player(ctx, "O1");
  if (tBackScreenSet + recognitionLatencySeconds(o1.attributes.M01, o1.attributes.M05) + CATCH_AND_SHOOT_PREP_SECONDS >= ctx.shotClockMs / 1000) {
    return { timing: null, reason: "back_screen_shot_clock_insufficient", values };
  }
  return { timing: { bsPoint, tO3AtScreen, tBackScreenSet }, reason: "back_screen_target_present", values };
}

/**
 * Delay→DHO con entrada a poste y salidas (ME-07B v2 §4, «Libro por fase»;
 * LAB-0.10). En vez de iniciar un bloqueo directo, el ataque retrasa la
 * acción: el manejador (O1, ala derecha) entra el balón al interior de arriba
 * (O5, por encima del arco), le **sigue** y recibe de él una **entrega en mano
 * (DHO)**: el cuerpo de O5 es la pantalla (retraso T13/F05 de O5 frente a T16
 * de D1, peso; la orden sin balón de D1 lo ajusta como en el mano a mano). El
 * otro interior (O4) espera en el poste bajo del lado del balón.
 *
 * Respuesta de la defensa a la entrega (según su cobertura; en `auto`, la de
 * menor concesión proyectada entre las tres aplicables):
 * - `hundirse` (drop, por debajo, a la altura, ICE): D5 se queda entre O5 y el
 *   aro; D1 persigue por encima de la entrega con el retraso del cuerpo de O5.
 * - `cambiar_entrega` (cambio): D5 toma a O1 en la entrega y D1 se queda con
 *   O5 (el emparejamiento persiste en la posesión).
 * - `saltar_entrega` (show, trampa): D5 sale al punto de la entrega; si llega
 *   antes que O1, la **niega** y O5 se la queda (keeper) con su pintura vacía;
 *   si llega tarde, la entrega sale y D5 está fuera de la pintura.
 *
 * Lecturas: con la entrega hecha, O1 (`lectura_delay`) ataca el aro, tira de
 * tres o parado tras la entrega, entra al poste o sale seguro hacia O5. Con la
 * entrega negada, O5 (`lectura_delay_pivote`) ataca el aro, encuentra el
 * **corte por la puerta de atrás** de O1, entra al poste (alto-bajo) o
 * invierte al ala débil. En el poste (`lectura_poste`), O4 finaliza (al aro o
 * en gancho) frente a D4 y a la ayuda, sale a la esquina si su defensor ha
 * ayudado («dig», `respuesta_poste`), encuentra el corte del ala débil o
 * **repostea** (devuelve arriba y el ataque se reorganiza con el reloj que
 * quede). Ninguna vía es obligatoria: si nada vale más, salida segura.
 */
type DelayResponse = "hundirse" | "cambiar_entrega" | "saltar_entrega";

function delayResponseFor(coverage: DefensiveCoverage): DelayResponse {
  if (coverage === "cambio") return "cambiar_entrega";
  if (coverage === "show" || coverage === "trampa") return "saltar_entrega";
  return "hundirse";
}

/** Cobertura con la que se registra cada respuesta a la entrega (observación y auditoría). */
const DELAY_RESPONSE_COVERAGE: Readonly<Record<DelayResponse, DefensiveCoverage>> = { hundirse: "drop", cambiar_entrega: "cambio", saltar_entrega: "show" };

/** Salida segura de Delay: el balón vuelve al pívot de arriba (o, si lo tiene él, al ala débil) y el ataque se reorganiza. */
function delayOutlet(ctx: CoreContext, holderSlot: string, holderPos: Point2D, tDecision: number, record: (factLinkKind?: string) => void, text: string, extra: Partial<PossessionCoreResult> = {}): PossessionCoreResult {
  const target = holderSlot === "O5" ? "O3" : "O5";
  const tOutlet = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(holderPos, ctx.positions[target]!);
  event(ctx, tOutlet, "concedido", "possession_continues", [holderSlot, target], text);
  record("possession_continues");
  return {
    ...finalize(ctx, { kind: "possession_reorganized_control_kept", outletPlayerId: target }, { status: "held", holderId: target, position: ctx.positions[target]! }),
    ...extra,
  };
}

/**
 * Lectura del poste (LAB-0.10): O4 recibe en el poste bajo y lee frente a D4
 * (por detrás, a contacto) y a la posible ayuda («dig») del defensor de la
 * esquina fuerte, que D2 decide comparando concesiones al reconocer la
 * recepción (M01/M05). Opciones: al aro (T01), gancho/floater desde el poste
 * (T02), pase a la esquina (si D2 ayudó), corte del ala débil (O3 por detrás
 * de D3, T21 adelanta su salida) y repostear (devolver arriba y reorganizar).
 */
function postReadOptions(ctx: CoreContext, tCatch: number, tRelease: number, swap: Partial<PossessionCoreResult>): { options: HandlerReadOption[]; dig: boolean; concessionWithDig: number; concessionWithoutDig: number; tD2Dig: number; digPoint: Point2D; digInTime: boolean; tRead: number } {
  const o2 = player(ctx, "O2");
  const o3 = player(ctx, "O3");
  const o4 = player(ctx, "O4");
  const d2 = player(ctx, "D2");
  const d3 = player(ctx, "D3");
  const post = ctx.positions.O4!;
  const corner = ctx.positions.O2!;
  const clock = ctx.shotClockMs / 1000;
  const d4Behind = chaser(ctx, "D4", ctx.positions.D4!, tCatch, (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
  const d5Sag = chaser(ctx, "D5", ctx.positions.D5!, tCatch + recognitionLatencySeconds(player(ctx, "D5").attributes.M01, player(ctx, "D5").attributes.M05), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
  // D2 lee el pase de entrada en el aire (desde que sale), no espera a la recepción.
  const tD2Recognize = tRelease + recognitionLatencySeconds(d2.attributes.M01, d2.attributes.M05);
  // El poste recibe de espaldas: lee la defensa (M01/M05, como cualquier lectura) y gira antes de
  // moverse (misma preparación de una finalización cercana, LAB-0.1).
  const tRead = tCatch + recognitionLatencySeconds(o4.attributes.M01, o4.attributes.M05);
  const tTurn = tRead + CLOSE_FINISH_PREP_SECONDS;
  // Camino del giro al aro: rodea a D4 por el lado libre.
  const dropStep = detourAround(post, ATTACKED_HOOP, ctx.positions.D4!, COMBINED_CONTACT_RADIUS_METERS);
  // La ayuda («dig») llega a contacto de O4 desde su lado: si llega antes del giro, son dos sobre el balón.
  const digPoint = pointShortOfTarget(ctx.positions.D2!, post, COMBINED_CONTACT_RADIUS_METERS);
  const tD2Dig = tD2Recognize + timeToReach(ctx.positions.D2!, digPoint, defenderLateralSpeedMps(d2.attributes.F04));
  const d2Dig: ContestCandidate = { id: "D2", geometryTo: () => ({ geometry: { originPos: ctx.positions.D2!, destinationPos: digPoint, speedMps: defenderLateralSpeedMps(d2.attributes.F04), brakingExtraSeconds: closeoutBrakingExtraSeconds(d2.attributes.F03) }, arrivalSeconds: tD2Dig }) };
  const d2DigToRim = chaser(ctx, "D2", digPoint, tD2Dig, (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
  const d2Home = chaser(ctx, "D2", ctx.positions.D2!, tD2Recognize, (p) => perimeterArrivalAdjustmentSeconds(p.attributes.T22));
  const d2Recover = chaser(ctx, "D2", digPoint, tD2Dig, (p) => perimeterArrivalAdjustmentSeconds(p.attributes.T22));
  // Corte del ala débil: sale al recibir el poste (T21 adelanta la salida); D3 lo reconoce tarde (M01/M05).
  const o3CutStart = Math.max(0, tCatch - cutterStartTimeReductionSeconds(o3.attributes.T21));
  // El corte pasa por detrás de D3 (lo rodea: D3 está entre O3 y el aro, en la línea del corte).
  const cutPath = detourAround(ctx.positions.O3!, DELAY_WEAK_CUT_SPOT, ctx.positions.D3!, COMBINED_CONTACT_RADIUS_METERS);
  const tO3AtCut = o3CutStart + cutPath.length / attackerMoveSpeedMps(o3.attributes.F01);
  const d3Chase = chaser(ctx, "D3", ctx.positions.D3!, tCatch + recognitionLatencySeconds(d3.attributes.M01, d3.attributes.M05), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));

  // Dos sobre el poste (D4 a la espalda y D2 cerrando el giro) si D2 llega antes de que O4 gire:
  // presión real de dos defensores sobre el balón (misma primitiva T07/T15 que la trampa).
  const digInTime = tD2Dig <= tTurn;
  const pressureSteal = turnoverUnderPressureProbability(o4.attributes.T07, Math.min(d2.attributes.T15, player(ctx, "D4").attributes.T15));
  function build(dig: boolean): HandlerReadOption[] {
    const helpers = dig ? [d4Behind, d2DigToRim, d5Sag] : [d4Behind, d5Sag];
    const doubled = dig && digInTime;
    const moveCompletion = doubled ? 1 - pressureSteal : 1;
    // El giro al aro rodea a D4, que defiende por detrás entre el poste y el aro (dos cuerpos no se cruzan).
    const tRim = tTurn + dropStep.length / attackerMoveSpeedMps(o4.attributes.F01) + CLOSE_FINISH_PREP_SECONDS;
    const rim = bestContest(ctx, helpers, ATTACKED_HOOP, tRim, CLOSE_FINISH_PREP_SECONDS)!;
    const rimValue = tRim < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o4.attributes.T01, rim.level) : -Infinity;
    const hookType: ShotType = isFloaterZone(post) ? "floater" : isMidRangeZone(post) ? "mid_range" : "close_finish";
    // Gancho/tiro de giro desde el poste: D4 ya está a contacto (no tiene que desplazarse).
    const tHook = tRead + CATCH_AND_SHOOT_PREP_SECONDS;
    const d4AtContact: ContestCandidate = { id: "D4", geometryTo: () => ({ geometry: { originPos: ctx.positions.D4!, destinationPos: ctx.positions.D4!, speedMps: defenderLateralSpeedMps(player(ctx, "D4").attributes.F04), brakingExtraSeconds: 0 }, arrivalSeconds: 0 }) };
    const hook = bestContest(ctx, dig ? [d4AtContact, d2Dig] : [d4AtContact], post, tHook, CATCH_AND_SHOOT_PREP_SECONDS)!;
    const hookValue = tHook < clock ? 2 * shotProbability(shotBaseProbability(hookType), shotSkill(o4, hookType), hook.level) : -Infinity;
    const tKickArrival = tRead + PASS_RELEASE_SECONDS + distanceSeconds(post, corner);
    const tKickReady = tKickArrival + CATCH_AND_SHOOT_PREP_SECONDS;
    const kick = bestContest(ctx, [dig ? d2Recover : d2Home], corner, tKickReady, CATCH_AND_SHOOT_PREP_SECONDS)!;
    const kickValue = dig && isBehindThreePointLine(corner) && tKickReady < clock ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o2.attributes.T04, kick.level) : -Infinity;
    const tCutArrival = Math.max(tO3AtCut, tRead + PASS_RELEASE_SECONDS + distanceSeconds(post, DELAY_WEAK_CUT_SPOT));
    const tCutReady = tCutArrival + CLOSE_FINISH_PREP_SECONDS;
    // D4, a la espalda del poste que pasa, se gira al cortador en cuanto sale el pase (está junto al aro).
    const d4ToCutter = chaser(ctx, "D4", ctx.positions.D4!, tRead + PASS_RELEASE_SECONDS + recognitionLatencySeconds(player(ctx, "D4").attributes.M01, player(ctx, "D4").attributes.M05), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
    const cut = bestContest(ctx, [d3Chase, d5Sag, d4ToCutter], DELAY_WEAK_CUT_SPOT, tCutReady, CLOSE_FINISH_PREP_SECONDS)!;
    const cutValue = tCutReady < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o3.attributes.T01, cut.level) : -Infinity;
    const shoot = (args: ShotAttemptArgs) => (record: (factLinkKind?: string) => void) => {
      record();
      if (doubled && resolvesTurnoverUnderPressure(o4.attributes.T07, Math.min(d2.attributes.T15, player(ctx, "D4").attributes.T15), ctx.rng)) {
        event(ctx, tTurn, "concedido", "turnover", ["D2", "D4"], "D4 y D2 cierran el giro del poste entre los dos y le roban el balón a O4.");
        return { ...finalize(ctx, { kind: "steal_by_defense" }, { status: "held", holderId: "D2", position: post }), ...swap };
      }
      return { ...resolveShotAttempt(ctx, args), ...swap };
    };
    const passTo = (receiver: "O2" | "O3", spot: Point2D, tArrival: number, deflectorId: string, shot: ShotAttemptArgs, text: string) => (record: (factLinkKind?: string) => void) => {
      if (receiver === "O3") {
        if (cutPath.waypoint) setArrival(ctx, "O3", o3CutStart + distance(ctx.positions.O3!, cutPath.waypoint) / attackerMoveSpeedMps(o3.attributes.F01), cutPath.waypoint, o3CutStart);
        setArrival(ctx, "O3", tO3AtCut, DELAY_WEAK_CUT_SPOT, cutPath.waypoint ? o3CutStart + distance(ctx.positions.O3!, cutPath.waypoint) / attackerMoveSpeedMps(o3.attributes.F01) : o3CutStart);
        event(ctx, o3CutStart, "ejecutado", "weak_side_cut", ["O3", "D3"], "O3 corta desde el ala débil por detrás de D3, que mira al poste.");
      }
      const outcome = resolvePass(o4.attributes.T09, player(ctx, receiver).attributes.T11, true, player(ctx, deflectorId).attributes.T17, 1, ctx.rng);
      event(ctx, tArrival, "ejecutado", "pass_released", ["O4", receiver], text);
      record("pass_released");
      if (outcome.kind === "deflected_loose_ball") return { ...resolveLooseBallAfterPass(ctx, tArrival, "O4", deflectorId), ...swap };
      const delay = outcome.kind === "awkward_control" ? outcome.extraDelaySeconds : 0;
      event(ctx, tArrival, "concedido", "pass_received", [receiver], receiver === "O2" ? "O2 recibe en la esquina." : "O3 recibe el corte junto al aro.");
      return { ...resolveShotAttempt(ctx, { ...shot, tReady: shot.tReady + delay, prepSeconds: shot.prepSeconds + delay }), ...swap };
    };
    return [
      {
        id: "finalizar_poste",
        value: rimValue,
        completion: moveCompletion,
        kind: "tiro",
        values: { contesterId: realId(ctx, rim.id), opposition: rim.level, readySeconds: tRim, dig, doubled, stealProbability: doubled ? pressureSteal : 0 },
        execute: shoot({ shooterId: "O4", shooterSkill: o4.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tRim, prepSeconds: CLOSE_FINISH_PREP_SECONDS, contesterId: rim.id, contesterArrival: rim.arrival, contesterGeometry: rim.geometry }),
      },
      {
        id: "gancho_poste",
        value: hookValue,
        completion: moveCompletion,
        kind: "tiro",
        values: { contesterId: realId(ctx, hook.id), opposition: hook.level, shotType: hookType, dig, doubled },
        execute: shoot({ shooterId: "O4", shooterSkill: shotSkill(o4, hookType), shotType: hookType, shooterPos: post, tReady: tHook, prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS, contesterId: hook.id, contesterArrival: hook.arrival, contesterGeometry: hook.geometry }),
      },
      {
        id: "salida_esquina_o2",
        value: kickValue,
        completion: 1 - deflectionProbability(d2.attributes.T17, o4.attributes.T09),
        kind: "pase",
        values: { contesterId: realId(ctx, kick.id), opposition: kick.level, dig, marginSeconds: kick.arrival - tKickReady },
        execute: passTo("O2", corner, tKickArrival, "D2", { shooterId: "O2", shooterSkill: o2.attributes.T04, shotType: "three_point", shooterPos: corner, tReady: tKickReady, prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS, contesterId: kick.id, contesterArrival: kick.arrival, contesterGeometry: kick.geometry }, "O4 saca el balón del poste hacia la esquina que deja la ayuda de D2."),
      },
      {
        id: "corte_o3",
        value: cutValue,
        completion: 1 - deflectionProbability(d3.attributes.T17, o4.attributes.T09),
        kind: "pase",
        values: { contesterId: realId(ctx, cut.id), opposition: cut.level, cutterAtSpotSeconds: tO3AtCut },
        execute: passTo("O3", DELAY_WEAK_CUT_SPOT, tCutArrival, "D3", { shooterId: "O3", shooterSkill: o3.attributes.T01, shotType: "close_finish", shooterPos: DELAY_WEAK_CUT_SPOT, tReady: tCutReady, prepSeconds: CLOSE_FINISH_PREP_SECONDS, contesterId: cut.id, contesterArrival: cut.arrival, contesterGeometry: cut.geometry }, "O4 encuentra el corte de O3 desde el ala débil."),
      },
      {
        id: "repostear",
        value: 0,
        completion: 1,
        kind: "salida",
        values: {},
        execute: (record) => delayOutlet(ctx, "O4", post, tRead, record, "O4 no encuentra ventaja: devuelve el balón arriba a O5 y vuelve a sellar el poste; el ataque se reorganiza.", swap),
      },
    ];
  }
  const best = (opts: HandlerReadOption[]) => Math.max(0, ...opts.map((o) => (Number.isFinite(o.value) ? o.value * o.completion : 0)));
  const withDig = build(true);
  const withoutDig = build(false);
  const concessionWithDig = best(withDig);
  const concessionWithoutDig = best(withoutDig);
  const dig = concessionWithDig < concessionWithoutDig;
  return { options: dig ? withDig : withoutDig, dig, concessionWithDig, concessionWithoutDig, tD2Dig, digPoint, digInTime, tRead };
}

/** Pase de entrada al poste y su lectura (desvío posible de D4, que defiende por detrás). */
function postEntryOption(ctx: CoreContext, passerSlot: "O1" | "O5", passerPos: Point2D, tDecision: number, swap: Partial<PossessionCoreResult>): HandlerReadOption {
  const o4 = player(ctx, "O4");
  const d4 = player(ctx, "D4");
  const passer = player(ctx, passerSlot);
  const tCatch = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(passerPos, ctx.positions.O4!);
  const tRelease = tDecision + PASS_RELEASE_SECONDS;
  const projected = postReadOptions(ctx, tCatch, tRelease, swap);
  const value = Math.max(-Infinity, ...projected.options.filter((o) => o.kind !== "salida").map((o) => (Number.isFinite(o.value) ? o.value * o.completion : -Infinity)));
  return {
    id: "entrada_poste_o4",
    value: Number.isFinite(value) ? value : -Infinity,
    completion: 1 - deflectionProbability(d4.attributes.T17, passer.attributes.T09),
    kind: "pase",
    values: { postBestOption: [...projected.options].sort((a, b) => b.value * b.completion - a.value * a.completion)[0]?.id ?? null, digProjected: projected.dig },
    execute: (record) => {
      const outcome = resolvePass(passer.attributes.T09, o4.attributes.T11, true, d4.attributes.T17, 1, ctx.rng);
      event(ctx, tCatch, "ejecutado", "pass_released", [passerSlot, "O4"], `${passerSlot} entra el balón al poste bajo a O4.`);
      record("pass_released");
      if (outcome.kind === "deflected_loose_ball") return { ...resolveLooseBallAfterPass(ctx, tCatch, passerSlot, "D4"), ...swap };
      const tAct = tCatch + (outcome.kind === "awkward_control" ? outcome.extraDelaySeconds : 0);
      event(ctx, tCatch, "concedido", "pass_received", ["O4"], "O4 recibe en el poste bajo con D4 a la espalda.");
      const read = postReadOptions(ctx, tAct, tRelease, swap);
      auditDecision(ctx, tAct, {
        point: "respuesta_poste",
        holderId: "O4",
        participants: ["D2", "O2", "O4", "D4"],
        chosenOptionId: read.dig ? "ayudar_poste" : "quedarse_esquina",
        options: [
          { id: "ayudar_poste", status: read.dig ? "elegida" : "descartada_por_condicion", reasonCode: read.dig ? "help_lower_concession" : "help_higher_concession", values: { concessionValue: read.concessionWithDig, digArrivalSeconds: read.tD2Dig, postTurnSeconds: read.tRead + CLOSE_FINISH_PREP_SECONDS, digInTime: read.digInTime } },
          { id: "quedarse_esquina", status: read.dig ? "descartada_por_condicion" : "elegida", reasonCode: read.dig ? "help_higher_concession" : "help_lower_concession", values: { concessionValue: read.concessionWithoutDig } },
        ],
      });
      if (read.dig) {
        setArrival(ctx, "D2", read.tD2Dig, read.digPoint, tRelease + recognitionLatencySeconds(player(ctx, "D2").attributes.M01, player(ctx, "D2").attributes.M05));
        event(ctx, read.tD2Dig, "concedido", "post_dig", ["D2", "O2"], "D2 se hunde a cerrar el giro del poste («dig») y deja a O2 en la esquina.", { digPoint: read.digPoint });
      }
      return decideHandlerRead(ctx, "lectura_poste", read.tRead, ["O4", "D4", "D2", "O2", "O3"], read.options, "O4");
    },
  };
}

function runDelayPhase(ctx: CoreContext, response: DelayResponse): PossessionCoreResult {
  const o1 = player(ctx, "O1");
  const o5 = player(ctx, "O5");
  const d1 = player(ctx, "D1");
  const d5 = player(ctx, "D5");
  const wing = ctx.positions.O1!;
  const hub = ctx.positions.O5!;
  const clock = ctx.shotClockMs / 1000;
  const swap: Partial<PossessionCoreResult> = response === "cambiar_entrega" ? { defensiveSwap: ["D1", "D5"] } : {};
  event(ctx, 0, "reconocido", "delay_hold", ["O1", "O5", "O4"], "Delay: O1 retrasa la acción en el ala y busca a O5 arriba; O4 se coloca en el poste bajo.", { response });

  // --- 1. Entrada al pívot de arriba ----------------------------------------
  const tEntry = PASS_RELEASE_SECONDS + distanceSeconds(wing, hub);
  if (clock - tEntry <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, "O1");
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: "O1", position: wing });
  }
  const entryCompletion = 1 - deflectionProbability(d5.attributes.T17, o1.attributes.T09);
  const entryPass: ReturnType<typeof resolvePass> = ctx.projecting ? { kind: "clean_reception" } : resolvePass(o1.attributes.T09, o5.attributes.T11, true, d5.attributes.T17, 1, ctx.rng);
  event(ctx, tEntry, "ejecutado", "pass_released", ["O1", "O5"], "O1 entra el balón a O5 arriba.");
  if (entryPass.kind === "deflected_loose_ball") {
    auditDecision(ctx, tEntry, { point: "entrega_delay", holderId: "O1", participants: ["O1", "O5", "D5"], chosenOptionId: "entrada_negada", factLinkKind: "pass_released", options: [{ id: "entrada_o5", status: "elegida", reasonCode: "entry_pass_denied" }] });
    return { ...resolveLooseBallAfterPass(ctx, tEntry, "O1", "D5"), ...swap };
  }
  const tO5Ready = tEntry + (entryPass.kind === "awkward_control" ? entryPass.extraDelaySeconds : 0);
  event(ctx, tEntry, "concedido", "pass_received", ["O5"], "O5 recibe arriba, por encima del arco.");

  // --- 2. O1 sigue su pase a por la entrega ---------------------------------
  const handoffPoint = pointShortOfTarget(wing, hub, COMBINED_CONTACT_RADIUS_METERS);
  const tO1AtHandoff = PASS_RELEASE_SECONDS + timeToReach(wing, handoffPoint, attackerMoveSpeedMps(o1.attributes.F01));
  const tHandoffReady = Math.max(tO5Ready, tO1AtHandoff);
  setArrival(ctx, "O1", tO1AtHandoff, handoffPoint, PASS_RELEASE_SECONDS);
  // D1 persigue por encima de la entrega: el cuerpo de O5 le retrasa (misma primitiva que una pantalla).
  const handoffScreenDelay = screenInterceptDelaySeconds(o5.attributes.T13, o5.attributes.F05, d1.attributes.T16) + screenContactAdjustmentSeconds(o5.measures.weightKg - d1.measures.weightKg);
  const tD1Recognize = PASS_RELEASE_SECONDS + recognitionLatencySeconds(d1.attributes.M01, d1.attributes.M05);
  const d1Speed = defenderLateralSpeedMps(d1.attributes.F04);
  const offBallChoice: OffBallDefensiveCallChoice = ctx.input.offBallDefensiveCall ?? "guardar_espacio";
  const d1TrailFor = (call: OffBallDefensiveCall) => {
    const adjustment = call === "negar_primera_salida" ? -OFF_BALL_CALL_NAVIGATION_ADJUSTMENT_SECONDS : OFF_BALL_CALL_NAVIGATION_ADJUSTMENT_SECONDS;
    // Sesión v2-8: el retraso de la pantalla se suma a la llegada de D1 a la entrega (como D1 en el
    // bloqueo directo, D3 en el indirecto y D2 en la mano a mano central): ir por detrás no le ahorra
    // rodear a O5. Antes era `max(llegada, entrega + retraso)` y la pantalla no costaba nada a un D1 tardío.
    return Math.max(tD1Recognize + timeToReach(ctx.positions.D1!, handoffPoint, d1Speed), tHandoffReady) + Math.max(0, handoffScreenDelay + adjustment);
  };

  // --- Respuesta de D5 a la entrega -----------------------------------------
  const d5Speed = defenderLateralSpeedMps(d5.attributes.F04);
  const tD5Recognize = PASS_RELEASE_SECONDS + recognitionLatencySeconds(d5.attributes.M01, d5.attributes.M05);
  const jumpPoint = moveToward(handoffPoint, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS);
  const tD5AtJump = Math.max(tD5Recognize, tD5Recognize + distance(ctx.positions.D5!, jumpPoint) / d5Speed - perimeterArrivalAdjustmentSeconds(d5.attributes.T22));
  // Salta la entrega: la niega si ya está colocado (llegada + frenada F03) cuando O1 llega al punto.
  const denied = response === "saltar_entrega" && tD5AtJump + closeoutBrakingExtraSeconds(d5.attributes.F03) <= tHandoffReady;

  const optionsCache = new Map<OffBallDefensiveCall, { options: HandlerReadOption[]; tDecision: number; holder: "O1" | "O5" }>();
  const handlerOptionsFor = (call: OffBallDefensiveCall): { options: HandlerReadOption[]; tDecision: number; holder: "O1" | "O5" } => {
    const cached = optionsCache.get(call);
    if (cached) return cached;
    const built = buildHandlerOptions(call);
    optionsCache.set(call, built);
    return built;
  };
  function buildHandlerOptions(call: OffBallDefensiveCall): { options: HandlerReadOption[]; tDecision: number; holder: "O1" | "O5" } {
    const tD1Back = d1TrailFor(call);
    if (!denied) {
      const tDecision = tHandoffReady;
      const d1Trail = chaser(ctx, "D1", handoffPoint, tD1Back);
      const d5Help: ContestCandidate =
        response === "hundirse"
          ? chaser(ctx, "D5", ctx.positions.D5!, tDecision, (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23))
          : chaser(ctx, "D5", jumpPoint, Math.max(tD5AtJump, tDecision), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
      const d4Help = chaser(ctx, "D4", ctx.positions.D4!, tDecision + recognitionLatencySeconds(player(ctx, "D4").attributes.M01, player(ctx, "D4").attributes.M05), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
      const tRim = tDecision + timeToReach(handoffPoint, ATTACKED_HOOP, attackerMoveSpeedMps(o1.attributes.F01)) + CLOSE_FINISH_PREP_SECONDS;
      const rim = bestContest(ctx, [d5Help, d1Trail, d4Help], ATTACKED_HOOP, tRim, CLOSE_FINISH_PREP_SECONDS)!;
      const rimValue = tRim < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o1.attributes.T01, rim.level) : -Infinity;
      const tTriple = tDecision + movingShotPrepSeconds(o1.attributes.T06);
      const d5AtBall: ContestCandidate = { id: "D5", geometryTo: () => ({ geometry: { originPos: ctx.positions.D5!, destinationPos: jumpPoint, speedMps: d5Speed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d5.attributes.F03) }, arrivalSeconds: tD5AtJump }) };
      const triple = bestContest(ctx, response === "hundirse" ? [d1Trail] : [d1Trail, d5AtBall], handoffPoint, tTriple, movingShotPrepSeconds(o1.attributes.T06))!;
      const tripleValue = isBehindThreePointLine(handoffPoint) && tTriple < clock ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o1.attributes.T04, triple.level) : -Infinity;
      const pullUp = response === "hundirse" ? planPullUp(ctx, { shooterId: "O1", from: handoffPoint, tStart: tDecision, protectorPos: ctx.positions.D5!, standoffMeters: contestReachMeters(d5.measures.wingspanCm) + 0.05, contesters: [d1Trail, d5Help] }) : null;
      const pullUpValue = pullUp && pullUp.tReady < clock ? pullUp.value : -Infinity;
      const options: HandlerReadOption[] = [
        {
          id: "finalizar",
          value: rimValue,
          completion: entryCompletion,
          kind: "tiro",
          values: { contesterId: realId(ctx, rim.id), opposition: rim.level, readySeconds: tRim, response },
          execute: (record) => {
            record();
            return { ...resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: o1.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tRim, prepSeconds: CLOSE_FINISH_PREP_SECONDS, contesterId: rim.id, contesterArrival: rim.arrival, contesterGeometry: rim.geometry }), ...swap };
          },
        },
        {
          id: "triple_o1",
          value: tripleValue,
          completion: entryCompletion,
          kind: "tiro",
          values: { contesterId: realId(ctx, triple.id), opposition: triple.level, d1BackSeconds: tD1Back, response },
          execute: (record) => {
            record();
            return { ...resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: o1.attributes.T04, shotType: "three_point", shooterPos: handoffPoint, tReady: tTriple, prepSeconds: movingShotPrepSeconds(o1.attributes.T06), contesterId: triple.id, contesterArrival: triple.arrival, contesterGeometry: triple.geometry }), ...swap };
          },
        },
        {
          id: "parada_o1",
          value: pullUpValue,
          completion: entryCompletion,
          kind: "tiro",
          values: { shotType: pullUp?.shotType ?? null, contesterId: pullUp ? realId(ctx, pullUp.contesterId) : null, opposition: pullUp?.opposition ?? null },
          execute: (record) => {
            record();
            const plan = pullUp!;
            setArrival(ctx, "O1", tDecision + plan.travelSeconds, plan.spot, tDecision);
            return { ...resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: shotSkill(o1, plan.shotType), shotType: plan.shotType, shooterPos: plan.spot, tReady: plan.tReady, prepSeconds: plan.prepSeconds, contesterId: plan.contesterId, contesterArrival: plan.contesterArrival, contesterGeometry: plan.contesterGeometry }), ...swap };
          },
        },
        { ...postEntryOption(ctx, "O1", handoffPoint, tDecision, swap), completion: entryCompletion * (1 - deflectionProbability(player(ctx, "D4").attributes.T17, o1.attributes.T09)) },
        {
          id: "salida_segura",
          value: 0,
          completion: 1,
          kind: "salida",
          values: {},
          execute: (record) => delayOutlet(ctx, "O1", handoffPoint, tDecision, record, "O1 sale de la entrega sin ventaja y devuelve el balón a O5; el ataque se reorganiza.", swap),
        },
      ];
      return { options, tDecision, holder: "O1" };
    }
    // Entrega negada: O5 se la queda con su defensor fuera de la pintura.
    const tKeep = tHandoffReady;
    const d5Recover = chaser(ctx, "D5", jumpPoint, Math.max(tD5AtJump, tKeep) + recognitionLatencySeconds(d5.attributes.M01, d5.attributes.M05), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
    const d4Help = chaser(ctx, "D4", ctx.positions.D4!, tKeep + recognitionLatencySeconds(player(ctx, "D4").attributes.M01, player(ctx, "D4").attributes.M05), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
    // D5 está en el punto de la entrega: el pívot y el cortador lo rodean (dos cuerpos no se cruzan).
    const keeperPath = detourAround(hub, ATTACKED_HOOP, jumpPoint, COMBINED_CONTACT_RADIUS_METERS);
    const tRim = tKeep + keeperPath.length / attackerMoveSpeedMps(o5.attributes.F01) + CLOSE_FINISH_PREP_SECONDS;
    const rim = bestContest(ctx, [d5Recover, d4Help], ATTACKED_HOOP, tRim, CLOSE_FINISH_PREP_SECONDS)!;
    const rimValue = tRim < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o5.attributes.T01, rim.level) : -Infinity;
    // Puerta de atrás: O1, con D5 en su camino arriba, corta al aro por detrás; D1 le persigue tarde.
    const backdoorPath = detourAround(handoffPoint, ATTACKED_HOOP, jumpPoint, COMBINED_CONTACT_RADIUS_METERS);
    const tO1AtRim = tKeep + backdoorPath.length / attackerMoveSpeedMps(o1.attributes.F01);
    const tBackdoorArrival = Math.max(tO1AtRim, tKeep + PASS_RELEASE_SECONDS + distanceSeconds(hub, ATTACKED_HOOP));
    const tBackdoorReady = tBackdoorArrival + CLOSE_FINISH_PREP_SECONDS;
    const d1Chase = chaser(ctx, "D1", ctx.positions.D1!, tKeep + recognitionLatencySeconds(d1.attributes.M01, d1.attributes.M05));
    const backdoor = bestContest(ctx, [d1Chase, d4Help], ATTACKED_HOOP, tBackdoorReady, CLOSE_FINISH_PREP_SECONDS)!;
    const backdoorValue = tBackdoorReady < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o1.attributes.T01, backdoor.level) : -Infinity;
    const options: HandlerReadOption[] = [
      {
        id: "finalizar_o5",
        value: rimValue,
        completion: entryCompletion,
        kind: "tiro",
        values: { contesterId: realId(ctx, rim.id), opposition: rim.level, readySeconds: tRim },
        execute: (record) => {
          record();
          return { ...resolveShotAttempt(ctx, { shooterId: "O5", shooterSkill: o5.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tRim, prepSeconds: CLOSE_FINISH_PREP_SECONDS, contesterId: rim.id, contesterArrival: rim.arrival, contesterGeometry: rim.geometry }), ...swap };
        },
      },
      {
        id: "puerta_atras_o1",
        value: backdoorValue,
        completion: entryCompletion * (1 - deflectionProbability(d5.attributes.T17, o5.attributes.T09)),
        kind: "pase",
        values: { contesterId: realId(ctx, backdoor.id), opposition: backdoor.level, cutterAtRimSeconds: tO1AtRim },
        execute: (record) => {
          setArrival(ctx, "O1", tO1AtRim, ATTACKED_HOOP, tKeep);
          event(ctx, tKeep, "ejecutado", "backdoor_cut", ["O1", "D1"], "Con D5 en el punto de la entrega, O1 corta por la puerta de atrás hacia el aro.");
          const outcome = resolvePass(o5.attributes.T09, o1.attributes.T11, true, d5.attributes.T17, 1, ctx.rng);
          event(ctx, tBackdoorArrival, "ejecutado", "pass_released", ["O5", "O1"], "O5 encuentra a O1 en el corte por la puerta de atrás.");
          record("pass_released");
          if (outcome.kind === "deflected_loose_ball") return { ...resolveLooseBallAfterPass(ctx, tBackdoorArrival, "O5", "D5"), ...swap };
          const delay = outcome.kind === "awkward_control" ? outcome.extraDelaySeconds : 0;
          event(ctx, tBackdoorArrival, "concedido", "pass_received", ["O1"], "O1 recibe junto al aro.");
          return { ...resolveShotAttempt(ctx, { shooterId: "O1", shooterSkill: o1.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tBackdoorReady + delay, prepSeconds: CLOSE_FINISH_PREP_SECONDS + delay, contesterId: backdoor.id, contesterArrival: backdoor.arrival, contesterGeometry: backdoor.geometry }), ...swap };
        },
      },
      { ...postEntryOption(ctx, "O5", hub, tKeep, swap), completion: entryCompletion * (1 - deflectionProbability(player(ctx, "D4").attributes.T17, o5.attributes.T09)) },
      {
        id: "salida_segura",
        value: 0,
        completion: 1,
        kind: "salida",
        values: {},
        execute: (record) => delayOutlet(ctx, "O5", hub, tKeep, record, "O5 se queda el balón sin ventaja e invierte al ala débil; el ataque se reorganiza.", swap),
      },
    ];
    return { options, tDecision: tKeep, holder: "O5" };
  }

  // Orden sin balón de D1 (ME-06 §3.1, mismo ajuste): en `auto`, la de menor concesión proyectada.
  const concessionOf = (call: OffBallDefensiveCall) => Math.max(0, ...handlerOptionsFor(call).options.map((o) => (Number.isFinite(o.value) ? o.value * o.completion : 0)));
  let call: OffBallDefensiveCall;
  if (offBallChoice === "auto") {
    const negar = concessionOf("negar_primera_salida");
    const guardar = concessionOf("guardar_espacio");
    call = negar < guardar ? "negar_primera_salida" : "guardar_espacio";
    auditDecision(ctx, tD1Recognize, {
      point: "seleccion_orden_sin_balon",
      holderId: null,
      participants: ["D1", "O1"],
      chosenOptionId: call,
      options: [
        { id: "negar_primera_salida", status: call === "negar_primera_salida" ? "elegida" : "descartada_por_condicion", reasonCode: call === "negar_primera_salida" ? "off_ball_call_lower_concession" : "off_ball_call_higher_concession", values: { concessionValue: negar } },
        { id: "guardar_espacio", status: call === "guardar_espacio" ? "elegida" : "descartada_por_condicion", reasonCode: call === "guardar_espacio" ? (negar === guardar ? "off_ball_call_tied_base_kept" : "off_ball_call_lower_concession") : "off_ball_call_higher_concession", values: { concessionValue: guardar } },
      ],
    });
  } else {
    call = offBallChoice;
  }
  const tD1Back = d1TrailFor(call);

  // Trayectorias y hechos de la entrega.
  if (response === "cambiar_entrega") {
    const tD5Switch = Math.max(tD5Recognize, tD5Recognize + distance(ctx.positions.D5!, jumpPoint) / d5Speed - perimeterArrivalAdjustmentSeconds(d5.attributes.T22));
    setArrival(ctx, "D5", tD5Switch, jumpPoint, tD5Recognize);
    setArrival(ctx, "D1", tD1Recognize + timeToReach(ctx.positions.D1!, moveToward(hub, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS), d1Speed), moveToward(hub, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS), tD1Recognize);
    event(ctx, tD5Recognize, "reconocido", "switch_committed", ["D5", "D1"], "D5 canta el cambio en la entrega: toma a O1 y D1 se queda con O5.", { switchPoint: jumpPoint });
  } else if (response === "saltar_entrega") {
    setArrival(ctx, "D5", tD5AtJump, jumpPoint, tD5Recognize);
    setArrival(ctx, "D1", tD1Back, handoffPoint, tD1Recognize);
    event(ctx, tD5AtJump, "ejecutado", "show_committed", ["D5"], denied ? "D5 salta al punto de la entrega antes que O1 y la niega; deja la pintura." : "D5 sale a saltar la entrega, pero O1 llega antes; D5 queda fuera de la pintura.", { jumpPoint, arrivesAt: tD5AtJump, denied });
  } else {
    setArrival(ctx, "D1", tD1Back, handoffPoint, tD1Recognize);
  }
  auditDecision(ctx, tHandoffReady, {
    point: "entrega_delay",
    holderId: "O5",
    participants: ["O5", "O1", "D1", "D5"],
    chosenOptionId: denied ? "entrega_negada" : "entrega_completada",
    options: [
      denied
        ? { id: "entrega_negada", status: "elegida", reasonCode: "handoff_denied_defender_arrived", values: { response, d5JumpArrivalSeconds: tD5AtJump, handoffReadySeconds: tHandoffReady, d1BackSeconds: tD1Back, handoffScreenDelay } }
        : { id: "entrega_completada", status: "elegida", reasonCode: "handoff_completed", values: { response, d5JumpArrivalSeconds: response === "saltar_entrega" ? tD5AtJump : null, handoffReadySeconds: tHandoffReady, d1BackSeconds: tD1Back, handoffScreenDelay } },
    ],
  });
  event(ctx, tHandoffReady, denied ? "concedido" : "ejecutado", denied ? "dho_denied" : "dho_completed", ["O5", "O1"], denied ? "O5 se queda el balón: la entrega está negada." : `O5 entrega en mano a O1; D1 persigue con ${(tD1Back - tHandoffReady).toFixed(2)} s de retraso.`, { handoffPoint, denied });

  const { options, tDecision, holder } = handlerOptionsFor(call);
  if (clock - tDecision <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, holder);
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: holder, position: holder === "O1" ? handoffPoint : hub });
  }
  return decideHandlerRead(ctx, holder === "O1" ? "lectura_delay" : "lectura_delay_pivote", tDecision, holder === "O1" ? ["O1", "O5", "O4", "D1", "D5"] : ["O5", "O1", "O4", "D5", "D4"], options, holder);
}

interface EntryOpportunity {
  readonly viable: boolean;
  readonly value: number;
}

/**
 * Resolución pura de `coverage: "auto"` (ME-07A §4): antes de despachar el
 * árbol organizado (bloqueo directo o mano a mano), compara qué concedería
 * cada cobertura desde la misma geometría real heredada, sin RNG y sin
 * ejecutar la rama descartada — mismo patrón que
 * `estimateBloqueoDirectoOpportunity`/`estimateHandoffOpportunity` para la
 * familia ofensiva.
 *
 * - Concesión de `drop`: el short roll de O5 queda libre en cuanto la
 *   pantalla retiene a D1 lo suficiente (mismo umbral 0,2 s que
 *   `estimateBloqueoDirectoOpportunity`); valor con la fórmula de tiro
 *   cercano ya existente (T01, sin oposición).
 * - Elegibilidad de `trampa`: D5 debe poder comprometer a O1 (mismo cálculo
 *   de `runTrapPhase`: aviso M01/M05 tras el uso de la pantalla, llegada
 *   real de D5 con el ajuste perimetral T22) antes de que O1 ya haya
 *   dispuesto de una ventana clara con la pantalla; si D5 llega tarde, la
 *   trampa no es elegible y `drop` es el único plan base disponible.
 * - Concesión de `trampa` (cuando es elegible): la rotación D3→D4 que
 *   `runTrapPhase` ejecuta después expone a O4 en la esquina débil; valor
 *   con la fórmula de triple ya existente (T04, sin oposición), la misma
 *   que compara la primera lectura del bloqueo directo.
 *
 * Empate exacto o trampa no elegible conservan `drop` como plan base
 * (prompt §4, "conserva drop/guardar_espacio como plan base").
 */
interface CoverageEstimate {
  readonly switchProjection: FamilyOpportunity;
  readonly showProjection: FamilyOpportunity;
  readonly atLevelProjection: FamilyOpportunity;
  /** ICE proyectado (solo con pantalla lateral; si D1 llega tarde, concede lo mismo que drop). */
  readonly iceProjection: FamilyOpportunity | null;
  readonly underProjection: FamilyOpportunity;
  /** ICE solo es elegible si la pantalla es lateral (fuera de la franja de la zona). */
  readonly iceEligible: boolean;
  readonly trapEligible: boolean;
  readonly dropConcessionValue: number;
  readonly trapConcessionValue: number;
  readonly trap: TrapProjection | null;
  readonly dropBestReadOption: string | null;
}

/**
 * ME-07B v2 §2.3: ambas concesiones salen de la misma frontera y de la
 * propia ejecución de cada cobertura, proyectada en seco: `drop` concede la
 * mejor vía de la primera lectura del bloqueo (con riesgo de pase, igual que
 * el selector de familia); `trampa` concede el valor esperado de la rama que
 * su propia geometría alcanza. La trampa solo es elegible si se cierra antes
 * de que llegue el pase a O5; una trampa tardía concede el carril de O1.
 */
function estimateCoverageChoice(ctx: CoreContext, scenario: ScenarioDefinition): CoverageEstimate {
  const drop = familyOpportunity(projectFamilyRead(ctx, (dry) => runDropPhase(dry, scenario)));
  const trap = projectTrapConcession(ctx);
  const dropConcessionValue = Number.isFinite(drop.value) ? drop.value : 0;
  const trapEligible = trap !== null && trap.trapClosed;
  return {
    switchProjection: familyOpportunity(projectFamilyRead(ctx, (dry) => runSwitchPhase(dry))),
    showProjection: familyOpportunity(projectFamilyRead(ctx, (dry) => runShowPhase(dry, scenario))),
    atLevelProjection: familyOpportunity(projectFamilyRead(ctx, (dry) => runShowPhase(dry, scenario, "a_la_altura"))),
    iceProjection: isLateralScreenSpot(ctx.positions.O5!) ? familyOpportunity(projectFamilyRead(ctx, (dry) => runIcePhase(dry, scenario))) : null,
    underProjection: familyOpportunity(projectFamilyRead(ctx, (dry) => runDropPhase(dry, scenario, "por_debajo"))),
    iceEligible: isLateralScreenSpot(ctx.positions.O5!),
    trapEligible,
    dropConcessionValue,
    trapConcessionValue: trap ? trap.concession : Infinity,
    trap,
    dropBestReadOption: drop.bestOptionId,
  };
}

/**
 * Segunda familia posicional completa (ME-06 §3.1): mano a mano central con
 * indirecto en el lado débil. Rediseño acotado de la sesión v2-8, autorizado
 * por Dennis («en la entrega de O5 a O2, el cuerpo de O5 debe poder actuar
 * como pantalla real sobre D2»):
 *
 * - O5 recibe la entrada en la línea de tiros libres (no antes de llegar a
 *   ella). O2 sube desde la esquina fuerte rodeando a O5 y recibe en su hombro
 *   alto (punto de entrega a contacto de O5, lejos del aro); al salir dobla por
 *   el otro hombro de O5 (punto de salida a contacto, en el lado contrario al
 *   que vino). El cuerpo de O5 queda así entre D2, que persigue por detrás, y
 *   la salida de O2: es la misma pantalla física que el bloqueo directo
 *   (`screenInterceptDelaySeconds` T13/F05 de O5 frente a T16 de D2, ajuste por
 *   peso) y solo cuenta si O5 está puesto (llegó al punto antes de
 *   `SCREEN_SET_AFTER_ARRIVAL_SECONDS` de la entrega); una pantalla en
 *   movimiento no retiene a nadie.
 * - D2 reconoce el corte (M01/M05) y lo sigue por el mismo camino; si llega al
 *   punto de entrega antes que O2 (con su frenada F03), lo ocupa y la entrega
 *   queda negada. Si no, persigue por encima y rodea a O5 con el retraso de la
 *   pantalla (la orden sin balón aprieta o concede ±0,15 s, como en Delay y en
 *   el indirecto); desde el hombro de salida cierra los tiros de O2.
 * - D5 responde a la entrega como en Delay (`DelayResponse`): hundirse (protege
 *   el aro y concede la parada), cambiar (sale a O2 por el hombro de salida y
 *   D2 se queda con O5) o saltar la entrega (si llega antes que O2 al hombro de
 *   salida la niega y deja la pintura).
 * - O2 lee al recibir (no espera al indirecto): aro, parada (T02/T03),
 *   triple solo si el punto de entrega estuviera detrás del arco (aquí no lo
 *   está), continuación de O5 al aro tras entregar, indirecto (O3 o O4) y salida.
 *   Con la entrega negada, O5 se la queda: aro, puerta de atrás de O2,
 *   indirecto y salida.
 *
 * Cada vía se valora con `bestContest`/`estimateContestLevel` y los mismos
 * argumentos que después recibe `resolveShotAttempt` (sesión v2-7). El tipo de
 * tiro del indirecto lo decide la zona real del punto (los puntos de ME-06
 * están dentro del arco: antes se anotaban como triples). Ningún coeficiente
 * nuevo; solo puntos derivados del radio de contacto ya versionado.
 */
type HandoffResponse = DelayResponse;

function runHandoffPhase(ctx: CoreContext, response: HandoffResponse): PossessionCoreResult {
  const o1 = player(ctx, "O1");
  const o2 = player(ctx, "O2");
  const o3 = player(ctx, "O3");
  const o4 = player(ctx, "O4");
  const o5 = player(ctx, "O5");
  const d2 = player(ctx, "D2");
  const d3 = player(ctx, "D3");
  const d4 = player(ctx, "D4");
  const d5 = player(ctx, "D5");
  const clock = ctx.shotClockMs / 1000;
  const r = COMBINED_CONTACT_RADIUS_METERS;
  const swap: Partial<PossessionCoreResult> = response === "cambiar_entrega" ? { defensiveSwap: ["D2", "D5"] } : {};
  const offBallCallChoice: OffBallDefensiveCallChoice = ctx.input.offBallDefensiveCall ?? "guardar_espacio";

  event(
    ctx,
    0,
    "reconocido",
    "handoff_action_started",
    ["O1", "O5", "O2", "O3", "O4"],
    "Se organiza el mano a mano: O1 busca a O5 en el codo alto, O2 sube a por la entrega y O4 coloca un bloqueo indirecto para O3 en el lado débil.",
    { offBallDefensiveCall: offBallCallChoice, response },
  );

  // --- 1. Entrada: O1 encuentra a O5 en el codo alto del lado fuerte ----------
  // ME-06 lo llamaba «codo alto» pero usaba el centro de la línea de tiros
  // libres; el codo real es el extremo de esa línea (semianchura FIBA de la
  // zona) del lado de O2, que es quien viene a por la entrega.
  const strongSign = Math.sign(ctx.positions.O2!.y - FREE_THROW_LINE_SPOT.y) || -1;
  const hub: Point2D = { x: FREE_THROW_LINE_SPOT.x, y: FREE_THROW_LINE_SPOT.y + strongSign * FIBA_LANE_HALF_WIDTH_METERS };
  const tO5AtHub = timeToReach(ctx.positions.O5!, hub, attackerMoveSpeedMps(o5.attributes.F01));
  // El pase llega cuando O5 ya está en el punto (nadie recibe donde todavía no está).
  const tEntryArrival = Math.max(PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, hub), tO5AtHub);
  if (clock - tEntryArrival <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, "O1");
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "dead", holderId: null, position: ctx.positions.O1! });
  }
  // En proyección no se sortea: el riesgo del pase de entrada entra como
  // probabilidad de completarse en el valor de la familia (§2.2).
  const entryPass: ReturnType<typeof resolvePass> = ctx.projecting
    ? { kind: "clean_reception" }
    : resolvePass(o1.attributes.T09, o5.attributes.T11, true, d5.attributes.T17, 1, ctx.rng);
  const entryCompletion = 1 - deflectionProbability(d5.attributes.T17, o1.attributes.T09);
  setArrival(ctx, "O5", tO5AtHub, hub, 0);
  event(ctx, tEntryArrival, "ejecutado", "pass_released", ["O1", "O5"], "O1 busca a O5 en el codo alto.");
  if (entryPass.kind === "deflected_loose_ball") {
    auditDecision(ctx, tEntryArrival, {
      point: "entrada_mano_a_mano",
      holderId: "O1",
      participants: ["O1", "O5", "D5"],
      chosenOptionId: "entrada_negada",
      factLinkKind: "pass_released",
      options: [{ id: "entrada_o5", status: "elegida", reasonCode: "entry_pass_denied", reasonNote: "El pase de entrada fue desviado por D5." }],
    });
    return resolveLooseBallAfterPass(ctx, tEntryArrival, "O1", "D5");
  }
  const tO5Ready = tEntryArrival + (entryPass.kind === "awkward_control" ? entryPass.extraDelaySeconds : 0);
  event(ctx, tO5Ready, "concedido", "pass_received", ["O5"], "O5 recibe la entrada en el codo alto.");
  auditDecision(ctx, tO5Ready, {
    point: "entrada_mano_a_mano",
    holderId: "O1",
    participants: ["O1", "O5"],
    chosenOptionId: "entrada_o5",
    factLinkKind: "pass_received",
    options: [{ id: "entrada_o5", status: "elegida", reasonCode: "entry_pass_completed", values: { tO5Ready, tO5AtHubSeconds: tO5AtHub } }],
  });

  // --- 2. Geometría de la entrega: hombro alto (entrega) y hombro de salida ---
  const hubToHoop = distance(hub, ATTACKED_HOOP);
  const towardHoop = { x: (ATTACKED_HOOP.x - hub.x) / hubToHoop, y: (ATTACKED_HOOP.y - hub.y) / hubToHoop };
  const exchange: Point2D = { x: hub.x - towardHoop.x * r, y: hub.y - towardHoop.y * r };
  // Lado por el que llega O2 (perpendicular al eje O5–aro); sale por el contrario.
  const perp = { x: -towardHoop.y, y: towardHoop.x };
  const approachSign = Math.sign((ctx.positions.O2!.x - hub.x) * perp.x + (ctx.positions.O2!.y - hub.y) * perp.y) || -1;
  const exitPoint: Point2D = { x: hub.x - perp.x * r * approachSign, y: hub.y - perp.y * r * approachSign };
  // Hombro de contacto: el del lado por el que llegan O2 y su perseguidor.
  const contactPoint: Point2D = { x: hub.x + perp.x * r * approachSign, y: hub.y + perp.y * r * approachSign };
  const exchangeToExit = distance(exchange, exitPoint);
  // D5 sale al encuentro de O2 justo después del hombro de salida (saltar o cambiar).
  const jumpPoint = moveToward(exitPoint, ATTACKED_HOOP, 1, r);

  // O2 rodea a O5 hasta el hombro alto.
  const o2Speed = attackerMoveSpeedMps(o2.attributes.F01);
  const o2Run = detourAround(ctx.positions.O2!, exchange, hub, r);
  const tO2AtExchange = o2Run.length / o2Speed;
  if (o2Run.waypoint) setArrival(ctx, "O2", distance(ctx.positions.O2!, o2Run.waypoint) / o2Speed, o2Run.waypoint, 0);
  setArrival(ctx, "O2", tO2AtExchange, exchange, o2Run.waypoint ? distance(ctx.positions.O2!, o2Run.waypoint) / o2Speed : 0);
  const tHandoffReady = Math.max(tO5Ready, tO2AtExchange);

  // Pantalla del cuerpo de O5: solo retiene si O5 está puesto antes de la entrega.
  const screenSet = tO5AtHub + SCREEN_SET_AFTER_ARRIVAL_SECONDS <= tHandoffReady;
  const screenDelayRaw = screenInterceptDelaySeconds(o5.attributes.T13, o5.attributes.F05, d2.attributes.T16) + screenContactAdjustmentSeconds(o5.measures.weightKg - d2.measures.weightKg);

  // D2 reconoce el corte de O2 y lo sigue por el mismo camino.
  const d2Speed = defenderLateralSpeedMps(d2.attributes.F04);
  const tD2Recognize = recognitionLatencySeconds(d2.attributes.M01, d2.attributes.M05);
  const d2Run = detourAround(ctx.positions.D2!, exchange, hub, r);
  const tD2AtExchange = Math.max(tD2Recognize, tD2Recognize + d2Run.length / d2Speed - perimeterArrivalAdjustmentSeconds(d2.attributes.T22));
  const d2Denies = tD2AtExchange + closeoutBrakingExtraSeconds(d2.attributes.F03) <= tO2AtExchange;
  const tD2AtContact = Math.max(tD2Recognize, tD2Recognize + distance(ctx.positions.D2!, contactPoint) / d2Speed - perimeterArrivalAdjustmentSeconds(d2.attributes.T22));

  // D5 lee el pase de entrada en el aire.
  const d5Speed = defenderLateralSpeedMps(d5.attributes.F04);
  const tD5Recognize = PASS_RELEASE_SECONDS + recognitionLatencySeconds(d5.attributes.M01, d5.attributes.M05);
  const tD5AtJump = Math.max(tD5Recognize, tD5Recognize + distance(ctx.positions.D5!, jumpPoint) / d5Speed - perimeterArrivalAdjustmentSeconds(d5.attributes.T22));
  const d5Jumps = response === "saltar_entrega" && tD5AtJump + closeoutBrakingExtraSeconds(d5.attributes.F03) <= tHandoffReady;
  const denied = d2Denies || d5Jumps;

  // --- 3. Bloqueo indirecto de O4 para el corte de O3 (ME-06 §3.1.3) ---------
  const screenDelayBase = screenInterceptDelaySeconds(o4.attributes.T13, o4.attributes.F05, d3.attributes.T16);
  const tO4ScreenSet = timeToReach(ctx.positions.O4!, WEAK_SIDE_SCREEN_SPOT, attackerMoveSpeedMps(o4.attributes.F01));
  const cutStart = Math.max(0, tO4ScreenSet - cutterStartTimeReductionSeconds(o3.attributes.T21));
  const tO3Cut = cutStart + timeToReach(ctx.positions.O3!, WEAK_SIDE_CUT_SPOT, attackerMoveSpeedMps(o3.attributes.F01));
  const d3RawArrival = timeToReach(ctx.positions.D3!, WEAK_SIDE_CUT_SPOT, defenderLateralSpeedMps(d3.attributes.F04));
  const callAdjustment = (call: OffBallDefensiveCall) => (call === "negar_primera_salida" ? -OFF_BALL_CALL_NAVIGATION_ADJUSTMENT_SECONDS : OFF_BALL_CALL_NAVIGATION_ADJUSTMENT_SECONDS);
  function pindownFor(call: OffBallDefensiveCall) {
    const screenDelay = Math.max(0, screenDelayBase + callAdjustment(call));
    const tD3AtCut = cutStart + d3RawArrival + screenDelay;
    const cutWindowOpen = tD3AtCut > tO3Cut;
    const d4HelpMargin = tD3AtCut - tO3Cut;
    const d4Helps = call === "guardar_espacio" && d4HelpMargin > -0.5;
    return { screenDelay, tD3AtCut, cutWindowOpen, d4HelpMargin, d4Helps };
  }
  /**
   * D2 se libera de la pantalla: llega al hombro de O5 por el que viene (o
   * está allí cuando O2 sale con el balón) y la navega con el retraso de
   * contacto, igual que D1 en el bloqueo directo y D3 en el indirecto (el
   * retraso se suma: ir por detrás no le ahorra rodear a O5).
   */
  function d2ReleaseFor(call: OffBallDefensiveCall): number {
    const navigation = screenSet ? Math.max(0, screenDelayRaw + callAdjustment(call)) : 0;
    return Math.max(tD2AtContact, tHandoffReady) + navigation;
  }
  /** Persecución de D2 desde el hombro de contacto, rodeando a O5 hasta el punto de tiro (el tiempo cuenta el rodeo). */
  function d2PursuitFor(call: OffBallDefensiveCall): ContestCandidate {
    const release = d2ReleaseFor(call);
    return {
      id: "D2",
      geometryTo: (spot) => ({
        geometry: { originPos: contactPoint, destinationPos: spot, speedMps: d2Speed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d2.attributes.F03) },
        arrivalSeconds: Math.max(release, release + detourAround(contactPoint, spot, hub, r).length / d2Speed - perimeterArrivalAdjustmentSeconds(d2.attributes.T22)),
      }),
    };
  }

  /** Tipo de tiro de recepción en un punto del indirecto: lo decide la zona real (LAB-0.5). */
  const spotShotType = (spot: Point2D): ShotType => (isBehindThreePointLine(spot) ? "three_point" : isMidRangeZone(spot) ? "mid_range" : isFloaterZone(spot) ? "floater" : "close_finish");
  const spotPoints = (type: ShotType) => (type === "three_point" ? 3 : 2);

  /** Vías del indirecto (O3 tras el corte, O4 si D4 ayuda) y la salida, desde quien tenga el balón. */
  function pindownOptions(call: OffBallDefensiveCall, holderSlot: "O2" | "O5", holderPos: Point2D, tDecision: number, completionBase: number): HandlerReadOption[] {
    const holder = player(ctx, holderSlot);
    const p = pindownFor(call);
    const o3Contester = p.d4Helps ? "D4" : "D3";
    const o3ContestGeometry: ContestGeometry = p.d4Helps
      ? { originPos: ctx.positions.D4!, destinationPos: WEAK_SIDE_CUT_SPOT, speedMps: defenderLateralSpeedMps(d4.attributes.F04), brakingExtraSeconds: closeoutBrakingExtraSeconds(d4.attributes.F03) }
      : { originPos: ctx.positions.D3!, destinationPos: WEAK_SIDE_CUT_SPOT, speedMps: defenderLateralSpeedMps(d3.attributes.F04), brakingExtraSeconds: closeoutBrakingExtraSeconds(d3.attributes.F03) };
    // El pase sale al decidir y llega al cortador cuando él llega al punto (no antes).
    const tPassArrivalO3 = Math.max(tO3Cut, tDecision + PASS_RELEASE_SECONDS + distanceSeconds(holderPos, WEAK_SIDE_CUT_SPOT));
    const o3Type = spotShotType(WEAK_SIDE_CUT_SPOT);
    const tO3Ready = tPassArrivalO3 + CATCH_AND_SHOOT_PREP_SECONDS;
    const o3Opposition = estimateContestLevel(ctx, o3Contester, o3ContestGeometry, p.tD3AtCut, WEAK_SIDE_CUT_SPOT, tO3Ready, CATCH_AND_SHOOT_PREP_SECONDS);
    const o3Value = p.cutWindowOpen && tO3Ready < clock ? spotPoints(o3Type) * shotProbability(shotBaseProbability(o3Type), shotSkill(o3, o3Type), o3Opposition) : -Infinity;
    const d4CornerGeometry: ContestGeometry = { originPos: ctx.positions.D4!, destinationPos: WEAK_SIDE_SCREEN_SPOT, speedMps: defenderLateralSpeedMps(d4.attributes.F04), brakingExtraSeconds: closeoutBrakingExtraSeconds(d4.attributes.F03) };
    const tPassArrivalO4 = Math.max(tO4ScreenSet, tDecision + PASS_RELEASE_SECONDS + distanceSeconds(holderPos, WEAK_SIDE_SCREEN_SPOT));
    const o4Type = spotShotType(WEAK_SIDE_SCREEN_SPOT);
    const tO4Ready = tPassArrivalO4 + CATCH_AND_SHOOT_PREP_SECONDS;
    // D4 sale a cerrar a O4 cuando deja la ayuda sobre O3 (su llegada al corte).
    const o4Opposition = estimateContestLevel(ctx, "D4", d4CornerGeometry, p.tD3AtCut, WEAK_SIDE_SCREEN_SPOT, tO4Ready, CATCH_AND_SHOOT_PREP_SECONDS);
    const o4Value = p.d4Helps && tO4Ready < clock ? spotPoints(o4Type) * shotProbability(shotBaseProbability(o4Type), shotSkill(o4, o4Type), o4Opposition) : -Infinity;
    const passTo = (receiver: "O3" | "O4", spot: Point2D, tArrival: number, deflectorId: string, shot: ShotAttemptArgs, text: string, receivedText: string) => (record: (factLinkKind?: string) => void) => {
      const outcome = resolvePass(holder.attributes.T09, player(ctx, receiver).attributes.T11, true, player(ctx, deflectorId).attributes.T17, 1, ctx.rng);
      event(ctx, tArrival, "ejecutado", "pass_released", [holderSlot, receiver], text);
      record("pass_released");
      if (outcome.kind === "deflected_loose_ball") return { ...resolveLooseBallAfterPass(ctx, tArrival, holderSlot, deflectorId), ...swap };
      const delay = outcome.kind === "awkward_control" ? outcome.extraDelaySeconds : 0;
      event(ctx, tArrival, "concedido", "pass_received", [receiver], receivedText);
      return { ...resolveShotAttempt(ctx, { ...shot, tReady: shot.tReady + delay, prepSeconds: shot.prepSeconds + delay }), ...swap };
    };
    return [
      {
        id: "pase_o3",
        value: o3Value,
        completion: completionBase * (1 - deflectionProbability(d3.attributes.T17, holder.attributes.T09)),
        kind: "pase",
        values: { cutWindowOpen: p.cutWindowOpen, tD3AtCut: p.tD3AtCut, tO3Cut, opposition: o3Opposition, contesterId: realId(ctx, o3Contester), shotType: o3Type },
        execute: passTo("O3", WEAK_SIDE_CUT_SPOT, tPassArrivalO3, "D3", { shooterId: "O3", shooterSkill: shotSkill(o3, o3Type), shotType: o3Type, shooterPos: WEAK_SIDE_CUT_SPOT, tReady: tO3Ready, prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS, contesterId: o3Contester, contesterArrival: p.tD3AtCut, contesterGeometry: o3ContestGeometry }, `${holderSlot} pasa a O3, que sale del bloqueo indirecto.`, "O3 recibe tras el bloqueo indirecto."),
      },
      {
        id: "continuar_o4",
        value: o4Value,
        completion: completionBase * (1 - deflectionProbability(d4.attributes.T17, holder.attributes.T09)),
        kind: "pase",
        values: { o4Open: p.d4Helps, d4HelpMargin: p.d4HelpMargin, opposition: o4Opposition, shotType: o4Type },
        execute: passTo("O4", WEAK_SIDE_SCREEN_SPOT, tPassArrivalO4, "D4", { shooterId: "O4", shooterSkill: shotSkill(o4, o4Type), shotType: o4Type, shooterPos: WEAK_SIDE_SCREEN_SPOT, tReady: tO4Ready, prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS, contesterId: "D4", contesterArrival: p.tD3AtCut, contesterGeometry: d4CornerGeometry }, `${holderSlot} continúa hacia O4, abierto tras la ayuda de D4.`, "O4 recibe en su propio punto de bloqueo."),
      },
      {
        id: "pase_o1",
        value: 0,
        completion: 1,
        kind: "salida",
        values: {},
        execute: (record) => {
          const tOutlet = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(holderPos, ctx.positions.O1!);
          event(ctx, tOutlet, "concedido", "possession_continues", [holderSlot, "O1"], `${holderSlot} elige la salida segura hacia O1; el ataque conserva el control y se reorganiza.`);
          record("possession_continues");
          return { ...finalize(ctx, { kind: "possession_reorganized_control_kept", outletPlayerId: "O1" }, { status: "held", holderId: "O1", position: ctx.positions.O1! }), ...swap };
        },
      },
    ];
  }

  const shoot = (args: ShotAttemptArgs) => (record: (factLinkKind?: string) => void) => {
    record();
    return { ...resolveShotAttempt(ctx, args), ...swap };
  };
  const d4Help = (tFrom: number) => chaser(ctx, "D4", ctx.positions.D4!, tFrom + recognitionLatencySeconds(d4.attributes.M01, d4.attributes.M05), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));

  function buildOptions(call: OffBallDefensiveCall): { options: HandlerReadOption[]; tDecision: number; holder: "O2" | "O5" } {
    const tDecision = tHandoffReady;
    if (!denied) {
      // O2 recibe en el hombro alto y sale por el otro hombro de O5; O5 entrega y continúa al aro.
      const tAtExit = tDecision + exchangeToExit / o2Speed;
      const d2Pursuit = d2PursuitFor(call);
      // Defensor de O5 en su continuación: una sola trayectoria hacia el aro desde
      // que lee la continuación (como D5 en el drop del bloqueo directo): D5 si se
      // hunde o salta tarde; D2 si cambian.
      const o5Speed = attackerMoveSpeedMps(o5.attributes.F01);
      const rollGuardId = response === "cambiar_entrega" ? "D2" : "D5";
      const rollGuardOrigin = response === "cambiar_entrega" ? contactPoint : response === "hundirse" ? ctx.positions.D5! : jumpPoint;
      const rollGuardDepart =
        (response === "cambiar_entrega" ? Math.max(tD2AtContact, tHandoffReady) : response === "hundirse" ? tHandoffReady : Math.max(tD5AtJump, tHandoffReady)) +
        recognitionLatencySeconds(player(ctx, rollGuardId).attributes.M01, player(ctx, rollGuardId).attributes.M05);
      const rollGuardProfile = player(ctx, rollGuardId);
      const rollGuardSpeed = defenderLateralSpeedMps(rollGuardProfile.attributes.F04);
      const rollGuardGeometry: ContestGeometry = { originPos: rollGuardOrigin, destinationPos: ATTACKED_HOOP, speedMps: rollGuardSpeed, brakingExtraSeconds: closeoutBrakingExtraSeconds(rollGuardProfile.attributes.F03) };
      const rollGuardArrival = Math.max(rollGuardDepart, rollGuardDepart + distance(rollGuardOrigin, ATTACKED_HOOP) / rollGuardSpeed - interiorArrivalAdjustmentSeconds(rollGuardProfile.attributes.T23));
      const rollGuard: ContestCandidate = { id: rollGuardId, geometryTo: () => ({ geometry: rollGuardGeometry, arrivalSeconds: rollGuardArrival }) };
      // Defensor de O2 tras la entrega: D2 por la pantalla, o D5 si ha cambiado.
      const o2Guard: ContestCandidate = response === "cambiar_entrega" ? chaser(ctx, "D5", jumpPoint, Math.max(tD5AtJump, tDecision), (p) => perimeterArrivalAdjustmentSeconds(p.attributes.T22)) : d2Pursuit;
      const rollPath = detourAround(hub, ATTACKED_HOOP, rollGuardOrigin, r);
      const tRollWaypoint = rollPath.waypoint ? tHandoffReady + distance(hub, rollPath.waypoint) / o5Speed : tHandoffReady;
      const tO5AtRim = tHandoffReady + rollPath.length / o5Speed;
      const continuation = () => {
        if (rollPath.waypoint) setArrival(ctx, "O5", tRollWaypoint, rollPath.waypoint, tHandoffReady);
        setArrival(ctx, "O5", tO5AtRim, ATTACKED_HOOP, tRollWaypoint);
        event(ctx, tHandoffReady, "ejecutado", "roll_continuation", ["O5"], "O5 entrega y continúa hacia el aro.", { rollSpot: ATTACKED_HOOP });
      };
      const withContinuation = (exec: HandlerReadOption["execute"]): HandlerReadOption["execute"] => (record) => {
        continuation();
        return exec(record);
      };

      const tRim = tAtExit + timeToReach(exitPoint, ATTACKED_HOOP, o2Speed) + CLOSE_FINISH_PREP_SECONDS;
      const rim = bestContest(ctx, [o2Guard, rollGuard, d4Help(tDecision)], ATTACKED_HOOP, tRim, CLOSE_FINISH_PREP_SECONDS)!;
      const rimValue = tRim < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o2.attributes.T01, rim.level) : -Infinity;
      const protectorAtExit = response === "cambiar_entrega" ? jumpPoint : positionAtInstant(rollGuardGeometry, rollGuardArrival, tAtExit);
      const pullUp = planPullUp(ctx, {
        shooterId: "O2",
        from: exitPoint,
        tStart: tAtExit,
        protectorPos: protectorAtExit,
        standoffMeters: contestReachMeters(player(ctx, response === "cambiar_entrega" ? "D5" : rollGuardId).measures.wingspanCm) + 0.05,
        contesters: [o2Guard, rollGuard],
      });
      const pullUpValue = pullUp && pullUp.tReady < clock ? pullUp.value : -Infinity;
      // Triple al recibir: solo si el hombro de entrega está detrás del arco.
      const tTriple = tDecision + movingShotPrepSeconds(o2.attributes.T06);
      const triple = bestContest(ctx, [o2Guard, rollGuard], exchange, tTriple, movingShotPrepSeconds(o2.attributes.T06))!;
      const tripleValue = isBehindThreePointLine(exchange) && tTriple < clock ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o2.attributes.T04, triple.level) : -Infinity;
      const tRollArrival = Math.max(tO5AtRim, tDecision + PASS_RELEASE_SECONDS + distanceSeconds(exchange, ATTACKED_HOOP));
      const tRollReady = tRollArrival + CLOSE_FINISH_PREP_SECONDS;
      const roll = bestContest(ctx, [rollGuard, d4Help(tHandoffReady)], ATTACKED_HOOP, tRollReady, CLOSE_FINISH_PREP_SECONDS)!;
      const rollValue = tRollReady < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o5.attributes.T01, roll.level) : -Infinity;
      const options: HandlerReadOption[] = [
        {
          id: "finalizar_portador",
          value: rimValue,
          completion: entryCompletion,
          kind: "tiro",
          values: { contesterId: realId(ctx, rim.id), opposition: rim.level, readySeconds: tRim, d2ReleaseSeconds: d2ReleaseFor(call), response },
          execute: withContinuation((record) => {
            setArrival(ctx, "O2", tAtExit, exitPoint, tDecision);
            return shoot({ shooterId: "O2", shooterSkill: o2.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tRim, prepSeconds: CLOSE_FINISH_PREP_SECONDS, contesterId: rim.id, contesterArrival: rim.arrival, contesterGeometry: rim.geometry })(record);
          }),
        },
        {
          id: "parada_o2",
          value: pullUpValue,
          completion: entryCompletion,
          kind: "tiro",
          values: { shotType: pullUp?.shotType ?? null, contesterId: pullUp ? realId(ctx, pullUp.contesterId) : null, opposition: pullUp?.opposition ?? null, d2ReleaseSeconds: d2ReleaseFor(call) },
          execute: withContinuation((record) => {
            const plan = pullUp!;
            setArrival(ctx, "O2", tAtExit, exitPoint, tDecision);
            setArrival(ctx, "O2", tAtExit + plan.travelSeconds, plan.spot, tAtExit);
            return shoot({ shooterId: "O2", shooterSkill: shotSkill(o2, plan.shotType), shotType: plan.shotType, shooterPos: plan.spot, tReady: plan.tReady, prepSeconds: plan.prepSeconds, contesterId: plan.contesterId, contesterArrival: plan.contesterArrival, contesterGeometry: plan.contesterGeometry })(record);
          }),
        },
        {
          id: "triple_o2",
          value: tripleValue,
          completion: entryCompletion,
          kind: "tiro",
          values: { behindArc: isBehindThreePointLine(exchange), contesterId: realId(ctx, triple.id), opposition: triple.level, d2ReleaseSeconds: d2ReleaseFor(call) },
          execute: withContinuation(shoot({ shooterId: "O2", shooterSkill: o2.attributes.T04, shotType: "three_point", shooterPos: exchange, tReady: tTriple, prepSeconds: movingShotPrepSeconds(o2.attributes.T06), contesterId: triple.id, contesterArrival: triple.arrival, contesterGeometry: triple.geometry })),
        },
        {
          id: "continuacion_o5",
          value: rollValue,
          completion: entryCompletion * (1 - deflectionProbability(rollGuardProfile.attributes.T17, o2.attributes.T09)),
          kind: "pase",
          values: { contesterId: realId(ctx, roll.id), opposition: roll.level, rollerAtRimSeconds: tO5AtRim, guardId: realId(ctx, rollGuardId) },
          execute: withContinuation((record) => {
            const outcome = resolvePass(o2.attributes.T09, o5.attributes.T11, true, rollGuardProfile.attributes.T17, 1, ctx.rng);
            event(ctx, tRollArrival, "ejecutado", "pass_released", ["O2", "O5"], "O2 devuelve el balón a O5, que continúa hacia el aro.");
            record("pass_released");
            if (outcome.kind === "deflected_loose_ball") return { ...resolveLooseBallAfterPass(ctx, tRollArrival, "O2", rollGuardId), ...swap };
            const delay = outcome.kind === "awkward_control" ? outcome.extraDelaySeconds : 0;
            event(ctx, tRollArrival, "concedido", "pass_received", ["O5"], "O5 recibe junto al aro.");
            return { ...resolveShotAttempt(ctx, { shooterId: "O5", shooterSkill: o5.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tRollReady + delay, prepSeconds: CLOSE_FINISH_PREP_SECONDS + delay, contesterId: roll.id, contesterArrival: roll.arrival, contesterGeometry: roll.geometry }), ...swap };
          }),
        },
        ...pindownOptions(call, "O2", exchange, tDecision, entryCompletion).map((o) => ({ ...o, execute: withContinuation(o.execute) })),
      ];
      return { options, tDecision, holder: "O2" };
    }
    // Entrega negada: O5 se la queda en el codo.
    const tKeep = tDecision;
    const d5Home = d5Jumps
      ? chaser(ctx, "D5", jumpPoint, Math.max(tD5AtJump, tKeep) + recognitionLatencySeconds(d5.attributes.M01, d5.attributes.M05), (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23))
      : chaser(ctx, "D5", ctx.positions.D5!, tKeep, (p) => interiorArrivalAdjustmentSeconds(p.attributes.T23));
    const keeperPath = detourAround(hub, ATTACKED_HOOP, d5Jumps ? jumpPoint : ctx.positions.D5!, r);
    const tRim = tKeep + keeperPath.length / attackerMoveSpeedMps(o5.attributes.F01) + CLOSE_FINISH_PREP_SECONDS;
    const rim = bestContest(ctx, [d5Home, d4Help(tKeep)], ATTACKED_HOOP, tRim, CLOSE_FINISH_PREP_SECONDS)!;
    const rimValue = tRim < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o5.attributes.T01, rim.level) : -Infinity;
    // Puerta de atrás: O2, con su defensor delante (o con D5 en su salida), corta al aro por el lado por el que vino.
    const o2At = d2Denies ? moveToward(exchange, ctx.positions.O2!, 1, r) : exchange;
    const blocker = d2Denies ? exchange : jumpPoint;
    const backdoorPath = detourAround(o2At, ATTACKED_HOOP, blocker, r);
    const tO2AtRim = tKeep + backdoorPath.length / o2Speed;
    const tBackdoorArrival = Math.max(tO2AtRim, tKeep + PASS_RELEASE_SECONDS + distanceSeconds(hub, ATTACKED_HOOP));
    const tBackdoorReady = tBackdoorArrival + CLOSE_FINISH_PREP_SECONDS;
    const d2Chase = chaser(ctx, "D2", d2Denies ? exchange : ctx.positions.D2!, tKeep + recognitionLatencySeconds(d2.attributes.M01, d2.attributes.M05));
    const backdoor = bestContest(ctx, [d2Chase, d5Home, d4Help(tKeep)], ATTACKED_HOOP, tBackdoorReady, CLOSE_FINISH_PREP_SECONDS)!;
    const backdoorValue = tBackdoorReady < clock ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o2.attributes.T01, backdoor.level) : -Infinity;
    const options: HandlerReadOption[] = [
      {
        id: "finalizar_o5",
        value: rimValue,
        completion: entryCompletion,
        kind: "tiro",
        values: { contesterId: realId(ctx, rim.id), opposition: rim.level, readySeconds: tRim, d2Denies, d5Jumps },
        execute: shoot({ shooterId: "O5", shooterSkill: o5.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tRim, prepSeconds: CLOSE_FINISH_PREP_SECONDS, contesterId: rim.id, contesterArrival: rim.arrival, contesterGeometry: rim.geometry }),
      },
      {
        id: "puerta_atras_o2",
        value: backdoorValue,
        completion: entryCompletion * (1 - deflectionProbability((d2Denies ? d2 : d5).attributes.T17, o5.attributes.T09)),
        kind: "pase",
        values: { contesterId: realId(ctx, backdoor.id), opposition: backdoor.level, cutterAtRimSeconds: tO2AtRim },
        execute: (record) => {
          setArrival(ctx, "O2", tO2AtRim, ATTACKED_HOOP, tKeep);
          event(ctx, tKeep, "ejecutado", "backdoor_cut", ["O2", d2Denies ? "D2" : "D5"], d2Denies ? "Con D2 en el punto de la entrega, O2 corta por la puerta de atrás hacia el aro." : "Con D5 en la salida de la entrega, O2 corta hacia el aro.");
          const deflector = d2Denies ? "D2" : "D5";
          const outcome = resolvePass(o5.attributes.T09, o2.attributes.T11, true, player(ctx, deflector).attributes.T17, 1, ctx.rng);
          event(ctx, tBackdoorArrival, "ejecutado", "pass_released", ["O5", "O2"], "O5 encuentra a O2 en el corte hacia el aro.");
          record("pass_released");
          if (outcome.kind === "deflected_loose_ball") return { ...resolveLooseBallAfterPass(ctx, tBackdoorArrival, "O5", deflector), ...swap };
          const delay = outcome.kind === "awkward_control" ? outcome.extraDelaySeconds : 0;
          event(ctx, tBackdoorArrival, "concedido", "pass_received", ["O2"], "O2 recibe junto al aro.");
          return { ...resolveShotAttempt(ctx, { shooterId: "O2", shooterSkill: o2.attributes.T01, shotType: "close_finish", shooterPos: ATTACKED_HOOP, tReady: tBackdoorReady + delay, prepSeconds: CLOSE_FINISH_PREP_SECONDS + delay, contesterId: backdoor.id, contesterArrival: backdoor.arrival, contesterGeometry: backdoor.geometry }), ...swap };
        },
      },
      ...pindownOptions(call, "O5", hub, tKeep, entryCompletion),
    ];
    return { options, tDecision: tKeep, holder: "O5" };
  }

  // Orden sin balón (ME-06 §3.1; misma regla que Delay): en `auto`, la de menor concesión proyectada.
  const cache = new Map<OffBallDefensiveCall, ReturnType<typeof buildOptions>>();
  const optionsFor = (call: OffBallDefensiveCall) => {
    const hit = cache.get(call);
    if (hit) return hit;
    const built = buildOptions(call);
    cache.set(call, built);
    return built;
  };
  const concessionOf = (call: OffBallDefensiveCall) => Math.max(0, ...optionsFor(call).options.map((o) => (Number.isFinite(o.value) ? o.value * o.completion : 0)));
  let offBallCall: OffBallDefensiveCall;
  let offBallAutoOptions: AuditOptionRecord[] | null = null;
  if (offBallCallChoice === "auto") {
    const negar = concessionOf("negar_primera_salida");
    const guardar = concessionOf("guardar_espacio");
    offBallCall = negar < guardar ? "negar_primera_salida" : "guardar_espacio";
    offBallAutoOptions = [
      { id: "negar_primera_salida", status: offBallCall === "negar_primera_salida" ? "elegida" : "descartada_por_condicion", reasonCode: offBallCall === "negar_primera_salida" ? "off_ball_call_lower_concession" : "off_ball_call_higher_concession", values: { concessionValue: negar } },
      { id: "guardar_espacio", status: offBallCall === "guardar_espacio" ? "elegida" : "descartada_por_condicion", reasonCode: offBallCall === "guardar_espacio" ? (negar === guardar ? "off_ball_call_tied_base_kept" : "off_ball_call_lower_concession") : "off_ball_call_higher_concession", values: { concessionValue: guardar } },
    ];
  } else {
    offBallCall = offBallCallChoice;
  }
  const pin = pindownFor(offBallCall);
  const tD2Release = d2ReleaseFor(offBallCall);

  // --- Trayectorias y hechos de la entrega y del indirecto --------------------
  if (d2Denies) {
    if (d2Run.waypoint) setArrival(ctx, "D2", tD2Recognize + distance(ctx.positions.D2!, d2Run.waypoint) / d2Speed, d2Run.waypoint, tD2Recognize);
    setArrival(ctx, "D2", tD2AtExchange, exchange, tD2Recognize);
  } else {
    // D2 llega al hombro de contacto de O5 y queda retenido hasta liberarse.
    setArrival(ctx, "D2", tD2AtContact, contactPoint, tD2Recognize);
    if (response !== "cambiar_entrega") {
      const exitPath = detourAround(contactPoint, exitPoint, hub, r);
      setArrival(ctx, "D2", tD2Release + exitPath.length / d2Speed, exitPoint, tD2Release);
    }
  }
  if (response === "cambiar_entrega") {
    setArrival(ctx, "D5", tD5AtJump, jumpPoint, tD5Recognize);
    event(ctx, tD5Recognize, "reconocido", "switch_committed", ["D5", "D2"], "D5 canta el cambio en la entrega: sale a O2 por el hombro de salida y D2 se queda con O5.", { switchPoint: jumpPoint });
  } else if (response === "saltar_entrega") {
    setArrival(ctx, "D5", tD5AtJump, jumpPoint, tD5Recognize);
    event(ctx, tD5AtJump, "ejecutado", "show_committed", ["D5"], d5Jumps ? "D5 salta a la salida de la entrega antes que O2 y la niega; deja la pintura." : "D5 sale a saltar la entrega, pero O2 llega antes; D5 queda fuera de la pintura.", { jumpPoint, arrivesAt: tD5AtJump, denied: d5Jumps });
  }
  auditDecision(ctx, tHandoffReady, {
    point: "transferencia_mano_a_mano",
    holderId: "O5",
    participants: ["O5", "O2", "D2", "D5"],
    chosenOptionId: denied ? "entrega_negada" : "entrega_completada",
    options: [
      {
        id: denied ? "entrega_negada" : "entrega_completada",
        status: "elegida",
        reasonCode: denied ? "handoff_denied_defender_arrived" : "handoff_completed",
        values: {
          response,
          d2Denies,
          d5Jumps,
          d2ArrivalSeconds: tD2AtExchange,
          o2ArrivalSeconds: tO2AtExchange,
          o5ReadySeconds: tO5Ready,
          tHandoffReady,
          screenSet,
          screenDelaySeconds: screenSet ? screenDelayRaw : 0,
          d2ContactSeconds: tD2AtContact,
          d2ReleaseSeconds: tD2Release,
          d5JumpArrivalSeconds: response === "hundirse" ? null : tD5AtJump,
        },
      },
    ],
  });
  event(
    ctx,
    tHandoffReady,
    denied ? "concedido" : "ejecutado",
    denied ? "dho_denied" : "dho_completed",
    ["O5", "O2"],
    denied
      ? d2Denies
        ? "O5 se queda el balón: D2 llega antes que O2 al punto de la entrega."
        : "O5 se queda el balón: D5 tapa la salida de la entrega."
      : screenSet
        ? `O5 entrega en mano a O2 y su cuerpo retiene a D2, que se libera de la pantalla ${(tD2Release - tHandoffReady).toFixed(2)} s después de la entrega.`
        : `O5 entrega en mano a O2 sin estar puesto: su cuerpo no retiene a D2, que sigue a O2 ${(tD2Release - tHandoffReady).toFixed(2)} s después de la entrega.`,
    { exchangePoint: exchange, exitPoint, denied, screenSet },
  );

  setArrival(ctx, "O4", tO4ScreenSet, WEAK_SIDE_SCREEN_SPOT, 0);
  event(ctx, tO4ScreenSet, "ejecutado", "screen_set", ["O4"], "O4 coloca un bloqueo indirecto legal para el corte de O3 en el lado débil.");
  setArrival(ctx, "O3", tO3Cut, WEAK_SIDE_CUT_SPOT, cutStart);
  event(ctx, tO3Cut, "ejecutado", "screen_navigated", ["O3", "D3"], `O3 corta tras el bloqueo indirecto; D3 navega con un retraso real de ${pin.screenDelay.toFixed(2)} s.`, { screenDelay: pin.screenDelay });
  setArrival(ctx, "D3", pin.tD3AtCut, WEAK_SIDE_CUT_SPOT, cutStart);
  if (pin.d4Helps) {
    event(ctx, pin.tD3AtCut, "concedido", "help_left_assignment", ["D4", "O4"], "D4 ayuda a cerrar a O3 en el corte; O4 queda libre en su propio punto de bloqueo.");
  }
  if (offBallAutoOptions) {
    auditDecision(ctx, tD2Recognize, { point: "seleccion_orden_sin_balon", holderId: null, participants: ["D2", "O2", "D3", "O3", "D4"], chosenOptionId: offBallCall, options: offBallAutoOptions });
  }
  auditDecision(ctx, tO3Cut, {
    point: "bloqueo_indirecto_o3",
    holderId: null,
    participants: ["O3", "O4", "D3", "D4"],
    chosenOptionId: pin.cutWindowOpen ? "corte_liberado" : "corte_negado",
    factLinkKind: "screen_navigated",
    options: [
      pin.cutWindowOpen
        ? { id: "corte_liberado", status: "elegida", reasonCode: "cut_window_open", values: { tD3AtCut: pin.tD3AtCut, tO3Cut, screenDelay: pin.screenDelay } }
        : { id: "corte_negado", status: "elegida", reasonCode: "cut_window_denied", values: { tD3AtCut: pin.tD3AtCut, tO3Cut, screenDelay: pin.screenDelay } },
      pin.d4Helps
        ? { id: "ayuda_d4_abre_o4", status: "elegida", reasonCode: "help_rotation_opened_o4", values: { d4HelpMargin: pin.d4HelpMargin } }
        : { id: "ayuda_d4_abre_o4", status: "descartada_por_condicion", reasonCode: "help_rotation_not_available", values: { d4HelpMargin: pin.d4HelpMargin, offBallCall } },
    ],
  });

  // --- 4. Primera lectura real de quien tiene el balón ------------------------
  const { options, tDecision, holder } = optionsFor(offBallCall);
  if (clock - tDecision <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, holder);
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: holder, position: holder === "O2" ? exchange : hub });
  }
  return decideHandlerRead(ctx, "lectura_mano_a_mano", tDecision, holder === "O2" ? ["O2", "O5", "O3", "O4", "D2", "D5"] : ["O5", "O2", "O3", "O4", "D2", "D5"], options, holder);
}

/**
 * Geometría del intento de cierre de un defensor sobre un lanzamiento (C1):
 * origen y destino reales de su desplazamiento y su velocidad, para poder
 * reconstruir dónde está físicamente en el instante de tiro, no solo
 * cuándo "llega" a un punto de referencia.
 */
export interface ContestGeometry {
  readonly originPos: Point2D;
  readonly destinationPos: Point2D;
  readonly speedMps: number;
  readonly brakingExtraSeconds: number;
}

/**
 * Posición real del defensor en `atSeconds`, reconstruida a partir de su
 * origen, destino, velocidad y el instante en que llegaría a ese destino
 * (`arrivalSeconds`), sin teletransporte: antes de `arrivalSeconds` sigue
 * en camino; en o después, está en el destino (C1 §2).
 */
function positionAtInstant(geometry: ContestGeometry, arrivalSeconds: number, atSeconds: number): Point2D {
  const totalDistance = distance(geometry.originPos, geometry.destinationPos);
  if (totalDistance <= 0 || geometry.speedMps <= 0) return geometry.destinationPos;
  const departureSeconds = arrivalSeconds - totalDistance / geometry.speedMps;
  const elapsed = Math.max(0, atSeconds - departureSeconds);
  return moveToward(geometry.originPos, geometry.destinationPos, geometry.speedMps, elapsed);
}

/**
 * ME-07B v2 §2.4: nivel de oposición que resultaría de una geometría de
 * cierre, calculado exactamente como `resolveShotAttempt` (R_contest de
 * LAB-0.3, posición real al empezar el gesto y al soltar), sin sortear. Lo
 * usan las lecturas para valorar un tiro antes de elegirlo con la misma
 * regla que después lo resolverá.
 */
function estimateContestLevel(
  ctx: CoreContext,
  contesterId: string,
  geometry: ContestGeometry,
  arrivalSeconds: number,
  shooterPos: Point2D,
  tReady: number,
  prepSeconds: number,
): EffectiveOpposition {
  const reach = contestReachMeters(player(ctx, contesterId).measures.wingspanCm);
  const tGesture = tReady - prepSeconds;
  const atReady = positionAtInstant(geometry, arrivalSeconds, tReady);
  const atGesture = positionAtInstant(geometry, arrivalSeconds, tGesture);
  return evaluateContestLevel({
    withinReachAtRelease: distance(atReady, shooterPos) <= reach,
    settledBeforeGesture: distance(atGesture, shooterPos) <= reach && arrivalSeconds + geometry.brakingExtraSeconds <= tGesture,
  });
}

/** Capacidad de tiro que consulta cada tipo (ME-07B v2 §6): T01/T02/T03/T04. */
function shotSkill(profile: PlayerProfile, type: ShotType): number {
  switch (type) {
    case "close_finish":
      return profile.attributes.T01;
    case "floater":
      return profile.attributes.T02;
    case "mid_range":
      return profile.attributes.T03;
    case "three_point":
      return profile.attributes.T04;
  }
}

/** Candidato a cerrar un tiro: su geometría hasta el punto de liberación. */
interface ContestCandidate {
  readonly id: string;
  readonly geometryTo: (spot: Point2D) => { readonly geometry: ContestGeometry; readonly arrivalSeconds: number };
}

/**
 * Tiro parado de dos en carrera hacia el aro (ME-07B v2 §2.4): el jugador
 * con balón avanza en línea recta hacia el aro y se detiene antes del
 * protector de aro `protectorPos`, a `standoffMeters` de él (fuera de su
 * alcance de contestación para el tiro medio; justo antes del contacto para
 * el floater). El tipo de tiro lo decide la zona real del punto de parada
 * (`isFloaterZone`/`isMidRangeZone`, LAB-0.5), nunca el nombre de la opción;
 * si el punto cae pegado al aro o detrás del arco, no hay tiro parado. El
 * cierre lo hace el candidato que consigue más oposición (empate: el que
 * llega antes), con la misma regla geométrica que resolverá el tiro.
 */
interface PullUpPlan {
  readonly shotType: "floater" | "mid_range";
  readonly spot: Point2D;
  readonly travelSeconds: number;
  readonly prepSeconds: number;
  readonly tReady: number;
  readonly contesterId: string;
  readonly contesterArrival: number;
  readonly contesterGeometry: ContestGeometry;
  readonly opposition: EffectiveOpposition;
  readonly value: number;
}

function planPullUp(
  ctx: CoreContext,
  args: {
    readonly shooterId: string;
    readonly from: Point2D;
    readonly tStart: number;
    readonly protectorPos: Point2D;
    readonly standoffMeters: number;
    readonly contesters: readonly ContestCandidate[];
  },
): PullUpPlan | null {
  const shooter = player(ctx, args.shooterId);
  const pathLength = distance(args.from, ATTACKED_HOOP);
  if (pathLength <= 0) return null;
  const dir = { x: (ATTACKED_HOOP.x - args.from.x) / pathLength, y: (ATTACKED_HOOP.y - args.from.y) / pathLength };
  const rel = { x: args.protectorPos.x - args.from.x, y: args.protectorPos.y - args.from.y };
  const along = rel.x * dir.x + rel.y * dir.y;
  const lateral = Math.abs(rel.x * dir.y - rel.y * dir.x);
  // Protector detrás o fuera del camino: la vía de aro ya lo refleja; aquí
  // no hay un punto de parada que imponga ese protector.
  if (along <= 0 || lateral >= args.standoffMeters) return null;
  const stopAlong = Math.max(0, Math.min(pathLength, along - Math.sqrt(args.standoffMeters ** 2 - lateral ** 2)));
  const spot = { x: args.from.x + dir.x * stopAlong, y: args.from.y + dir.y * stopAlong };
  const shotType = isFloaterZone(spot) ? "floater" : isMidRangeZone(spot) ? "mid_range" : null;
  if (!shotType) return null;
  const travelSeconds = stopAlong / attackerMoveSpeedMps(shooter.attributes.F01);
  // Floater: gesto corto en carrera (preparación de finalización cercana);
  // tiro medio tras bote: preparación de tiro en movimiento (T06), sin
  // parámetro nuevo.
  const prepSeconds = shotType === "floater" ? CLOSE_FINISH_PREP_SECONDS : movingShotPrepSeconds(shooter.attributes.T06);
  const tReady = args.tStart + travelSeconds + prepSeconds;
  const best = bestContest(ctx, args.contesters, spot, tReady, prepSeconds);
  if (!best) return null;
  const value = 2 * shotProbability(shotBaseProbability(shotType), shotSkill(shooter, shotType), best.level);
  return {
    shotType,
    spot,
    travelSeconds,
    prepSeconds,
    tReady,
    contesterId: best.id,
    contesterArrival: best.arrival,
    contesterGeometry: best.geometry,
    opposition: best.level,
    value,
  };
}

/**
 * Mejor cierre posible sobre un tiro (ME-07B v2 §2.4): entre los defensores
 * que pueden llegar, el que consigue más oposición geométrica (empate: el
 * que llega antes). Sustituye la suposición de un único cerrador fijo por
 * rama, que dejaba sin contestar tiros con un defensor real al lado.
 */
interface BestContest {
  readonly id: string;
  readonly geometry: ContestGeometry;
  readonly arrival: number;
  readonly level: EffectiveOpposition;
  /** Algún candidato ocupa ya el punto de liberación al soltar (solape corporal). */
  readonly occupied: boolean;
}

function bestContest(
  ctx: CoreContext,
  candidates: readonly ContestCandidate[],
  spot: Point2D,
  tReady: number,
  prepSeconds: number,
): BestContest | null {
  let best: BestContest | null = null;
  let occupied = false;
  for (const c of candidates) {
    const { geometry, arrivalSeconds } = c.geometryTo(spot);
    const level = estimateContestLevel(ctx, c.id, geometry, arrivalSeconds, spot, tReady, prepSeconds);
    if (distance(positionAtInstant(geometry, arrivalSeconds, tReady), spot) <= COMBINED_CONTACT_RADIUS_METERS) {
      occupied = true;
    }
    if (!best || level > best.level || (level === best.level && arrivalSeconds < best.arrival)) {
      best = { id: c.id, geometry, arrival: arrivalSeconds, level, occupied: false };
    }
  }
  return best ? { ...best, occupied } : null;
}

interface ShotAttemptArgs {
  readonly shooterId: string;
  readonly shooterSkill: number;
  readonly shotType: ShotType;
  /** Posición real del tirador en el instante de liberación (C1). */
  readonly shooterPos: Point2D;
  readonly tReady: number;
  /**
   * Duración del gesto de tiro hasta la liberación (preparación ya
   * vigente de cada rama). Solo la usa el modo enlazado: los encargos de
   * carga/balance se asumen al empezar el gesto, antes de conocer el
   * resultado (ME-03 §4).
   */
  readonly prepSeconds: number;
  readonly contesterId: string;
  readonly contesterArrival: number;
  readonly contesterGeometry: ContestGeometry;
}

function emitFieldGoalAttempt(
  ctx: CoreContext,
  atSeconds: number,
  shooterId: string,
  shotType: ShotType,
  made: boolean,
  points: 0 | 2 | 3,
): void {
  event(
    ctx,
    atSeconds,
    "concedido",
    "field_goal_attempt",
    [shooterId],
    `${shooterId} deja constancia de ${shotType === "three_point" ? "un" : "un"} tiro de campo oficial (FGA) de ${shotType === "three_point" ? "tres" : "dos"} puntos.`,
    { shotType, made, points },
  );
}

/**
 * Un lanzamiento es una única interacción (estudio §9.4): la legalidad del
 * cierre se decide primero por hecho de contacto y posición, y de ella
 * dependen la oposición efectiva y si cabe un tapón legal. No se sortean
 * tapón y falta como sucesos independientes sobre la misma contestación.
 * El tapón, además, solo es elegible si el defensor puede tocar físicamente
 * el punto de liberación del tiro (T18 no actúa si no llega a la altura,
 * HF-002 §1.5), usando las fórmulas verticales ya aprobadas de LAB-0.1.
 *
 * C1: la legalidad ya no se decide comparando solo dos marcas de reloj.
 * Primero se comprueba si los espacios corporales de tirador y defensor
 * (radio `BODY_CONTACT_RADIUS_METERS` cada uno, LAB-0.2) realmente se
 * solapan en el instante de liberación, reconstruyendo la posición real del
 * defensor con `positionAtInstant`. Si no se solapan, no hay contacto ni
 * oposición atribuible a ese defensor, con independencia de cuán "tarde"
 * llegue por el reloj. Solo si sí se solapan se aplica la regla de frenada
 * (`evaluateCloseoutLegality`) para decidir contestación legal o falta.
 */
function resolveShotAttempt(ctx: CoreContext, args: ShotAttemptArgs): PossessionCoreResult {
  if (ctx.linked) {
    const violation = prepareLinkedShot(ctx, args);
    if (violation) return violation;
  }
  const shooter = player(ctx, args.shooterId);
  const contester = player(ctx, args.contesterId);

  // --- Contacto/falta (ME-04B §3.3, primera pregunta: "¿hubo contacto
  // corporal sancionable?"): se sigue decidiendo con el solape de los dos
  // radios corporales (0,70 m combinados, LAB-0.2) y la misma regla de
  // frenada de siempre. Esto nunca decide la oposición al tiro: solo si cabe
  // una falta ordinaria de tiro.
  const contesterPosAtReady = positionAtInstant(args.contesterGeometry, args.contesterArrival, args.tReady);
  const bodyOverlap = distance(contesterPosAtReady, args.shooterPos) <= COMBINED_CONTACT_RADIUS_METERS;
  const arrivalMargin = args.contesterArrival - args.tReady;
  const legality = bodyOverlap
    ? evaluateCloseoutLegality(arrivalMargin, args.contesterGeometry.brakingExtraSeconds)
    : "no_contest";

  // --- Oposición al tiro (ME-04B §3.3, segunda pregunta: "¿puede un
  // defensor intervenir en el tiro sin tocar al tirador?"): modelo
  // geométrico R_contest (LAB-0.3), separado del contacto de arriba. Un
  // defensor puede contestar sin falta si su envergadura (C03) le da alcance
  // aunque los dos radios corporales de 0,35 m no lleguen a solaparse.
  const tGesture = args.tReady - args.prepSeconds;
  const contestReach = contestReachMeters(contester.measures.wingspanCm);
  const contesterPosAtGesture = positionAtInstant(args.contesterGeometry, args.contesterArrival, tGesture);
  const withinReachAtRelease = distance(contesterPosAtReady, args.shooterPos) <= contestReach;
  const withinReachAtGesture = distance(contesterPosAtGesture, args.shooterPos) <= contestReach;
  const settledBeforeGesture =
    withinReachAtGesture && args.contesterArrival + args.contesterGeometry.brakingExtraSeconds <= tGesture;
  const contestLevel = evaluateContestLevel({ withinReachAtRelease, settledBeforeGesture });
  const opposition: EffectiveOpposition = contestLevel;

  const shooterJump = jumpCeilingMeters(shooter.attributes.F06);
  const contesterJump = jumpCeilingMeters(contester.attributes.F06);
  const releaseHeight = shotReleaseHeightMeters(
    shooter.measures.heightCm,
    shooter.measures.standingReachCm,
    shooterJump,
  );
  const maxTouch = maxTouchHeightMeters(contester.measures.standingReachCm, contesterJump);
  const shotTouchable = maxTouch >= releaseHeight;
  // Tapón (T18, ME-04B §3.3): elegible con cualquier oposición geométrica
  // real (el defensor alcanza el punto de liberación dentro de `R_contest`,
  // `contestLevel` 0,5 o 1 — un cierre que llega justo a tiempo para tocar el
  // balón, no solo uno ya colocado de antes), sin que el contacto haya sido
  // ya una falta ilegal, y solo si además llega a la altura de liberación;
  // C01/C04 (altura) no reciben un segundo premio aparte del ya usado por
  // `contestLevel`.
  // ME-07B v2 §2.5 (LAB-0.6): un cierre legal con solape corporal es un
  // contacto real; con reglas de partido puede ser falta según la
  // disciplina (M07) del defensor y la situación (finalización frente a
  // tiro exterior). Un contacto tardío sigue siendo falta por tiempo, igual
  // que antes. La falta, si la hay, anula el tapón.
  let contactFoulProb: number | null = null;
  let contactFoul = false;
  if (legality === "legal_contest" && ctx.linked?.rules?.ordinaryFouls) {
    const situation = args.shotType === "close_finish" || args.shotType === "floater" ? "finalizacion" : "tiro_exterior";
    contactFoulProb = contactFoulProbability(situation, contester.attributes.M07);
    contactFoul = ctx.rng.next() < contactFoulProb;
  }
  const blockEligible = contestLevel > 0 && legality !== "late_illegal_contact" && !contactFoul && shotTouchable;

  event(
    ctx,
    args.tReady,
    "intentado",
    "shot_prepared",
    [args.shooterId],
    `${args.shooterId} prepara un lanzamiento de ${args.shotType === "three_point" ? "tres" : "dos"} puntos.`,
  );

  // Auditoría (ME-04A §3 punto 4, corregida en ME-04B §4.2): el hecho
  // `shot_prepared` ya se emitió arriba, así que el enlace apunta a su
  // instante real (buscado, no reutilizado). La probabilidad y la
  // elegibilidad de tapón que la regla realmente usó se recalculan de forma
  // pura (mismas funciones LAB-0.1, sin consumir sorteo) solo para dejar
  // constancia; el sorteo real lo consume `resolveShot` más abajo.
  if (ctx.audit.enabled) {
    const shotProb = shotProbability(shotBaseProbability(args.shotType), args.shooterSkill, opposition);
    const blockProb = blockEligible ? blockDeflectionProbability(contester.attributes.T18) : null;
    auditDecision(ctx, args.tReady, {
      point: "resolucion_tiro",
      holderId: args.shooterId,
      participants: [args.shooterId, args.contesterId],
      chosenOptionId: legality,
      factLinkKind: "shot_prepared",
      options: [
        {
          id: "no_contest",
          status: legality === "no_contest" ? "elegida" : "descartada_por_condicion",
          reasonCode: "shot_contact_no_overlap",
          values: { bodyOverlap, arrivalMarginSeconds: arrivalMargin },
        },
        {
          id: "legal_contest",
          status: legality === "legal_contest" ? "elegida" : "descartada_por_condicion",
          reasonCode: "shot_contact_legal",
          values: {
            arrivalMarginSeconds: arrivalMargin,
            brakingExtraSeconds: args.contesterGeometry.brakingExtraSeconds,
            contactFoulProbability: contactFoulProb,
            contactFoul,
            contesterM07: contester.attributes.M07,
          },
        },
        {
          id: "late_illegal_contact",
          status: legality === "late_illegal_contact" ? "elegida" : "descartada_por_condicion",
          reasonCode: "shot_contact_late_illegal",
          values: { arrivalMarginSeconds: arrivalMargin },
        },
      ],
      note: `R_contest=${contestReach.toFixed(2)} m; oposición geométrica=${contestLevel} (dentro de alcance al soltar: ${withinReachAtRelease}; colocado antes del gesto: ${settledBeforeGesture}). Probabilidad de conversión usada: ${shotProb.toFixed(3)}. Tapón elegible: ${blockEligible ? `sí (probabilidad ${blockProb!.toFixed(3)})` : "no (" + (contestLevel === 0 ? "sin oposición geométrica (fuera de R_contest al soltar)" : legality === "late_illegal_contact" ? "contacto tardío ilegal" : "no llega a la altura de liberación") + ")"}.`,
    });
  }

  const shotOutcome = resolveShot(
    {
      type: args.shotType,
      shooterSkillRating: args.shooterSkill,
      opposition,
      blockEligible,
      blockerT18: contester.attributes.T18,
    },
    ctx.rng,
  );

  if (shotOutcome.kind === "blocked") {
    // Tapón legal sin falta: cuenta como FGA (oportunidad real de tiro de
    // campo), aunque no haya canasta (C3 §2).
    emitFieldGoalAttempt(ctx, args.tReady + 0.05, args.shooterId, args.shotType, false, 0);
    event(ctx, args.tReady + 0.05, "concedido", "shot_blocked", [args.contesterId], `${args.contesterId} tapona el lanzamiento.`);
    return finalize(
      ctx,
      { kind: "blocked_shot_live_ball" },
      { status: "loose", holderId: null, position: ctx.positions[args.shooterId] ?? ATTACKED_HOOP },
    );
  }

  const isFoul = legality === "late_illegal_contact" || contactFoul;

  if (isFoul) {
    const madeShot = shotOutcome.kind === "made";
    // C3 §2: falta de tiro con intento fallado → no FGA. Canasta válida con
    // falta (and-one) → 1 FGA y 1 FGM, además del libre adicional.
    if (madeShot) {
      emitFieldGoalAttempt(ctx, args.tReady + 0.05, args.shooterId, args.shotType, true, shotOutcome.points);
    }
    return resolveShootingFoulSequence(ctx, {
      shooterId: args.shooterId,
      foulerId: args.contesterId,
      shotType: args.shotType,
      madeShot,
      atSeconds: args.tReady + 0.05,
    });
  }

  if (shotOutcome.kind === "made") {
    emitFieldGoalAttempt(ctx, args.tReady + 0.05, args.shooterId, args.shotType, true, shotOutcome.points);
    event(
      ctx,
      args.tReady + 0.05,
      "concedido",
      "shot_result",
      [args.shooterId],
      `${args.shooterId} anota ${shotOutcome.points} puntos.`,
    );
    return finalize(
      ctx,
      { kind: "made_basket", points: shotOutcome.points, andOnePending: false },
      { status: "dead", holderId: null, position: ATTACKED_HOOP },
    );
  }

  // Fallo sin falta ni tapón: FGA fallado (C3 §2), antes de generar rebote.
  emitFieldGoalAttempt(ctx, args.tReady + 0.05, args.shooterId, args.shotType, false, 0);

  // Fallo que toca aro: generar rebote.
  event(ctx, args.tReady + 0.05, "concedido", "rebound_seeded", [args.shooterId], "El tiro falla y toca aro; el balón sale suelto.");
  return resolveLiveReboundAfterMiss(ctx, {
    shooterId: args.shooterId,
    shotType: args.shotType,
    contesterId: args.contesterId,
    shotOrigin: ctx.positions[args.shooterId]!,
    atSeconds: args.tReady + 0.05,
    // Suelta en el vértice del salto (tReady) y el fallo se fija 0,05 s después.
    shooterAirborneSeconds: Math.max(0, shooterLandingSeconds(player(ctx, args.shooterId).attributes.F06) - 0.05),
  });
}

/**
 * Modo enlazado (ME-03 §3-§4), antes de resolver el tiro: el balón debe
 * liberarse antes de que se agote el reloj de lanzamiento; el tirador llega
 * de verdad al punto de lanzamiento; y los cuatro atacantes que no tiran
 * asumen su encargo de carga o balance **antes** de conocer el resultado y
 * antes de sembrar el rebote.
 */
function prepareLinkedShot(ctx: CoreContext, args: ShotAttemptArgs): PossessionCoreResult | null {
  if (args.tReady >= ctx.shotClockMs / 1000) {
    return linkedShotClockViolation(ctx, args.shooterId);
  }
  const tGesture = Math.max(0, args.tReady - args.prepSeconds);
  ctx.linked!.firstGestureSeconds = Math.min(ctx.linked!.firstGestureSeconds, tGesture);
  const shooterAtGesture = historyPositionAt(ctx, args.shooterId, tGesture);
  if (distance(shooterAtGesture, args.shooterPos) > 1e-6) {
    const travel = timeToReach(shooterAtGesture, args.shooterPos, runSpeed(ctx, args.shooterId));
    setArrival(ctx, args.shooterId, tGesture, args.shooterPos, tGesture - travel);
  }
  // La carrera real del defensor que cierra (misma geometría que decide
  // contacto y oposición) queda en el historial para que la foto de cada
  // instante la muestre.
  const g = args.contesterGeometry;
  const contestDistance = distance(g.originPos, g.destinationPos);
  if (Number.isFinite(args.contesterArrival) && contestDistance > 1e-6 && g.speedMps > 0) {
    const current = historyPositionAt(ctx, args.contesterId, args.tReady);
    if (distance(current, g.destinationPos) > 1e-6) {
      const departure = args.contesterArrival - contestDistance / g.speedMps;
      setArrival(ctx, args.contesterId, args.contesterArrival, g.destinationPos, Math.max(0, departure));
    }
  }
  assignReboundDuties(ctx, args.shooterId, tGesture);
  return null;
}

const ATTACKING_SLOTS = ["O1", "O2", "O3", "O4", "O5"] as const;

/**
 * Encargos de carga/balance (ME-03 §4). «Mejor acceso» es el tiempo de
 * llegada al aro atacado desde la posición real en el instante del gesto,
 * con el movimiento ya modelado (F01), sin mirar dónde caerá el rebote.
 * Desempate estable por ID real, nunca por el rol canónico. Los cargadores
 * se desplazan hacia el aro y los de balance hacia la línea central en su
 * mismo carril; son objetivos de desplazamiento a su velocidad real, no
 * posiciones asignadas de golpe.
 */
function assignReboundDuties(ctx: CoreContext, shooterSlot: string, tGesture: number): void {
  const linked = ctx.linked!;
  const binding = linked.binding;
  const ranked = ATTACKING_SLOTS.filter((slot) => slot !== shooterSlot)
    .map((slot) => {
      const position = historyPositionAt(ctx, slot, tGesture);
      const speed = runSpeed(ctx, slot);
      return { slot, realId: binding[slot] ?? slot, position, speed, arrival: timeToReach(position, ATTACKED_HOOP, speed) };
    })
    .sort((a, b) => a.arrival - b.arrival || (a.realId < b.realId ? -1 : a.realId > b.realId ? 1 : 0));

  const crasherCount = linked.priority === "cargar_rebote" ? 2 : 1;
  const crashers = ranked.slice(0, crasherCount);
  const balancers = ranked.slice(crasherCount);

  for (const c of crashers) {
    redirect(ctx, c.slot, tGesture, tGesture + c.arrival, ATTACKED_HOOP);
  }
  for (const b of balancers) {
    const target =
      b.position.x > MIDCOURT_LINE_X
        ? { x: MIDCOURT_LINE_X, y: Math.min(COURT_WIDTH_METERS, Math.max(0, b.position.y)) }
        : b.position;
    redirect(ctx, b.slot, tGesture, tGesture + timeToReach(b.position, target, b.speed), target);
  }
  linked.balancers = new Set(balancers.map((b) => b.slot));

  const planLabel = linked.priority === "cargar_rebote" ? "Cargar rebote" : "Proteger balance";
  const crashText = crashers.map((c) => `${c.slot} (llegada prevista al aro ${c.arrival.toFixed(2)} s)`).join(" y ");
  const balanceText = balancers.map((b) => b.slot).join(", ");
  // El hecho se emite antes del registro de auditoría (ME-04B §4.2): el
  // enlace debe apuntar a `rebound_duties_assigned` ya emitido, no al
  // instante propio de esta decisión.
  event(
    ctx,
    tGesture,
    "ordenado",
    "rebound_duties_assigned",
    [...crashers.map((c) => c.slot), ...balancers.map((b) => b.slot)],
    `Plan «${planLabel}» antes de conocer el tiro de ${shooterSlot}: carga ${crashText}; ${balanceText} preparan el retorno.`,
    {
      priority: linked.priority,
      shooter: shooterSlot,
      crashers: crashers.map((c) => ({ slot: c.slot, arrivalSeconds: c.arrival })),
      balancers: balancers.map((b) => ({ slot: b.slot, arrivalSeconds: b.arrival })),
    },
  );

  auditDecision(ctx, tGesture, {
    point: "asignacion_rebote",
    holderId: shooterSlot,
    participants: ranked.map((r) => r.slot),
    chosenOptionId: crashers.map((c) => c.slot).join("+") || null,
    factLinkKind: "rebound_duties_assigned",
    options: [
      ...crashers.map((c): AuditOptionRecord => ({ id: c.slot, status: "elegida", reasonCode: "rebound_duty_crash_fastest", values: { arrivalSeconds: c.arrival } })),
      ...balancers.map((b): AuditOptionRecord => ({ id: b.slot, status: "descartada_por_condicion", reasonCode: "rebound_duty_balance_return", values: { arrivalSeconds: b.arrival } })),
    ],
    note: `Prioridad «${linked.priority}»: mejor acceso al aro por tiempo de llegada real, sin mirar dónde caerá el rebote.`,
  });
}

function buildReboundCandidates(
  ctx: CoreContext,
  landingPoint: Point2D,
  shooterId: string,
  atSeconds?: number,
  shooterAirborneSeconds = 0,
): ReboundCandidate[] {
  // Modo enlazado: posiciones reales en el instante del fallo y sin los
  // atacantes que ya retornan por su encargo de balance.
  const ids = ctx.linked
    ? Object.keys(ctx.positions).filter((id) => !ctx.linked!.balancers.has(id))
    : Object.keys(ctx.positions);
  return ids.map((id) => {
    const profile = player(ctx, id);
    const from = ctx.linked && atSeconds !== undefined ? historyPositionAt(ctx, id, atSeconds) : ctx.positions[id]!;
    const arrival =
      timeToReach(from, landingPoint, REBOUND_CANDIDATE_SPEED_MPS) + (id === shooterId ? shooterAirborneSeconds : 0);
    return {
      playerId: id,
      teamId: isOffensivePlayer(id) ? "ataque" : "defensa",
      position: from,
      arrivalTimeSeconds: arrival,
      t19: profile.attributes.T19,
      f05: profile.attributes.F05,
      t20: profile.attributes.T20,
      canBoxOut: id !== shooterId,
    };
  });
}

/** Geometría del cierre de rebote en el marco local del núcleo (ME-07B v2 §2.1). */
const REBOUND_BOX_OUT_GEOMETRY: ReboundBoxOutGeometry = { hoop: ATTACKED_HOOP, speedMps: REBOUND_CANDIDATE_SPEED_MPS };

/** Texto breve de los cierres para el relato (el detalle numérico va en el hecho). */
function boxOutText(trace: ReboundTrace): string {
  if (trace.boxOuts.length === 0) return "";
  const parts = trace.boxOuts.map((b) => `${b.closerId} cierra a ${b.rivalId} (+${b.delaySeconds.toFixed(2)} s)`);
  return ` Cierres: ${parts.join("; ")}.`;
}

function boxOutDetail(trace: ReboundTrace): Record<string, unknown> {
  return {
    boxOuts: trace.boxOuts.map((b) => ({
      closer: b.closerId,
      rival: b.rivalId,
      contactSeconds: b.contactSeconds,
      delaySeconds: b.delaySeconds,
      closerT19: b.closerT19,
      closerF05: b.closerF05,
    })),
  };
}

/**
 * Punto de auditoría `disputa_rebote` (ME-07B v2 §2.1/§6): llegada bruta y
 * efectiva de cada candidato, quién le cerró con qué T19/F05, si entró en la
 * ventana de vuelo y quién controló. No consume azar.
 */
function auditReboundContest(
  ctx: CoreContext,
  atSeconds: number,
  outcome: Exclude<ReboundOutcome, { kind: "out_of_bounds" }>,
  winner: string,
  factLinkKind: string,
): void {
  if (!ctx.audit.enabled) return;
  const closedBy = new Map(outcome.trace.boxOuts.map((b) => [b.rivalId, b]));
  const closing = new Map(outcome.trace.boxOuts.map((b) => [b.closerId, b]));
  auditDecision(ctx, atSeconds, {
    point: "disputa_rebote",
    holderId: null,
    participants: outcome.trace.arrivals.map((a) => a.playerId),
    chosenOptionId: realId(ctx, winner),
    factLinkKind,
    options: outcome.trace.arrivals.map((a): AuditOptionRecord => {
      const by = closedBy.get(a.playerId);
      const closes = closing.get(a.playerId);
      return {
        id: realId(ctx, a.playerId),
        status: a.playerId === winner ? "elegida" : "descartada_por_condicion",
        reasonCode: by ? "rebound_boxed_out_by_rival" : a.inPool ? "rebound_arrival_in_window" : "rebound_arrival_outside_window",
        values: {
          rawArrivalSeconds: a.rawArrivalSeconds,
          effectiveArrivalSeconds: a.effectiveArrivalSeconds,
          inPool: a.inPool,
          boxedOutBy: by ? realId(ctx, by.closerId) : null,
          boxOutDelaySeconds: by ? by.delaySeconds : null,
          closerT19: by ? by.closerT19 : null,
          closerF05: by ? by.closerF05 : null,
          boxesOut: closes ? realId(ctx, closes.rivalId) : null,
          ownT19: player(ctx, a.playerId).attributes.T19,
          ownF05: player(ctx, a.playerId).attributes.F05,
          ownT20: player(ctx, a.playerId).attributes.T20,
        },
      };
    }),
    note: `${outcome.trace.boxOuts.length} cierre(s) legales y próximos; captura ${outcome.kind === "secured" ? "limpia" : "tras palmeo"}.`,
  });
}

/** Elige quién controla un palmeo disputado solo entre quienes realmente llegan (HF-002 §1.4). */
function pickTipWinner(ctx: CoreContext, tip: Extract<ReboundOutcome, { kind: "loose_ball_tip" }>): string {
  return pickTipWinnerByT20(tip, (id) => player(ctx, id).attributes.T20);
}

interface LiveReboundArgs {
  readonly shooterId: string;
  readonly shotType: ShotType;
  /** Id del defensor que cerró el tiro, o cadena vacía si no aplica (p. ej. libres). */
  readonly contesterId: string;
  readonly shotOrigin: Point2D;
  readonly atSeconds: number;
  /**
   * Segundos, contados desde `atSeconds`, que el tirador sigue en el aire
   * antes de poder ir al rebote (LAB-0.4). 0 para libres (sin salto).
   */
  readonly shooterAirborneSeconds?: number;
}

/**
 * Resuelve el balón vivo tras un fallo que toca aro: reutilizada tanto por
 * un tiro de campo fallado como por el último libre fallado (HF-002 §2), sin
 * duplicar la lógica de disputa de rebote.
 */
function resolveLiveReboundAfterMiss(ctx: CoreContext, args: LiveReboundArgs): PossessionCoreResult {
  if (ctx.linked) return resolveLinkedRebound(ctx, args);
  const seed = seedReboundLanding(ATTACKED_HOOP, args.shotOrigin, args.shotType, ctx.rng);
  const candidates = buildReboundCandidates(ctx, seed.landingPoint, args.shooterId, undefined, args.shooterAirborneSeconds);
  const reboundOutcome = resolveRebound(seed, candidates, ctx.rng, REBOUND_BOX_OUT_GEOMETRY);

  if (reboundOutcome.kind === "out_of_bounds") {
    return finalize(
      ctx,
      { kind: "out_of_bounds", lastTouchPlayerId: args.shooterId },
      { status: "dead", holderId: null, position: seed.landingPoint },
    );
  }

  if (reboundOutcome.kind === "secured") {
    const isOffensive = isOffensivePlayer(reboundOutcome.playerId);
    event(
      ctx,
      args.atSeconds + 1,
      "concedido",
      "rebound_secured",
      [reboundOutcome.playerId],
      (isOffensive
        ? `${reboundOutcome.playerId} captura el rebote ofensivo y continúa la posesión.`
        : `${reboundOutcome.playerId} asegura el rebote defensivo.`) + boxOutText(reboundOutcome.trace),
      boxOutDetail(reboundOutcome.trace),
    );
    auditReboundContest(ctx, args.atSeconds + 1, reboundOutcome, reboundOutcome.playerId, "rebound_secured");
    if (isOffensive) {
      ctx.possessionPhase += 1;
      return resolveOffensiveReboundContinuation(ctx, reboundOutcome.playerId, args.atSeconds + 1);
    }
    return finalize(
      ctx,
      { kind: "missed_shot_defensive_rebound" },
      { status: "held", holderId: reboundOutcome.playerId, position: seed.landingPoint },
    );
  }

  // loose_ball_tip: solo entre quienes realmente llegan (bug 1.4 corregido).
  const winner = pickTipWinner(ctx, reboundOutcome);
  event(
    ctx,
    args.atSeconds + 1,
    "concedido",
    "rebound_contested",
    [winner],
    `${winner} controla el balón dividido tras el palmeo.` + boxOutText(reboundOutcome.trace),
    boxOutDetail(reboundOutcome.trace),
  );
  auditReboundContest(ctx, args.atSeconds + 1, reboundOutcome, winner, "rebound_contested");

  if (isOffensivePlayer(winner)) {
    ctx.possessionPhase += 1;
    return resolveOffensiveReboundContinuation(ctx, winner, args.atSeconds + 1);
  }
  return finalize(
    ctx,
    { kind: "missed_shot_defensive_rebound" },
    { status: "held", holderId: winner, position: seed.landingPoint },
  );
}

/**
 * Rebote en modo enlazado (ME-03 §3): misma siembra y misma disputa
 * (T19/T20/F05) que ME-01, pero el núcleo no encadena la segunda
 * oportunidad por su cuenta. Devuelve el control real (quién, dónde y
 * cuándo) para que el tramo abra una fase nueva de la misma posesión
 * (rebote ofensivo, 14 s) o una posesión nueva del rival (24 s). Un balón
 * que cae fuera se registra con su último toque.
 */
function resolveLinkedRebound(ctx: CoreContext, args: LiveReboundArgs): PossessionCoreResult {
  const seed = seedReboundLanding(ATTACKED_HOOP, args.shotOrigin, args.shotType, ctx.rng);
  const candidates = buildReboundCandidates(ctx, seed.landingPoint, args.shooterId, args.atSeconds, args.shooterAirborneSeconds);
  const reboundOutcome = resolveRebound(seed, candidates, ctx.rng, REBOUND_BOX_OUT_GEOMETRY);

  if (reboundOutcome.kind === "out_of_bounds") {
    event(
      ctx,
      args.atSeconds + seed.flightTimeSeconds,
      "concedido",
      "out_of_bounds",
      [args.shooterId],
      `El rebote sale fuera de la cancha; último toque de ${args.shooterId}.`,
      { landingPoint: seed.landingPoint },
    );
    return finalize(
      ctx,
      { kind: "out_of_bounds", lastTouchPlayerId: args.shooterId },
      { status: "dead", holderId: null, position: seed.landingPoint },
    );
  }

  // ME-07B v2 §2.5 (LAB-0.6): un defensor al que un atacante le ha cerrado
  // el rebote (posición interior real) y que aun así llega a disputar el
  // balón lo hace por encima de la espalda del cerrador: contacto real que
  // puede ser falta sin tiro según su disciplina (M07). La falta de rebote
  // del atacante cerrado (falta en ataque) todavía no está modelada.
  if (ctx.linked?.rules?.ordinaryFouls) {
    const inPool = new Set(reboundOutcome.trace.arrivals.filter((x) => x.inPool).map((x) => x.playerId));
    const overTheBack = [...reboundOutcome.trace.boxOuts]
      .filter((b) => isOffensivePlayer(b.closerId) && !isOffensivePlayer(b.rivalId) && inPool.has(b.rivalId))
      .sort((x, y) => x.contactSeconds - y.contactSeconds || (x.rivalId < y.rivalId ? -1 : 1));
    for (const b of overTheBack) {
      const foulProb = contactFoulProbability("rebote_sobre_espalda", player(ctx, b.rivalId).attributes.M07);
      const rngBefore = rngStateOf(ctx.rng);
      const fouled = ctx.rng.next() < foulProb;
      auditDecision(ctx, args.atSeconds + seed.flightTimeSeconds, {
        point: "puerta_falta_sin_tiro",
        holderId: null,
        participants: [b.rivalId, b.closerId],
        chosenOptionId: fouled ? "ilegal" : "legal",
        rngStateBefore: rngBefore,
        rngStateAfter: rngStateOf(ctx.rng),
        options: [
          { id: "legal", status: fouled ? "descartada_por_condicion" : "elegida", reasonCode: "contact_foul_not_drawn", values: { situation: "rebote_sobre_espalda", foulProbability: foulProb } },
          { id: "ilegal", status: fouled ? "elegida" : "descartada_por_condicion", reasonCode: "contact_foul_drawn", values: { situation: "rebote_sobre_espalda", foulProbability: foulProb, foulerM07: player(ctx, b.rivalId).attributes.M07 } },
        ],
      });
      if (!fouled) continue;
      const tFoul = args.atSeconds + seed.flightTimeSeconds;
      event(ctx, tFoul, "concedido", "non_shooting_foul", [b.rivalId, b.closerId], `Falta personal sin tiro de ${b.rivalId} en el rebote: disputa por encima de la espalda de ${b.closerId}, que le había cerrado.`, {
        foulerId: b.rivalId,
        fouledId: b.closerId,
        situation: "rebote_sobre_espalda",
        foulProbability: foulProb,
      });
      return finalize(ctx, { kind: "non_shooting_foul", foulerId: b.rivalId, fouledId: b.closerId }, { status: "dead", holderId: null, position: seed.landingPoint });
    }
  }

  const winner = reboundOutcome.kind === "secured" ? reboundOutcome.playerId : pickTipWinner(ctx, reboundOutcome);
  // ME-07B v2 §2.1: el control llega con la llegada efectiva (retrasada si
  // un rival le cerró), no con la carrera libre.
  const arrival = effectiveReboundArrival(reboundOutcome.trace, winner) ?? 0;
  const tControl = args.atSeconds + Math.max(1, arrival);
  setArrival(ctx, winner, tControl, seed.landingPoint, args.atSeconds);
  const offensive = isOffensivePlayer(winner);
  event(
    ctx,
    tControl,
    "concedido",
    reboundOutcome.kind === "secured" ? "rebound_secured" : "rebound_contested",
    [winner],
    (reboundOutcome.kind === "secured"
      ? offensive
        ? `${winner} captura el rebote ofensivo (el tiro tocó aro).`
        : `${winner} asegura el rebote defensivo.`
      : `${winner} controla el balón dividido tras el palmeo${offensive ? " (rebote ofensivo)" : " (rebote defensivo)"}.`) +
      boxOutText(reboundOutcome.trace),
    { offensive, touchedRim: true, landingPoint: seed.landingPoint, ...boxOutDetail(reboundOutcome.trace) },
  );
  auditReboundContest(
    ctx,
    tControl,
    reboundOutcome,
    winner,
    reboundOutcome.kind === "secured" ? "rebound_secured" : "rebound_contested",
  );
  return finalize(
    ctx,
    { kind: offensive ? "missed_shot_offensive_rebound_continues" : "missed_shot_defensive_rebound" },
    { status: "held", holderId: winner, position: seed.landingPoint },
  );
}

function resolveOffensiveReboundContinuation(ctx: CoreContext, playerId: string, atSeconds: number): PossessionCoreResult {
  if (ctx.possessionPhase > MAX_PROGRESS_ITERATIONS) {
    return finalize(
      ctx,
      { kind: "simulation_guard_stopped", reason: "Demasiadas fases de rebote ofensivo encadenadas." },
      { status: "held", holderId: playerId, position: ctx.positions[playerId] ?? ATTACKED_HOOP },
    );
  }

  const profile = player(ctx, playerId);
  const opposingContester = playerId === "O5" ? "D5" : "D1";
  const contester = player(ctx, opposingContester);
  const contesterArrival = atSeconds - interiorArrivalAdjustmentSeconds(contester.attributes.T23);
  const putbackSpot = ctx.positions[playerId] ?? ATTACKED_HOOP;

  return resolveShotAttempt(ctx, {
    shooterId: playerId,
    shooterSkill: profile.attributes.T01,
    shotType: "close_finish",
    shooterPos: putbackSpot,
    tReady: atSeconds + CLOSE_FINISH_PREP_SECONDS,
    prepSeconds: CLOSE_FINISH_PREP_SECONDS,
    contesterId: opposingContester,
    contesterArrival,
    // Segunda oportunidad inmediata bajo aro (simplificación ya vigente en
    // HF-002, no forma parte del alcance de C1): se asume al defensor ya en
    // el punto de disputa, sin recorrido adicional que reconstruir.
    contesterGeometry: {
      originPos: putbackSpot,
      destinationPos: putbackSpot,
      speedMps: defenderLateralSpeedMps(contester.attributes.F04),
      brakingExtraSeconds: closeoutBrakingExtraSeconds(contester.attributes.F03),
    },
  });
}

function resolveLooseBallAfterPass(
  ctx: CoreContext,
  atSeconds: number,
  passerId: string,
  defenderId: string,
): PossessionCoreResult {
  const passer = player(ctx, passerId);
  const defender = player(ctx, defenderId);
  const isSteal = resolvesTurnoverUnderPressure(passer.attributes.T07, defender.attributes.T15, ctx.rng);
  event(
    ctx,
    atSeconds,
    "concedido",
    isSteal ? "turnover" : "pass_control_lost",
    [defenderId],
    isSteal
      ? `${defenderId} desvía el pase y recupera el control: pérdida en balón vivo.`
      : `${defenderId} desvía el pase; el balón queda suelto sin control claro.`,
  );
  // Modo enlazado: el balón queda donde el defensor está de verdad en ese
  // instante, no en el destino de su ayuda si aún no ha llegado.
  const deflectionSpot = ctx.linked
    ? historyPositionAt(ctx, defenderId, atSeconds)
    : (ctx.positions[defenderId] ?? ctx.positions[passerId]!);
  if (isSteal) {
    return finalize(ctx, { kind: "steal_by_defense" }, { status: "held", holderId: defenderId, position: deflectionSpot });
  }
  return finalize(ctx, { kind: "live_turnover" }, { status: "loose", holderId: null, position: deflectionSpot });
}

interface ShootingFoulArgs {
  readonly shooterId: string;
  /** Defensor cuyo contacto tardío se sancionó (rol canónico). */
  readonly foulerId: string;
  readonly shotType: ShotType;
  readonly madeShot: boolean;
  readonly atSeconds: number;
}

/**
 * Ejecuta la falta ordinaria de tiro completa (HF-002 §1.6, §2): adjudica
 * primero la validez de la canasta, ejecuta cada libre con T05 y la misma
 * semilla de la posesión, y resuelve el balón vivo si el último libre falla
 * reutilizando la misma disputa de rebote que un tiro de campo.
 *
 * ME-04: con reglas de partido, el hecho identifica también al infractor y
 * la serie de libres se devuelve pendiente (`deferFreeThrows`) para que el
 * partido abra antes la oportunidad de sustitución; la serie se ejecuta
 * después con la entrada `free_throws`, que llama a la misma función.
 */
function resolveShootingFoulSequence(ctx: CoreContext, args: ShootingFoulArgs): PossessionCoreResult {
  const award = awardFreeThrowsForShootingFoul(args.shotType, args.madeShot);
  const rules = ctx.linked?.rules ?? null;

  const basketPoints: 0 | 2 | 3 = args.madeShot ? (args.shotType === "three_point" ? 3 : 2) : 0;
  event(
    ctx,
    args.atSeconds,
    "concedido",
    "shooting_foul",
    [args.shooterId],
    `Falta ordinaria de tiro sobre ${args.shooterId}; se conceden ${award.count} libre(s).`,
    rules
      ? { madeShot: args.madeShot, freeThrows: award.count, foulerId: args.foulerId, shotType: args.shotType }
      : { madeShot: args.madeShot, freeThrows: award.count },
  );

  if (rules?.deferFreeThrows) {
    const shooterPos = historyPositionAt(ctx, args.shooterId, args.atSeconds);
    return finalize(
      ctx,
      {
        kind: "shooting_foul_free_throws_pending",
        shooterId: args.shooterId,
        foulerId: args.foulerId,
        shotType: args.shotType,
        basketCounted: award.basketCounted,
        freeThrowsAwarded: award.count,
      },
      { status: "dead", holderId: null, position: shooterPos },
    );
  }

  return runFreeThrowSeries(ctx, {
    shooterId: args.shooterId,
    count: award.count,
    atSeconds: args.atSeconds,
    basketCounted: award.basketCounted,
    basketPoints,
    liveReboundOnLastMiss: true,
  });
}

interface FreeThrowSeriesArgs {
  readonly shooterId: string;
  readonly count: number;
  readonly atSeconds: number;
  readonly basketCounted: boolean;
  readonly basketPoints: 0 | 2 | 3;
  readonly liveReboundOnLastMiss: boolean;
}

/** Serie de libres (HF-002 §1.6): tirador real, T05 y la semilla del tramo; mismo bucle en ME-01, ME-03 y ME-04. */
function runFreeThrowSeries(ctx: CoreContext, args: FreeThrowSeriesArgs): PossessionCoreResult {
  const shooter = player(ctx, args.shooterId);
  let t = args.atSeconds;
  let freeThrowsMade = 0;
  let lastMissed = false;
  let tShooterAtLine = args.atSeconds;

  if (ctx.linked) {
    // El lanzador va de verdad a la línea de tiros libres (sin colocar al
    // resto en los pasillos: la alineación de libres queda fuera de ME-03).
    const from = historyPositionAt(ctx, args.shooterId, args.atSeconds);
    tShooterAtLine = args.atSeconds + timeToReach(from, FREE_THROW_LINE_SPOT, runSpeed(ctx, args.shooterId));
    setArrival(ctx, args.shooterId, tShooterAtLine, FREE_THROW_LINE_SPOT, args.atSeconds);
  }

  for (let i = 0; i < args.count; i++) {
    t += FREE_THROW_PREP_SECONDS;
    if (ctx.linked && i === 0) t = Math.max(t, tShooterAtLine);
    if (ctx.linked && i === args.count - 1 && args.liveReboundOnLastMiss) {
      // Último libre: los encargos se asumen al soltarlo, antes de conocer
      // su resultado; nadie invade antes de la liberación.
      assignReboundDuties(ctx, args.shooterId, t);
    }
    const made = ctx.rng.next() < freeThrowProbability(shooter.attributes.T05);
    lastMissed = !made;
    if (made) freeThrowsMade += 1;
    event(
      ctx,
      t,
      "concedido",
      "free_throws_result",
      [args.shooterId],
      `${args.shooterId} ${made ? "anota" : "falla"} el libre ${i + 1} de ${args.count}.`,
      { made, index: i + 1, of: args.count },
    );
  }

  const pointsFromFreeThrows = freeThrowsMade;
  const totalPoints = args.basketPoints + pointsFromFreeThrows;

  if (args.count === 0 || !lastMissed || !args.liveReboundOnLastMiss) {
    return finalize(
      ctx,
      {
        kind: "shooting_foul",
        basketCounted: args.basketCounted,
        freeThrowsAwarded: args.count,
        freeThrowsMade,
        pointsFromFreeThrows,
        totalPoints,
      },
      { status: "dead", holderId: null, position: ATTACKED_HOOP },
    );
  }

  // Último libre fallado: balón vivo (RULES.md), se resuelve como cualquier
  // rebote disputado, incluida la continuación ofensiva si corresponde.
  return resolveLiveReboundAfterMiss(ctx, {
    shooterId: args.shooterId,
    shotType: "close_finish",
    contesterId: "",
    shotOrigin: FREE_THROW_LINE_SPOT,
    atSeconds: t,
  });
}

// --- ME-04: vía ordinaria sin tiro ------------------------------------------

/**
 * Registra la contención del continuador por el defensor que ayuda (drop
 * con ayuda) o que pasa a low man (trampa). Solo con reglas de partido.
 */
function registerContainment(
  ctx: CoreContext,
  defenderSlot: string,
  defenderDepartSeconds: number,
  defenderArrivalSeconds: number,
  brakingExtraSeconds: number,
  attackerDepartSeconds: number,
  attackerArrivalSeconds: number,
): void {
  if (!ctx.linked?.rules?.ordinaryFouls) return;
  ctx.linked.containment = {
    defenderSlot,
    attackerSlot: "O5",
    attackerDepartSeconds,
    attackerArrivalSeconds,
    defenderDepartSeconds,
    defenderArrivalSeconds,
    brakingExtraSeconds,
  };
}

/** Paso de muestreo del primer solape corporal (s): técnico, sin efecto deportivo propio. */
const CONTACT_SAMPLE_SECONDS = 0.01;

/** Hechos después de los cuales la acción de media pista ya no está «antes del gesto de tiro». */
const CONTAINMENT_CUTOFF_KINDS: ReadonlySet<FactKind> = new Set<FactKind>([
  "possession_continues",
  "turnover",
  "pass_control_lost",
  "shot_clock_violation",
]);

/**
 * Adjudica, con las trayectorias reales del tramo de cálculo, si el
 * defensor que ayuda cerró el paso del continuador **mientras este seguía
 * desplazándose** y **antes** de que empezara cualquier gesto de tiro o
 * terminara la acción. Contacto ilegal → falta personal sin tiro: el balón
 * muere en el instante de contacto y se descarta lo que el núcleo había
 * calculado después (no pudo ocurrir), igual que la violación de 24 s.
 * Contacto legal → se deja constancia y el juego sigue.
 */
function adjudicatePendingContainment(ctx: CoreContext): PossessionCoreResult | null {
  const linked = ctx.linked!;
  const c = linked.containment;
  if (!c) return null;
  linked.containment = null;

  let cutoff = linked.firstGestureSeconds;
  for (const raw of ctx.timeline) {
    if (CONTAINMENT_CUTOFF_KINDS.has(raw.kind)) cutoff = Math.min(cutoff, raw.atMs / 1000);
  }
  const start = Math.max(0, c.attackerDepartSeconds, c.defenderDepartSeconds);
  const end = Math.min(cutoff, c.attackerArrivalSeconds);
  let contactSeconds: number | null = null;
  for (let t = start; t < end; t += CONTACT_SAMPLE_SECONDS) {
    const d = distance(historyPositionAt(ctx, c.defenderSlot, t), historyPositionAt(ctx, c.attackerSlot, t));
    // Solape corporal: más cerca que la suma de radios. Tocarse justo en la
    // suma (el defensor que contiene a contacto del punto de llegada, ME-07B
    // v2 §4) no es solape mientras el continuador aún no ha llegado.
    if (d < COMBINED_CONTACT_RADIUS_METERS - 1e-6) {
      contactSeconds = Math.round(t * 1000) / 1000;
      break;
    }
  }
  const legality = evaluateContainmentContact({
    contactSeconds,
    attackerMoving: contactSeconds !== null,
    defenderArrivalSeconds: c.defenderArrivalSeconds,
    brakingExtraSeconds: c.brakingExtraSeconds,
  });
  if (legality === "sin_contacto" || contactSeconds === null) {
    auditDecision(ctx, end, {
      point: "puerta_falta_sin_tiro",
      holderId: c.attackerSlot,
      participants: [c.defenderSlot, c.attackerSlot],
      chosenOptionId: "no_evaluada",
      options: [
        {
          id: "no_evaluada",
          status: "elegida",
          reasonCode: "containment_gate_not_reached",
          reasonNote: "No hubo solape corporal entre el defensor y el continuador antes de que la acción dejara de estar en movimiento (gesto de tiro u otra acción).",
          values: { startSeconds: start, endSeconds: end, defenderArrivalSeconds: c.defenderArrivalSeconds },
        },
      ],
    });
    return null;
  }

  const defenderPos = historyPositionAt(ctx, c.defenderSlot, contactSeconds);
  const attackerPos = historyPositionAt(ctx, c.attackerSlot, contactSeconds);
  const detail = {
    legality,
    contactMs: secondsToMs(contactSeconds),
    defenderArrivalMs: secondsToMs(c.defenderArrivalSeconds),
    defenderSetMs: secondsToMs(c.defenderArrivalSeconds + c.brakingExtraSeconds),
    attackerArrivalMs: secondsToMs(c.attackerArrivalSeconds),
    brakingExtraMs: secondsToMs(c.brakingExtraSeconds),
    distanceMeters: Math.round(distance(defenderPos, attackerPos) * 100) / 100,
    defenderPosition: defenderPos,
    attackerPosition: attackerPos,
    foulerId: c.defenderSlot,
    fouledId: c.attackerSlot,
  };

  // Los hechos se emiten antes del registro de auditoría (ME-04B §4.2): el
  // enlace debe apuntar al hecho ya emitido (`legal_containment` o
  // `non_shooting_foul`), no al instante propio de esta decisión.
  if (legality === "contencion_legal") {
    event(
      ctx,
      contactSeconds,
      "concedido",
      "legal_containment",
      [c.defenderSlot, c.attackerSlot],
      `${c.defenderSlot} contiene legalmente a ${c.attackerSlot} en su continuación: había llegado y frenado antes del contacto.`,
      detail,
    );
    auditDecision(ctx, contactSeconds, {
      point: "puerta_falta_sin_tiro",
      holderId: c.attackerSlot,
      participants: [c.defenderSlot, c.attackerSlot],
      chosenOptionId: "legal",
      factLinkKind: "legal_containment",
      options: [
        {
          id: "legal",
          status: "elegida",
          reasonCode: "containment_gate_legal",
          values: { contactMs: secondsToMs(contactSeconds), defenderArrivalMs: secondsToMs(c.defenderArrivalSeconds), brakingExtraMs: secondsToMs(c.brakingExtraSeconds) },
        },
        {
          id: "ilegal",
          status: "descartada_por_condicion",
          reasonCode: "containment_gate_illegal",
          values: { contactMs: secondsToMs(contactSeconds), defenderArrivalMs: secondsToMs(c.defenderArrivalSeconds) },
        },
      ],
    });
    return null;
  }

  const expiryMs = secondsToMs(contactSeconds);
  for (let i = ctx.timeline.length - 1; i >= 0; i--) {
    if (ctx.timeline[i]!.atMs > expiryMs) ctx.timeline.splice(i, 1);
  }
  if (ctx.positionHistory) {
    for (const id of Object.keys(ctx.positionHistory)) {
      ctx.positionHistory[id] = truncateTrajectory(ctx.positionHistory[id]!, expiryMs);
      ctx.positions[id] = historyPositionAt(ctx, id, contactSeconds);
    }
  }
  event(
    ctx,
    contactSeconds,
    "concedido",
    "non_shooting_foul",
    [c.defenderSlot, c.attackerSlot],
    `Falta personal sin tiro de ${c.defenderSlot}: cierra el paso de ${c.attackerSlot}, que sigue en carrera hacia su continuación, sin haber frenado antes del contacto (no tenía posición legal establecida).`,
    detail,
  );
  auditDecision(ctx, contactSeconds, {
    point: "puerta_falta_sin_tiro",
    holderId: c.attackerSlot,
    participants: [c.defenderSlot, c.attackerSlot],
    chosenOptionId: "ilegal",
    factLinkKind: "non_shooting_foul",
    options: [
      {
        id: "legal",
        status: "descartada_por_condicion",
        reasonCode: "containment_gate_legal",
        values: { contactMs: secondsToMs(contactSeconds), defenderArrivalMs: secondsToMs(c.defenderArrivalSeconds), brakingExtraMs: secondsToMs(c.brakingExtraSeconds) },
      },
      {
        id: "ilegal",
        status: "elegida",
        reasonCode: "containment_gate_illegal",
        values: { contactMs: secondsToMs(contactSeconds), defenderArrivalMs: secondsToMs(c.defenderArrivalSeconds) },
      },
    ],
  });
  return finalize(
    ctx,
    { kind: "non_shooting_foul", foulerId: c.defenderSlot, fouledId: c.attackerSlot },
    { status: "dead", holderId: null, position: attackerPos },
  );
}

// --- ME-04: segunda entrada del bloqueo directo -------------------------------------

/**
 * Con reglas de partido y la primera lectura negada (O5 contenido de
 * verdad y la inversión a la esquina cerrada), O5 saca el balón con un pase
 * real al exterior O2/O4 que haga viable la segunda entrada: línea de pase
 * libre, creador en el exterior y segundos de tiro suficientes para
 * recolocar la pantalla (`second-entry-read.ts`). Si ninguno es viable,
 * devuelve `null` y se mantiene el tiro forzado bajo contención de ME-01.
 */
function tryLinkedKickOut(ctx: CoreContext, tRead: number, containerSlot: string): PossessionCoreResult | null {
  const linked = ctx.linked;
  if (!linked?.rules?.secondEntryAllowed) return null;
  const scenario = getScenario(ctx.input.scenarioId);
  const base: Record<string, Point2D> = {};
  const local: Record<string, Point2D> = {};
  for (const slot of [...scenario.offense, ...scenario.defense]) {
    base[slot.playerId] = slot.initialPosition;
    local[slot.playerId] = historyPositionAt(ctx, slot.playerId, tRead);
  }
  // El defensor que contiene a O5 presiona el pase (T17, como en la
  // inversión de ME-02); la línea se comprueba frente a los otros cuatro.
  const defenders: RaceParticipant[] = scenario.defense.filter((slot) => slot.playerId !== containerSlot).map((slot) => {
    const p = player(ctx, slot.playerId);
    return {
      slot: slot.playerId,
      id: linked.binding[slot.playerId] ?? slot.playerId,
      position: local[slot.playerId]!,
      runSpeedMps: attackerMoveSpeedMps(p.attributes.F01),
      lateralSpeedMps: defenderLateralSpeedMps(p.attributes.F04),
      t23: p.attributes.T23,
    };
  });
  const options = (["O4", "O2"] as const).map((creatorSlot) => {
    const passSeconds = PASS_RELEASE_SECONDS + distance(local.O5!, local[creatorSlot]!) / PASS_FLIGHT_SPEED_MPS;
    const plan: SecondEntryPlan = planSecondEntry({
      creatorSlot,
      local,
      base,
      passerAtRelease: local.O5!,
      creatorAtRelease: local[creatorSlot]!,
      defendersAtRelease: defenders,
      screenerSpeedMps: runSpeed(ctx, "O5"),
      shotClockRemainingSeconds: ctx.shotClockMs / 1000 - (tRead + passSeconds),
    });
    return { creatorSlot, passSeconds, plan, realId: linked.binding[creatorSlot] ?? creatorSlot };
  });
  const viable = options
    .filter((o) => o.plan.viable)
    .sort((a, b) => a.passSeconds - b.passSeconds || (a.realId < b.realId ? -1 : a.realId > b.realId ? 1 : 0));
  const choice = viable[0];
  auditDecision(ctx, tRead, {
    point: "segunda_entrada",
    holderId: "O5",
    participants: ["O5", ...options.map((o) => o.creatorSlot)],
    chosenOptionId: choice ? choice.creatorSlot : null,
    options: options.map((o) => ({
      id: o.creatorSlot,
      status: choice && o.creatorSlot === choice.creatorSlot ? "elegida" : "descartada_por_condicion",
      reasonCode: o.plan.viable ? "second_entry_viable_shortest_pass" : secondEntryRejectionCode(o.plan.reason),
      reasonNote: o.plan.reason,
      values: { passSeconds: o.passSeconds },
    })),
  });
  if (!choice || !choice.plan.viable) {
    event(
      ctx,
      tRead,
      "reconocido",
      "second_entry",
      ["O5"],
      `${containerSlot} contiene a O5 y la esquina está cerrada, pero no hay segunda entrada (${options.map((o) => (o.plan.viable ? "" : o.plan.reason)).join("; ")}): O5 fuerza el tiro.`,
      { viable: false, reasons: options.map((o) => (o.plan.viable ? null : o.plan.reason)) },
    );
    return null;
  }
  const plan = choice.plan;
  const creator = player(ctx, choice.creatorSlot);
  const o5 = player(ctx, "O5");
  const release = tRead + PASS_RELEASE_SECONDS;
  const arrival = tRead + choice.passSeconds;
  event(
    ctx,
    release,
    "ejecutado",
    "pass_released",
    ["O5", choice.creatorSlot],
    `Primera lectura negada (${containerSlot} contiene a O5 y la esquina está cerrada): O5 saca el balón hacia ${choice.creatorSlot}.`,
  );
  // Línea libre frente a los defensores sin balón; el que contiene a O5 sí
  // puede tocarlo bajo presión, igual que en la inversión de ME-02.
  const container = player(ctx, containerSlot);
  const outcome = resolvePass(o5.attributes.T09, creator.attributes.T11, true, container.attributes.T17, 1, ctx.rng);
  if (outcome.kind === "deflected_loose_ball") {
    return resolveLooseBallAfterPass(ctx, release, "O5", containerSlot);
  }
  const delay = outcome.kind === "awkward_control" ? outcome.extraDelaySeconds : 0;
  event(ctx, arrival, "concedido", "pass_received", [choice.creatorSlot], `${choice.creatorSlot} recibe${delay > 0 ? " con control incómodo" : ""} para crear la segunda entrada.`);
  event(
    ctx,
    arrival + delay,
    "concedido",
    "second_entry",
    [choice.creatorSlot, "O5"],
    `Segunda entrada del bloqueo directo: ${choice.creatorSlot} crea desde su nuevo ángulo y O5 se recoloca para ponerle la pantalla (${plan.reason}).`,
    { viable: true, creatorSlot: choice.creatorSlot, screenSpot: plan.targets.O5, screenSetSeconds: plan.screenSetSeconds },
  );
  return finalize(
    ctx,
    {
      kind: "second_entry_kick_out",
      passerId: "O5",
      creatorId: choice.creatorSlot,
      slotSwap: plan.slotSwap,
      targets: plan.targets,
      screenSetSeconds: plan.screenSetSeconds,
      reason: plan.reason,
    },
    { status: "held", holderId: choice.creatorSlot, position: local[choice.creatorSlot]! },
  );
}
