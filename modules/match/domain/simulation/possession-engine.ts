/**
 * Motor detallado de una posesión de laboratorio (ME-01). Implementa
 * exactamente el árbol de decisión, las fórmulas LAB-0.1 y los estados
 * terminales legales descritos en el prompt ME-01 §2–§4.
 *
 * Simplificación técnica reversible y documentada: en vez de una malla de
 * navegación general, cada participante se desplaza en línea recta hacia el
 * punto objetivo de su responsabilidad en cada fase (permitido explícitamente
 * por el estudio de referencia §4.2: "no hace falta una malla compleja de
 * navegación para diez jugadores en una cancha pequeña"). El reloj interno
 * SÍ avanza en pasos ≤100 ms con cortes exactos de evento (§5.2), aunque las
 * llegadas se calculen de forma analítica por tramo.
 */
import type { Point2D } from "../geometry/point";
import { timeToReach } from "../geometry/point";
import { ATTACKED_HOOP, isBehindThreePointLine } from "../geometry/court";
import { createSeededRandom } from "../random/seeded-random";
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
  CATCH_AND_SHOOT_PREP_SECONDS,
  CLOSE_FINISH_PREP_SECONDS,
  SCREEN_SET_AFTER_ARRIVAL_SECONDS,
  PASS_RELEASE_SECONDS,
  PASS_FLIGHT_SPEED_MPS,
} from "../lab/lab-0-1-parameters";
import type { EffectiveOpposition } from "../lab/lab-0-1-parameters";
import type { MatchState, TerminalOutcome, OnCourtPlayerState } from "./match-state";
import { createFact, type Fact, type FactPhase, type FactKind, type PlayerSnapshot } from "./fact";
import { resolvePass } from "./resolvers/pass-resolver";
import { resolveShot, type ShotType } from "./resolvers/shot-resolver";
import { seedReboundLanding, resolveRebound, type ReboundCandidate } from "./resolvers/rebound-resolver";
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

interface RunContext {
  input: MatchInput;
  rng: ReturnType<typeof createSeededRandom>;
  facts: Fact[];
  sequence: number;
  positions: Record<string, Point2D>;
  gameClockMs: Milliseconds;
  shotClockMs: Milliseconds;
  possessionPhase: number;
}

function player(ctx: RunContext, id: string): PlayerProfile {
  return findPlayerInInput(ctx.input, id);
}

function snapshotAll(ctx: RunContext): PlayerSnapshot[] {
  return Object.entries(ctx.positions).map(([playerId, position]) => ({ playerId, position }));
}

function emit(
  ctx: RunContext,
  atSeconds: number,
  phase: FactPhase,
  kind: FactKind,
  actors: readonly string[],
  text: string,
  detail: Record<string, unknown> = {},
): Fact {
  const fact = createFact(
    ctx.sequence++,
    secondsToMs(atSeconds),
    phase,
    kind,
    actors,
    text,
    snapshotAll(ctx),
    detail,
  );
  ctx.facts.push(fact);
  return fact;
}

/**
 * Distintas responsabilidades (pantalla, ayuda, lectura del balón) se
 * calculan como líneas de tiempo independientes y se registran en el orden
 * en que el código las resuelve. Antes de presentar el relato se ordenan
 * por instante real (y por orden de cálculo como desempate), para que la
 * secuencia mostrada a Dennis sea siempre cronológica.
 */
function finalizeTerminal(ctx: RunContext, outcome: TerminalOutcome): MatchState {
  const orderedFacts = [...ctx.facts]
    .sort((a, b) => a.atMs - b.atMs || a.sequence - b.sequence)
    .map((fact, index) => ({ ...fact, sequence: index }));

  return {
    input: ctx.input,
    clockMs: orderedFacts.length > 0 ? orderedFacts[orderedFacts.length - 1]!.atMs : 0,
    gameClockMs: ctx.gameClockMs,
    shotClockMs: ctx.shotClockMs,
    players: Object.fromEntries(
      Object.entries(ctx.positions).map(([id, position]) => [id, { playerId: id, position }]),
    ) as Record<string, OnCourtPlayerState>,
    ball: { status: "dead", holderId: null, position: ATTACKED_HOOP },
    facts: orderedFacts,
    terminal: outcome,
    possessionPhase: ctx.possessionPhase,
  };
}

