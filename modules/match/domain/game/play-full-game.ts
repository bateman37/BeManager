/**
 * Partido completo de laboratorio FIBA 2026 (ME-04, `PlayFullGame`). Una
 * sola llamada del dominio juega 4 × 10:00 y tantas prórrogas de 5:00 como
 * hagan falta, reutilizando **el mismo motor de continuidad** que el tramo
 * de ME-03 (`LinkedRun`): los diez jugadores en pista, el balón, los
 * relojes y el azar atraviesan todas las fronteras sin reiniciarse desde
 * el fixture. Este módulo añade solo lo propio de un partido, adjudicado
 * con las funciones puras de `fiba-2026-rules.ts`: salto inicial
 * `ME-04-JUMP-1`, flecha de alternancia, sentido por período, bocina,
 * reloj tras canasta, faltas personales y de equipo con bonus, exclusión
 * por cinco faltas, sustituciones en oportunidades legales (política
 * `ME-04-ROT-1`) y la segunda entrada del bloqueo directo.
 *
 * No hay bucle de microticks: el tiempo avanza de hecho en hecho. El
 * guardián detiene y explica una corrida anómala; nunca inventa un ganador
 * ni cierra un empate como final.
 */
import type { Point2D } from "../geometry/point";
import { distance } from "../geometry/point";
import {
  CENTER_LINE_THROW_IN_SPOT,
  isFrontcourtLocal,
  nearestLineThrowInSpot,
  toLocal,
  type AttackDirection,
} from "../geometry/frame";
import { truncateTrajectory } from "../geometry/trajectory";
import { secondsToMs, type Milliseconds } from "../time/clock";
import type { DefensiveCoverage } from "../lab/match-input";
import { PASS_FLIGHT_SPEED_MPS } from "../lab/lab-0-1-parameters";
import type { PlayerProfile } from "../players/player-profile";
import { FUNCTIONAL_ROLE_LABELS, type FunctionalRole } from "../players/functional-roles";
import type { LinkedGameRules } from "../simulation/possession-core";
import type { TerminalOutcome } from "../simulation/match-state";
import type { FactKind } from "../simulation/fact";
import { SHOT_CLOCK_FULL_MS } from "../sequence/fiba-clock-rules";
import {
  LinkedRun,
  DEFENSE_SLOTS,
  OFFENSE_SLOTS,
  rebindFrame,
  formatSeconds,
  type EmitArgs,
  type Frame,
  type LinkedLimits,
  type Step,
  type BallMark,
} from "../sequence/linked-run";
import type { PhaseEntry, PossessionRecord } from "../sequence/tramo-model";
import {
  FIBA_2026,
  adjudicateDefensiveFoul,
  adjudicateOpeningJump,
  adjudicatePeriodEnd,
  arrowAfterAlternatingThrowIn,
  attackDirectionForPeriod,
  gameClockStopsOnMadeBasket,
  initialArrowTeam,
  isOvertime,
  isReleasedBeforeBuzzer,
  periodDurationMs,
  periodLabel,
  shotClockAfterDefensiveFoulThrowIn,
  substitutionOpportunity,
  teamFoulPeriodKey,
  type DeadBallCause,
  type DefensiveFoulAdjudication,
  type DefensiveFoulType,
  type JumperFacts,
} from "./fiba-2026-rules";
import {
  CONTINUOUS_THRESHOLD_MS,
  VOLUNTARY_CAP_BETWEEN_PERIODS,
  VOLUNTARY_CAP_PER_STOPPAGE,
  planSubstitutions,
  type PlannedSubstitution,
} from "./substitution-policy";
import { projectBoxScore } from "./box-score";
import type {
  FoulRecord,
  GameInput,
  GameResult,
  GameStop,
  GameTeamInput,
  PeriodRecord,
  SubstitutionRecord,
} from "./game-model";

export const DEFAULT_GAME_LIMITS: LinkedLimits = { maxPhasesPerPossession: 12, maxSteps: 20_000, maxZeroTimeSteps: 6 };
/** Prórrogas encadenadas a partir de las cuales el guardián señala un bucle anómalo (nunca un final). */
export const DEFAULT_MAX_OVERTIMES = 12;

export interface PlayFullGameOptions {
  readonly limits?: Partial<LinkedLimits>;
  readonly maxOvertimes?: number;
}

/** Hechos de la resolución de un tiro ya soltado antes de la bocina que se registran después de ella. */
const SHOT_RESOLUTION_KINDS: ReadonlySet<FactKind> = new Set<FactKind>([
  "field_goal_attempt",
  "shot_result",
  "shot_blocked",
  "shooting_foul",
]);

/**
 * Disposición del salto inicial (ME-04-JUMP-1), coordenadas globales: los
 * saltadores en su mitad del círculo central; los demás fuera del círculo
 * (radio 1,8 m) a 2,4 m del centro, alternando equipos alrededor. Solo es
 * la colocación de partida; no decide nada del salto.
 */
const CENTER: Point2D = { x: 14, y: 7.5 };
function around(angleDeg: number, radius = 2.4): Point2D {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CENTER.x + radius * Math.cos(a), y: CENTER.y + radius * Math.sin(a) };
}
/** Por rol 1–5, para el equipo que ataca hacia x creciente y para el que ataca hacia x decreciente. */
const JUMP_LAYOUT: Readonly<Record<AttackDirection, readonly Point2D[]>> = {
  hacia_x_creciente: [around(180), around(0), around(90), around(270), { x: 13.6, y: 7.5 }],
  hacia_x_decreciente: [around(45), around(135), around(225), around(315), { x: 14.4, y: 7.5 }],
};

