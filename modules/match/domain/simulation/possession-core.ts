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
import { timeToReach } from "../geometry/point";
import { ATTACKED_HOOP, FREE_THROW_LINE_SPOT, isBehindThreePointLine } from "../geometry/court";
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
import type { TerminalOutcome, BallState } from "./match-state";
import type { FactPhase, FactKind } from "./fact";
import { resolvePass } from "./resolvers/pass-resolver";
import { resolveShot, type ShotType } from "./resolvers/shot-resolver";
import { seedReboundLanding, resolveRebound, type ReboundCandidate, type ReboundOutcome } from "./resolvers/rebound-resolver";
import { resolvesTurnoverUnderPressure } from "./resolvers/turnover-resolver";
import { evaluateCloseoutLegality, awardFreeThrowsForShootingFoul } from "./resolvers/foul-resolver";

const HELP_SPOT: Point2D = { x: 24.6, y: 9.3 };
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
const REBOUND_CANDIDATE_SPEED_MPS = 3.2;

export interface RawEvent {
  sequence: number;
  readonly atMs: Milliseconds;
  readonly phase: FactPhase;
  readonly kind: FactKind;
  readonly actors: readonly string[];
  readonly text: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface PositionHistoryEntry {
  readonly atMs: Milliseconds;
  readonly position: Point2D;
}

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
}

function player(ctx: CoreContext, id: string): PlayerProfile {
  return findPlayerInInput(ctx.input, id);
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
function setArrival(ctx: CoreContext, playerId: string, arrivalAtSeconds: number, position: Point2D): void {
  ctx.positions[playerId] = position;
  if (ctx.positionHistory) {
    (ctx.positionHistory[playerId] ??= []).push({ atMs: secondsToMs(arrivalAtSeconds), position });
  }
}

function distanceSeconds(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y) / PASS_FLIGHT_SPEED_MPS;
}

function isOffensivePlayer(playerId: string): boolean {
  return playerId.startsWith("O");
}

function finalize(ctx: CoreContext, outcome: TerminalOutcome, ball: BallState): PossessionCoreResult {
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
  const rng = createSeededRandom(input.seed);
  const scenario = getScenario(input.scenarioId);
  const trackPositionHistory = options.trackPositionHistory ?? false;

  const positions: Record<string, Point2D> = {};
  const positionHistory: Record<string, PositionHistoryEntry[]> | null = trackPositionHistory ? {} : null;

  for (const slot of [...scenario.offense, ...scenario.defense]) {
    positions[slot.playerId] = slot.initialPosition;
    if (positionHistory) {
      positionHistory[slot.playerId] = [{ atMs: 0, position: slot.initialPosition }];
    }
  }

  const ctx: CoreContext = {
    input,
    rng,
    timeline: [],
    sequence: 0,
    positions,
    positionHistory,
    gameClockMs: scenario.initialGameClockMs,
    shotClockMs: scenario.initialShotClockMs,
    possessionPhase: 0,
  };

  return runPhase(ctx, scenario);
}