/**
 * Ejecuta la posesión completa de forma determinista y devuelve el estado
 * terminal con el relato completo de hechos. Misma entrada (perfiles,
 * escenario y semilla) produce siempre la misma secuencia (invariante 2).
 */
export function runPossession(input: MatchInput): MatchState {
  const rng = createSeededRandom(input.seed);
  const scenarioModule = getScenario(input.scenarioId);

  const positions: Record<string, Point2D> = {};
  for (const slot of [...scenarioModule.offense, ...scenarioModule.defense]) {
    positions[slot.playerId] = slot.initialPosition;
  }

  const ctx: RunContext = {
    input,
    rng,
    facts: [],
    sequence: 0,
    positions,
    gameClockMs: scenarioModule.initialGameClockMs,
    shotClockMs: scenarioModule.initialShotClockMs,
    possessionPhase: 0,
  };

  return runPhase(ctx, scenarioModule);
}

function runPhase(ctx: RunContext, scenario: ScenarioDefinition): MatchState {
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
  emit(ctx, tScreenSet, "ejecutado", "screen_set", ["O5"], "O5 llega y coloca su pantalla central.");

  const weightDiff = o5.measures.weightKg - d1.measures.weightKg;
  const screenDelay =
    screenInterceptDelaySeconds(o5.attributes.T13, o5.attributes.F05, d1.attributes.T16) +
    screenContactAdjustmentSeconds(weightDiff);
  emit(
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

  // --- Ayuda de D3 --------------------------------------------------------
  let tD3ArriveHelp = Infinity;
  let tD4RepairStart = Infinity;
  let tD4ArriveAtCorner = Infinity;
  const tHelpDecision = scenario.startsWithHelpAlreadyCommitted
    ? 0
    : tUseScreen + recognitionLatencySeconds(d3.attributes.M01, d3.attributes.M05);

  emit(
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
    tD3ArriveHelp = scenario.startsWithHelpAlreadyCommitted
      ? 0.1
      : tHelpDecision + timeToReach(d3StartPoint, HELP_SPOT, defenderLateralSpeedMps(d3.attributes.F04));
    ctx.positions.D3 = HELP_SPOT;
    emit(
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
    tD4ArriveAtCorner =
      tD4RepairStart + timeToReach(d4OriginalPos, WEAK_CORNER_SPOT, defenderLateralSpeedMps(d4.attributes.F04));
    ctx.positions.D4 = WEAK_CORNER_SPOT;
    emit(
      ctx,
      tD4RepairStart,
      "concedido",
      "help_repair_attempt",
      ["D4", "O4"],
      "D4 intenta reparar hacia la esquina débil y deja libre a O4.",
      { arrivesAt: tD4ArriveAtCorner },
    );
  }

  // --- Árbol de decisión de O1 --------------------------------------------
  const tDecision = tUseScreen + recognitionLatencySeconds(o1.attributes.M01, o1.attributes.M05);
  const preferSecondOption =
    o1.pnrTendency === "explorar_segunda_opcion" && ctx.rng.next() < secondOptionProbability(o1.attributes.M03);

  const shotClockRemainingSeconds = ctx.shotClockMs / 1000 - tDecision;
  if (shotClockRemainingSeconds <= 0) {
    return finalizeTerminal(ctx, { kind: "shot_clock_violation" });
  }

  // Opción 1: finalizar si O1 ya tiene carril al aro antes de D5.
  const o1TimeToHoop = timeToReach(ctx.positions.O1!, ATTACKED_HOOP, attackerMoveSpeedMps(o1.attributes.F01));
  const d5TimeToHoop = timeToReach(ctx.positions.D5!, ATTACKED_HOOP, defenderLateralSpeedMps(d5.attributes.F04));
  const option1Available = o1TimeToHoop < d5TimeToHoop && !preferSecondOption;

  if (option1Available && shotClockRemainingSeconds > 2) {
    return resolveShotAttempt(ctx, {
      shooterId: "O1",
      shooterSkill: o1.attributes.T01,
      shotType: "close_finish",
      tReady: tDecision + o1TimeToHoop + CLOSE_FINISH_PREP_SECONDS,
      contesterId: "D5",
      contesterArrival: tDecision + d5TimeToHoop,
      contesterT18: d5.attributes.T18,
      contesterF03: d5.attributes.F03,
      lateCloseoutScenario: scenario.startsWithHelpAlreadyCommitted,
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
    emit(ctx, tPassArrival, "ejecutado", "pass_released", ["O1", "O5"], "O1 pasa al continuador O5.");

    if (passOutcome.kind === "deflected_loose_ball") {
      return resolveLooseBallAfterPass(ctx, tPassArrival, "O1", "D1");
    }

    const readyDelay = passOutcome.kind === "awkward_control" ? passOutcome.extraDelaySeconds : 0;
    const tO5Ready = tPassArrival + readyDelay + CLOSE_FINISH_PREP_SECONDS;
    const contesterId = scenario.d3HelpsRoller ? "D3" : "D5";
    const contester = scenario.d3HelpsRoller ? d3 : d5;
    const tContestArrival = scenario.d3HelpsRoller ? tD3ArriveHelp : tDecision + d5TimeToHoop;

    emit(ctx, tPassArrival, "concedido", "pass_received", ["O5"], "O5 recibe el balón en el roll.");

    return resolveShotAttempt(ctx, {
      shooterId: "O5",
      shooterSkill: o5.attributes.T01,
      shotType: "close_finish",
      tReady: tO5Ready,
      contesterId,
      contesterArrival: tContestArrival,
      contesterT18: contester.attributes.T18,
      contesterF03: contester.attributes.F03,
      lateCloseoutScenario: scenario.startsWithHelpAlreadyCommitted,
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
      emit(ctx, tPassArrivalO3, "ejecutado", "pass_released", ["O1", "O3"], "O1 encuentra a O3 en la esquina débil.");

      if (passOutcome.kind === "deflected_loose_ball") {
        return resolveLooseBallAfterPass(ctx, tPassArrivalO3, "O1", "D4");
      }

      const readyDelay = passOutcome.kind === "awkward_control" ? passOutcome.extraDelaySeconds : 0;
      emit(ctx, tPassArrivalO3, "concedido", "pass_received", ["O3"], "O3 recibe en la esquina con ventana abierta.");

      return resolveShotAttempt(ctx, {
        shooterId: "O3",
        shooterSkill: o3.attributes.T04,
        shotType: "three_point",
        tReady: tPrepReady + readyDelay,
        contesterId: "D4",
        contesterArrival: tCloseoutArrival,
        contesterT18: d4.attributes.T18,
        contesterF03: d4.attributes.F03,
        lateCloseoutScenario: scenario.startsWithHelpAlreadyCommitted,
      });
    }
  }

  // Opción 4: triple de O1 si está detrás de la línea, ventana >=0.25s y T04>=9.
  const behindLine = isBehindThreePointLine(ctx.positions.O1!);
  const tShotReadyO1 = tDecision + movingShotPrepSeconds(o1.attributes.T06);
  const tD5Contest = tDecision + d5TimeToHoop;
  const windowD5 = tD5Contest - tShotReadyO1;

  if (behindLine && windowD5 >= 0.25 && o1.attributes.T04 >= 9) {
    return resolveShotAttempt(ctx, {
      shooterId: "O1",
      shooterSkill: o1.attributes.T04,
      shotType: "three_point",
      tReady: tShotReadyO1,
      contesterId: "D5",
      contesterArrival: tD5Contest,
      contesterT18: d5.attributes.T18,
      contesterF03: d5.attributes.F03,
      lateCloseoutScenario: false,
    });
  }

  // Opción 5: salida segura a O4/O2. Control conservado, sin tiro forzado.
  const outletTarget = distanceSeconds(ctx.positions.O1!, ctx.positions.O4!) <
    distanceSeconds(ctx.positions.O1!, ctx.positions.O2!)
    ? "O4"
    : "O2";
  const tOutlet = tDecision + PASS_RELEASE_SECONDS + distanceSeconds(ctx.positions.O1!, ctx.positions[outletTarget]!);
  emit(
    ctx,
    tOutlet,
    "concedido",
    "possession_continues",
    ["O1", outletTarget],
    `O1 elige la salida segura hacia ${outletTarget}; el ataque conserva el control y se reorganiza.`,
  );

  return finalizeTerminal(ctx, {
    kind: "possession_reorganized_control_kept",
    outletPlayerId: outletTarget,
  });
}

function distanceSeconds(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y) / PASS_FLIGHT_SPEED_MPS;
}

interface ShotAttemptArgs {
  readonly shooterId: string;
  readonly shooterSkill: number;
  readonly shotType: ShotType;
  readonly tReady: number;
  readonly contesterId: string;
  readonly contesterArrival: number;
  readonly contesterT18: number;
  readonly contesterF03: number;
  readonly lateCloseoutScenario: boolean;
}

/**
 * Un lanzamiento es una única interacción (estudio §9.4): la legalidad del
 * cierre se decide primero por hecho de contacto y posición, y de ella
 * dependen la oposición efectiva y si cabe un tapón legal. No se sortean
 * tapón y falta como sucesos independientes sobre la misma contestación.
 */
function resolveShotAttempt(ctx: RunContext, args: ShotAttemptArgs): MatchState {
  const brakingExtra = closeoutBrakingExtraSeconds(args.contesterF03);
  const arrivalMargin = args.contesterArrival - args.tReady;
  const legality = evaluateCloseoutLegality(arrivalMargin, brakingExtra);

  const opposition: EffectiveOpposition =
    legality === "legal_contest" ? 1 : legality === "late_illegal_contact" ? 0.5 : 0;
  const blockEligible = legality === "legal_contest";

  emit(
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
      blockerT18: args.contesterT18,
    },
    ctx.rng,
  );

  if (shotOutcome.kind === "blocked") {
    emit(ctx, args.tReady + 0.05, "concedido", "shot_blocked", [args.contesterId], `${args.contesterId} tapona el lanzamiento.`);
    return finalizeTerminal(ctx, { kind: "blocked_shot_live_ball" });
  }

  const isFoul = legality === "late_illegal_contact";

  if (isFoul) {
    const award = awardFreeThrowsForShootingFoul(args.shotType, shotOutcome.kind === "made");
    emit(
      ctx,
      args.tReady + 0.05,
      "concedido",
      "shooting_foul",
      [args.contesterId, args.shooterId],
      `Falta ordinaria de tiro de ${args.contesterId} sobre ${args.shooterId}.`,
      { madeShot: shotOutcome.kind === "made", freeThrows: award.count },
    );
    return finalizeTerminal(ctx, {
      kind: "shooting_foul",
      basketCounted: award.basketCounted,
      freeThrowsAwarded: award.count,
    });
  }

  if (shotOutcome.kind === "made") {
    emit(
      ctx,
      args.tReady + 0.05,
      "concedido",
      "shot_result",
      [args.shooterId],
      `${args.shooterId} anota ${shotOutcome.points} puntos.`,
    );
    return finalizeTerminal(ctx, { kind: "made_basket", points: shotOutcome.points, andOnePending: false });
  }

  // Fallo que toca aro: generar rebote.
  const shotOrigin = ctx.positions[args.shooterId]!;
  const seed = seedReboundLanding(ATTACKED_HOOP, shotOrigin, args.shotType, ctx.rng);
  emit(ctx, args.tReady + 0.05, "concedido", "rebound_seeded", [args.shooterId], "El tiro falla y toca aro; el balón sale suelto.");

  const candidates: ReboundCandidate[] = Object.keys(ctx.positions).map((id) => {
    const profile = player(ctx, id);
    const arrival = timeToReach(ctx.positions[id]!, seed.landingPoint, 3.2);
    return {
      playerId: id,
      arrivalTimeSeconds: arrival,
      closedOut: id === args.contesterId,
      t19: profile.attributes.T19,
      f05: profile.attributes.F05,
      t20: profile.attributes.T20,
    };
  });

  const reboundOutcome = resolveRebound(seed, candidates, ctx.rng);

  if (reboundOutcome.kind === "out_of_bounds") {
    return finalizeTerminal(ctx, { kind: "out_of_bounds", lastTouchPlayerId: args.shooterId });
  }

  const isOffensive = reboundOutcome.kind === "secured" && isOffensivePlayer(reboundOutcome.playerId);

  if (reboundOutcome.kind === "secured" && !isOffensive) {
    emit(ctx, args.tReady + 1, "concedido", "rebound_secured", [reboundOutcome.playerId], `${reboundOutcome.playerId} asegura el rebote defensivo.`);
    return finalizeTerminal(ctx, { kind: "missed_shot_defensive_rebound" });
  }

  if (reboundOutcome.kind === "secured" && isOffensive) {
    emit(ctx, args.tReady + 1, "concedido", "rebound_secured", [reboundOutcome.playerId], `${reboundOutcome.playerId} captura el rebote ofensivo y continúa la posesión.`);
    ctx.possessionPhase += 1;
    return resolveOffensiveReboundContinuation(ctx, reboundOutcome.playerId, args.tReady + 1);
  }

  // loose_ball_tip: un guardián de progreso evita bucles; se resuelve por T20.
  const winner = candidates.reduce((best, c) => (c.t20 > best.t20 ? c : best), candidates[0]!);
  emit(ctx, args.tReady + 1, "concedido", "rebound_contested", [winner.playerId], `${winner.playerId} controla el balón dividido tras el palmeo.`);

  if (isOffensivePlayer(winner.playerId)) {
    ctx.possessionPhase += 1;
    return resolveOffensiveReboundContinuation(ctx, winner.playerId, args.tReady + 1);
  }
  return finalizeTerminal(ctx, { kind: "missed_shot_defensive_rebound" });
}

function isOffensivePlayer(playerId: string): boolean {
  return playerId.startsWith("O");
}

function resolveOffensiveReboundContinuation(ctx: RunContext, playerId: string, atSeconds: number): MatchState {
  if (ctx.possessionPhase > MAX_PROGRESS_ITERATIONS) {
    return finalizeTerminal(ctx, {
      kind: "simulation_guard_stopped",
      reason: "Demasiadas fases de rebote ofensivo encadenadas.",
    });
  }

  const profile = player(ctx, playerId);
  const opposingContester = playerId === "O5" ? "D5" : "D1";
  const contester = player(ctx, opposingContester);

  return resolveShotAttempt(ctx, {
    shooterId: playerId,
    shooterSkill: profile.attributes.T01,
    shotType: "close_finish",
    tReady: atSeconds + CLOSE_FINISH_PREP_SECONDS,
    contesterId: opposingContester,
    contesterArrival: atSeconds,
    contesterT18: contester.attributes.T18,
    contesterF03: contester.attributes.F03,
    lateCloseoutScenario: false,
  });
}

function resolveLooseBallAfterPass(
  ctx: RunContext,
  atSeconds: number,
  passerId: string,
  defenderId: string,
): MatchState {
  const passer = player(ctx, passerId);
  const defender = player(ctx, defenderId);
  const isSteal = resolvesTurnoverUnderPressure(passer.attributes.T07, defender.attributes.T15, ctx.rng);
  emit(
    ctx,
    atSeconds,
    "concedido",
    isSteal ? "turnover" : "pass_control_lost",
    [defenderId],
    isSteal
      ? `${defenderId} desvía el pase y recupera el control: pérdida en balón vivo.`
      : `${defenderId} desvía el pase; el balón queda suelto sin control claro.`,
  );
  return finalizeTerminal(ctx, isSteal ? { kind: "steal_by_defense" } : { kind: "live_turnover" });
}