interface PlayerRunState {
  totalMs: Milliseconds;
  continuousMs: Milliseconds;
  fouls: number;
  disqualified: boolean;
  onCourt: boolean;
  /** Valor de `clockTicks` en el último cambio: bloqueado hasta que corra el reloj. */
  changedAtTick: number | null;
}

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

class GameRun extends LinkedRun {
  private readonly input: GameInput;
  private readonly rules = FIBA_2026;
  private readonly maxOvertimes: number;
  private readonly teamIds: readonly [string, string];
  private readonly teamInputs = new Map<string, GameTeamInput>();
  private readonly lineups = new Map<string, string[]>();
  private readonly players = new Map<string, PlayerRunState>();
  private readonly teamFouls = new Map<string, Map<number, number>>();
  private readonly periods: PeriodRecord[] = [];
  private readonly subs: SubstitutionRecord[] = [];
  private readonly fouls: FoulRecord[] = [];

  private period = 1;
  private arrowTeamId: string | null = null;
  private alternatingThrowInPending = false;
  private scheduled: Step | null = null;
  private periodOver = false;
  private buzzerMs: Milliseconds | null = null;
  /** Instante de salida del tiro del tramo de cálculo en curso cuya resolución aún se está relatando. */
  private shotReleaseMs: Milliseconds | null = null;
  /** Ese tiro ya dejó constancia de su resolución (FGA, tapón o falta). */
  private shotResolved = false;
  private freeThrowsAfterBuzzer = false;
  private lastStoppage: DeadBallCause | null = null;
  private currentSetKind: "central" | "segunda" = "central";
  private clockTicks = 0;
  private playedMs: Milliseconds = 0;
  private winnerTeamId: string | null = null;
  private betweenPossessions = true;

  constructor(input: GameInput, options: PlayFullGameOptions) {
    super({
      seed: input.seed,
      rulesetVersion: input.rulesetVersion,
      labParametersVersion: input.labParametersVersion,
      dispositionScenarioId: "drop_con_ayuda",
      teams: [
        { id: input.teams[0].id, name: input.teams[0].name, priority: input.teams[0].priority },
        { id: input.teams[1].id, name: input.teams[1].name, priority: input.teams[1].priority },
      ],
      roster: input.teams.flatMap((t) => t.roster.map((profile) => ({ teamId: t.id, profile }))),
      limits: { ...DEFAULT_GAME_LIMITS, ...options.limits },
    });
    this.input = input;
    this.maxOvertimes = options.maxOvertimes ?? DEFAULT_MAX_OVERTIMES;
    this.teamIds = [input.teams[0].id, input.teams[1].id];
    for (const team of input.teams) {
      this.teamInputs.set(team.id, team);
      this.lineups.set(team.id, [...team.starters]);
      this.teamFouls.set(team.id, new Map());
      for (const p of team.roster) {
        this.players.set(p.id, {
          totalMs: 0,
          continuousMs: 0,
          fouls: 0,
          disqualified: false,
          onCourt: team.starters.includes(p.id),
          changedAtTick: null,
        });
      }
    }
  }

  // --- ganchos del motor compartido ------------------------------------------

  protected lineup(teamId: string): readonly PlayerProfile[] {
    return this.lineups.get(teamId)!.map((id) => this.profile(id));
  }

  protected attackDirection(teamId: string): AttackDirection {
    return attackDirectionForPeriod(this.rules, teamId === this.teamIds[0] ? 0 : 1, this.period);
  }

  protected coverageWhenDefending(teamId: string): DefensiveCoverage {
    return this.teamInputs.get(teamId)!.coverage;
  }

  protected coreRules(): LinkedGameRules {
    // Una sola segunda entrada por acción: la segunda entrada no abre una tercera.
    return { deferFreeThrows: true, ordinaryFouls: true, secondEntryAllowed: this.currentSetKind === "central" };
  }

  protected madeBasketStopsGameClock(): boolean {
    return gameClockStopsOnMadeBasket(this.rules, this.period, this.game.ms);
  }

  protected onClockRan(deltaMs: Milliseconds): void {
    this.clockTicks += 1;
    this.playedMs += deltaMs;
    for (const id of this.onCourtIds()) {
      const st = this.players.get(id)!;
      st.totalMs += deltaMs;
      st.continuousMs += deltaMs;
    }
  }

  protected currentPeriod(): number {
    return this.period;
  }

  protected onCourtIds(): readonly string[] {
    return [...this.lineups.get(this.teamIds[0])!, ...this.lineups.get(this.teamIds[1])!].sort();
  }

  protected possessionRef(): PossessionRecord | null {
    // Entre el cierre por fin de período y el siguiente saque, los hechos no pertenecen a ninguna posesión.
    if (this.betweenPossessions) return null;
    return this.possessions[this.possessions.length - 1] ?? null;
  }

  protected stopEventKind(): FactKind {
    return "game_ended";
  }

  protected runLabel(): string {
    return "el partido";
  }

  protected takeScheduledStep(): Step | null {
    const next = this.scheduled;
    this.scheduled = null;
    return next;
  }

  protected onGameClockExpired(e: EmitArgs, expiryMs: Milliseconds): boolean {
    if (!this.periodOver) this.signalBuzzer(expiryMs);
    // Un tiro soltado antes de la bocina termina de resolverse (puede contar); nada más empieza tras 0:00.
    if (this.shotReleaseMs !== null && isReleasedBeforeBuzzer(this.shotReleaseMs, this.buzzerMs!) && SHOT_RESOLUTION_KINDS.has(e.kind)) {
      return true;
    }
    return this.freeThrowsAfterBuzzer && e.kind === "free_throws_result";
  }