function runPhase(ctx: CoreContext, scenario: ScenarioDefinition): PossessionCoreResult {
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

  const continuationShift = screenCoordinationShiftSeconds(o5.attributes.M04);
  const tRollReady = Math.max(0.05, tUseScreen - continuationShift);

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

  if (scenario.d3HelpsRoller) {
    const d3StartPoint = scenario.startsWithHelpAlreadyCommitted ? HELP_SPOT : ctx.positions.D3!;
    const rawD3Arrival = scenario.startsWithHelpAlreadyCommitted
      ? 0.1
      : tHelpDecision + timeToReach(d3StartPoint, HELP_SPOT, defenderLateralSpeedMps(d3.attributes.F04));
    // T23 (defensa interior): D3 protege el espacio cercano al aro contra el
    // continuador; ajusta su llegada real a la ayuda (HF-002 §1.5).
    tD3ArriveHelp = Math.max(0, rawD3Arrival - interiorArrivalAdjustmentSeconds(d3.attributes.T23));
    setArrival(ctx, "D3", tD3ArriveHelp, HELP_SPOT);
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
    tD4RepairStart = tD3ArriveHelp + recognitionLatencySeconds(d4.attributes.M01, d4.attributes.M05);
    const rawD4Arrival =
      tD4RepairStart + timeToReach(d4OriginalPos, WEAK_CORNER_SPOT, defenderLateralSpeedMps(d4.attributes.F04));
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
    setArrival(ctx, "D4", tD4ArriveAtCorner, WEAK_CORNER_SPOT);
  }

  // --- Árbol de decisión de O1 --------------------------------------------
  const tDecision = tUseScreen + recognitionLatencySeconds(o1.attributes.M01, o1.attributes.M05);
  const preferSecondOption =
    o1.pnrTendency === "explorar_segunda_opcion" && ctx.rng.next() < secondOptionProbability(o1.attributes.M03);

  const shotClockRemainingSeconds = ctx.shotClockMs / 1000 - tDecision;
  if (shotClockRemainingSeconds <= 0) {
    return finalize(ctx, { kind: "shot_clock_violation" }, { status: "held", holderId: "O1", position: ctx.positions.O1! });
  }

  // Opción 1: finalizar si O1 ya tiene carril al aro antes de D5.
  const o1TimeToHoop = timeToReach(ctx.positions.O1!, ATTACKED_HOOP, attackerMoveSpeedMps(o1.attributes.F01));
  // T23 (defensa interior): D5 protege el aro contra la finalización directa.
  const d5RawTimeToHoop = timeToReach(ctx.positions.D5!, ATTACKED_HOOP, defenderLateralSpeedMps(d5.attributes.F04));
  const d5TimeToHoop = Math.max(0, d5RawTimeToHoop - interiorArrivalAdjustmentSeconds(d5.attributes.T23));
  const option1Available = o1TimeToHoop < d5TimeToHoop && !preferSecondOption;

  if (option1Available && shotClockRemainingSeconds > 2) {
    return resolveShotAttempt(ctx, {
      shooterId: "O1",
      shooterSkill: o1.attributes.T01,
      shotType: "close_finish",
      tReady: tDecision + o1TimeToHoop + CLOSE_FINISH_PREP_SECONDS,
      contesterId: "D5",
      contesterArrival: tDecision + d5TimeToHoop,
    });
  }

  // Opción 2: pasar a O5 si gana al perseguidor >=0.2s, hay línea y D3 no anuló.
  const rollDenied = scenario.d3HelpsRoller && tD3ArriveHelp <= tDecision;
  const option2Available = screenDelay >= 0.2 && !rollDenied;

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

    event(ctx, tPassArrival, "concedido", "pass_received", ["O5"], "O5 recibe el balón en el roll.");

    return resolveShotAttempt(ctx, {
      shooterId: "O5",
      shooterSkill: o5.attributes.T01,
      shotType: "close_finish",
      tReady: tO5Ready,
      contesterId,
      contesterArrival: tContestArrival,
    });
  }

  // Opción 3: si D3 dejó a O3, pasar a esa esquina si el margen >= 0.25 s.
  if (scenario.d3HelpsRoller) {
    const tPassArrivalO3 =
      tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, WEAK_CORNER_SPOT);
    const tPrepReady = tPassArrivalO3 + CATCH_AND_SHOOT_PREP_SECONDS;
    const tCloseoutArrival = tD4ArriveAtCorner;
    const margin = tCloseoutArrival - tPrepReady;

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
        tReady: tPrepReady + readyDelay,
        contesterId: "D4",
        contesterArrival: tCloseoutArrival,
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
      tReady: tShotReadyO1,
      contesterId: "D5",
      contesterArrival: tD5Contest,
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

interface ShotAttemptArgs {
  readonly shooterId: string;
  readonly shooterSkill: number;
  readonly shotType: ShotType;
  readonly tReady: number;
  readonly contesterId: string;
  readonly contesterArrival: number;
}

/**
 * Un lanzamiento es una única interacción (estudio §9.4): la legalidad del
 * cierre se decide primero por hecho de contacto y posición, y de ella
 * dependen la oposición efectiva y si cabe un tapón legal. No se sortean
 * tapón y falta como sucesos independientes sobre la misma contestación.
 * El tapón, además, solo es elegible si el defensor puede tocar físicamente
 * el punto de liberación del tiro (T18 no actúa si no llega a la altura,
 * HF-002 §1.5), usando las fórmulas verticales ya aprobadas de LAB-0.1.
 */
