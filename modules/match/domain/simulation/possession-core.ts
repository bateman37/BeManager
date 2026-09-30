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
import { ATTACKED_HOOP, FREE_THROW_LINE_SPOT, COURT_WIDTH_METERS, isBehindThreePointLine } from "../geometry/court";
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
} from "../lab/match-input";
import { findPlayerInInput } from "../lab/match-input";
import { getScenario, type ScenarioDefinition } from "../lab/scenario";
import type { PlayerProfile } from "../players/player-profile";
import {
  attackerMoveSpeedMps,
  deflectionProbability,
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
import {
  COMBINED_CONTACT_RADIUS_METERS,
  SHORT_ROLL_SPOT,
  DEEP_CONTINUATION_SPOT,
  m09CoordinationLatencySeconds,
} from "../lab/lab-0-2-parameters";
import { shooterLandingSeconds } from "../lab/lab-0-4-parameters";
import { contestReachMeters, evaluateContestLevel, FIRST_READ_TIE_BAND_POINTS } from "../lab/lab-0-3-parameters";
import type { TerminalOutcome, BallState } from "./match-state";
import type { FactPhase, FactKind } from "./fact";
import { resolvePass } from "./resolvers/pass-resolver";
import { resolveShot, type ShotType } from "./resolvers/shot-resolver";
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

const WEAK_CORNER_SPOT: Point2D = { x: 24.0, y: 13.9 };
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
      readonly shotType?: "close_finish" | "three_point";
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
    resolvedCoverage: input.coverage === "trampa" ? "trampa" : "drop",
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
  if (planChoice === "auto") {
    // ME-06 §3.2: evaluación pura de la oportunidad de entrada de cada
    // familia desde el estado real heredado, sin RNG y sin ejecutar la vía
    // descartada. Solo se ejecuta (con su propio árbol de lectura, sorteos
    // y hechos) la familia elegida aquí.
    // ME-07B v2 §2.2: cada familia se proyecta con su propia ejecución, en
    // seco, hasta su primera lectura real (misma frontera temporal, mismas
    // respuestas defensivas y mismos costes de pase), en vez de dos
    // estimadores distintos que suponían recepciones limpias futuras.
    const bloqueoOpportunity = familyOpportunity(projectFamilyRead(ctx, (dry) => runDropPhase(dry, scenario)));
    const handoffOpportunity = familyOpportunity(projectFamilyRead(ctx, (dry) => runHandoffPhase(dry)));
    // Empate exacto: regla estable vinculada a las opciones reales (no una
    // alternancia por número de posesión) — se conserva el bloqueo directo,
    // la familia central ya versionada.
    resolvedPlan = handoffOpportunity.value > bloqueoOpportunity.value ? "mano_a_mano_sin_balon" : "bloqueo_directo";
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
          values: { ...familyAuditValues(bloqueoOpportunity), projectedCoverage: "drop" },
        },
        {
          id: "mano_a_mano_sin_balon",
          status: resolvedPlan === "mano_a_mano_sin_balon" ? "elegida" : "descartada_por_condicion",
          reasonCode: resolvedPlan === "mano_a_mano_sin_balon" ? "family_opportunity_higher" : "family_opportunity_lower",
          values: familyAuditValues(handoffOpportunity),
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
        { id: "bloqueo_directo", status: resolvedPlan === "bloqueo_directo" ? "elegida" : "no_evaluada_por_cortocircuito", reasonCode: resolvedPlan === "bloqueo_directo" ? "family_forced_by_plan" : "not_evaluated_short_circuit" },
        { id: "mano_a_mano_sin_balon", status: resolvedPlan === "mano_a_mano_sin_balon" ? "elegida" : "no_evaluada_por_cortocircuito", reasonCode: resolvedPlan === "mano_a_mano_sin_balon" ? "family_forced_by_plan" : "not_evaluated_short_circuit" },
      ],
    });
  }

  const coverageChoice: DefensiveCoverageChoice = ctx.input.coverage;
  if (coverageChoice === "auto") {
    const estimate = estimateCoverageChoice(ctx);
    // Empate exacto, trampa no elegible o concesión indistinguible
    // conservan `drop` como plan base (ME-07A §4).
    ctx.resolvedCoverage = estimate.trapEligible && estimate.trapConcessionValue < estimate.dropConcessionValue ? "trampa" : "drop";
    auditDecision(ctx, 0, {
      point: "seleccion_cobertura",
      holderId: null,
      participants: ["D1", "D5"],
      chosenOptionId: ctx.resolvedCoverage,
      options: [
        {
          id: "drop",
          status: ctx.resolvedCoverage === "drop" ? "elegida" : "descartada_por_condicion",
          reasonCode:
            ctx.resolvedCoverage === "drop"
              ? estimate.trapConcessionValue === estimate.dropConcessionValue
                ? "coverage_tied_base_kept"
                : "coverage_lower_concession"
              : "coverage_higher_concession",
          values: { concessionValue: estimate.dropConcessionValue },
        },
        {
          id: "trampa",
          status: ctx.resolvedCoverage === "trampa" ? "elegida" : "descartada_por_condicion",
          reasonCode: !estimate.trapEligible ? "coverage_trap_not_eligible" : ctx.resolvedCoverage === "trampa" ? "coverage_lower_concession" : "coverage_higher_concession",
          values: { concessionValue: estimate.trapConcessionValue, trapEligible: estimate.trapEligible },
        },
      ],
    });
  } else {
    ctx.resolvedCoverage = coverageChoice;
  }

  if (resolvedPlan === "mano_a_mano_sin_balon") return runHandoffPhase(ctx);
  return ctx.resolvedCoverage === "trampa" ? runTrapPhase(ctx) : runDropPhase(ctx, scenario);
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
  const prepSeconds = shotType === "three_point" ? CATCH_AND_SHOOT_PREP_SECONDS : CLOSE_FINISH_PREP_SECONDS;
  return resolveShotAttempt(ctx, {
    shooterId: entry.shooterSlot,
    shooterSkill: shotType === "three_point" ? shooter.attributes.T04 : shooter.attributes.T01,
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

function runDropPhase(ctx: CoreContext, scenario: ScenarioDefinition): PossessionCoreResult {
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
  event(ctx, tScreenSet, "ejecutado", "screen_set", ["O5"], "O5 llega y coloca su pantalla central.");

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
    `O1 usa la pantalla de O5; D1 navega con un retraso de ${screenDelay.toFixed(2)} s.`,
    { screenDelay },
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
  setArrival(ctx, "D1", tUseScreen + screenDelay, o1UsePoint, 0);

  // --- Continuación real de O5 (C1): O5 recorre su continuación desde la
  // pantalla hasta una posición de recepción/finalización alcanzable
  // (short roll), en vez de recibir/finalizar desde la posición original
  // del bloqueo por tener asignado el rol de continuador.
  const continuationShift = screenCoordinationShiftSeconds(o5.attributes.M04);
  const rollTravelSeconds = timeToReach(screenPoint, SHORT_ROLL_SPOT, attackerMoveSpeedMps(o5.attributes.F01));
  const tRollReady = Math.max(0.05, tUseScreen - continuationShift + rollTravelSeconds);
  setArrival(ctx, "O5", tRollReady, SHORT_ROLL_SPOT, tRollReady - rollTravelSeconds);
  event(ctx, tRollReady, "ejecutado", "roll_continuation", ["O5"], "O5 continúa hacia el short roll tras la pantalla.", {
    rollSpot: SHORT_ROLL_SPOT,
    // Punto de referencia de la continuación profunda (ME-02 §3): O5 no lo
    // ocupa en esta secuencia (se detiene en el short roll), se deja
    // trazable como el punto de referencia aprobado si una lectura futura
    // lo necesita.
    deepContinuationSpot: DEEP_CONTINUATION_SPOT,
  });

  // --- Ayuda de D3 (protección interior, T23) ------------------------------
  let tD3ArriveHelp = Infinity;
  let tD4RepairStart = Infinity;
  let tD4ArriveAtCorner = Infinity;
  const tHelpDecision = scenario.startsWithHelpAlreadyCommitted
    ? 0
    : tUseScreen + recognitionLatencySeconds(d3.attributes.M01, d3.attributes.M05);

  event(
    ctx,
    tHelpDecision,
    "reconocido",
    "help_decision",
    ["D3"],
    scenario.d3HelpsRoller
      ? "D3 reconoce el bloqueo y decide ayudar al continuador."
      : "D3 reconoce el bloqueo y decide no ayudar; conserva la marca de O3.",
    { helps: scenario.d3HelpsRoller },
  );

  // Origen y velocidad de D3 en su intento de ayuda: se guardan para poder
  // reconstruir su posición real en el instante del tiro (C1), no solo su
  // instante de llegada.
  let d3HelpOrigin: Point2D = ctx.positions.D3!;
  const d3HelpSpeed = defenderLateralSpeedMps(d3.attributes.F04);
  const d3BrakingExtra = closeoutBrakingExtraSeconds(d3.attributes.F03);
  let d4RepairOrigin: Point2D = ctx.positions.D4!;
  const d4RepairSpeed = defenderLateralSpeedMps(d4.attributes.F04);
  const d4BrakingExtra = closeoutBrakingExtraSeconds(d4.attributes.F03);

  if (scenario.d3HelpsRoller) {
    // D3 ayuda hacia la posición real donde O5 recibe/finaliza (short roll),
    // no hacia un punto fijo desconectado del continuador (C1: `tD3ArriveHelp`
    // no significaba, antes de esta corrección, que D3 estuviera junto a O5).
    const d3StartPoint = scenario.startsWithHelpAlreadyCommitted ? SHORT_ROLL_SPOT : ctx.positions.D3!;
    d3HelpOrigin = d3StartPoint;
    const rawD3Arrival = scenario.startsWithHelpAlreadyCommitted
      ? 0.1
      : tHelpDecision + timeToReach(d3StartPoint, SHORT_ROLL_SPOT, d3HelpSpeed);
    // T23 (defensa interior): D3 protege el espacio cercano al aro contra el
    // continuador; ajusta su llegada real a la ayuda (HF-002 §1.5).
    tD3ArriveHelp = Math.max(0, rawD3Arrival - interiorArrivalAdjustmentSeconds(d3.attributes.T23));
    setArrival(ctx, "D3", tD3ArriveHelp, SHORT_ROLL_SPOT, tHelpDecision);
    registerContainment(ctx, "D3", tHelpDecision, tD3ArriveHelp, d3BrakingExtra, tRollReady - rollTravelSeconds, tRollReady);
    event(
      ctx,
      tD3ArriveHelp,
      "concedido",
      "help_left_assignment",
      ["D3", "O3"],
      "La ayuda de D3 deja libre a O3 en la esquina débil.",
    );

    const d4OriginalPos = scenario.startsWithHelpAlreadyCommitted
      ? LATE_CLOSEOUT_D4_START
      : ctx.positions.D4!;
    d4RepairOrigin = d4OriginalPos;
    tD4RepairStart = tD3ArriveHelp + recognitionLatencySeconds(d4.attributes.M01, d4.attributes.M05);
    const rawD4Arrival = tD4RepairStart + timeToReach(d4OriginalPos, WEAK_CORNER_SPOT, d4RepairSpeed);
    // T22 (defensa perimetral): D4 cierra sobre una amenaza exterior (O3 en
    // la esquina); ajusta su llegada real al cierre (HF-002 §1.5).
    tD4ArriveAtCorner = Math.max(tD4RepairStart, rawD4Arrival - perimeterArrivalAdjustmentSeconds(d4.attributes.T22));
    event(
      ctx,
      tD4RepairStart,
      "concedido",
      "help_repair_attempt",
      ["D4", "O4"],
      "D4 intenta reparar hacia la esquina débil y deja libre a O4.",
      { arrivesAt: tD4ArriveAtCorner },
    );
    setArrival(ctx, "D4", tD4ArriveAtCorner, WEAK_CORNER_SPOT, tD4RepairStart);
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
  const finishOpposition: EffectiveOpposition = finishMarginSeconds >= 0.25 ? 0 : 1;
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
  const rollDeniedBeforeDecision = scenario.d3HelpsRoller && tD3ArriveHelp <= tDecision;
  const o5PassViable = screenDelay >= 0.2 && !rollDeniedBeforeDecision;
  const tPassArrivalO5 = Math.max(
    tRollReady,
    tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, ctx.positions.O5!),
  );
  const tO5ReadyEstimate = tPassArrivalO5 + CLOSE_FINISH_PREP_SECONDS;
  const o5ContesterId = scenario.d3HelpsRoller ? "D3" : "D5";
  const o5ContestArrival = scenario.d3HelpsRoller ? tD3ArriveHelp : tDecision + d5TimeToHoop;
  const o5ContestGeometry: ContestGeometry = scenario.d3HelpsRoller
    ? { originPos: d3HelpOrigin, destinationPos: SHORT_ROLL_SPOT, speedMps: d3HelpSpeed, brakingExtraSeconds: d3BrakingExtra }
    : { ...d5HoopGeometry, destinationPos: SHORT_ROLL_SPOT };
  const d3PosAtO5ReadyEstimate = positionAtInstant(o5ContestGeometry, o5ContestArrival, tO5ReadyEstimate);
  const d3TrulyContainingEstimate =
    scenario.d3HelpsRoller && distance(d3PosAtO5ReadyEstimate, ctx.positions.O5!) <= COMBINED_CONTACT_RADIUS_METERS;
  let o5PassValue = -Infinity;
  if (o5PassViable) {
    if (!d3TrulyContainingEstimate) {
      // O5 recibe sin contención real prevista: puede finalizar en el roll.
      o5PassValue = 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o5.attributes.T01, 0);
    } else {
      // ME-06 §2 corrige la "estimación optimista de una recepción futura"
      // diagnosticada en las ocho auditorías ME-04B-AUDIT-1: si D3 de verdad
      // contendría a O5 en la recepción, esta vía **no** puede puntuarse con
      // el valor de una inversión a O3 que todavía depende de una segunda
      // decisión de O5 (su propia lectura real, más abajo) y de una segunda
      // proyección defensiva de D4 dos tiempos más adelante — esa cadena de
      // dos pases es exactamente la canasta/inversión futura que la
      // continuación real podría no llegar a ejecutar. Se puntúa en su
      // lugar la salida que O1 sí puede dar por cierta al pasar: O5 recibe
      // contenido y, si su propia lectura real más abajo no encuentra la
      // esquina abierta, acaba forzando el mismo tiro bajo contención que
      // ya modela `finalizar_bajo_contencion`. Misma fórmula, sin sortear ni
      // adivinar cuál de las dos ramas de la lectura real de O5 ganará.
      o5PassValue = 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o5.attributes.T01, 1);
    }
  }

  // Vía "pase_o3": pase directo de O1 a la esquina débil, viable en cuanto
  // D3 ya dejó su marca (el escenario la carga así comprometida, o D3 ya
  // ayudó antes de esta decisión) — ya no depende de que la vía "pase_o5"
  // esté cerrada: ambas compiten de verdad por valor situacional (ME-04B
  // §3.2), en vez de que una sea siempre subsidiaria de la otra.
  const o3PassViable = scenario.d3HelpsRoller && (scenario.startsWithHelpAlreadyCommitted || rollDeniedBeforeDecision);
  const tPassArrivalO3Direct = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, WEAK_CORNER_SPOT);
  const tPrepReadyO3Direct = tPassArrivalO3Direct + CATCH_AND_SHOOT_PREP_SECONDS;
  const marginO3Direct = tD4ArriveAtCorner - tPrepReadyO3Direct;
  const o3PassOpposition: EffectiveOpposition = marginO3Direct >= 0.25 ? 0 : 0.5;
  const o3PassValue = o3PassViable
    ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o3.attributes.T04, o3PassOpposition)
    : -Infinity;

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
  const tripleOpposition: EffectiveOpposition = windowD5 >= 0.25 ? 0 : 1;
  const tripleValue = tripleViable
    ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o1.attributes.T04, tripleOpposition)
    : -Infinity;

  // Vía "salida_segura": último recurso, siempre viable, sin puntos
  // esperados (conserva el control, no arriesga un tiro).
  const outletTarget = distanceSeconds(ctx.positions.O1!, ctx.positions.O4!) <
    distanceSeconds(ctx.positions.O1!, ctx.positions.O2!)
    ? "O4"
    : "O2";
  const safeOutletValue = 0;

  type FirstReadOptionId = "finalizar" | "pase_o5" | "pase_o3" | "triple_o1" | "salida_segura";
  const candidateValues: Readonly<Record<FirstReadOptionId, number>> = {
    finalizar: finishValue,
    pase_o5: o5PassValue,
    pase_o3: o3PassValue,
    triple_o1: tripleValue,
    salida_segura: safeOutletValue,
  };
  const FIRST_READ_ORDER: readonly FirstReadOptionId[] = ["finalizar", "pase_o5", "pase_o3", "triple_o1", "salida_segura"];
  if (ctx.projecting) {
    const completionOf: Readonly<Record<FirstReadOptionId, number>> = {
      finalizar: 1,
      pase_o5: 1 - deflectionProbability(d1.attributes.T17, o1.attributes.T09),
      pase_o3: 1 - deflectionProbability(d4.attributes.T17, o1.attributes.T09),
      triple_o1: 1,
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
      priorityBand = band.filter((c) => c.id === "finalizar" || c.id === "pase_o5").sort((a, b) => b.value - a.value);
    } else if (creationPriority === "buscar_triple") {
      priorityBand = band.filter((c) => c.id === "pase_o3" || c.id === "triple_o1").sort((a, b) => b.value - a.value);
    }
    if (priorityBand && priorityBand.length > 0) {
      tieBandResolvedByPriority = true;
      if (priorityBand[0]!.id !== chosen) chosen = priorityBand[0]!.id;
    } else if (o1.pnrTendency === "priorizar_primera_opcion") {
      const handlerBand = band.filter((c) => c.id === "finalizar" || c.id === "pase_o5").sort((a, b) => b.value - a.value);
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
    pase_o3: { chosen: "corner_window_open", notViable: scenario.d3HelpsRoller ? "corner_window_closed" : "not_available" },
    triple_o1: {
      chosen: "three_point_eligible",
      notViable: "three_point_window_closed",
    },
    salida_segura: { chosen: "safe_outlet_default", notViable: "not_available" },
  };
  const firstReadValues: Readonly<Record<FirstReadOptionId, Record<string, number | string | boolean | null>>> = {
    finalizar: {
      situationalValue: finishValue,
      o1TimeToHoopSeconds: o1TimeToHoop,
      d5TimeToHoopSeconds: d5TimeToHoop,
      shotClockRemainingSeconds,
      d5TrulyBlockingFinish,
      finishMarginSeconds,
    },
    pase_o5: {
      situationalValue: o5PassValue,
      screenDelaySeconds: screenDelay,
      rollDeniedBeforeDecision,
      estimatedD3TrulyContaining: d3TrulyContainingEstimate,
    },
    pase_o3: { situationalValue: o3PassValue, marginSeconds: marginO3Direct, d3AlreadyLeft: rollDeniedBeforeDecision || scenario.startsWithHelpAlreadyCommitted },
    triple_o1: { situationalValue: tripleValue, windowD5Seconds: windowD5, opposition: tripleOpposition, t04: o1.attributes.T04, behindLine },
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
      const structurallyUnavailable = id === "pase_o3" && !scenario.d3HelpsRoller;
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
    const tO5Ready = tPassArrival + readyDelay + CLOSE_FINISH_PREP_SECONDS;
    const contesterId = o5ContesterId;
    const tContestArrival = o5ContestArrival;
    const rollContestGeometry = o5ContestGeometry;

    event(ctx, tPassArrival, "concedido", "pass_received", ["O5"], "O5 recibe el balón en el roll.");

    // Segunda lectura de O5 (C2): reevaluada **con el estado real de este
    // instante** (ME-04B §3.2), no con la estimación pura de más arriba —
    // si el espacio corporal de D3 realmente se solapa con el de O5 para
    // cuando O5 está listo para actuar (no antes de que O1 decidiera pasar)
    // —misma geometría de contacto que C1, reconstruyendo la posición real
    // de D3 en ese instante, no solo comparando cuándo "llega" D3 a un
    // punto de referencia—, O5 puede invertir hacia O3 en la esquina débil
    // en vez de forzar el tiro, sin reiniciar el reloj. Solo es una lectura
    // real si además D4 no ha cerrado ya esa esquina.
    const d3PosAtO5Ready = positionAtInstant(rollContestGeometry, tContestArrival, tO5Ready);
    const d3TrulyContaining =
      scenario.d3HelpsRoller && distance(d3PosAtO5Ready, ctx.positions.O5!) <= COMBINED_CONTACT_RADIUS_METERS;
    if (d3TrulyContaining) {
      const tPassArrivalO3 = tO5Ready + PASS_RELEASE_SECONDS + distanceSeconds(SHORT_ROLL_SPOT, WEAK_CORNER_SPOT);
      const tPrepReadyO3 = tPassArrivalO3 + CATCH_AND_SHOOT_PREP_SECONDS;
      const marginO3 = tD4ArriveAtCorner - tPrepReadyO3;

      if (marginO3 >= 0.25) {
        const d4CornerGeometry: ContestGeometry = {
          originPos: d4RepairOrigin,
          destinationPos: WEAK_CORNER_SPOT,
          speedMps: d4RepairSpeed,
          brakingExtraSeconds: d4BrakingExtra,
        };
        const invertOutcome = resolvePass(o5.attributes.T09, o3.attributes.T11, true, d3.attributes.T17, 1, ctx.rng);
        event(ctx, tPassArrivalO3, "ejecutado", "pass_released", ["O5", "O3"], "O5 invierte hacia O3 en la esquina débil.");
        auditDecision(ctx, tO5Ready, {
          point: "lectura_segunda_o5",
          holderId: "O5",
          participants: ["O5", "O3", "D3", "D4"],
          chosenOptionId: "invertir_o3",
          factLinkKind: "pass_released",
          options: [
            { id: "invertir_o3", status: "elegida", reasonCode: "corner_window_open", values: { marginO3Seconds: marginO3, tD4ArriveAtCornerSeconds: tD4ArriveAtCorner } },
            { id: "finalizar_bajo_contencion", status: "descartada_por_condicion", reasonCode: "corner_window_open", reasonNote: "La esquina estaba libre: no hizo falta forzar el tiro contenido.", values: { marginO3Seconds: marginO3 } },
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
          shooterSkill: o3.attributes.T04,
          shotType: "three_point",
          shooterPos: WEAK_CORNER_SPOT,
          tReady: tPrepReadyO3 + invertReadyDelay,
          prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + invertReadyDelay,
          contesterId: "D4",
          contesterArrival: tD4ArriveAtCorner,
          contesterGeometry: d4CornerGeometry,
        });
      }
    }

    if (d3TrulyContaining) {
      // Primera lectura negada: O5 contenido y la inversión cerrada (ME-04 §5).
      const kickOut = tryLinkedKickOut(ctx, tO5Ready, "D3");
      if (kickOut) {
        auditDecision(ctx, tO5Ready, {
          point: "lectura_segunda_o5",
          holderId: "O5",
          participants: ["O5", "D3"],
          chosenOptionId: "segunda_entrada",
          options: [
            { id: "invertir_o3", status: "descartada_por_condicion", reasonCode: "corner_window_closed", reasonNote: "D4 cierra la esquina a tiempo: sin ventana para invertir." },
            shortCircuited("finalizar_bajo_contencion"),
            { id: "segunda_entrada", status: "elegida", reasonCode: "second_entry_viable_shortest_pass" },
          ],
        });
        return kickOut;
      }
      auditDecision(ctx, tO5Ready, {
        point: "lectura_segunda_o5",
        holderId: "O5",
        participants: ["O5", "D3"],
        chosenOptionId: "finalizar_bajo_contencion",
        options: [
          { id: "invertir_o3", status: "descartada_por_condicion", reasonCode: "corner_window_closed", reasonNote: "D4 cierra la esquina a tiempo: sin ventana para invertir." },
          { id: "segunda_entrada", status: "descartada_por_condicion", reasonCode: "second_entry_pass_line_blocked", reasonNote: "Ningún exterior fue viable; el detalle por candidato está en la decisión «segunda_entrada» del mismo instante." },
          { id: "finalizar_bajo_contencion", status: "elegida", reasonCode: "second_read_contained" },
        ],
      });
    }

    return resolveShotAttempt(ctx, {
      shooterId: "O5",
      shooterSkill: o5.attributes.T01,
      shotType: "close_finish",
      shooterPos: ctx.positions.O5!,
      tReady: tO5Ready,
      prepSeconds: CLOSE_FINISH_PREP_SECONDS + readyDelay,
      contesterId,
      contesterArrival: tContestArrival,
      contesterGeometry: rollContestGeometry,
    });
  }

  if (chosen === "pase_o3") {
    const d4CornerGeometry: ContestGeometry = {
      originPos: d4RepairOrigin,
      destinationPos: WEAK_CORNER_SPOT,
      speedMps: d4RepairSpeed,
      brakingExtraSeconds: d4BrakingExtra,
    };
    const passOutcome = resolvePass(o1.attributes.T09, o3.attributes.T11, true, d4.attributes.T17, 1, ctx.rng);
    event(ctx, tPassArrivalO3Direct, "ejecutado", "pass_released", ["O1", "O3"], "O1 encuentra a O3 en la esquina débil.");
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
    event(ctx, tPassArrivalO3Direct, "concedido", "pass_received", ["O3"], "O3 recibe en la esquina.");

    return resolveShotAttempt(ctx, {
      shooterId: "O3",
      shooterSkill: o3.attributes.T04,
      shotType: "three_point",
      shooterPos: WEAK_CORNER_SPOT,
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
      contesterId: "D5",
      contesterArrival: tD5Contest,
      contesterGeometry: { ...d5HoopGeometry, destinationPos: ctx.positions.O1! },
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
  event(ctx, tScreenSet, "ejecutado", "screen_set", ["O5"], "O5 llega y coloca su pantalla central.");

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
  const rollTravelSeconds = timeToReach(screenPoint, SHORT_ROLL_SPOT, attackerMoveSpeedMps(o5.attributes.F01));
  const tRollReady = Math.max(0.05, tUseScreen - continuationShift + rollTravelSeconds);
  setArrival(ctx, "O5", tRollReady, SHORT_ROLL_SPOT, tRollReady - rollTravelSeconds);
  event(ctx, tRollReady, "ejecutado", "roll_continuation", ["O5"], "O5 continúa hacia el short roll tras la pantalla.", {
    rollSpot: SHORT_ROLL_SPOT,
    // Punto de referencia de la continuación profunda (ME-02 §3): O5 no lo
    // ocupa en esta secuencia (se detiene en el short roll), se deja
    // trazable como el punto de referencia aprobado si una lectura futura
    // lo necesita.
    deepContinuationSpot: DEEP_CONTINUATION_SPOT,
  });

  // --- D5 sale a comprometer a O1 (aviso: emisor D5) ----------------------
  const tTrapCall = tUseScreen + recognitionLatencySeconds(d5.attributes.M01, d5.attributes.M05);
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
  const rawD3LowManArrival = tLowManDecision + timeToReach(d3LowManOrigin, SHORT_ROLL_SPOT, d3LowManSpeed);
  const tD3LowManArrival = Math.max(0, rawD3LowManArrival - interiorArrivalAdjustmentSeconds(d3.attributes.T23));
  const d3BrakingExtra = closeoutBrakingExtraSeconds(d3.attributes.F03);
  setArrival(ctx, "D3", tD3LowManArrival, SHORT_ROLL_SPOT, tLowManDecision);
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
    "D3 en low man deja libre a O3 en la esquina débil.",
  );

  // --- D4 rota hacia la amenaza que deja D3 (O3), exponiendo a O4 --------
  const m09LatencyD4 = m09CoordinationLatencySeconds(d3.attributes.M09, d4.attributes.M09);
  const tD4RepairStart = tD3LowManArrival + m09LatencyD4;
  const d4RepairOrigin = ctx.positions.D4!;
  const d4RepairSpeed = defenderLateralSpeedMps(d4.attributes.F04);
  const rawD4Arrival = tD4RepairStart + timeToReach(d4RepairOrigin, WEAK_CORNER_SPOT, d4RepairSpeed);
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
  setArrival(ctx, "D4", tD4ArriveAtCorner, WEAK_CORNER_SPOT, tD4RepairStart);

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
    destinationPos: SHORT_ROLL_SPOT,
    speedMps: d3LowManSpeed,
    brakingExtraSeconds: d3BrakingExtra,
  };
  const d4CornerGeometry: ContestGeometry = {
    originPos: d4RepairOrigin,
    destinationPos: WEAK_CORNER_SPOT,
    speedMps: d4RepairSpeed,
    brakingExtraSeconds: d4BrakingExtra,
  };

  if (trapClosed) {
    // Presión real de dos defensores sobre el balón (T07 vs el peor T15 de
    // los dos comprometidos): reutiliza el mecanismo de presión ya vigente,
    // no un robo global nuevo. Una trampa cerrada no garantiza robo.
    const worstT15 = Math.min(d1.attributes.T15, d5.attributes.T15);
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
      const tPassArrivalO4 = tO5Ready + PASS_RELEASE_SECONDS + distanceSeconds(SHORT_ROLL_SPOT, ctx.positions.O4!);
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
    const tPassArrivalO3 = tO5Ready + PASS_RELEASE_SECONDS + distanceSeconds(SHORT_ROLL_SPOT, WEAK_CORNER_SPOT);
    const tPrepReadyO3 = tPassArrivalO3 + CATCH_AND_SHOOT_PREP_SECONDS;
    const marginO3 = tD4ArriveAtCorner - tPrepReadyO3;
    if (marginO3 >= 0.25) {
      const invertOutcome = resolvePass(o5.attributes.T09, o3.attributes.T11, true, d3.attributes.T17, 1, ctx.rng);
      event(ctx, tPassArrivalO3, "ejecutado", "pass_released", ["O5", "O3"], "O5 invierte hacia O3 en la esquina débil.");
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
        shooterSkill: o3.attributes.T04,
        shotType: "three_point",
        shooterPos: WEAK_CORNER_SPOT,
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
  readonly trapEligible: boolean;
  readonly dropConcessionValue: number;
  readonly trapConcessionValue: number;
}

function estimateCoverageChoice(ctx: CoreContext): CoverageEstimate {
  const o1 = player(ctx, "O1");
  const o5 = player(ctx, "O5");
  const o4 = player(ctx, "O4");
  const d1 = player(ctx, "D1");
  const d5 = player(ctx, "D5");

  const screenPoint = ctx.positions.O5!;
  const o1UsePoint = pointShortOfTarget(ctx.positions.O1!, screenPoint, COMBINED_CONTACT_RADIUS_METERS);
  const tHandlerArrival = timeToReach(ctx.positions.O1!, o1UsePoint, attackerMoveSpeedMps(o1.attributes.F01));
  const tUseScreen = Math.max(SCREEN_SET_AFTER_ARRIVAL_SECONDS, tHandlerArrival);

  const screenDelay = screenInterceptDelaySeconds(o5.attributes.T13, o5.attributes.F05, d1.attributes.T16) + screenContactAdjustmentSeconds(o5.measures.weightKg - d1.measures.weightKg);
  const dropConcessionValue = screenDelay >= 0.2 ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, o5.attributes.T01, 0) : 0;

  const tTrapCall = tUseScreen + recognitionLatencySeconds(d5.attributes.M01, d5.attributes.M05);
  const rawD5TrapArrival = tTrapCall + timeToReach(ctx.positions.D5!, screenPoint, defenderLateralSpeedMps(d5.attributes.F04));
  const tD5TrapArrival = Math.max(0, rawD5TrapArrival - perimeterArrivalAdjustmentSeconds(d5.attributes.T22));
  const trapEligible = tD5TrapArrival <= tUseScreen + screenDelay;
  const trapConcessionValue = trapEligible ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o4.attributes.T04, 0) : Infinity;

  return { trapEligible, dropConcessionValue, trapConcessionValue };
}

/**
 * Segunda familia posicional completa (ME-06 §3.1): mano a mano sin balón.
 * Reutiliza movimientos, tiempos de llegada, geometría de pase, oposición
 * `R_contest`, contacto y responsabilidades ya versionados (LAB-0.1/0.2/0.3);
 * ningún parámetro deportivo nuevo. IDs canónicos O1..O5/D1..D5, traducidos
 * a los reales del quinteto por `player()`, no nombres fijos.
 */
function runHandoffPhase(ctx: CoreContext): PossessionCoreResult {
  const o1 = player(ctx, "O1");
  const o2 = player(ctx, "O2");
  const o3 = player(ctx, "O3");
  const o4 = player(ctx, "O4");
  const o5 = player(ctx, "O5");
  const d2 = player(ctx, "D2");
  const d3 = player(ctx, "D3");
  const d4 = player(ctx, "D4");
  const d5 = player(ctx, "D5");
  const offBallCallChoice: OffBallDefensiveCallChoice = ctx.input.offBallDefensiveCall ?? "guardar_espacio";

  event(
    ctx,
    0,
    "reconocido",
    "handoff_action_started",
    ["O1", "O5", "O2", "O3", "O4"],
    "Se organiza el mano a mano: O1 busca a O5 en el codo alto mientras O4 coloca un bloqueo indirecto para O3 en el lado débil.",
    { offBallDefensiveCall: offBallCallChoice },
  );

  // --- 1. Entrada: O1 encuentra a O5 en el codo alto (ME-06 §3.1.1) --------
  const entryPoint = FREE_THROW_LINE_SPOT;
  const tEntryArrival = PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, entryPoint);
  const shotClockRemainingAtEntry = ctx.shotClockMs / 1000 - tEntryArrival;
  if (shotClockRemainingAtEntry <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, "O1");
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "dead", holderId: null, position: ctx.positions.O1! });
  }
  // En proyección no se sortea: el riesgo del pase de entrada entra como
  // probabilidad de completarse en el valor de la familia (§2.2).
  const entryPass: ReturnType<typeof resolvePass> = ctx.projecting
    ? { kind: "clean_reception" }
    : resolvePass(o1.attributes.T09, o5.attributes.T11, true, d5.attributes.T17, 1, ctx.rng);
  const entryCompletion = 1 - deflectionProbability(d5.attributes.T17, o1.attributes.T09);
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
  const entryReadyDelay = entryPass.kind === "awkward_control" ? entryPass.extraDelaySeconds : 0;
  const tO5Ready = tEntryArrival + entryReadyDelay;
  setArrival(ctx, "O5", tO5Ready, entryPoint, 0);
  event(ctx, tO5Ready, "concedido", "pass_received", ["O5"], "O5 recibe la entrada en el codo alto.");
  auditDecision(ctx, tO5Ready, {
    point: "entrada_mano_a_mano",
    holderId: "O1",
    participants: ["O1", "O5"],
    chosenOptionId: "entrada_o5",
    factLinkKind: "pass_received",
    options: [{ id: "entrada_o5", status: "elegida", reasonCode: "entry_pass_completed", values: { tO5Ready } }],
  });

  // --- 2. Mano a mano: O5 entrega a O2, que sube desde el lado fuerte
  //        (ME-06 §3.1.2). D2 puede perseguir o negar la recepción; D5
  //        puede contener o saltar a la pelota según la cobertura. --------
  const handoffPoint = pointShortOfTarget(ctx.positions.O2!, entryPoint, COMBINED_CONTACT_RADIUS_METERS);
  const tO2Arrival = timeToReach(ctx.positions.O2!, handoffPoint, attackerMoveSpeedMps(o2.attributes.F01));
  setArrival(ctx, "O2", tO2Arrival, handoffPoint, 0);
  const tHandoffReady = Math.max(tO5Ready, tO2Arrival);

  const d2Origin = ctx.positions.D2!;
  const d2Speed = defenderLateralSpeedMps(d2.attributes.F04);
  const d2Braking = closeoutBrakingExtraSeconds(d2.attributes.F03);
  const d2RawArrival = timeToReach(d2Origin, handoffPoint, d2Speed);
  const d2Arrival = Math.max(0, d2RawArrival - perimeterArrivalAdjustmentSeconds(d2.attributes.T22));
  const d2Geometry: ContestGeometry = { originPos: d2Origin, destinationPos: handoffPoint, speedMps: d2Speed, brakingExtraSeconds: d2Braking };
  setArrival(ctx, "D2", d2Arrival, handoffPoint, 0);

  // Cobertura sobre el mano a mano (ME-06 §3.1, respuesta defensiva): en
  // drop, D5 protege el interior y no se suma a negar la entrega; en
  // trampa, D5 sale a presionar la recepción junto a D2 si llega a tiempo,
  // dejando un coste interior real y verificable (se registra abajo).
  let d5CommittedToHandoffTrap = false;
  let tD5RecoverToRim = 0;
  if (ctx.resolvedCoverage === "trampa") {
    const d5RawArrivalAtHandoff = timeToReach(ctx.positions.D5!, handoffPoint, defenderLateralSpeedMps(d5.attributes.F04));
    const d5ArrivalAtHandoff = Math.max(0, d5RawArrivalAtHandoff - interiorArrivalAdjustmentSeconds(d5.attributes.T23));
    if (d5ArrivalAtHandoff <= tHandoffReady + COMBINED_CONTACT_RADIUS_METERS / d2Speed) {
      d5CommittedToHandoffTrap = true;
      tD5RecoverToRim =
        m09CoordinationLatencySeconds(d5.attributes.M09, d5.attributes.M09) +
        timeToReach(handoffPoint, ATTACKED_HOOP, defenderLateralSpeedMps(d5.attributes.F04));
      event(ctx, d5ArrivalAtHandoff, "concedido", "help_left_assignment", ["D5", "O5"], "D5 salta a presionar la recepción del mano a mano (trampa); deja el interior expuesto mientras recupera.");
    }
  }

  const d2PosAtHandoff = positionAtInstant(d2Geometry, d2Arrival, tHandoffReady);
  const handoffDenied = distance(d2PosAtHandoff, handoffPoint) <= COMBINED_CONTACT_RADIUS_METERS || d5CommittedToHandoffTrap;

  auditDecision(ctx, tHandoffReady, {
    point: "transferencia_mano_a_mano",
    holderId: "O5",
    participants: ["O5", "O2", "D2", "D5"],
    chosenOptionId: handoffDenied ? "entrega_negada" : "entrega_completada",
    options: [
      handoffDenied
        ? { id: "entrega_negada", status: "elegida", reasonCode: "handoff_denied_defender_arrived", values: { d2ArrivalSeconds: d2Arrival, tHandoffReady, d5CommittedToHandoffTrap } }
        : { id: "entrega_completada", status: "elegida", reasonCode: "handoff_completed", values: { d2ArrivalSeconds: d2Arrival, tHandoffReady, d5CommittedToHandoffTrap } },
    ],
  });

  // --- 3. Simultáneamente: bloqueo indirecto de O4 para el corte de O3
  //        desde el lado débil (ME-06 §3.1.3). La orden fija de defensa
  //        sin balón desplaza la navegación real de D3 (T13/F05 la
  //        pantalla; T21 el desmarque de O3; T16 la navegación de D3). --
  const screenDelayBase = screenInterceptDelaySeconds(o4.attributes.T13, o4.attributes.F05, d3.attributes.T16);
  const tO4ScreenSet = timeToReach(ctx.positions.O4!, WEAK_SIDE_SCREEN_SPOT, attackerMoveSpeedMps(o4.attributes.F01));
  setArrival(ctx, "O4", tO4ScreenSet, WEAK_SIDE_SCREEN_SPOT, 0);
  event(ctx, tO4ScreenSet, "ejecutado", "screen_set", ["O4"], "O4 coloca un bloqueo indirecto legal para el corte de O3 en el lado débil.");

  const cutStart = Math.max(0, tO4ScreenSet - cutterStartTimeReductionSeconds(o3.attributes.T21));
  const tO3Cut = cutStart + timeToReach(ctx.positions.O3!, WEAK_SIDE_CUT_SPOT, attackerMoveSpeedMps(o3.attributes.F01));
  const d3RawArrival = timeToReach(ctx.positions.D3!, WEAK_SIDE_CUT_SPOT, defenderLateralSpeedMps(d3.attributes.F04));

  // Evalúa, de forma pura (sin RNG ni hechos), qué concedería cada orden
  // sin balón desde esta misma geometría real: la navegación de D3
  // (T13/F05/T21/T16, igual que antes de ME-07A) y si D4 ayudaría a cerrar
  // a O3 (`d4HelpMargin`). El valor de concesión reutiliza la fórmula de
  // tiro exterior ya existente (three_point_base × T04, sin oposición),
  // nunca un coeficiente nuevo.
  function evaluateOffBallCall(call: OffBallDefensiveCall) {
    const adjustment = call === "negar_primera_salida" ? -OFF_BALL_CALL_NAVIGATION_ADJUSTMENT_SECONDS : OFF_BALL_CALL_NAVIGATION_ADJUSTMENT_SECONDS;
    const screenDelay = Math.max(0, screenDelayBase + adjustment);
    const tD3AtCut = cutStart + d3RawArrival + screenDelay;
    const cutWindowOpen = tD3AtCut > tO3Cut;
    const d4HelpMargin = tD3AtCut - tO3Cut;
    const d4Helps = call === "guardar_espacio" && d4HelpMargin > -0.5;
    const o3Value = cutWindowOpen && !d4Helps ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o3.attributes.T04, 0) : 0;
    const o4Value = d4Helps ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o4.attributes.T04, 0) : 0;
    return { screenDelay, tD3AtCut, cutWindowOpen, d4HelpMargin, d4Helps, concessionValue: Math.max(o3Value, o4Value) };
  }

  let offBallCall: OffBallDefensiveCall;
  let offBallCallAutoOptions: readonly AuditOptionRecord[] | null = null;
  if (offBallCallChoice === "auto") {
    const negar = evaluateOffBallCall("negar_primera_salida");
    const guardar = evaluateOffBallCall("guardar_espacio");
    // Empate exacto (o concesión indistinguible) conserva `guardar_espacio`
    // como plan base (ME-07A §4): solo cambia si `negar_primera_salida`
    // concede estrictamente menos.
    offBallCall = negar.concessionValue < guardar.concessionValue ? "negar_primera_salida" : "guardar_espacio";
    offBallCallAutoOptions = [
      {
        id: "negar_primera_salida",
        status: offBallCall === "negar_primera_salida" ? "elegida" : "descartada_por_condicion",
        reasonCode: offBallCall === "negar_primera_salida" ? "off_ball_call_lower_concession" : "off_ball_call_higher_concession",
        values: { concessionValue: negar.concessionValue },
      },
      {
        id: "guardar_espacio",
        status: offBallCall === "guardar_espacio" ? "elegida" : "descartada_por_condicion",
        reasonCode: offBallCall === "guardar_espacio" ? (negar.concessionValue === guardar.concessionValue ? "off_ball_call_tied_base_kept" : "off_ball_call_lower_concession") : "off_ball_call_higher_concession",
        values: { concessionValue: guardar.concessionValue },
      },
    ];
  } else {
    offBallCall = offBallCallChoice;
  }
  const chosenOffBallCall = evaluateOffBallCall(offBallCall);
  const { screenDelay, tD3AtCut, cutWindowOpen, d4HelpMargin, d4Helps } = chosenOffBallCall;

  setArrival(ctx, "O3", tO3Cut, WEAK_SIDE_CUT_SPOT, cutStart);
  event(ctx, tO3Cut, "ejecutado", "screen_navigated", ["O3", "D3"], `O3 corta tras el bloqueo indirecto; D3 navega con un retraso real de ${screenDelay.toFixed(2)} s.`, { screenDelay });
  setArrival(ctx, "D3", tD3AtCut, WEAK_SIDE_CUT_SPOT, cutStart);

  // D4 responde al bloqueador: en `guardar_espacio`, D4 está listo para
  // ayudar a cerrar a O3 en cuanto D3 no lo deniega con margen real
  // (`d4HelpMargin`, positivo cuando D3 llega después que O3): si ayuda,
  // O3 recibe contestado (no un tiro libre) y O4 se abre en su propio
  // punto de bloqueo (mismo patrón que la ayuda de D3/D4 del bloqueo
  // directo). En `negar_primera_salida`, D4 nunca ayuda: sigue siempre al
  // bloqueador, así que O3 recibe sin contestar si D3 lo pierde, pero O4
  // no se abre nunca por esta vía.
  const o4Open = d4Helps;
  if (d4Helps) {
    event(ctx, tD3AtCut, "concedido", "help_left_assignment", ["D4", "O4"], "D4 ayuda a cerrar a O3 en el corte; O4 queda libre en su propio punto de bloqueo.");
  }

  if (offBallCallAutoOptions) {
    auditDecision(ctx, tO3Cut, {
      point: "seleccion_orden_sin_balon",
      holderId: null,
      participants: ["O3", "O4", "D3", "D4"],
      chosenOptionId: offBallCall,
      options: offBallCallAutoOptions,
    });
  }

  auditDecision(ctx, tO3Cut, {
    point: "bloqueo_indirecto_o3",
    holderId: null,
    participants: ["O3", "O4", "D3", "D4"],
    chosenOptionId: cutWindowOpen ? "corte_liberado" : "corte_negado",
    factLinkKind: "screen_navigated",
    options: [
      cutWindowOpen
        ? { id: "corte_liberado", status: "elegida", reasonCode: "cut_window_open", values: { tD3AtCut, tO3Cut, screenDelay } }
        : { id: "corte_negado", status: "elegida", reasonCode: "cut_window_denied", values: { tD3AtCut, tO3Cut, screenDelay } },
      o4Open
        ? { id: "ayuda_d4_abre_o4", status: "elegida", reasonCode: "help_rotation_opened_o4", values: { d4HelpMargin } }
        : { id: "ayuda_d4_abre_o4", status: "descartada_por_condicion", reasonCode: "help_rotation_not_available", values: { d4HelpMargin, offBallCall } },
    ],
  });

  // --- 4. Primera lectura real: el portador (O2 si la entrega se
  //        completó; si no, O5 conserva el balón) elige entre finalizar,
  //        pasar a O3, continuar a O4, o la seguridad a O1 (ME-06 §3.1.4).
  const holderId = handoffDenied ? "O5" : "O2";
  const holder = handoffDenied ? o5 : o2;
  const holderPos = handoffDenied ? entryPoint : handoffPoint;
  // El portador no decide hasta que también puede leer de verdad la salida
  // del bloqueo/corte simultáneo (§3.1.3): si esa acción paralela tarda más
  // que la entrega en resolverse, la lectura espera a la más lenta de las
  // dos, en vez de decidir con el corte todavía en el aire.
  const tDecision = Math.max(tHandoffReady, tO3Cut, tD3AtCut);

  const shotClockRemainingSeconds = ctx.shotClockMs / 1000 - tDecision;
  if (shotClockRemainingSeconds <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, holderId);
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId, position: holderPos });
  }

  // Vía "finalizar_portador": el portador conduce al aro. D5 protege el
  // interior salvo que ya esté comprometido en la trampa del mano a mano,
  // en cuyo caso recupera con el retraso real de coordinación (M09).
  const d5FinishOrigin = d5CommittedToHandoffTrap ? handoffPoint : ctx.positions.D5!;
  const d5FinishDepart = d5CommittedToHandoffTrap ? tHandoffReady : tDecision;
  const d5FinishGeometry: ContestGeometry = {
    originPos: d5FinishOrigin,
    destinationPos: ATTACKED_HOOP,
    speedMps: defenderLateralSpeedMps(d5.attributes.F04),
    brakingExtraSeconds: closeoutBrakingExtraSeconds(d5.attributes.F03),
  };
  const holderTimeToHoop = timeToReach(holderPos, ATTACKED_HOOP, attackerMoveSpeedMps(holder.attributes.F01));
  const tHolderFinishReady = tDecision + holderTimeToHoop + CLOSE_FINISH_PREP_SECONDS;
  const d5RawArrivalAtRim = d5FinishDepart + timeToReach(d5FinishOrigin, ATTACKED_HOOP, defenderLateralSpeedMps(d5.attributes.F04));
  const d5ArrivalAtRim = d5CommittedToHandoffTrap ? tHandoffReady + tD5RecoverToRim : Math.max(0, d5RawArrivalAtRim - interiorArrivalAdjustmentSeconds(d5.attributes.T23));
  const d5PosAtHolderReady = positionAtInstant(d5FinishGeometry, d5ArrivalAtRim, tHolderFinishReady);
  const d5TrulyBlockingFinish = distance(d5PosAtHolderReady, ATTACKED_HOOP) <= COMBINED_CONTACT_RADIUS_METERS;
  const finishMarginSeconds = d5ArrivalAtRim - tHolderFinishReady;
  const finishOpposition: EffectiveOpposition = finishMarginSeconds >= 0.25 ? 0 : 1;
  const finishValue = !handoffDenied && !d5TrulyBlockingFinish
    ? 2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, holder.attributes.T01, finishOpposition)
    : -Infinity;

  // Vía "pase_o3": el corte quedó liberado.
  const d4CornerGeometry: ContestGeometry = {
    originPos: ctx.positions.D4!,
    destinationPos: WEAK_SIDE_SCREEN_SPOT,
    speedMps: defenderLateralSpeedMps(d4.attributes.F04),
    brakingExtraSeconds: closeoutBrakingExtraSeconds(d4.attributes.F03),
  };
  const o3Opposition: EffectiveOpposition = d4Helps ? 1 : 0;
  const o3PassValue = cutWindowOpen ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o3.attributes.T04, o3Opposition) : -Infinity;

  // Vía "continuar_o4": D4 ayudó a cerrar a O3 y O4 quedó libre.
  const o4PassValue = o4Open ? 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, o4.attributes.T04, 0) : -Infinity;

  // Vía "pase_o1": seguridad, siempre viable, sin puntos esperados.
  const safeOutletValue = 0;

  type HandoffReadOptionId = "finalizar_portador" | "pase_o3" | "continuar_o4" | "pase_o1";
  const candidateValues: Readonly<Record<HandoffReadOptionId, number>> = {
    finalizar_portador: finishValue,
    pase_o3: o3PassValue,
    continuar_o4: o4PassValue,
    pase_o1: safeOutletValue,
  };
  const HANDOFF_READ_ORDER: readonly HandoffReadOptionId[] = ["finalizar_portador", "pase_o3", "continuar_o4", "pase_o1"];
  if (ctx.projecting) {
    const completionOf: Readonly<Record<HandoffReadOptionId, number>> = {
      finalizar_portador: entryCompletion,
      pase_o3: entryCompletion * (1 - deflectionProbability(d3.attributes.T17, holder.attributes.T09)),
      continuar_o4: entryCompletion * (1 - deflectionProbability(d4.attributes.T17, holder.attributes.T09)),
      pase_o1: 1,
    };
    throw new ReadProjectionReached({
      tDecisionSeconds: tDecision,
      options: HANDOFF_READ_ORDER.map((id) => ({ id, value: candidateValues[id], completion: completionOf[id] })),
    });
  }
  const viableCandidates = HANDOFF_READ_ORDER.filter((id) => Number.isFinite(candidateValues[id]))
    .map((id) => ({ id, value: candidateValues[id] }))
    .sort((a, b) => b.value - a.value);
  const topValue = viableCandidates[0]!.value;

  // ME-07A §2 (regla piloto), generalizada a esta lectura fuera del bloqueo:
  // dentro de `FIRST_READ_TIE_BAND_POINTS`, la prioridad de creación del
  // entrenador favorece primero una vía compatible (aro: `finalizar_portador`;
  // triple: `pase_o3`/`continuar_o4`, ambas de tres). Si sigue compitiendo un
  // tiro real con la continuación seguridad (`pase_o1`), decide la nueva
  // tendencia de tiro del jugador (ortogonal a `pnrTendency`, que conserva su
  // papel específico solo en la primera lectura del bloqueo): `decidida`
  // favorece el tiro, `prudente` conserva/pasa, `equilibrada` usa la misma
  // `secondOptionProbability(M03)` ya versionada. Si compiten solo vías de
  // tiro entre sí (aro vs triple, sin continuación real en banda), la
  // elección sembrada entre mejor y alternativa resuelve igual que en el
  // bloqueo directo cuando no hay `pnrTendency` de manejador aplicable.
  let chosen: HandoffReadOptionId = viableCandidates[0]!.id;
  let tieBandResolvedByPriority = false;
  let tieBandResolvedByTendency = false;
  let shotTendencyReasonCode: AuditReasonCode = "shot_tendency_seeded_choice";
  let tieRngBefore: number | null = null;
  let tieRngAfter: number | null = null;
  if (viableCandidates.length > 1 && topValue - viableCandidates[1]!.value <= FIRST_READ_TIE_BAND_POINTS) {
    const band = viableCandidates.filter((c) => topValue - c.value <= FIRST_READ_TIE_BAND_POINTS);
    const creationPriority: OffensiveCreationPriority = ctx.input.creationPriority ?? "equilibrado";
    let priorityBand: readonly { readonly id: HandoffReadOptionId; readonly value: number }[] | null = null;
    if (creationPriority === "buscar_aro") {
      priorityBand = band.filter((c) => c.id === "finalizar_portador").sort((a, b) => b.value - a.value);
    } else if (creationPriority === "buscar_triple") {
      priorityBand = band.filter((c) => c.id === "pase_o3" || c.id === "continuar_o4").sort((a, b) => b.value - a.value);
    }
    if (priorityBand && priorityBand.length > 0) {
      tieBandResolvedByPriority = true;
      chosen = priorityBand[0]!.id;
    } else {
      const shotBand = band.filter((c) => c.id !== "pase_o1").sort((a, b) => b.value - a.value);
      const continuationInBand = band.some((c) => c.id === "pase_o1");
      if (shotBand.length > 0 && continuationInBand) {
        if (holder.shotTendency === "decidida") {
          chosen = shotBand[0]!.id;
          tieBandResolvedByTendency = true;
          shotTendencyReasonCode = "shot_tendency_favors_shot";
        } else if (holder.shotTendency === "prudente") {
          chosen = "pase_o1";
          tieBandResolvedByTendency = true;
          shotTendencyReasonCode = "shot_tendency_favors_continuation";
        } else {
          tieRngBefore = rngStateOf(ctx.rng);
          const preferContinuation = ctx.rng.next() < secondOptionProbability(holder.attributes.M03);
          tieRngAfter = rngStateOf(ctx.rng);
          chosen = preferContinuation ? "pase_o1" : shotBand[0]!.id;
          tieBandResolvedByTendency = true;
          shotTendencyReasonCode = "shot_tendency_seeded_choice";
        }
      } else if (shotBand.length > 1) {
        tieRngBefore = rngStateOf(ctx.rng);
        const preferSecondShot = ctx.rng.next() < secondOptionProbability(holder.attributes.M03);
        tieRngAfter = rngStateOf(ctx.rng);
        if (preferSecondShot) chosen = shotBand[1]!.id;
        tieBandResolvedByTendency = true;
        shotTendencyReasonCode = "shot_tendency_seeded_choice";
      }
    }
  }

  const handoffReadReasonCodes: Readonly<Record<HandoffReadOptionId, { chosen: AuditReasonCode; notViable: AuditReasonCode }>> = {
    finalizar_portador: { chosen: "lane_open_before_help", notViable: handoffDenied ? "not_available" : "lane_closed_help_ready" },
    pase_o3: { chosen: "cut_window_open", notViable: "cut_window_denied" },
    continuar_o4: { chosen: "help_rotation_opened_o4", notViable: "help_rotation_not_available" },
    pase_o1: { chosen: "safe_outlet_default", notViable: "not_available" },
  };
  const handoffReadValues: Readonly<Record<HandoffReadOptionId, Record<string, number | string | boolean | null>>> = {
    finalizar_portador: { situationalValue: finishValue, holderTimeToHoopSeconds: holderTimeToHoop, d5TrulyBlockingFinish, finishMarginSeconds },
    pase_o3: { situationalValue: o3PassValue, cutWindowOpen, tD3AtCut, tO3Cut },
    continuar_o4: { situationalValue: o4PassValue, o4Open, d4HelpMargin },
    pase_o1: { situationalValue: safeOutletValue },
  };
  function handoffReadOptionRecord(id: HandoffReadOptionId): AuditOptionRecord {
    const value = candidateValues[id];
    if (id === chosen) return { id, status: "elegida", reasonCode: handoffReadReasonCodes[id].chosen, values: handoffReadValues[id] };
    if (!Number.isFinite(value)) return { id, status: "descartada_por_condicion", reasonCode: handoffReadReasonCodes[id].notViable, values: handoffReadValues[id] };
    const inBand = topValue - value <= FIRST_READ_TIE_BAND_POINTS;
    return {
      id,
      status: "descartada_por_condicion",
      reasonCode: inBand && tieBandResolvedByPriority ? "creation_priority_resolved_band" : inBand && tieBandResolvedByTendency ? shotTendencyReasonCode : "situational_value_lower",
      values: handoffReadValues[id],
    };
  }
  const handoffReadOptions = HANDOFF_READ_ORDER.map(handoffReadOptionRecord);
  void tieRngBefore;
  void tieRngAfter;

  if (chosen === "pase_o1") {
    auditDecision(ctx, tDecision, {
      point: "lectura_mano_a_mano",
      holderId,
      participants: [holderId, "O1"],
      chosenOptionId: "pase_o1",
      options: handoffReadOptions,
    });
    const tOutlet = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(holderPos, ctx.positions.O1!);
    event(ctx, tOutlet, "concedido", "possession_continues", [holderId, "O1"], `${holderId} elige la salida segura hacia O1; el ataque conserva el control y se reorganiza.`);
    return finalize(
      ctx,
      { kind: "possession_reorganized_control_kept", outletPlayerId: "O1" },
      { status: "held", holderId: "O1", position: ctx.positions.O1! },
    );
  }

  if (chosen === "finalizar_portador") {
    auditDecision(ctx, tDecision, {
      point: "lectura_mano_a_mano",
      holderId,
      participants: [holderId, "D5"],
      chosenOptionId: "finalizar_portador",
      options: handoffReadOptions,
    });
    return resolveShotAttempt(ctx, {
      shooterId: holderId,
      shooterSkill: holder.attributes.T01,
      shotType: "close_finish",
      shooterPos: ATTACKED_HOOP,
      tReady: tHolderFinishReady,
      prepSeconds: CLOSE_FINISH_PREP_SECONDS,
      contesterId: "D5",
      contesterArrival: d5ArrivalAtRim,
      contesterGeometry: d5FinishGeometry,
    });
  }

  if (chosen === "pase_o3") {
    const passOutcome = resolvePass(holder.attributes.T09, o3.attributes.T11, true, d3.attributes.T17, 1, ctx.rng);
    const tPassArrivalO3 = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(holderPos, WEAK_SIDE_CUT_SPOT);
    event(ctx, tPassArrivalO3, "ejecutado", "pass_released", [holderId, "O3"], `${holderId} pasa a O3, liberado por el bloqueo/corte.`);
    auditDecision(ctx, tDecision, {
      point: "lectura_mano_a_mano",
      holderId,
      participants: [holderId, "O3", "D3"],
      chosenOptionId: "pase_o3",
      factLinkKind: "pass_released",
      options: handoffReadOptions,
    });
    if (passOutcome.kind === "deflected_loose_ball") {
      return resolveLooseBallAfterPass(ctx, tPassArrivalO3, holderId, "D3");
    }
    const readyDelay = passOutcome.kind === "awkward_control" ? passOutcome.extraDelaySeconds : 0;
    const tPrepReadyO3 = tPassArrivalO3 + readyDelay + CATCH_AND_SHOOT_PREP_SECONDS;
    event(ctx, tPassArrivalO3, "concedido", "pass_received", ["O3"], "O3 recibe liberado tras el bloqueo/corte.");
    // Si D4 ayudó a cerrar (guardar_espacio con D3 batido), el contestador
    // real del tiro de O3 es D4 rotando, no D3 (que ya perdió la carrera);
    // si D3 lo deniega solo (negar_primera_salida o D3 gana con margen),
    // el propio D3 es quien contesta al recuperar.
    return resolveShotAttempt(ctx, {
      shooterId: "O3",
      shooterSkill: o3.attributes.T04,
      shotType: "three_point",
      shooterPos: WEAK_SIDE_CUT_SPOT,
      tReady: tPrepReadyO3,
      prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + readyDelay,
      contesterId: d4Helps ? "D4" : "D3",
      contesterArrival: tD3AtCut,
      contesterGeometry: d4Helps
        ? { originPos: ctx.positions.D4!, destinationPos: WEAK_SIDE_CUT_SPOT, speedMps: defenderLateralSpeedMps(d4.attributes.F04), brakingExtraSeconds: closeoutBrakingExtraSeconds(d4.attributes.F03) }
        : { originPos: ctx.positions.D3!, destinationPos: WEAK_SIDE_CUT_SPOT, speedMps: defenderLateralSpeedMps(d3.attributes.F04), brakingExtraSeconds: closeoutBrakingExtraSeconds(d3.attributes.F03) },
    });
  }

  // chosen === "continuar_o4"
  const passOutcome = resolvePass(holder.attributes.T09, o4.attributes.T11, true, d4.attributes.T17, 1, ctx.rng);
  const tPassArrivalO4 = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(holderPos, WEAK_SIDE_SCREEN_SPOT);
  event(ctx, tPassArrivalO4, "ejecutado", "pass_released", [holderId, "O4"], `${holderId} continúa hacia O4, abierto tras la ayuda de D4.`);
  auditDecision(ctx, tDecision, {
    point: "lectura_mano_a_mano",
    holderId,
    participants: [holderId, "O4", "D4"],
    chosenOptionId: "continuar_o4",
    factLinkKind: "pass_released",
    options: handoffReadOptions,
  });
  if (passOutcome.kind === "deflected_loose_ball") {
    return resolveLooseBallAfterPass(ctx, tPassArrivalO4, holderId, "D4");
  }
  const readyDelayO4 = passOutcome.kind === "awkward_control" ? passOutcome.extraDelaySeconds : 0;
  const tPrepReadyO4 = tPassArrivalO4 + readyDelayO4 + CATCH_AND_SHOOT_PREP_SECONDS;
  event(ctx, tPassArrivalO4, "concedido", "pass_received", ["O4"], "O4 recibe abierto en su propio punto de bloqueo.");
  return resolveShotAttempt(ctx, {
    shooterId: "O4",
    shooterSkill: o4.attributes.T04,
    shotType: "three_point",
    shooterPos: WEAK_SIDE_SCREEN_SPOT,
    tReady: tPrepReadyO4,
    prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + readyDelayO4,
    contesterId: "D4",
    contesterArrival: tD3AtCut,
    contesterGeometry: d4CornerGeometry,
  });
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
  const blockEligible = contestLevel > 0 && legality !== "late_illegal_contact" && shotTouchable;

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
    const base = args.shotType === "close_finish" ? CLOSE_FINISH_BASE_PROBABILITY : THREE_POINT_BASE_PROBABILITY;
    const shotProb = shotProbability(base, args.shooterSkill, opposition);
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
          values: { arrivalMarginSeconds: arrivalMargin, brakingExtraSeconds: args.contesterGeometry.brakingExtraSeconds },
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

  const isFoul = legality === "late_illegal_contact";

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
    if (d <= COMBINED_CONTACT_RADIUS_METERS) {
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