  protected emit(e: EmitArgs): boolean {
    const ok = super.emit(e);
    if (!ok) return false;
    if (e.kind === "shot_prepared") {
      this.shotReleaseMs = e.atMs;
      this.shotResolved = false;
    } else if (SHOT_RESOLUTION_KINDS.has(e.kind)) {
      this.shotResolved = true;
    } else if (e.kind !== "rebound_duties_assigned") {
      // Cualquier otro hecho (rebote, balón suelto, saque…) cierra la resolución de ese tiro.
      this.shotReleaseMs = null;
    }
    switch (e.kind) {
      case "shot_result":
        this.lastStoppage = "canasta";
        break;
      case "free_throws_result":
        if (e.detail?.index === e.detail?.of && e.detail?.made === true) this.lastStoppage = "libre_anotado";
        break;
      case "out_of_bounds":
        this.lastStoppage = "fuera";
        break;
      case "shot_clock_violation":
      case "backcourt_violation":
      case "throw_in_violation":
        this.lastStoppage = "violacion";
        break;
      case "shooting_foul":
      case "non_shooting_foul":
        this.lastStoppage = "falta";
        break;
      default:
        break;
    }
    return true;
  }

  protected openPossession(teamId: string, atMs: Milliseconds, kind: PossessionRecord["phases"][number]["kind"], reason: string): boolean {
    if (this.periodOver) return false;
    this.betweenPossessions = false;
    return super.openPossession(teamId, atMs, kind, reason);
  }

  protected closePossession(atMs: Milliseconds, reason: string): boolean {
    if (this.periodOver) return false;
    return super.closePossession(atMs, reason);
  }

  protected newPhase(atMs: Milliseconds, kind: PossessionRecord["phases"][number]["kind"], text: string): boolean {
    if (this.periodOver) return false;
    return super.newPhase(atMs, kind, text);
  }

  protected onThrowInEnded(teamId: string, legal: boolean): void {
    if (!this.alternatingThrowInPending) return;
    this.alternatingThrowInPending = false;
    this.arrowTeamId = arrowAfterAlternatingThrowIn(teamId, this.teamIds);
    this.record({
      atMs: this.lastMs,
      phase: "concedido",
      kind: "alternating_arrow",
      actors: [],
      text: `${legal ? "El saque de alternancia termina legalmente" : "Violación en el saque de alternancia"}: la flecha pasa a ${this.team(this.arrowTeamId).name}.`,
      detail: { arrowTeamId: this.arrowTeamId, legal },
    });
  }

  protected runCore(...args: Parameters<LinkedRun["runCore"]>): Step | null {
    this.shotReleaseMs = null;
    try {
      return super.runCore(...args);
    } finally {
      this.shotReleaseMs = null;
    }
  }

  protected runSet(frame: Frame, t0: Milliseconds, targets?: Record<string, Point2D>, entryText?: string): Step | null {
    this.currentSetKind = entryText ? "segunda" : "central";
    return super.runSet(frame, t0, targets, entryText);
  }

  protected throwIn(step: Extract<Step, { kind: "throw_in" }>): Step | null {
    const cause = this.lastStoppage;
    this.lastStoppage = null;
    if (cause && cause !== "falta" && cause !== "inicio_periodo") {
      const teams = substitutionOpportunity({
        cause,
        gameClockStopped: !this.game.running,
        receivingTeamId: step.teamId,
        teamIds: this.teamIds,
      });
      if (teams.length > 0 && !this.substitutionWindow(step.atMs, cause, teams, [], VOLUNTARY_CAP_PER_STOPPAGE)) return null;
    }
    const alternating = this.alternatingThrowInPending;
    const next = super.throwIn(step);
    if (alternating && next?.kind === "advance") {
      // Saque de inicio de período: los diez se colocaron durante el
      // descanso, así que no hay transición que leer; el ataque es organizado.
      this.setPhaseEntry(
        "ataque_organizado",
        "Saque de alternancia al empezar el período: los diez ya están colocados, no hay transición que leer.",
      );
      return { kind: "organize", frame: next.frame, atMs: next.atMs, holderId: next.holderId };
    }
    return next;
  }

  protected afterTerminal(frame: Frame, terminal: TerminalOutcome, endMs: Milliseconds): Step | null {
    if (this.periodOver) {
      // Tras la bocina solo se adjudica la falta de un tiro soltado a tiempo (sus libres); lo demás espera al fin de período.
      if (terminal.kind === "shooting_foul_free_throws_pending") return this.handleShootingFoul(frame, terminal, endMs);
      return null;
    }
    switch (terminal.kind) {
      case "shooting_foul_free_throws_pending":
        return this.handleShootingFoul(frame, terminal, endMs);
      case "non_shooting_foul":
        return this.handleNonShootingFoul(frame, terminal, endMs);
      case "second_entry_kick_out":
        return this.secondEntry(frame, terminal, endMs);
      case "possession_reorganized_control_kept":
        // Tras una segunda entrada, la reorganización vuelve al sistema habitual (roles del quinteto).
        return super.afterTerminal(this.currentSetKind === "segunda" ? this.frameFor(frame.attacking.id) : frame, terminal, endMs);
      default:
        return super.afterTerminal(frame, terminal, endMs);
    }
  }

