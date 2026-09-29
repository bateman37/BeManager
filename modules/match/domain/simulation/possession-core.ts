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
import { timeToReach, distance, moveToward } from "../geometry/point";
import { positionOnTrajectory, truncateTrajectory, type TrajectoryPoint } from "../geometry/trajectory";
import { ATTACKED_HOOP, FREE_THROW_LINE_SPOT, COURT_WIDTH_METERS, isBehindThreePointLine } from "../geometry/court";
import { MIDCOURT_LINE_X } from "../geometry/frame";
import { createSeededRandom, type SeededRandom } from "../random/seeded-random";
import { secondsToMs, type Milliseconds } from "../time/clock";
import type { MatchInput } from "../lab/match-input";
import { findPlayerInInput } from "../lab/match-input";
import { getScenario, type ScenarioDefinition } from "../lab/scenario";
import type { PlayerProfile } from "../players/player-profile";
import {
  attackerMoveSpeedMps,
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
import type { TerminalOutcome, BallState } from "./match-state";
import type { FactPhase, FactKind } from "./fact";
import { resolvePass } from "./resolvers/pass-resolver";
import { resolveShot, type ShotType } from "./resolvers/shot-resolver";
import {
  seedReboundLanding,
  resolveRebound,
  pickTipWinnerByT20,
  type ReboundCandidate,
  type ReboundOutcome,
} from "./resolvers/rebound-resolver";
import { resolvesTurnoverUnderPressure } from "./resolvers/turnover-resolver";
import {
  evaluateCloseoutLegality,
  awardFreeThrowsForShootingFoul,
  evaluateContainmentContact,
} from "./resolvers/foul-resolver";

const WEAK_CORNER_SPOT: Point2D = { x: 24.0, y: 13.9 };
/**
 * Solo para `closeout_tardío_con_contacto`: representa que D4 ya había
 * rotado a proteger el aro (X-out) antes de tener que recuperar sobre O3,
 * en vez de partir directamente desde su posición inicial de ala débil.
 * Es una condición geométrica propia de este escenario, no una fórmula
 * LAB-0.1 compartida.
 */
const LATE_CLOSEOUT_D4_START: Point2D = { x: 24.9, y: 8.2 };
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
  readonly linked: LinkedState | null;
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

  return ctx.input.coverage === "trampa" ? runTrapPhase(ctx) : runDropPhase(ctx, scenario);
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

  return resolveShotAttempt(ctx, {
    shooterId: entry.shooterSlot,
    shooterSkill: shooter.attributes.T01,
    shotType: "close_finish",
    shooterPos: entry.finishSpot,
    tReady: tCatch + readyDelay + CLOSE_FINISH_PREP_SECONDS,
    prepSeconds: CLOSE_FINISH_PREP_SECONDS,
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

  // --- Pantalla ---------------------------------------------------------
  const tScreenSet = scenario.startsWithHelpAlreadyCommitted ? 0 : SCREEN_SET_AFTER_ARRIVAL_SECONDS;
  const tHandlerArrival = timeToReach(ctx.positions.O1!, screenPoint, attackerMoveSpeedMps(o1.attributes.F01));
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

  // --- Árbol de decisión de O1 --------------------------------------------
  const tDecision = tUseScreen + recognitionLatencySeconds(o1.attributes.M01, o1.attributes.M05);
  const preferSecondOption =
    o1.pnrTendency === "explorar_segunda_opcion" && ctx.rng.next() < secondOptionProbability(o1.attributes.M03);

  const shotClockRemainingSeconds = ctx.shotClockMs / 1000 - tDecision;
  if (shotClockRemainingSeconds <= 0) {
    if (ctx.linked) return linkedShotClockViolation(ctx, "O1");
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: "O1", position: ctx.positions.O1! });
  }

  // Opción 1: finalizar si O1 ya tiene carril al aro antes de D5.
  const o1TimeToHoop = timeToReach(ctx.positions.O1!, ATTACKED_HOOP, attackerMoveSpeedMps(o1.attributes.F01));
  // T23 (defensa interior): D5 protege el aro contra la finalización directa.
  const d5RawTimeToHoop = timeToReach(ctx.positions.D5!, ATTACKED_HOOP, defenderLateralSpeedMps(d5.attributes.F04));
  const d5TimeToHoop = Math.max(0, d5RawTimeToHoop - interiorArrivalAdjustmentSeconds(d5.attributes.T23));
  const option1Available = o1TimeToHoop < d5TimeToHoop && !preferSecondOption;

  const d5HoopGeometry: ContestGeometry = {
    originPos: ctx.positions.D5!,
    destinationPos: ATTACKED_HOOP,
    speedMps: defenderLateralSpeedMps(d5.attributes.F04),
    brakingExtraSeconds: closeoutBrakingExtraSeconds(d5.attributes.F03),
  };

  if (option1Available && shotClockRemainingSeconds > 2) {
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

  // Opción 2: pasar a O5 si gana al perseguidor >=0.2s, hay línea y D3 no
  // negó el roll *antes* de que O1 decidiera (si D3 ya lo negó antes de la
  // decisión, la esquina entra en la lectura a tiempo por la opción 3, sin
  // pasar antes por O5 — C2 §2). Una negación que llega *después* de la
  // decisión, mientras O1 ya pasó o O5 está recibiendo, se lee más abajo
  // como la segunda lectura real de O5, no como un descarte prematuro.
  const rollDeniedBeforeDecision = scenario.d3HelpsRoller && tD3ArriveHelp <= tDecision;
  const option2Available = screenDelay >= 0.2 && !rollDeniedBeforeDecision;

  if (option2Available) {
    const tPassArrival = Math.max(
      tRollReady,
      tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, ctx.positions.O5!),
    );
    const passOutcome = resolvePass(
      o1.attributes.T09,
      o5.attributes.T11,
      true,
      d1.attributes.T17,
      1,
      ctx.rng,
    );
    event(ctx, tPassArrival, "ejecutado", "pass_released", ["O1", "O5"], "O1 pasa al continuador O5.");

    if (passOutcome.kind === "deflected_loose_ball") {
      return resolveLooseBallAfterPass(ctx, tPassArrival, "O1", "D1");
    }

    const readyDelay = passOutcome.kind === "awkward_control" ? passOutcome.extraDelaySeconds : 0;
    const tO5Ready = tPassArrival + readyDelay + CLOSE_FINISH_PREP_SECONDS;
    const contesterId = scenario.d3HelpsRoller ? "D3" : "D5";
    const tContestArrival = scenario.d3HelpsRoller ? tD3ArriveHelp : tDecision + d5TimeToHoop;
    const rollContestGeometry: ContestGeometry = scenario.d3HelpsRoller
      ? { originPos: d3HelpOrigin, destinationPos: SHORT_ROLL_SPOT, speedMps: d3HelpSpeed, brakingExtraSeconds: d3BrakingExtra }
      : { ...d5HoopGeometry, destinationPos: SHORT_ROLL_SPOT };

    event(ctx, tPassArrival, "concedido", "pass_received", ["O5"], "O5 recibe el balón en el roll.");

    // Segunda lectura de O5 (C2): si el espacio corporal de D3 realmente
    // se solapa con el de O5 para cuando O5 está listo para actuar (no
    // antes de que O1 decidiera pasar) —misma geometría de contacto que
    // C1, reconstruyendo la posición real de D3 en ese instante, no solo
    // comparando cuándo "llega" D3 a un punto de referencia—, O5 puede
    // invertir hacia O3 en la esquina débil en vez de forzar el tiro, sin
    // reiniciar el reloj. Solo es una lectura real si además D4 no ha
    // cerrado ya esa esquina.
    const d3PosAtO5Ready = positionAtInstant(rollContestGeometry, tD3ArriveHelp, tO5Ready);
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

  // Opción 3: pase directo de O1 a O3 en la esquina, solo cuando la opción
  // 2 no estuvo disponible (bloqueo bien defendido: `screenDelay < 0.2`).
  // Con la opción 2 disponible, la esquina se lee después de que O5 reciba
  // (arriba), no antes.
  if (scenario.d3HelpsRoller) {
    const tPassArrivalO3 =
      tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, WEAK_CORNER_SPOT);
    const tPrepReady = tPassArrivalO3 + CATCH_AND_SHOOT_PREP_SECONDS;
    const tCloseoutArrival = tD4ArriveAtCorner;
    const margin = tCloseoutArrival - tPrepReady;
    const d4CornerGeometry: ContestGeometry = {
      originPos: d4RepairOrigin,
      destinationPos: WEAK_CORNER_SPOT,
      speedMps: d4RepairSpeed,
      brakingExtraSeconds: d4BrakingExtra,
    };

    // El escenario de closeout tardío carga el estado con O3 ya disponible
    // (prompt §4): la condición de ventana no se exige de nuevo, la
    // legalidad real del cierre se sigue decidiendo por hechos en el tiro.
    if (margin >= 0.25 || scenario.startsWithHelpAlreadyCommitted) {
      const passOutcome = resolvePass(o1.attributes.T09, o3.attributes.T11, true, d4.attributes.T17, 1, ctx.rng);
      event(ctx, tPassArrivalO3, "ejecutado", "pass_released", ["O1", "O3"], "O1 encuentra a O3 en la esquina débil.");

      if (passOutcome.kind === "deflected_loose_ball") {
        return resolveLooseBallAfterPass(ctx, tPassArrivalO3, "O1", "D4");
      }

      const readyDelay = passOutcome.kind === "awkward_control" ? passOutcome.extraDelaySeconds : 0;
      event(ctx, tPassArrivalO3, "concedido", "pass_received", ["O3"], "O3 recibe en la esquina con ventana abierta.");

      return resolveShotAttempt(ctx, {
        shooterId: "O3",
        shooterSkill: o3.attributes.T04,
        shotType: "three_point",
        shooterPos: WEAK_CORNER_SPOT,
        tReady: tPrepReady + readyDelay,
        prepSeconds: CATCH_AND_SHOOT_PREP_SECONDS + readyDelay,
        contesterId: "D4",
        contesterArrival: tCloseoutArrival,
        contesterGeometry: d4CornerGeometry,
      });
    }
  }

  // Opción 4: triple de O1 si está detrás de la línea, ventana >=0.25s y T04>=9.
  const behindLine = isBehindThreePointLine(ctx.positions.O1!);
  const tShotReadyO1 = tDecision + movingShotPrepSeconds(o1.attributes.T06);
  // T22 (defensa perimetral): D5 cierra sobre una amenaza exterior (triple de O1).
  const d5RawContestTime = d5RawTimeToHoop;
  const tD5Contest = Math.max(0, tDecision + d5RawContestTime - perimeterArrivalAdjustmentSeconds(d5.attributes.T22));
  const windowD5 = tD5Contest - tShotReadyO1;

  if (behindLine && windowD5 >= 0.25 && o1.attributes.T04 >= 9) {
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

  // Opción 5: salida segura a O4/O2. Control conservado, sin tiro forzado.
  const outletTarget = distanceSeconds(ctx.positions.O1!, ctx.positions.O4!) <
    distanceSeconds(ctx.positions.O1!, ctx.positions.O2!)
    ? "O4"
    : "O2";
  const tOutlet = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, ctx.positions[outletTarget]!);
  event(
    ctx,
    tOutlet,
    "concedido",
    "possession_continues",
    ["O1", outletTarget],
    `O1 elige la salida segura hacia ${outletTarget}; el ataque conserva el control y se reorganiza.`,
  );

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

  // --- Pantalla: D1 sigue navegando, igual que en drop -------------------
  const tScreenSet = SCREEN_SET_AFTER_ARRIVAL_SECONDS;
  const tHandlerArrival = timeToReach(ctx.positions.O1!, screenPoint, attackerMoveSpeedMps(o1.attributes.F01));
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
    const isStripped = resolvesTurnoverUnderPressure(o1.attributes.T07, worstT15, ctx.rng);
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

  const contesterPosAtReady = positionAtInstant(args.contesterGeometry, args.contesterArrival, args.tReady);
  const bodyOverlap = distance(contesterPosAtReady, args.shooterPos) <= COMBINED_CONTACT_RADIUS_METERS;
  const arrivalMargin = args.contesterArrival - args.tReady;
  const legality = bodyOverlap
    ? evaluateCloseoutLegality(arrivalMargin, args.contesterGeometry.brakingExtraSeconds)
    : "no_contest";

  const opposition: EffectiveOpposition =
    legality === "legal_contest" ? 1 : legality === "late_illegal_contact" ? 0.5 : 0;

  const shooterJump = jumpCeilingMeters(shooter.attributes.F06);
  const contesterJump = jumpCeilingMeters(contester.attributes.F06);
  const releaseHeight = shotReleaseHeightMeters(
    shooter.measures.heightCm,
    shooter.measures.standingReachCm,
    shooterJump,
  );
  const maxTouch = maxTouchHeightMeters(contester.measures.standingReachCm, contesterJump);
  const shotTouchable = maxTouch >= releaseHeight;
  const blockEligible = legality === "legal_contest" && shotTouchable;

  event(
    ctx,
    args.tReady,
    "intentado",
    "shot_prepared",
    [args.shooterId],
    `${args.shooterId} prepara un lanzamiento de ${args.shotType === "three_point" ? "tres" : "dos"} puntos.`,
  );

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
}