function resolveShotAttempt(ctx: CoreContext, args: ShotAttemptArgs): PossessionCoreResult {
  const shooter = player(ctx, args.shooterId);
  const contester = player(ctx, args.contesterId);

  const brakingExtra = closeoutBrakingExtraSeconds(contester.attributes.F03);
  const arrivalMargin = args.contesterArrival - args.tReady;
  const legality = evaluateCloseoutLegality(arrivalMargin, brakingExtra);

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
    event(ctx, args.tReady + 0.05, "concedido", "shot_blocked", [args.contesterId], `${args.contesterId} tapona el lanzamiento.`);
    return finalize(
      ctx,
      { kind: "blocked_shot_live_ball" },
      { status: "loose", holderId: null, position: ctx.positions[args.shooterId] ?? ATTACKED_HOOP },
    );
  }

  const isFoul = legality === "late_illegal_contact";

  if (isFoul) {
    return resolveShootingFoulSequence(ctx, {
      shooterId: args.shooterId,
      shotType: args.shotType,
      madeShot: shotOutcome.kind === "made",
      atSeconds: args.tReady + 0.05,
    });
  }

  if (shotOutcome.kind === "made") {
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

function buildReboundCandidates(
  ctx: CoreContext,
  landingPoint: Point2D,
  closedOutPlayerId: string,
): ReboundCandidate[] {
  return Object.keys(ctx.positions).map((id) => {
    const profile = player(ctx, id);
    const arrival = timeToReach(ctx.positions[id]!, landingPoint, REBOUND_CANDIDATE_SPEED_MPS);
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
  let best = tip.nearestPlayerId;
  let bestT20 = player(ctx, best).attributes.T20;
  for (const id of tip.contestPoolPlayerIds) {
    const t20 = player(ctx, id).attributes.T20;
    if (t20 > bestT20) {
      best = id;
      bestT20 = t20;
    }
  }
  return best;
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

  return resolveShotAttempt(ctx, {
    shooterId: playerId,
    shooterSkill: profile.attributes.T01,
    shotType: "close_finish",
    tReady: atSeconds + CLOSE_FINISH_PREP_SECONDS,
    contesterId: opposingContester,
    contesterArrival,
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
  const deflectionSpot = ctx.positions[defenderId] ?? ctx.positions[passerId]!;
  if (isSteal) {
    return finalize(ctx, { kind: "steal_by_defense" }, { status: "held", holderId: defenderId, position: deflectionSpot });
  }
  return finalize(ctx, { kind: "live_turnover" }, { status: "loose", holderId: null, position: deflectionSpot });
}

interface ShootingFoulArgs {
  readonly shooterId: string;
  readonly shotType: ShotType;
  readonly madeShot: boolean;
  readonly atSeconds: number;
}

/**
 * Ejecuta la falta ordinaria de tiro completa (HF-002 §1.6, §2): adjudica
 * primero la validez de la canasta, ejecuta cada libre con T05 y la misma
 * semilla de la posesión, y resuelve el balón vivo si el último libre falla
 * reutilizando la misma disputa de rebote que un tiro de campo.
 */
function resolveShootingFoulSequence(ctx: CoreContext, args: ShootingFoulArgs): PossessionCoreResult {
  const award = awardFreeThrowsForShootingFoul(args.shotType, args.madeShot);
  const shooter = player(ctx, args.shooterId);

  const basketPoints: 0 | 2 | 3 = args.madeShot ? (args.shotType === "three_point" ? 3 : 2) : 0;
  event(
    ctx,
    args.atSeconds,
    "concedido",
    "shooting_foul",
    [args.shooterId],
    `Falta ordinaria de tiro sobre ${args.shooterId}; se conceden ${award.count} libre(s).`,
    { madeShot: args.madeShot, freeThrows: award.count },
  );

  let t = args.atSeconds;
  let freeThrowsMade = 0;
  let lastMissed = false;

  for (let i = 0; i < award.count; i++) {
    t += FREE_THROW_PREP_SECONDS;
    const made = ctx.rng.next() < freeThrowProbability(shooter.attributes.T05);
    lastMissed = !made;
    if (made) freeThrowsMade += 1;
    event(
      ctx,
      t,
      "concedido",
      "free_throws_result",
      [args.shooterId],
      `${args.shooterId} ${made ? "anota" : "falla"} el libre ${i + 1} de ${award.count}.`,
      { made, index: i + 1, of: award.count },
    );
  }

  const pointsFromFreeThrows = freeThrowsMade;
  const totalPoints = basketPoints + pointsFromFreeThrows;

  if (award.count === 0 || !lastMissed) {
    return finalize(
      ctx,
      {
        kind: "shooting_foul",
        basketCounted: award.basketCounted,
        freeThrowsAwarded: award.count,
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