  // --- relato sin reloj --------------------------------------------------------

  /** Hecho de frontera (período, flecha, sustitución, falta): no pasa por el control de bocina. */
  private record(e: EmitArgs & { readonly ball?: BallMark }): void {
    if (e.ball) this.ball = e.ball;
    this.pushEvent({ ...e, atMs: Math.max(e.atMs, this.lastMs) });
  }

  private scoreText(): string {
    const [a, b] = this.teamIds;
    return `${this.team(a).name} ${this.score[a]} – ${this.score[b]} ${this.team(b).name}`;
  }

  // --- salto inicial -------------------------------------------------------------

  run(): GameResult {
    this.loop({ kind: "custom", label: "salto_inicial", atMs: 0, run: () => this.openingJump() });
    if (!this.stop) this.guardianStop(this.lastMs, "el partido terminó sin una causa de parada reconocida.");
    return this.finish();
  }

  private openingJump(): Step | null {
    this.period = 1;
    this.game = { ms: periodDurationMs(this.rules, 1), running: false, ref: 0 };
    this.shot = null;
    this.periods.push({ period: 1, label: periodLabel(this.rules, 1), overtime: false, startMs: 0, endMs: null, points: {} });
    for (const teamId of this.teamIds) {
      const layout = JUMP_LAYOUT[this.attackDirection(teamId)];
      this.lineups.get(teamId)!.forEach((id, i) => (this.tracks[id] = [{ atMs: 0, position: layout[i]! }]));
    }
    this.ball = { status: "dead", holderId: null, fixed: CENTER };
    this.record({
      atMs: 0,
      phase: "ordenado",
      kind: "period_started",
      actors: [],
      text: `Empieza ${periodLabel(this.rules, 1)} (10:00): salto entre dos en el círculo central. ${this.team(this.teamIds[0]).name} ataca hacia la derecha en la primera mitad.`,
      detail: { period: 1 },
    });

    const jumpers = this.teamIds.map((teamId) => this.lineups.get(teamId)![4]!) as [string, string];
    const variations = jumpers.map(() => this.rng.nextInRange(-5, 5));
    const jumperFacts = jumpers.map((id, i): JumperFacts => {
      const p = this.profile(id);
      return { teamId: this.teamIds[i]!, playerId: id, standingReachCm: p.measures.standingReachCm, f06: p.attributes.F06, variationCm: variations[i]! };
    }) as unknown as readonly [JumperFacts, JumperFacts];
    const provisional = adjudicateOpeningJump(jumperFacts, 0);
    const jump = provisional.tiedBySeed ? adjudicateOpeningJump(jumperFacts, this.rng.next()) : provisional;
    const winnerTeam = this.teamIds[jump.winnerIndex]!;
    const winner = jumpers[jump.winnerIndex]!;
    const receiver = this.lineups.get(winnerTeam)![0]!;
    const receiverPos = this.positionAt(receiver, 0);

    // Art. 50: el reloj de partido arranca con el toque legal del saltador.
    this.startGameClock(0);
    const rounded = (n: number) => Math.round(n * 10) / 10;
    if (
      !this.emit({
        atMs: 0,
        phase: "ejecutado",
        kind: "jump_ball",
        actors: [winner, jumpers[1 - jump.winnerIndex]!, receiver],
        text: `Salto inicial (ME-04-JUMP-1): ${jumpers[0]} alcanza ${rounded(jump.reachCm[0]).toString().replace(".", ",")} cm y ${jumpers[1]} ${rounded(jump.reachCm[1]).toString().replace(".", ",")} cm${jump.tiedBySeed ? " (empate exacto: decide el sorteo sembrado)" : ""}. ${winner} toca hacia su base ${receiver}; corre el reloj de partido.`,
        detail: {
          approximation: "ME-04-JUMP-1",
          jumpers: jumperFacts.map((j, i) => ({ playerId: j.playerId, teamId: j.teamId, standingReachCm: j.standingReachCm, f06: j.f06, variationCm: j.variationCm, reachCm: jump.reachCm[i] })),
          winnerId: winner,
          receiverId: receiver,
          tiedBySeed: jump.tiedBySeed,
        },
        ball: { status: "in_flight_pass", holderId: null, fixed: CENTER },
      })
    )
      return null;

    this.arrowTeamId = initialArrowTeam(winnerTeam, this.teamIds);
    this.record({
      atMs: 0,
      phase: "concedido",
      kind: "alternating_arrow",
      actors: [],
      text: `Flecha de alternancia inicial hacia ${this.team(this.arrowTeamId).name} (el equipo que no obtiene el primer control).`,
      detail: { arrowTeamId: this.arrowTeamId },
    });

    const controlMs = secondsToMs(distance(CENTER, receiverPos) / PASS_FLIGHT_SPEED_MPS);
    if (!this.openPossession(winnerTeam, controlMs, "salto_inicial", `${receiver} controla el toque del salto inicial (reloj de lanzamiento 24 s)`)) return null;
    this.setPhaseEntry("pendiente", "");
    this.setShotClock(controlMs, SHOT_CLOCK_FULL_MS);
    if (
      !this.emit({
        atMs: controlMs,
        phase: "concedido",
        kind: "jump_ball_control",
        actors: [receiver],
        text: `${receiver} obtiene el primer control vivo del partido: corre el reloj de lanzamiento (24 s).`,
        ball: { status: "held", holderId: receiver, fixed: null },
      })
    )
      return null;
    const frame = this.frameFor(winnerTeam);
    this.backcourt = isFrontcourtLocal(toLocal(frame.dir, receiverPos)) ? null : { startMs: controlMs, elapsedBeforeMs: 0 };
    return { kind: "advance", frame, atMs: controlMs, holderId: receiver };
  }