function buildReboundCandidates(
  ctx: CoreContext,
  landingPoint: Point2D,
  closedOutPlayerId: string,
  atSeconds?: number,
): ReboundCandidate[] {
  // Modo enlazado: posiciones reales en el instante del fallo y sin los
  // atacantes que ya retornan por su encargo de balance.
  const ids = ctx.linked
    ? Object.keys(ctx.positions).filter((id) => !ctx.linked!.balancers.has(id))
    : Object.keys(ctx.positions);
  return ids.map((id) => {
    const profile = player(ctx, id);
    const from = ctx.linked && atSeconds !== undefined ? historyPositionAt(ctx, id, atSeconds) : ctx.positions[id]!;
    const arrival = timeToReach(from, landingPoint, REBOUND_CANDIDATE_SPEED_MPS);
    return {
      playerId: id,
      arrivalTimeSeconds: arrival,
      closedOut: id === closedOutPlayerId,
      t19: profile.attributes.T19,
      f05: profile.attributes.F05,
      t20: profile.attributes.T20,
    };
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
}

/**
 * Resuelve el balón vivo tras un fallo que toca aro: reutilizada tanto por
 * un tiro de campo fallado como por el último libre fallado (HF-002 §2), sin
 * duplicar la lógica de disputa de rebote.
 */
function resolveLiveReboundAfterMiss(ctx: CoreContext, args: LiveReboundArgs): PossessionCoreResult {
  if (ctx.linked) return resolveLinkedRebound(ctx, args);
  const seed = seedReboundLanding(ATTACKED_HOOP, args.shotOrigin, args.shotType, ctx.rng);
  const candidates = buildReboundCandidates(ctx, seed.landingPoint, args.contesterId);
  const reboundOutcome = resolveRebound(seed, candidates, ctx.rng);

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
      isOffensive
        ? `${reboundOutcome.playerId} captura el rebote ofensivo y continúa la posesión.`
        : `${reboundOutcome.playerId} asegura el rebote defensivo.`,
    );
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
  event(ctx, args.atSeconds + 1, "concedido", "rebound_contested", [winner], `${winner} controla el balón dividido tras el palmeo.`);

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
  const candidates = buildReboundCandidates(ctx, seed.landingPoint, args.contesterId, args.atSeconds);
  const reboundOutcome = resolveRebound(seed, candidates, ctx.rng);

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
  const arrival = candidates.find((c) => c.playerId === winner)?.arrivalTimeSeconds ?? 0;
  const tControl = args.atSeconds + Math.max(1, arrival);
  setArrival(ctx, winner, tControl, seed.landingPoint, args.atSeconds);
  const offensive = isOffensivePlayer(winner);
  event(
    ctx,
    tControl,
    "concedido",
    reboundOutcome.kind === "secured" ? "rebound_secured" : "rebound_contested",
    [winner],
    reboundOutcome.kind === "secured"
      ? offensive
        ? `${winner} captura el rebote ofensivo (el tiro tocó aro).`
        : `${winner} asegura el rebote defensivo.`
      : `${winner} controla el balón dividido tras el palmeo${offensive ? " (rebote ofensivo)" : " (rebote defensivo)"}.`,
    { offensive, touchedRim: true, landingPoint: seed.landingPoint },
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
  if (legality === "sin_contacto" || contactSeconds === null) return null;

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
  return finalize(
    ctx,
    { kind: "non_shooting_foul", foulerId: c.defenderSlot, fouledId: c.attackerSlot },
    { status: "dead", holderId: null, position: attackerPos },
  );
}