  // --- fin e inicio de período -------------------------------------------------------

  private signalBuzzer(expiryMs: Milliseconds): void {
    this.sync(expiryMs);
    this.game.ms = 0;
    this.game.running = false;
    if (this.shot) this.shot.running = false;
    this.periodOver = true;
    this.buzzerMs = expiryMs;
    const inFlight = this.shotReleaseMs !== null && isReleasedBeforeBuzzer(this.shotReleaseMs, expiryMs) && !this.shotResolved;
    this.record({
      atMs: expiryMs,
      phase: "concedido",
      kind: "buzzer",
      actors: [],
      text: `Bocina: termina ${periodLabel(this.rules, this.period)} (reloj de partido 0:00).${
        inFlight
          ? ` El lanzamiento de ${this.ball.holderId ?? "su tirador"} salió ${formatSeconds((expiryMs - this.shotReleaseMs!) / 1000)} antes de la bocina y sigue en el aire: puede contar.`
          : " No se inicia ninguna acción después."
      }`,
      detail: { period: this.period, buzzerMs: expiryMs, shotReleaseMs: inFlight ? this.shotReleaseMs : null, shotInFlight: inFlight },
    });
    this.scheduled = { kind: "custom", label: "fin_periodo", atMs: expiryMs, run: () => this.endPeriod() };
  }

  private endPeriod(): Step | null {
    const at = Math.max(this.lastMs, this.buzzerMs ?? this.lastMs);
    this.holdAll(at);
    this.freeThrowsAfterBuzzer = false;
    const last = this.possessions[this.possessions.length - 1];
    const open = last && last.endMs === null ? last : null;
    if (open) {
      open.endMs = at;
      open.endReason = `fin de ${periodLabel(this.rules, this.period)}`;
      this.closed += 1;
      this.rngStates.push({ atMs: at, state: this.rng.state() });
      this.record({
        atMs: at,
        phase: "concedido",
        kind: "possession_ended",
        actors: [],
        text: `Termina la posesión ${open.index} de ${this.team(open.teamId).name}: fin de ${periodLabel(this.rules, this.period)}.`,
        detail: { teamId: open.teamId, closed: this.closed },
      });
    }
    this.betweenPossessions = true;
    this.ball = { status: "dead", holderId: null, fixed: this.ball.fixed ?? CENTER };
    this.periods[this.periods.length - 1]!.endMs = at;
    this.record({
      atMs: at,
      phase: "concedido",
      kind: "period_ended",
      actors: [],
      text: `Final de ${periodLabel(this.rules, this.period)}: ${this.scoreText()}.`,
      detail: { period: this.period, score: { ...this.score } },
    });

    const [a, b] = this.teamIds;
    const decision = adjudicatePeriodEnd(this.rules, this.period, [
      { teamId: a, points: this.score[a]! },
      { teamId: b, points: this.score[b]! },
    ]);
    if (decision.kind === "final") {
      this.winnerTeamId = decision.winnerTeamId;
      this.stop = { cause: "final", atMs: at, explanation: `Final del partido (${decision.reason}): gana ${this.team(decision.winnerTeamId).name}.` };
      this.record({ atMs: at, phase: "concedido", kind: "game_ended", actors: [], text: `${this.stop.explanation} ${this.scoreText()}.`, detail: { cause: "final", winnerTeamId: decision.winnerTeamId } });
      return null;
    }
    if (decision.overtime && decision.nextPeriod - this.rules.regulationPeriods > this.maxOvertimes) {
      this.guardianStop(
        at,
        `se han encadenado ${this.maxOvertimes} prórrogas con empate; el guardián señala un bucle anómalo y no cierra el empate como final ni inventa un ganador.`,
      );
      return null;
    }
    const startAt = at + this.rules.intervalAfterPeriodMs(this.period);
    const next = decision.nextPeriod;
    return { kind: "custom", label: `inicio_${next}`, atMs: startAt, run: () => this.startPeriod(next, startAt, decision.reason) };
  }

  private startPeriod(period: number, at: Milliseconds, reason: string): Step | null {
    this.period = period;
    this.periodOver = false;
    this.buzzerMs = null;
    this.gameExpiredAtMs = null;
    this.shotReleaseMs = null;
    this.game = { ms: periodDurationMs(this.rules, period), running: false, ref: at };
    this.shot = null;
    this.backcourt = null;
    this.periods.push({ period, label: periodLabel(this.rules, period), overtime: isOvertime(this.rules, period), startMs: at, endMs: null, points: {} });
    this.holdAll(at);
    const arrowTeam = this.arrowTeamId!;
    const home = this.team(this.teamIds[0]);
    this.record({
      atMs: at,
      phase: "ordenado",
      kind: "period_started",
      actors: [],
      text: `Empieza ${periodLabel(this.rules, period)} (${periodDurationMs(this.rules, period) / 60_000}:00) tras ${reason}. ${home.name} ataca hacia la ${this.attackDirection(home.id) === "hacia_x_creciente" ? "derecha" : "izquierda"}${period === this.rules.switchBasketsAtPeriod ? " (cambio de canastas)" : ""}. Saque de alternancia para ${this.team(arrowTeam).name} desde la prolongación de la línea central.`,
      detail: { period, arrowTeamId: arrowTeam, teamFoulKey: teamFoulPeriodKey(this.rules, period) },
      ball: { status: "dead", holderId: null, fixed: CENTER_LINE_THROW_IN_SPOT },
    });
    this.lastStoppage = null;
    if (!this.substitutionWindow(at, "inicio_periodo", this.teamIds, [], VOLUNTARY_CAP_BETWEEN_PERIODS)) return null;

    // Los diez ocupan su puesto durante el descanso (a su velocidad real) antes de sacar.
    const frame = this.frameFor(arrowTeam);
    const arrivals = this.planOrganizeLegs(frame, at, []);
    const ready = Math.max(at, ...Object.values(arrivals));
    this.alternatingThrowInPending = true;
    return {
      kind: "throw_in",
      teamId: arrowTeam,
      atMs: ready,
      spot: CENTER_LINE_THROW_IN_SPOT,
      reason: `de alternancia al empezar ${periodLabel(this.rules, period)}`,
      sameTeamKeepsBall: false,
      shotClockMs: SHOT_CLOCK_FULL_MS,
    };
  }

  // --- faltas -------------------------------------------------------------------------

  private registerFoul(
    foulerId: string,
    fouledId: string,
    type: DefensiveFoulType,
    atMs: Milliseconds,
    shot?: { readonly shotType: "close_finish" | "three_point"; readonly madeShot: boolean },
  ): DefensiveFoulAdjudication | null {
    const st = this.players.get(foulerId)!;
    if (st.disqualified || !st.onCourt) {
      this.guardianStop(atMs, `${foulerId} comete una falta sin estar en pista o ya excluido: adjudicación imposible.`);
      return null;
    }
    const teamId = this.teamOf.get(foulerId)!;
    const key = teamFoulPeriodKey(this.rules, this.period);
    const before = this.teamFouls.get(teamId)!.get(key) ?? 0;
    const adj = adjudicateDefensiveFoul(this.rules, {
      type,
      shotType: shot?.shotType,
      madeShot: shot?.madeShot,
      teamFoulsInPeriodBefore: before,
      foulerPersonalFoulsBefore: st.fouls,
    });
    st.fouls = adj.personalFoulsAfter;
    this.teamFouls.get(teamId)!.set(key, adj.teamFoulsAfter);
    if (adj.disqualified) st.disqualified = true;
    this.fouls.push({
      atMs,
      period: this.period,
      gameClockMs: this.game.ms,
      teamId,
      foulerId,
      fouledId,
      type,
      personalFoulsAfter: adj.personalFoulsAfter,
      teamFoulsAfter: adj.teamFoulsAfter,
      teamInPenalty: adj.teamInPenalty,
      sanction: adj.sanction,
      disqualified: adj.disqualified,
    });
    const sanctionText =
      adj.sanction.kind === "saque"
        ? `saque de ${this.team(this.teamOf.get(fouledId)!).name}`
        : `${adj.sanction.count} libre(s) para ${fouledId}${adj.sanction.byBonus ? " por bonus" : ""}`;
    const foulPeriod = isOvertime(this.rules, this.period) ? "C4 y prórrogas" : periodLabel(this.rules, this.period);
    this.record({
      atMs,
      phase: "concedido",
      kind: "personal_foul",
      actors: [foulerId, fouledId],
      text: `Falta personal ${type === "tiro" ? "de tiro" : "sin tiro"} de ${foulerId} sobre ${fouledId}: ${adj.personalFoulsAfter}.ª personal, ${adj.teamFoulsAfter}.ª de ${this.team(teamId).name} en ${foulPeriod}${adj.teamInPenalty ? " (equipo en bonus)" : ""}. Sanción: ${sanctionText}.`,
      detail: {
        type,
        teamId,
        period: this.period,
        teamFoulKey: key,
        personalFoulsAfter: adj.personalFoulsAfter,
        teamFoulsAfter: adj.teamFoulsAfter,
        teamInPenalty: adj.teamInPenalty,
        sanction: adj.sanction,
        disqualified: adj.disqualified,
      },
    });
    if (adj.disqualified) {
      this.record({
        atMs,
        phase: "concedido",
        kind: "player_disqualified",
        actors: [foulerId],
        text: `${foulerId} comete su quinta falta personal: queda excluido, debe salir antes de reanudar y no puede volver a entrar.`,
        detail: { teamId, personalFouls: adj.personalFoulsAfter },
      });
    }
    return adj;
  }

  private handleShootingFoul(
    frame: Frame,
    terminal: Extract<TerminalOutcome, { kind: "shooting_foul_free_throws_pending" }>,
    endMs: Milliseconds,
  ): Step | null {
    const shooter = frame.slotToId[terminal.shooterId]!;
    const fouler = frame.slotToId[terminal.foulerId]!;
    const adj = this.registerFoul(fouler, shooter, "tiro", endMs, { shotType: terminal.shotType, madeShot: terminal.basketCounted });
    if (!adj) return null;
    if (adj.sanction.kind !== "libres" || adj.sanction.count !== terminal.freeThrowsAwarded) {
      this.guardianStop(endMs, "la sanción de la falta de tiro no coincide con los libres concedidos por el núcleo.");
      return null;
    }
    this.lastStoppage = null;
    if (!this.substitutionWindow(endMs, "falta", this.teamIds, [shooter], VOLUNTARY_CAP_PER_STOPPAGE)) return null;
    return this.freeThrowSeries(shooter, adj.sanction.count, endMs);
  }

  private handleNonShootingFoul(
    frame: Frame,
    terminal: Extract<TerminalOutcome, { kind: "non_shooting_foul" }>,
    endMs: Milliseconds,
  ): Step | null {
    const fouler = frame.slotToId[terminal.foulerId]!;
    const fouled = frame.slotToId[terminal.fouledId]!;
    const adj = this.registerFoul(fouler, fouled, "sin_tiro", endMs);
    if (!adj) return null;
    this.lastStoppage = null;
    const fouledTeam = this.teamOf.get(fouled)!;
    if (adj.sanction.kind === "libres") {
      if (!this.substitutionWindow(endMs, "falta", this.teamIds, [fouled], VOLUNTARY_CAP_PER_STOPPAGE)) return null;
      return this.freeThrowSeries(fouled, adj.sanction.count, endMs);
    }
    if (!this.substitutionWindow(endMs, "falta", this.teamIds, [], VOLUNTARY_CAP_PER_STOPPAGE)) return null;
    const spot = nearestLineThrowInSpot(this.positionAt(fouled, endMs));
    const inFrontcourt = isFrontcourtLocal(toLocal(this.attackDirection(fouledTeam), spot));
    const remaining = this.shotRemainingAt(endMs);
    const shotClockMs = shotClockAfterDefensiveFoulThrowIn({ inThrowingTeamFrontcourt: inFrontcourt, remainingMs: remaining });
    const clockText = !inFrontcourt
      ? "saque en pista trasera: 24 s"
      : shotClockMs === remaining
        ? `saque en pista delantera con ${formatSeconds(remaining / 1000)} (14 s o más): se conserva`
        : `saque en pista delantera con ${formatSeconds(remaining / 1000)} (13 s o menos): pasa a 14 s`;
    return {
      kind: "throw_in",
      teamId: fouledTeam,
      atMs: endMs,
      spot,
      reason: `por falta personal sin tiro de ${fouler}`,
      sameTeamKeepsBall: true,
      shotClockMs,
      note: `Saque por falta de ${fouler} (su equipo no está en bonus): ${this.team(fouledTeam).name} conserva el balón; ${clockText}.`,
    };
  }

  private freeThrowSeries(shooterId: string, count: number, atMs: Milliseconds): Step | null {
    const frame = this.frameFor(this.teamOf.get(shooterId)!);
    if (this.periodOver) this.freeThrowsAfterBuzzer = true;
    return this.runCore(frame, atMs, {
      kind: "free_throws",
      shooterSlot: frame.idToSlot[shooterId]!,
      count,
      liveReboundOnLastMiss: !this.periodOver,
    });
  }

  // --- sustituciones ------------------------------------------------------------------

  private substitutionWindow(
    atMs: Milliseconds,
    cause: DeadBallCause,
    teamIds: readonly string[],
    protectedIds: readonly string[],
    voluntaryCap: number,
  ): boolean {
    this.sync(atMs);
    for (const teamId of teamIds) {
      const team = this.teamInputs.get(teamId)!;
      const plan = planSubstitutions({
        lineup: this.lineups.get(teamId)!,
        players: team.roster.map((p) => {
          const st = this.players.get(p.id)!;
          return {
            id: p.id,
            declaredRoles: team.declaredRoles[p.id] ?? [],
            onCourt: st.onCourt,
            continuousMs: st.continuousMs,
            totalMs: st.totalMs,
            disqualified: st.disqualified,
            locked: st.changedAtTick === this.clockTicks,
          };
        }),
        voluntaryCap,
        continuousThresholdMs: CONTINUOUS_THRESHOLD_MS,
        protectedIds,
      });
      for (const change of plan.changes) this.applySubstitution(teamId, change, atMs, cause);
      if (plan.unresolved.length > 0) {
        const u = plan.unresolved[0]!;
        this.guardianStop(
          atMs,
          `${team.name} no tiene suplente elegible para el rol ${u.role} (${FUNCTIONAL_ROLE_LABELS[u.role]}) de ${u.outId}, excluido: no se crea un sexto jugador ni se deja actuar al excluido.`,
        );
        return false;
      }
    }
    return true;
  }

  private applySubstitution(teamId: string, change: PlannedSubstitution, atMs: Milliseconds, cause: DeadBallCause): void {
    const lineup = this.lineups.get(teamId)!;
    const index = (change.role as FunctionalRole) - 1;
    const position = this.positionAt(change.outId, atMs);
    this.tracks[change.outId] = truncateTrajectory(this.tracks[change.outId]!, atMs);
    const previous = this.tracks[change.inId];
    this.tracks[change.inId] = previous ? [...truncateTrajectory(previous, atMs), { atMs, position }] : [{ atMs, position }];
    lineup[index] = change.inId;
    const out = this.players.get(change.outId)!;
    const inn = this.players.get(change.inId)!;
    out.onCourt = false;
    out.changedAtTick = this.clockTicks;
    inn.onCourt = true;
    inn.continuousMs = 0;
    inn.changedAtTick = this.clockTicks;
    this.currentResponsibility.delete(change.outId);
    const roleLabel = FUNCTIONAL_ROLE_LABELS[change.role];
    this.assignResponsibility(atMs, change.inId, "organizacion", `Entra como ${roleLabel} (rol ${change.role}) por ${change.outId}.`);
    this.subs.push({
      atMs,
      period: this.period,
      gameClockMs: this.game.ms,
      teamId,
      outId: change.outId,
      inId: change.inId,
      role: change.role,
      reason: change.reason,
      window: cause,
      outContinuousMs: change.outContinuousMs,
    });
    const minutes = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;
    this.record({
      atMs,
      phase: "concedido",
      kind: "substitution",
      actors: [change.inId, change.outId],
      text:
        change.reason === "exclusion"
          ? `Sustitución obligatoria en ${this.team(teamId).name}: entra ${change.inId} (${roleLabel}) por ${change.outId}, excluido por cinco faltas.`
          : `Sustitución en ${this.team(teamId).name}: entra ${change.inId} (${roleLabel}, ${minutes(change.inTotalMs)} jugados) por ${change.outId} (${minutes(change.outContinuousMs)} seguidos en pista).`,
      detail: { teamId, role: change.role, reason: change.reason, window: cause, position, outContinuousMs: change.outContinuousMs, inTotalMs: change.inTotalMs },
    });
  }

  // --- segunda entrada del bloqueo directo ----------------------------------------------

  /**
   * El núcleo ya decidió (con línea de pase, ubicaciones y reloj) que la
   * primera lectura estaba negada y el continuador sacó el balón al creador
   * secundario: aquí se intercambian los roles canónicos (O1↔creador,
   * D1↔su defensor), el bloqueador se recoloca a su velocidad real y el
   * mismo bloqueo directo se juega desde el nuevo ángulo.
   */
  private secondEntry(
    frame: Frame,
    terminal: Extract<TerminalOutcome, { kind: "second_entry_kick_out" }>,
    t0: Milliseconds,
  ): Step | null {
    const creatorId = frame.slotToId[terminal.creatorId]!;
    const slotToId: Record<string, string> = {};
    for (const slot of [...OFFENSE_SLOTS, ...DEFENSE_SLOTS]) slotToId[slot] = frame.slotToId[terminal.slotSwap[slot] ?? slot]!;
    const second = rebindFrame(frame, slotToId);
    const targets = terminal.targets as Record<string, Point2D>;
    if (!this.newPhase(t0, "salida_segura", `Primera lectura negada: ${creatorId} recibe la salida del continuador y crea la segunda entrada; ${frame.attacking.name} conserva el reloj de lanzamiento.`))
      return null;
    this.setPhaseEntry(
      "segunda_entrada" satisfies PhaseEntry,
      `Segunda entrada del bloqueo directo: ${creatorId} crea desde su nuevo ángulo y ${second.slotToId.O5} se recoloca para ponerle la pantalla (${terminal.reason}).`,
    );
    const arrivals = this.planOrganizeLegs(second, t0, [creatorId], targets);
    const attackers = OFFENSE_SLOTS.map((slot) => second.slotToId[slot]!).filter((id) => id !== creatorId);
    const tAllSet = Math.max(t0, ...attackers.map((id) => arrivals[id]!));
    const expiry = this.shotExpiryMs();
    if (expiry <= tAllSet) return this.shotClockViolationDuringPlay(second, expiry, creatorId);
    return this.runSet(
      second,
      tAllSet,
      targets,
      `Segunda entrada situada: ${creatorId} y ${second.slotToId.O5} juegan el bloqueo directo desde el nuevo ángulo (${this.coverageWhenDefending(second.defending.id) === "trampa" ? "trampa" : "drop"}) con ${(this.shotRemainingAt(tAllSet) / 1000).toFixed(1)} s de lanzamiento.`,
    );
  }

  // --- resultado ------------------------------------------------------------------------

  private finish(): GameResult {
    const rawStop = this.stop!;
    const stop: GameStop = { cause: rawStop.cause === "final" ? "final" : "guardian", atMs: rawStop.atMs, explanation: rawStop.explanation };
    const events = this.materializeEvents(stop.atMs);
    const box = projectBoxScore(
      events,
      this.input.teams.map((t) => ({ teamId: t.id, playerIds: t.roster.map((p) => p.id) })),
    );
    for (const [i, record] of this.periods.entries()) record.points = { ...(box.periodPoints[i] ?? Object.fromEntries(this.teamIds.map((id) => [id, 0]))) };
    const entryCounts: Record<PhaseEntry, number> = {
      ataque_organizado: 0,
      ventaja_temprana: 0,
      segunda_oportunidad: 0,
      segunda_entrada: 0,
      pendiente: 0,
    };
    for (const p of this.possessions) for (const ph of p.phases) entryCounts[ph.entry] += 1;
    return {
      gameId: `lab-${this.input.seed}-${fnv1a(JSON.stringify(this.input))}`,
      input: this.input,
      events,
      possessions: this.possessions.map((p) => ({ ...p, phases: p.phases.map((ph) => ({ ...ph })) })),
      periods: this.periods.map((p) => ({ ...p, points: { ...p.points } })),
      substitutions: this.subs,
      fouls: this.fouls,
      responsibilities: this.responsibilities,
      finalScore: { ...this.score },
      winnerTeamId: stop.cause === "final" ? this.winnerTeamId : null,
      stop,
      box,
      engineMinutesMs: Object.fromEntries([...this.players.entries()].map(([id, st]) => [id, st.totalMs])),
      effectivePlayedMs: this.playedMs,
      entryCounts,
      rngStateAtBoundaries: this.rngStates,
    };
  }
}

/**
 * Juega un partido completo FIBA 2026 de laboratorio. Determinista: misma
 * `GameInput` produce el mismo marcador, hechos, rotación, relojes y acta.
 */
export function playFullGame(input: GameInput, options: PlayFullGameOptions = {}): GameResult {
  return new GameRun(input, options).run();
}
