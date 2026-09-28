/**
 * Tramo de hasta cuatro posesiones estadísticas enlazadas (ME-03,
 * ADR-0006). La misma cancha, los mismos diez jugadores y el mismo balón
 * atraviesan rebotes, pérdidas, canastas, saques y cambios de dirección:
 * cada frontera hereda posiciones reales, relojes, balón, encargos y el
 * estado del azar. No concatena llamadas a `runPossession` ni recarga el
 * fixture: la primera posesión parte de `drop_con_ayuda` y el resto, del
 * estado que dejó la anterior.
 *
 * El árbol de pase/tiro/tapón/falta/rebote es el del núcleo compartido
 * (`possession-core.ts`, modo enlazado). Este módulo solo orquesta: marco
 * local del equipo que ataca, reglas de reloj y reanudación FIBA 2026
 * alcanzables (`fiba-clock-rules.ts`), transición y saques.
 */
import type { Point2D } from "../geometry/point";
import { distance, timeToReach } from "../geometry/point";
import { ATTACKED_HOOP, isInsideCourt } from "../geometry/court";
import {
  toGlobal,
  toLocal,
  attackedHoopGlobal,
  isFrontcourtLocal,
  endLineThrowInSpot,
  outOfBoundsThrowInSpot,
  sidelineThrowInSpot,
  type AttackDirection,
} from "../geometry/frame";
import { positionOnTrajectory, truncateTrajectory, type TrajectoryPoint } from "../geometry/trajectory";
import { createResumableRandom, type ResumableRandom } from "../random/seeded-random";
import { secondsToMs, type Milliseconds } from "../time/clock";
import type { MatchInput } from "../lab/match-input";
import { getScenario } from "../lab/scenario";
import {
  attackerMoveSpeedMps,
  defenderLateralSpeedMps,
  closeoutBrakingExtraSeconds,
  PASS_FLIGHT_SPEED_MPS,
  PASS_RELEASE_SECONDS,
} from "../lab/lab-0-1-parameters";
import type { PlayerProfile } from "../players/player-profile";
import type { FactKind, FactPhase, PlayerSnapshot } from "../simulation/fact";
import type { TerminalOutcome, BallState, BallStatus } from "../simulation/match-state";
import {
  computePossessionCore,
  REBOUND_CANDIDATE_SPEED_MPS,
  type LinkedEntry,
  type PlannedLeg,
  type RawEvent,
} from "../simulation/possession-core";
import { resolvePass } from "../simulation/resolvers/pass-resolver";
import { resolveRebound, pickTipWinnerByT20 } from "../simulation/resolvers/rebound-resolver";
import {
  SHOT_CLOCK_FULL_MS,
  GAME_CLOCK_STOPS_ON_MADE_BASKET_IN_FIRST_QUARTER,
  shotClockAfterLiveControl,
  shotClockForThrowIn,
  evaluateBackcourtCount,
  evaluateThrowInCount,
  backcourtElapsedAfterThrowIn,
} from "./fiba-clock-rules";
import {
  readTransition,
  readSecondChance,
  readOutlet,
  frontcourtEntryOffsetSeconds,
  type RaceParticipant,
} from "./transition";
import {
  TRAMO_MAX_POSSESSIONS,
  REBOUND_PRIORITY_LABELS,
  type ControlState,
  type PhaseKind,
  type PossessionRecord,
  type Responsibility,
  type ResponsibilityChange,
  type TramoBallState,
  type TramoEvent,
  type TramoInput,
  type TramoResult,
  type TramoStop,
  type TramoTeamBox,
  type TramoTeamSnapshot,
} from "./tramo-model";

export interface TramoLimits {
  /** Fases (rebotes ofensivos, salidas, recuperaciones) máximas en una posesión. */
  readonly maxPhasesPerPossession: number;
  /** Pasos de orquestación máximos del tramo completo. */
  readonly maxSteps: number;
  /** Pasos consecutivos sin avanzar el reloj interno antes de declarar un ciclo. */
  readonly maxZeroTimeSteps: number;
}

/** Mismo límite de 12 fases que el guardián de rebotes encadenados de ME-01. */
export const DEFAULT_TRAMO_LIMITS: TramoLimits = { maxPhasesPerPossession: 12, maxSteps: 80, maxZeroTimeSteps: 3 };

export interface PlayTramoOptions {
  readonly limits?: Partial<TramoLimits>;
  /**
   * Solo para comprobar la frontera de tiempo en pruebas automáticas: reloj
   * de partido restante al empezar. La interfaz siempre usa 7:12.
   */
  readonly initialGameClockMs?: Milliseconds;
}

const OFFENSE_SLOTS = ["O1", "O2", "O3", "O4", "O5"] as const;
const DEFENSE_SLOTS = ["D1", "D2", "D3", "D4", "D5"] as const;
const SLOT_TOKEN = /\b([OD][1-5])\b/g;

/** Hechos del núcleo que deciden el desenlace de un tramo de cálculo. */
const DECISIVE_KINDS: ReadonlySet<FactKind> = new Set<FactKind>([
  "shot_result",
  "rebound_secured",
  "rebound_contested",
  "turnover",
  "pass_control_lost",
  "shot_blocked",
  "free_throws_result",
  "out_of_bounds",
  "shot_clock_violation",
  "possession_continues",
]);

const ROLE_LABELS: Readonly<Record<string, string>> = {
  O1: "manejador del bloqueo directo",
  O2: "esquina del lado del balón",
  O3: "esquina débil",
  O4: "ala débil",
  O5: "bloqueador y continuador",
  D1: "persigue al manejador",
  D2: "defiende la esquina del lado del balón",
  D3: "ayuda desde la esquina débil",
  D4: "defiende el ala débil y repara",
  D5: "protege el aro ante el bloqueo",
};

/**
 * Marco de una fase: quién ataca, hacia dónde, y qué jugador real ocupa
 * cada rol canónico de la acción (el número del fixture da el rol natural;
 * el equipo lo da el control del balón, no el prefijo).
 */
interface Frame {
  readonly attacking: TramoTeamSnapshot;
  readonly defending: TramoTeamSnapshot;
  readonly dir: AttackDirection;
  readonly slotToId: Readonly<Record<string, string>>;
  readonly idToSlot: Readonly<Record<string, string>>;
}

function buildFrame(attacking: TramoTeamSnapshot, defending: TramoTeamSnapshot): Frame {
  const slotToId: Record<string, string> = {};
  OFFENSE_SLOTS.forEach((slot, i) => (slotToId[slot] = attacking.players[i]!.id));
  DEFENSE_SLOTS.forEach((slot, i) => (slotToId[slot] = defending.players[i]!.id));
  const idToSlot = Object.fromEntries(Object.entries(slotToId).map(([slot, id]) => [id, slot]));
  return { attacking, defending, dir: attacking.attackDirection, slotToId, idToSlot };
}

type Step =
  | { readonly kind: "set"; readonly frame: Frame; readonly atMs: Milliseconds }
  | { readonly kind: "organize"; readonly frame: Frame; readonly atMs: Milliseconds; readonly holderId: string }
  | { readonly kind: "advance"; readonly frame: Frame; readonly atMs: Milliseconds; readonly holderId: string }
  | { readonly kind: "second_chance"; readonly frame: Frame; readonly atMs: Milliseconds; readonly holderId: string }
  | { readonly kind: "loose_ball"; readonly frame: Frame; readonly atMs: Milliseconds; readonly ball: Point2D }
  | {
      readonly kind: "throw_in";
      readonly teamId: string;
      readonly atMs: Milliseconds;
      readonly spot: Point2D;
      readonly reason: string;
      readonly sameTeamKeepsBall: boolean;
      readonly shotClockMs: Milliseconds;
    };

interface BallMark {
  readonly status: BallStatus;
  readonly holderId: string | null;
  /** Posición fija (balón sin poseedor); con poseedor se sigue su trayectoria. */
  readonly fixed: Point2D | null;
}

interface PendingEvent {
  readonly atMs: Milliseconds;
  readonly possessionIndex: number;
  readonly phaseIndex: number;
  readonly possessionTeamId: string;
  readonly phase: FactPhase;
  readonly kind: FactKind;
  readonly actors: readonly string[];
  readonly text: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly ball: BallMark;
  readonly control: ControlState;
  readonly gameClockMs: Milliseconds;
  readonly shotClockMs: Milliseconds | null;
  readonly score: Readonly<Record<string, number>>;
}

interface EmitArgs {
  readonly atMs: Milliseconds;
  readonly phase: FactPhase;
  readonly kind: FactKind;
  readonly actors: readonly string[];
  readonly text: string;
  readonly detail?: Readonly<Record<string, unknown>>;
  readonly ball?: BallMark;
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(2).replace(".", ",")} s`;
}

class TramoRun {
  private readonly input: TramoInput;
  private readonly limits: TramoLimits;
  private readonly rng: ResumableRandom;
  private readonly profiles = new Map<string, PlayerProfile>();
  private readonly teamOf = new Map<string, string>();
  private readonly teams = new Map<string, TramoTeamSnapshot>();
  private readonly tracks: Record<string, TrajectoryPoint[]> = {};
  private readonly events: PendingEvent[] = [];
  private readonly possessions: PossessionRecord[] = [];
  private readonly responsibilities: ResponsibilityChange[] = [];
  private readonly currentResponsibility = new Map<string, Responsibility>();
  private readonly rngStates: { atMs: Milliseconds; state: number }[] = [];
  private readonly score: Record<string, number> = {};

  private game: { ms: Milliseconds; running: boolean; ref: Milliseconds };
  private shot: { ms: Milliseconds; running: boolean; ref: Milliseconds } | null;
  private ball: BallMark;
  private throwInTeamId: string | null = null;
  /** Cuenta de 8 s en curso (art. 28), o `null` si el balón ya está en pista delantera. */
  private backcourt: { startMs: Milliseconds; elapsedBeforeMs: Milliseconds } | null = null;
  private closed = 0;
  private stop: TramoStop | null = null;
  private lastMs: Milliseconds = 0;
  /** Instante exacto en que el reloj de partido llegó a 0, si ya ocurrió. */
  private gameExpiredAtMs: Milliseconds | null = null;

  constructor(input: TramoInput, options: PlayTramoOptions) {
    this.input = input;
    this.limits = { ...DEFAULT_TRAMO_LIMITS, ...options.limits };
    this.rng = createResumableRandom(input.seed);
    for (const team of input.teams) {
      this.teams.set(team.id, team);
      this.score[team.id] = 0;
      for (const p of team.players) {
        this.profiles.set(p.id, p);
        this.teamOf.set(p.id, team.id);
      }
    }
    const scenario = getScenario(input.startScenarioId);
    this.game = { ms: options.initialGameClockMs ?? scenario.initialGameClockMs, running: true, ref: 0 };
    this.shot = { ms: scenario.initialShotClockMs, running: true, ref: 0 };
    const frame0 = buildFrame(input.teams[0], input.teams[1]);
    for (const slot of [...scenario.offense, ...scenario.defense]) {
      const id = frame0.slotToId[slot.playerId]!;
      this.tracks[id] = [{ atMs: 0, position: toGlobal(frame0.dir, slot.initialPosition) }];
    }
    this.ball = { status: "held", holderId: frame0.slotToId.O1!, fixed: null };
  }

  // --- utilidades ---------------------------------------------------------

  private profile(id: string): PlayerProfile {
    const p = this.profiles.get(id);
    if (!p) throw new Error(`Jugador desconocido en el tramo: ${id}`);
    return p;
  }

  private team(id: string): TramoTeamSnapshot {
    return this.teams.get(id)!;
  }

  private otherTeam(teamId: string): TramoTeamSnapshot {
    return this.input.teams[0].id === teamId ? this.input.teams[1] : this.input.teams[0];
  }

  private frameFor(attackingTeamId: string): Frame {
    return buildFrame(this.team(attackingTeamId), this.otherTeam(attackingTeamId));
  }

  private runSpeed(id: string): number {
    return attackerMoveSpeedMps(this.profile(id).attributes.F01);
  }

  private positionAt(id: string, atMs: Milliseconds): Point2D {
    return positionOnTrajectory(this.tracks[id]!, atMs);
  }

  private localPositions(frame: Frame, atMs: Milliseconds): Record<string, Point2D> {
    const out: Record<string, Point2D> = {};
    for (const [slot, id] of Object.entries(frame.slotToId)) out[slot] = toLocal(frame.dir, this.positionAt(id, atMs));
    return out;
  }

  /** Nueva orden de desplazamiento global: sale desde donde está de verdad en `departMs`. */
  private moveGlobal(id: string, departMs: Milliseconds, target: Point2D): Milliseconds {
    const from = this.positionAt(id, departMs);
    const arriveMs = departMs + secondsToMs(timeToReach(from, target, this.runSpeed(id)));
    const track = truncateTrajectory(this.tracks[id]!, departMs);
    if (arriveMs > departMs) track.push({ atMs: arriveMs, position: target, moving: true });
    this.tracks[id] = track;
    return arriveMs;
  }

  private holdAll(atMs: Milliseconds): void {
    for (const id of Object.keys(this.tracks)) this.tracks[id] = truncateTrajectory(this.tracks[id]!, atMs);
  }

  private assignResponsibility(atMs: Milliseconds, id: string, responsibility: Responsibility, reason: string): void {
    if (this.currentResponsibility.get(id) === responsibility && responsibility !== "cargar_rebote" && responsibility !== "proteger_balance") {
      return;
    }
    this.currentResponsibility.set(id, responsibility);
    this.responsibilities.push({ atMs, playerId: id, teamId: this.teamOf.get(id)!, responsibility, reason });
  }

  private translateText(frame: Frame, text: string): string {
    return text.replace(SLOT_TOKEN, (token) => frame.slotToId[token] ?? token);
  }

  private translateDetail(frame: Frame, value: unknown): unknown {
    if (typeof value === "string") return /^[OD][1-5]$/.test(value) ? (frame.slotToId[value] ?? value) : value;
    if (Array.isArray(value)) return value.map((v) => this.translateDetail(frame, v));
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 2 && typeof obj.x === "number" && typeof obj.y === "number") {
        return toGlobal(frame.dir, { x: obj.x, y: obj.y });
      }
      return Object.fromEntries(keys.map((k) => [k === "slot" ? "playerId" : k, this.translateDetail(frame, obj[k])]));
    }
    return value;
  }

  // --- relojes ------------------------------------------------------------

  private sync(atMs: Milliseconds): void {
    if (atMs < this.game.ref) return;
    if (this.game.running) {
      if (this.gameExpiredAtMs === null && atMs >= this.game.ref + this.game.ms) {
        this.gameExpiredAtMs = this.game.ref + this.game.ms;
      }
      this.game.ms = Math.max(0, this.game.ms - (atMs - this.game.ref));
    }
    this.game.ref = atMs;
    if (this.shot) {
      if (this.shot.running) this.shot.ms = Math.max(0, this.shot.ms - (atMs - this.shot.ref));
      this.shot.ref = atMs;
    }
  }

  private stopGameClock(atMs: Milliseconds): void {
    this.sync(atMs);
    this.game.running = false;
  }

  private startGameClock(atMs: Milliseconds): void {
    this.sync(atMs);
    this.game.running = true;
  }

  private setShotClock(atMs: Milliseconds, ms: Milliseconds): void {
    this.sync(atMs);
    this.shot = { ms, running: true, ref: atMs };
  }

  private stopShotClock(atMs: Milliseconds): void {
    this.sync(atMs);
    if (this.shot) this.shot.running = false;
  }

  private shotRemainingAt(atMs: Milliseconds): Milliseconds {
    if (!this.shot) return SHOT_CLOCK_FULL_MS;
    return this.shot.running ? Math.max(0, this.shot.ms - (atMs - this.shot.ref)) : this.shot.ms;
  }

  private shotExpiryMs(): Milliseconds {
    if (!this.shot || !this.shot.running) return Infinity;
    return this.shot.ref + this.shot.ms;
  }

  private gameExpiryMs(): Milliseconds {
    if (this.gameExpiredAtMs !== null) return this.gameExpiredAtMs;
    return this.game.running ? this.game.ref + this.game.ms : Infinity;
  }

  // --- relato ---------------------------------------------------------------

  private currentPossession(): PossessionRecord {
    return this.possessions[this.possessions.length - 1]!;
  }

  private control(): ControlState {
    const b = this.ball;
    if (b.status === "held" || b.status === "in_flight_pass") {
      const holderTeam = b.holderId ? this.teamOf.get(b.holderId)! : this.currentPossession().teamId;
      return { status: "control", controlTeamId: holderTeam, throwInTeamId: null };
    }
    if (b.status === "in_flight_shot") return { status: "tiro_en_el_aire", controlTeamId: null, throwInTeamId: null };
    if (b.status === "loose") return { status: "balon_suelto", controlTeamId: null, throwInTeamId: null };
    return { status: "balon_muerto", controlTeamId: null, throwInTeamId: this.throwInTeamId };
  }

  private guardianStop(atMs: Milliseconds, explanation: string): void {
    if (this.stop) return;
    const at = Math.max(atMs, this.lastMs);
    this.stop = { cause: "guardian", atMs: at, explanation };
    this.pushEvent({ atMs: at, phase: "concedido", kind: "tramo_stopped", actors: [], text: `Guardián de progreso: ${explanation}`, detail: { cause: "guardian" } });
  }

  private expire(atMs: Milliseconds): void {
    this.game.ms = 0;
    this.game.running = false;
    this.stop = {
      cause: "tiempo_agotado",
      atMs,
      explanation:
        "El reloj de partido llega a 0:00 con la posesión abierta. El final de cuarto (bocina, tiro en el aire) no se adjudica en ME-03; queda para ME-04.",
    };
    this.pushEvent({ atMs, phase: "concedido", kind: "tramo_stopped", actors: [], text: "Se agota el tiempo reglamentario disponible: el tramo se detiene sin adjudicar el final de cuarto.", detail: { cause: "tiempo_agotado" } });
  }

  private pushEvent(e: EmitArgs): void {
    const possession = this.currentPossession();
    this.events.push({
      atMs: e.atMs,
      possessionIndex: possession.index,
      phaseIndex: possession.phases.length,
      possessionTeamId: possession.teamId,
      phase: e.phase,
      kind: e.kind,
      actors: e.actors,
      text: e.text,
      detail: e.detail ?? {},
      ball: this.ball,
      control: this.control(),
      gameClockMs: this.game.ms,
      shotClockMs: this.shot ? this.shot.ms : null,
      score: { ...this.score },
    });
    this.lastMs = e.atMs;
  }

  /** Registra un hecho en su instante absoluto; `false` si el tramo se detuvo. */
  private emit(e: EmitArgs): boolean {
    if (this.stop) return false;
    if (e.atMs < this.lastMs) {
      this.guardianStop(this.lastMs, `hecho «${e.kind}» fuera de orden temporal; se detiene en vez de reordenar el relato.`);
      return false;
    }
    if (e.atMs >= this.gameExpiryMs()) {
      this.expire(this.gameExpiryMs());
      return false;
    }
    this.sync(e.atMs);

    switch (e.kind) {
      case "shooting_foul":
        // Silbato: se detienen ambos relojes; permanecen parados durante los libres.
        this.stopGameClock(e.atMs);
        this.stopShotClock(e.atMs);
        break;
      case "rebound_secured":
      case "rebound_contested":
        // Último libre fallado y vivo: el reloj vuelve a correr al tocar a un jugador.
        if (!this.game.running) this.startGameClock(e.atMs);
        break;
      case "out_of_bounds":
      case "backcourt_violation":
      case "throw_in_violation":
        this.stopGameClock(e.atMs);
        this.stopShotClock(e.atMs);
        break;
      case "shot_clock_violation":
        this.stopGameClock(e.atMs);
        if (this.shot) this.shot.ms = 0;
        this.stopShotClock(e.atMs);
        break;
      case "shot_result":
        if (GAME_CLOCK_STOPS_ON_MADE_BASKET_IN_FIRST_QUARTER) this.stopGameClock(e.atMs);
        break;
      default:
        break;
    }

    if (e.ball) this.ball = e.ball;
    if (e.kind === "field_goal_attempt" && e.detail?.made === true) {
      const team = this.teamOf.get(e.actors[0]!)!;
      this.score[team] = (this.score[team] ?? 0) + Number(e.detail.points ?? 0);
    }
    if (e.kind === "free_throws_result" && e.detail?.made === true) {
      const team = this.teamOf.get(e.actors[0]!)!;
      this.score[team] = (this.score[team] ?? 0) + 1;
    }
    this.pushEvent(e);
    return true;
  }

  // --- posesiones y fases ---------------------------------------------------

  private openPossession(teamId: string, atMs: Milliseconds, kind: PhaseKind, reason: string): boolean {
    this.possessions.push({
      index: this.possessions.length + 1,
      teamId,
      startMs: atMs,
      startReason: reason,
      endMs: null,
      endReason: null,
      phases: [{ index: 1, kind, startMs: atMs, entry: "pendiente", entryReason: "" }],
    });
    return this.emit({
      atMs,
      phase: "ordenado",
      kind: "possession_started",
      actors: [],
      text: `Empieza la posesión ${this.possessions.length} de ${this.team(teamId).name}: ${reason}.`,
      detail: { teamId, phaseKind: kind },
    });
  }

  private closePossession(atMs: Milliseconds, reason: string): boolean {
    const p = this.currentPossession();
    p.endMs = atMs;
    p.endReason = reason;
    this.closed += 1;
    this.backcourt = null;
    this.rngStates.push({ atMs, state: this.rng.state() });
    const ok = this.emit({
      atMs,
      phase: "concedido",
      kind: "possession_ended",
      actors: [],
      text: `Termina la posesión ${p.index} de ${this.team(p.teamId).name}: ${reason}.`,
      detail: { teamId: p.teamId, closed: this.closed },
    });
    if (ok && this.closed >= TRAMO_MAX_POSSESSIONS) {
      this.stop = {
        cause: "cuatro_posesiones",
        atMs,
        explanation: `Se han cerrado ${TRAMO_MAX_POSSESSIONS} posesiones estadísticas; los rebotes ofensivos y las salidas seguras son fases, no posesiones nuevas.`,
      };
      this.pushEvent({ atMs, phase: "concedido", kind: "tramo_stopped", actors: [], text: this.stop.explanation, detail: { cause: "cuatro_posesiones" } });
      return false;
    }
    return ok;
  }

  private newPhase(atMs: Milliseconds, kind: PhaseKind, text: string): boolean {
    const p = this.currentPossession();
    p.phases.push({ index: p.phases.length + 1, kind, startMs: atMs, entry: "pendiente", entryReason: "" });
    if (p.phases.length > this.limits.maxPhasesPerPossession) {
      this.guardianStop(
        atMs,
        `la posesión ${p.index} encadena ${p.phases.length} fases (límite ${this.limits.maxPhasesPerPossession}) sin cerrarse; se detiene y se exporta el motivo en vez de inventar un desenlace.`,
      );
      return false;
    }
    return this.emit({ atMs, phase: "ordenado", kind: "phase_started", actors: [], text, detail: { phaseKind: kind, phaseIndex: p.phases.length } });
  }

  private setPhaseEntry(entry: PossessionRecord["phases"][number]["entry"], reason: string): void {
    const phase = this.currentPossession().phases[this.currentPossession().phases.length - 1]!;
    phase.entry = entry;
    phase.entryReason = reason;
  }

  // --- ciclo principal --------------------------------------------------------

  run(): TramoResult {
    const frame0 = buildFrame(this.input.teams[0], this.input.teams[1]);
    this.openPossession(
      frame0.attacking.id,
      0,
      "inicio_tramo",
      "disposición del escenario «Drop con ayuda» (7:12 del primer cuarto, 18 s de lanzamiento)",
    );
    this.setPhaseEntry("ataque_organizado", "El tramo empieza con los diez ya situados en la disposición del bloqueo directo.");
    let step: Step | null = { kind: "set", frame: frame0, atMs: 0 };
    let steps = 0;
    let zeroTimeSteps = 0;

    while (step && !this.stop) {
      steps += 1;
      if (steps > this.limits.maxSteps) {
        this.guardianStop(step.atMs, `el tramo supera ${this.limits.maxSteps} pasos de orquestación sin completarse.`);
        break;
      }
      const startMs = step.atMs;
      const closedBefore = this.closed;
      const next: Step | null = this.execute(step);
      if (next && next.atMs <= startMs && this.closed === closedBefore) {
        zeroTimeSteps += 1;
        if (zeroTimeSteps > this.limits.maxZeroTimeSteps) {
          this.guardianStop(
            startMs,
            `${zeroTimeSteps} transiciones seguidas sin avanzar el reloj interno ni cerrar una posesión (ciclo inválido «${step.kind}» → «${next.kind}»).`,
          );
          break;
        }
      } else {
        zeroTimeSteps = 0;
      }
      step = next;
    }

    if (!this.stop) this.guardianStop(this.lastMs, "el tramo terminó sin una causa de parada reconocida.");
    return this.finish();
  }

  private execute(step: Step): Step | null {
    switch (step.kind) {
      case "set":
        return this.runSet(step.frame, step.atMs);
      case "organize":
        return this.organize(step.frame, step.atMs, step.holderId);
      case "advance":
        return this.advance(step.frame, step.atMs, step.holderId);
      case "second_chance":
        return this.secondChance(step.frame, step.atMs, step.holderId);
      case "loose_ball":
        return this.looseBall(step.frame, step.atMs, step.ball);
      case "throw_in":
        return this.throwIn(step);
    }
  }

  // --- tramo de cálculo del núcleo -------------------------------------------

  private runCore(frame: Frame, t0: Milliseconds, entry: LinkedEntry, legs?: Record<string, PlannedLeg>): Step | null {
    const local = this.localPositions(frame, t0);
    const matchInput: MatchInput = {
      scenarioId: this.input.startScenarioId,
      coverage: this.input.coverage,
      seed: this.input.seed,
      rulesetVersion: this.input.rulesetVersion,
      labParametersVersion: this.input.labParametersVersion,
      offensePlayers: frame.attacking.players,
      defensePlayers: frame.defending.players,
    };
    const core = computePossessionCore(matchInput, {
      linked: {
        binding: frame.slotToId,
        startPositions: local,
        legs,
        shotClockMs: this.shotRemainingAt(t0),
        gameClockMs: this.game.ms,
        rng: this.rng,
        attackingPriority: frame.attacking.priority,
        entry,
      },
    });

    // Historial local → trayectoria global continua desde t0.
    for (const [slot, entries] of Object.entries(core.positionHistory ?? {})) {
      const id = frame.slotToId[slot]!;
      const track = truncateTrajectory(this.tracks[id]!, t0);
      for (const e of entries.slice(1)) {
        track.push({ atMs: t0 + e.atMs, position: toGlobal(frame.dir, e.position), moving: e.moving });
      }
      this.tracks[id] = track;
    }

    // El desenlace ocurre en el último hecho decisivo; lo que el núcleo
    // calculó después (una ayuda que llega cuando el balón ya está muerto)
    // no se relata como si hubiera cambiado algo.
    const decisive = core.timeline.filter((raw) => DECISIVE_KINDS.has(raw.kind));
    const terminalAtMs = decisive.length > 0 ? Math.max(...decisive.map((raw) => raw.atMs)) : Infinity;
    let endMs = t0;
    for (const raw of core.timeline) {
      if (raw.atMs > terminalAtMs) continue;
      const atMs = t0 + raw.atMs;
      endMs = Math.max(endMs, atMs);
      if (!this.emitCoreEvent(frame, raw, atMs)) return null;
    }
    this.ball = this.globalBall(frame, core.ball);
    return this.afterTerminal(frame, core.terminal, endMs);
  }

  private globalBall(frame: Frame, ball: BallState): BallMark {
    return {
      status: ball.status,
      holderId: ball.holderId ? (frame.slotToId[ball.holderId] ?? ball.holderId) : null,
      fixed: ball.holderId ? null : toGlobal(frame.dir, ball.position),
    };
  }

  private emitCoreEvent(frame: Frame, raw: RawEvent, atMs: Milliseconds): boolean {
    const actors = raw.actors.map((a) => frame.slotToId[a] ?? a);
    const detail = this.translateDetail(frame, raw.detail) as Record<string, unknown>;
    const at = (id: string) => this.positionAt(id, atMs);
    let ball: BallMark | undefined;
    switch (raw.kind) {
      case "pass_released":
        ball = { status: "in_flight_pass", holderId: null, fixed: at(actors[0]!) };
        break;
      case "pass_received":
      case "shot_prepared":
      case "rebound_secured":
      case "rebound_contested":
        ball = { status: "held", holderId: actors[0]!, fixed: null };
        break;
      case "possession_continues":
        ball = { status: "held", holderId: actors[actors.length - 1]!, fixed: null };
        break;
      case "field_goal_attempt":
        ball = { status: "in_flight_shot", holderId: null, fixed: at(actors[0]!) };
        break;
      case "shot_result":
        ball = { status: "dead", holderId: null, fixed: attackedHoopGlobal(frame.dir) };
        this.throwInTeamId = frame.defending.id;
        break;
      case "shot_blocked":
      case "rebound_seeded":
        ball = { status: "loose", holderId: null, fixed: this.ball.fixed ?? at(actors[0]!) };
        break;
      case "pass_control_lost":
        ball = { status: "loose", holderId: null, fixed: at(actors[0]!) };
        break;
      case "turnover":
        ball = { status: "held", holderId: actors[actors.length - 1]!, fixed: null };
        break;
      case "shooting_foul":
        ball = { status: "dead", holderId: null, fixed: at(actors[0]!) };
        this.throwInTeamId = null;
        break;
      case "free_throws_result": {
        const last = detail.index === detail.of;
        ball =
          last && detail.made !== true
            ? { status: "loose", holderId: null, fixed: attackedHoopGlobal(frame.dir) }
            : { status: "dead", holderId: null, fixed: attackedHoopGlobal(frame.dir) };
        if (last && detail.made === true) this.throwInTeamId = frame.defending.id;
        break;
      }
      case "out_of_bounds":
        ball = { status: "dead", holderId: null, fixed: (detail.landingPoint as Point2D | undefined) ?? at(actors[0]!) };
        this.throwInTeamId = frame.defending.id;
        break;
      case "shot_clock_violation":
        ball = { status: "dead", holderId: null, fixed: at(actors[0]!) };
        this.throwInTeamId = frame.defending.id;
        break;
      default:
        break;
    }

    if (raw.kind === "rebound_duties_assigned") {
      const crashers = (detail.crashers as { playerId: string; arrivalSeconds: number }[]) ?? [];
      const balancers = (detail.balancers as { playerId: string; arrivalSeconds: number }[]) ?? [];
      const plan = REBOUND_PRIORITY_LABELS[frame.attacking.priority];
      crashers.forEach((c, i) =>
        this.assignResponsibility(atMs, c.playerId, "cargar_rebote", `Plan «${plan}»: ${i + 1}.º mejor acceso al aro (${formatSeconds(c.arrivalSeconds)}).`),
      );
      balancers.forEach((b) =>
        this.assignResponsibility(atMs, b.playerId, "proteger_balance", `Plan «${plan}»: llegada al aro ${formatSeconds(b.arrivalSeconds)}, prepara el retorno.`),
      );
    }

    return this.emit({ atMs, phase: raw.phase, kind: raw.kind, actors, text: this.translateText(frame, raw.text), detail, ball });
  }

  // --- después de cada desenlace del núcleo -----------------------------------

  private afterTerminal(frame: Frame, terminal: TerminalOutcome, endMs: Milliseconds): Step | null {
    const attackingName = frame.attacking.name;
    switch (terminal.kind) {
      case "made_basket": {
        if (!this.closePossession(endMs, `canasta de ${terminal.points} puntos; saca ${frame.defending.name}`)) return null;
        return this.throwInAfterScore(frame, endMs, "tras canasta");
      }
      case "shooting_foul": {
        const reason =
          terminal.freeThrowsMade > 0
            ? `falta de tiro, ${terminal.freeThrowsMade}/${terminal.freeThrowsAwarded} libres anotados (último anotado); saca ${frame.defending.name}`
            : `falta de tiro; saca ${frame.defending.name}`;
        if (!this.closePossession(endMs, reason)) return null;
        return this.throwInAfterScore(frame, endMs, "tras el último libre anotado");
      }
      case "missed_shot_defensive_rebound": {
        const holder = this.ball.holderId!;
        if (!this.closePossession(endMs, `rebote defensivo de ${holder}: control rival = nueva posesión`)) return null;
        return this.beginLiveControl(this.teamOf.get(holder)!, endMs, holder, "rebote_defensivo", `rebote defensivo de ${holder}`);
      }
      case "steal_by_defense": {
        const holder = this.ball.holderId!;
        if (!this.closePossession(endMs, `robo de ${holder}: control rival = nueva posesión`)) return null;
        return this.beginLiveControl(this.teamOf.get(holder)!, endMs, holder, "robo", `robo de ${holder}`);
      }
      case "missed_shot_offensive_rebound_continues": {
        const holder = this.ball.holderId!;
        // Art. 29: el tiro tocó aro y lo recupera el mismo equipo → 14 s desde el control.
        this.setShotClock(endMs, shotClockAfterLiveControl("rebote_ofensivo_tras_aro", this.shotRemainingAt(endMs)));
        if (
          !this.newPhase(
            endMs,
            "rebote_ofensivo",
            `Rebote ofensivo de ${holder}: nueva fase de la misma posesión de ${attackingName} (reloj de lanzamiento 14 s).`,
          )
        )
          return null;
        return { kind: "second_chance", frame, atMs: endMs, holderId: holder };
      }
      case "live_turnover":
      case "blocked_shot_live_ball": {
        const ballPos = this.ball.fixed!;
        return { kind: "loose_ball", frame, atMs: endMs, ball: ballPos };
      }
      case "out_of_bounds": {
        const lastTouch = frame.slotToId[terminal.lastTouchPlayerId] ?? terminal.lastTouchPlayerId;
        const throwingTeam = this.otherTeam(this.teamOf.get(lastTouch)!);
        const spot = outOfBoundsThrowInSpot(this.ball.fixed!);
        const sameTeam = throwingTeam.id === this.currentPossession().teamId;
        const remaining = this.shotRemainingAt(endMs);
        if (!sameTeam && !this.closePossession(endMs, `balón fuera, último toque de ${lastTouch}; saca ${throwingTeam.name}`)) return null;
        return this.throwInStep(throwingTeam.id, endMs, spot, `balón fuera (último toque de ${lastTouch})`, sameTeam, remaining);
      }
      case "shot_clock_violation": {
        const spot = sidelineThrowInSpot(this.ball.fixed!);
        if (!this.closePossession(endMs, `violación del reloj de lanzamiento; saca ${frame.defending.name}`)) return null;
        return this.throwInStep(frame.defending.id, endMs, spot, "violación del reloj de lanzamiento", false, 0);
      }
      case "possession_reorganized_control_kept": {
        const holder = frame.slotToId[terminal.outletPlayerId] ?? terminal.outletPlayerId;
        if (
          !this.newPhase(
            endMs,
            "salida_segura",
            `Salida segura hacia ${holder}: la posesión de ${attackingName} continúa y se reorganiza, sin reiniciar el reloj de lanzamiento.`,
          )
        )
          return null;
        return { kind: "organize", frame, atMs: endMs, holderId: holder };
      }
      case "simulation_guard_stopped":
        this.guardianStop(endMs, terminal.reason);
        return null;
    }
  }

  private beginLiveControl(teamId: string, atMs: Milliseconds, holderId: string, kind: PhaseKind, reason: string): Step | null {
    // Art. 29: control rival en balón vivo → 24 s desde el control.
    this.setShotClock(atMs, shotClockAfterLiveControl("control_rival", this.shotRemainingAt(atMs)));
    const frame = this.frameFor(teamId);
    const holderLocal = toLocal(frame.dir, this.positionAt(holderId, atMs));
    this.backcourt = isFrontcourtLocal(holderLocal) ? null : { startMs: atMs, elapsedBeforeMs: 0 };
    if (!this.openPossession(teamId, atMs, kind, `${reason} (reloj de lanzamiento 24 s)`)) return null;
    return { kind: "advance", frame, atMs, holderId };
  }

  private throwInAfterScore(frame: Frame, atMs: Milliseconds, reason: string): Step | null {
    const hoop = attackedHoopGlobal(frame.dir);
    // El punto exacto depende del sacador real: el más cercano a la línea de fondo.
    const thrower = this.nearestToPoint(frame.defending, hoop, atMs, []);
    const spot = endLineThrowInSpot(hoop, this.positionAt(thrower, atMs));
    return this.throwInStep(frame.defending.id, atMs, spot, reason, false, 0);
  }

  private throwInStep(
    teamId: string,
    atMs: Milliseconds,
    spot: Point2D,
    reason: string,
    sameTeamKeepsBall: boolean,
    remainingMs: Milliseconds,
  ): Step {
    const frame = this.frameFor(teamId);
    const shotClockMs = shotClockForThrowIn({
      sameTeamKeepsBall,
      remainingMs,
      inThrowingTeamFrontcourt: isFrontcourtLocal(toLocal(frame.dir, spot)),
    });
    return { kind: "throw_in", teamId, atMs, spot, reason, sameTeamKeepsBall, shotClockMs };
  }

  private nearestToPoint(team: TramoTeamSnapshot, point: Point2D, atMs: Milliseconds, exclude: readonly string[]): string {
    return team.players
      .filter((p) => !exclude.includes(p.id))
      .map((p) => ({ id: p.id, t: timeToReach(this.positionAt(p.id, atMs), point, this.runSpeed(p.id)) }))
      .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]!.id;
  }

  // --- saque -------------------------------------------------------------------

  private throwIn(step: Extract<Step, { kind: "throw_in" }>): Step | null {
    const t0 = step.atMs;
    const team = this.team(step.teamId);
    const frame = this.frameFor(step.teamId);
    this.throwInTeamId = team.id;
    this.ball = { status: "dead", holderId: null, fixed: this.ball.fixed ?? step.spot };
    // Sin control todavía: el reloj de lanzamiento no corre para nadie hasta el toque legal.
    this.shot = null;
    if (!step.sameTeamKeepsBall) {
      if (!this.openPossession(team.id, t0, "saque", `saque ${step.reason}`)) return null;
    } else if (!this.newPhase(t0, "saque", `Saque ${step.reason}: ${team.name} conserva el balón y el reloj restante.`)) {
      return null;
    }

    const thrower = this.nearestToPoint(team, step.spot, t0, []);
    const receiver = team.players
      .filter((p) => p.id !== thrower)
      .map((p) => ({ id: p.id, d: distance(this.positionAt(p.id, t0), step.spot) }))
      .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]!.id;

    this.holdAll(t0);
    const tDisposal = this.moveGlobal(thrower, t0, step.spot);
    this.assignResponsibility(t0, thrower, "sacador", `Jugador de ${team.name} más cercano al punto de saque.`);
    this.assignResponsibility(t0, receiver, "receptor_saque", `Compañero más cercano al sacador; recibe donde está.`);
    // El resto empieza ya a colocarse: atacantes a su puesto, rivales a su marca.
    this.planOrganizeLegs(frame, t0, [thrower, receiver]);

    if (
      !this.emit({
        atMs: t0,
        phase: "ordenado",
        kind: "throw_in_awarded",
        actors: [thrower, receiver],
        text: `Saque para ${team.name} ${step.reason}: ${thrower} va al espacio de saque (fuera de la línea) y ${receiver} se ofrece.`,
        detail: { spot: step.spot, shotClockAtTouchMs: step.shotClockMs },
        ball: this.ball,
      })
    )
      return null;

    const releaseMs = tDisposal + secondsToMs(PASS_RELEASE_SECONDS);
    const count = evaluateThrowInCount(tDisposal, releaseMs);
    if (count.violation) {
      this.holdAll(count.violationAtMs!);
      if (!this.emit({ atMs: count.violationAtMs!, phase: "concedido", kind: "throw_in_violation", actors: [thrower], text: `${thrower} no suelta el saque en 5 s: violación.` }))
        return null;
      if (!this.closePossession(count.violationAtMs!, `violación de 5 s en el saque`)) return null;
      return this.throwInStep(this.otherTeam(team.id).id, count.violationAtMs!, step.spot, "tras violación de 5 s", false, 0);
    }

    const receiverPos = this.positionAt(receiver, releaseMs);
    const touchMs = releaseMs + secondsToMs(distance(step.spot, receiverPos) / PASS_FLIGHT_SPEED_MPS);
    const outcome = resolvePass(this.profile(thrower).attributes.T09, this.profile(receiver).attributes.T11, false, 0, 0, this.rng);
    const delayMs = outcome.kind === "awkward_control" ? secondsToMs(outcome.extraDelaySeconds) : 0;
    if (!this.emit({ atMs: releaseMs, phase: "ejecutado", kind: "pass_released", actors: [thrower, receiver], text: `${thrower} saca hacia ${receiver}.`, ball: { status: "in_flight_pass", holderId: null, fixed: step.spot } }))
      return null;

    // Art. 50 / art. 29: los relojes arrancan con el toque legal en la cancha.
    this.throwInTeamId = null;
    if (!this.game.running) this.startGameClock(touchMs);
    this.setShotClock(touchMs, step.shotClockMs);
    const receiverLocal = toLocal(frame.dir, this.positionAt(receiver, touchMs));
    this.backcourt = isFrontcourtLocal(receiverLocal)
      ? null
      : { startMs: touchMs, elapsedBeforeMs: backcourtElapsedAfterThrowIn(step.sameTeamKeepsBall, 0) };
    if (
      !this.emit({
        atMs: touchMs,
        phase: "concedido",
        kind: "throw_in_completed",
        actors: [receiver],
        text: `${receiver} recibe el saque${delayMs > 0 ? " con control incómodo" : ""}: toque legal en la cancha, corre el reloj de lanzamiento (${step.shotClockMs / 1000} s).`,
        ball: { status: "held", holderId: receiver, fixed: null },
      })
    )
      return null;
    return { kind: "advance", frame, atMs: touchMs + delayMs, holderId: receiver };
  }

  // --- organización y acción organizada ----------------------------------------

  /** Destinos de la disposición del bloqueo directo, en el marco local de quien ataca. */
  private dispositionTargets(): Record<string, Point2D> {
    const scenario = getScenario(this.input.startScenarioId);
    const targets: Record<string, Point2D> = {};
    for (const slot of [...scenario.offense, ...scenario.defense]) targets[slot.playerId] = slot.initialPosition;
    return targets;
  }

  /** Planifica a todos (salvo `exclude`) hacia su puesto; devuelve la llegada de cada uno. */
  private planOrganizeLegs(frame: Frame, t0: Milliseconds, exclude: readonly string[]): Record<string, Milliseconds> {
    const targets = this.dispositionTargets();
    const arrivals: Record<string, Milliseconds> = {};
    for (const [slot, id] of Object.entries(frame.slotToId)) {
      if (exclude.includes(id)) continue;
      const target = toGlobal(frame.dir, targets[slot]!);
      arrivals[id] = this.moveGlobal(id, t0, target);
      const attacking = slot.startsWith("O");
      this.assignResponsibility(
        t0,
        id,
        attacking ? "organizacion" : "retorno_defensivo",
        attacking
          ? `Se coloca como ${ROLE_LABELS[slot]} para la acción organizada.`
          : `Vuelve a su marca: ${ROLE_LABELS[slot]}.`,
      );
    }
    return arrivals;
  }

  private organize(frame: Frame, t0: Milliseconds, holderId: string): Step | null {
    const arrivals = this.planOrganizeLegs(frame, t0, []);
    const holderSlot = frame.idToSlot[holderId]!;
    // La acción organizada empieza cuando los cinco atacantes están
    // situados; el ataque no espera a una defensa que llega tarde.
    const attackerIds = OFFENSE_SLOTS.map((slot) => frame.slotToId[slot]!);
    const tAllSet = Math.max(t0, ...attackerIds.map((id) => arrivals[id]!));
    const handlerId = frame.slotToId.O1!;

    // Cuenta de 8 s si el control empezó en pista trasera (art. 28).
    if (this.backcourt) {
      const from = toLocal(frame.dir, this.positionAt(holderId, t0));
      const to = this.dispositionTargets()[holderSlot]!;
      const offset = frontcourtEntryOffsetSeconds(from, to, (arrivals[holderId]! - t0) / 1000);
      const crossingMs = offset === null ? null : t0 + secondsToMs(offset);
      const count = evaluateBackcourtCount(this.backcourt.startMs, crossingMs, this.backcourt.elapsedBeforeMs);
      if (count.violation && count.violationAtMs! <= tAllSet) return this.backcourtViolation(frame, count.violationAtMs!, holderId);
      this.backcourt = null;
    }

    let tReady = tAllSet;
    const passNeeded = holderId !== handlerId;
    const releaseMs = tAllSet + secondsToMs(PASS_RELEASE_SECONDS);
    if (passNeeded) {
      const flightMs = secondsToMs(distance(this.positionAt(holderId, tAllSet), this.positionAt(handlerId, tAllSet)) / PASS_FLIGHT_SPEED_MPS);
      tReady = releaseMs + flightMs;
    }

    // Reloj de lanzamiento durante la organización.
    const expiry = this.shotExpiryMs();
    if (expiry <= tReady) {
      const holderAtExpiry = passNeeded && expiry > releaseMs ? handlerId : holderId;
      return this.shotClockViolationDuringPlay(frame, expiry, holderAtExpiry);
    }

    if (passNeeded) {
      const outcome = resolvePass(this.profile(holderId).attributes.T09, this.profile(handlerId).attributes.T11, false, 0, 0, this.rng);
      if (!this.emit({ atMs: releaseMs, phase: "ejecutado", kind: "pass_released", actors: [holderId, handlerId], text: `${holderId} devuelve el balón al base ${handlerId} para iniciar la acción.`, ball: { status: "in_flight_pass", holderId: null, fixed: this.positionAt(holderId, releaseMs) } }))
        return null;
      if (!this.emit({ atMs: tReady, phase: "concedido", kind: "pass_received", actors: [handlerId], text: `${handlerId} recibe en su puesto.`, ball: { status: "held", holderId: handlerId, fixed: null } }))
        return null;
      if (outcome.kind === "awkward_control") tReady += secondsToMs(outcome.extraDelaySeconds);
      if (this.shotExpiryMs() <= tReady) return this.shotClockViolationDuringPlay(frame, this.shotExpiryMs(), handlerId);
    }
    return this.runSet(frame, tReady);
  }

  private runSet(frame: Frame, t0: Milliseconds): Step | null {
    const remaining = this.shotRemainingAt(t0);
    const targets = this.dispositionTargets();
    const local = this.localPositions(frame, t0);
    // Defensores que aún no han llegado a su puesto: entran en la acción
    // desde donde están de verdad. Los que el árbol del bloqueo usa como
    // origen de una ayuda, reparación o protección del aro parten de esa
    // posición real (así el retraso tiene efecto causal); el resto sigue
    // su carrera hacia su marca mientras se juega.
    const positionalDefenders = this.input.coverage === "trampa" ? ["D2", "D3", "D4", "D5"] : ["D3", "D4", "D5"];
    const legs: Record<string, PlannedLeg> = {};
    const late: string[] = [];
    for (const slot of DEFENSE_SLOTS) {
      const id = frame.slotToId[slot]!;
      const gap = distance(local[slot]!, targets[slot]!);
      if (gap <= 0.05) continue;
      const remainingRun = timeToReach(local[slot]!, targets[slot]!, this.runSpeed(id));
      late.push(`${id} (a ${formatSeconds(remainingRun)} de su puesto)`);
      if (!positionalDefenders.includes(slot)) {
        legs[slot] = { departSeconds: 0, arriveSeconds: remainingRun, to: targets[slot]! };
      }
    }
    for (const [slot, id] of Object.entries(frame.slotToId)) {
      this.assignResponsibility(t0, id, "accion_organizada", `En la acción organizada: ${ROLE_LABELS[slot]}.`);
    }
    const lateText = late.length > 0 ? ` Defensa todavía sin colocar: ${late.join(", ")}.` : "";
    if (
      !this.emit({
        atMs: t0,
        phase: "ordenado",
        kind: "organized_entry",
        actors: [frame.slotToId.O1!, frame.slotToId.O5!],
        text: `Los cinco atacantes están situados: ${frame.slotToId.O1} y ${frame.slotToId.O5} inician el bloqueo directo central (${this.input.coverage === "trampa" ? "trampa" : "drop"}) con ${(remaining / 1000).toFixed(1)} s de lanzamiento.${lateText}`,
        detail: { shotClockMs: remaining, lateDefenders: late },
        ball: { status: "held", holderId: frame.slotToId.O1!, fixed: null },
      })
    )
      return null;
    return this.runCore(frame, t0, { kind: "organized_set" }, legs);
  }

  private backcourtViolation(frame: Frame, atMs: Milliseconds, holderId: string): Step | null {
    this.holdAll(atMs);
    if (
      !this.emit({
        atMs,
        phase: "concedido",
        kind: "backcourt_violation",
        actors: [holderId],
        text: `${frame.attacking.name} no pasa el balón a pista delantera en 8 s: violación.`,
        ball: { status: "dead", holderId: null, fixed: this.positionAt(holderId, atMs) },
      })
    )
      return null;
    this.throwInTeamId = frame.defending.id;
    if (!this.closePossession(atMs, "violación de 8 s")) return null;
    return this.throwInStep(frame.defending.id, atMs, sidelineThrowInSpot(this.positionAt(holderId, atMs)), "tras violación de 8 s", false, 0);
  }

  private shotClockViolationDuringPlay(frame: Frame, atMs: Milliseconds, holderId: string): Step | null {
    this.holdAll(atMs);
    const ballPos = this.positionAt(holderId, atMs);
    if (
      !this.emit({
        atMs,
        phase: "concedido",
        kind: "shot_clock_violation",
        actors: [holderId],
        text: `Se agota el reloj de lanzamiento de ${frame.attacking.name} antes de poder lanzar: violación, balón muerto.`,
        ball: { status: "dead", holderId: null, fixed: ballPos },
      })
    )
      return null;
    this.throwInTeamId = frame.defending.id;
    if (!this.closePossession(atMs, `violación del reloj de lanzamiento; saca ${frame.defending.name}`)) return null;
    return this.throwInStep(frame.defending.id, atMs, sidelineThrowInSpot(ballPos), "tras violación del reloj de lanzamiento", false, 0);
  }

  // --- transición ------------------------------------------------------------------

  private participants(frame: Frame, local: Record<string, Point2D>, slots: readonly string[]): RaceParticipant[] {
    return slots.map((slot) => {
      const id = frame.slotToId[slot]!;
      const p = this.profile(id);
      return {
        slot,
        id,
        position: local[slot]!,
        runSpeedMps: attackerMoveSpeedMps(p.attributes.F01),
        lateralSpeedMps: defenderLateralSpeedMps(p.attributes.F04),
        t23: p.attributes.T23,
      };
    });
  }

  private advance(frame: Frame, t0: Milliseconds, holderId: string): Step | null {
    const handlerId = frame.slotToId.O1!;
    let carrierId = holderId;
    let t1 = t0;
    const local0 = this.localPositions(frame, t0);
    const defenders0 = this.participants(frame, local0, DEFENSE_SLOTS);

    // Mientras se decide la salida, los demás ya se mueven hacia su puesto o su marca.
    this.planOrganizeLegs(frame, t0, [holderId, handlerId]);
    this.tracks[holderId] = truncateTrajectory(this.tracks[holderId]!, t0);
    this.tracks[handlerId] = truncateTrajectory(this.tracks[handlerId]!, t0);

    if (holderId !== handlerId) {
      const outlet = readOutlet(local0[frame.idToSlot[holderId]!]!, local0.O1!, defenders0);
      if (outlet.viable) {
        const releaseMs = t0 + secondsToMs(PASS_RELEASE_SECONDS);
        const arrivalMs = t0 + secondsToMs(outlet.passArrivalSeconds);
        this.assignResponsibility(t0, holderId, "salida", "Asegura el balón y busca la salida.");
        this.assignResponsibility(t0, handlerId, "salida", "Se ofrece como receptor de la salida.");
        if (!this.emit({ atMs: t0, phase: "reconocido", kind: "transition_outlet", actors: [holderId, handlerId], text: `${holderId} ve salida viable hacia ${handlerId}: el primer rival (${outlet.closestDefender.id}) tardaría ${formatSeconds(outlet.closestDefender.arrivalSeconds)} y el pase llega en ${formatSeconds(outlet.passArrivalSeconds)}.` }))
          return null;
        const pass = resolvePass(this.profile(holderId).attributes.T09, this.profile(handlerId).attributes.T11, false, 0, 0, this.rng);
        if (!this.emit({ atMs: releaseMs, phase: "ejecutado", kind: "pass_released", actors: [holderId, handlerId], text: `${holderId} da el pase de salida a ${handlerId}.`, ball: { status: "in_flight_pass", holderId: null, fixed: this.positionAt(holderId, releaseMs) } }))
          return null;
        if (!this.emit({ atMs: arrivalMs, phase: "concedido", kind: "pass_received", actors: [handlerId], text: `${handlerId} recibe la salida${pass.kind === "awkward_control" ? " con control incómodo" : ""}.`, ball: { status: "held", holderId: handlerId, fixed: null } }))
          return null;
        carrierId = handlerId;
        t1 = arrivalMs + (pass.kind === "awkward_control" ? secondsToMs(pass.extraDelaySeconds) : 0);
      } else {
        this.assignResponsibility(t0, holderId, "salida", "Sin salida viable: conserva y sube el balón.");
        if (!this.emit({ atMs: t0, phase: "reconocido", kind: "transition_outlet", actors: [holderId], text: `Sin salida viable hacia ${handlerId} (${outlet.interceptor ? `${outlet.interceptor.id} podría cortar la línea del pase` : `${outlet.closestDefender.id} llegaría antes que el pase`}): ${holderId} conserva y sube el balón.` }))
          return null;
      }
    } else {
      this.assignResponsibility(t0, holderId, "salida", "El base asegura y sube el balón él mismo.");
      if (!this.emit({ atMs: t0, phase: "reconocido", kind: "transition_outlet", actors: [holderId], text: `El base ${holderId} tiene el balón y lo sube él mismo.` }))
        return null;
    }

    // Carrera hacia el aro desde las posiciones reales en t1.
    const local = this.localPositions(frame, t1);
    const carrierSlot = frame.idToSlot[carrierId]!;
    const attackers = this.participants(frame, local, OFFENSE_SLOTS);
    const defenders = this.participants(frame, local, DEFENSE_SLOTS);
    const carrier = attackers.find((a) => a.slot === carrierSlot)!;
    const read = readTransition(
      carrier,
      attackers.filter((a) => a.slot !== carrierSlot),
      defenders,
      this.shotRemainingAt(t1) / 1000,
    );

    if (read.kind === "sin_ventaja") {
      const reason = `Sin ventaja: ataque organizado. Primer defensor en el aro: ${read.firstDefender.id} (${formatSeconds(read.firstDefender.arrivalSeconds)}); atacante más rápido: ${read.fastestAttacker.id} (${formatSeconds(read.fastestAttacker.arrivalSeconds)}); ${read.reason}.`;
      this.setPhaseEntry("ataque_organizado", reason);
      if (!this.emit({ atMs: t1, phase: "reconocido", kind: "transition_read", actors: [carrierId], text: reason, detail: { advantage: false } }))
        return null;
      return { kind: "organize", frame, atMs: t1, holderId: carrierId };
    }

    const shooterSlot = read.kind === "penetracion" ? carrierSlot : read.receiver.slot;
    const shooterId = frame.slotToId[shooterSlot]!;
    const shooterArrival =
      read.kind === "penetracion" ? read.carrier.arrivalSeconds : timeToReach(local[shooterSlot]!, ATTACKED_HOOP, this.runSpeed(shooterId));
    const contesterTimed = read.kind === "superioridad" ? read.secondDefender : read.firstDefender;
    const reason =
      read.kind === "penetracion"
        ? `Ventaja temprana: ${carrierId} ataca el aro y llega en ${formatSeconds(read.carrier.arrivalSeconds)}, antes que el primer defensor (${read.firstDefender.id}, ${formatSeconds(read.firstDefender.arrivalSeconds)}).`
        : read.kind === "pase_adelantado"
          ? `Ventaja temprana: ${carrierId} adelanta el balón a ${shooterId}, que llega al aro en ${formatSeconds(read.receiver.arrivalSeconds)}, antes que el primer defensor (${read.firstDefender.id}, ${formatSeconds(read.firstDefender.arrivalSeconds)}).`
          : `Ventaja temprana 2×1: ${read.firstDefender.id} para a ${carrierId} en el aro (${formatSeconds(read.carrier.arrivalSeconds)}) y ${shooterId} recibe en ${formatSeconds(read.receiver.arrivalSeconds)}, antes que el segundo defensor (${read.secondDefender.id}, ${formatSeconds(read.secondDefender.arrivalSeconds)}).`;

    // Cuenta de 8 s: el balón debe entrar en pista delantera a tiempo
    // (penetración y 2×1: el portador bota; pase adelantado: vuela el balón).
    if (this.backcourt) {
      const from = local[carrierSlot]!;
      const duration = read.kind === "pase_adelantado" ? read.passArrivalSeconds : read.carrier.arrivalSeconds;
      const offset = frontcourtEntryOffsetSeconds(from, ATTACKED_HOOP, duration);
      const crossingMs = offset === null ? null : t1 + secondsToMs(offset);
      const count = evaluateBackcourtCount(this.backcourt.startMs, crossingMs, this.backcourt.elapsedBeforeMs);
      if (count.violation) return this.backcourtViolation(frame, count.violationAtMs!, carrierId);
      this.backcourt = null;
    }

    this.setPhaseEntry("ventaja_temprana", reason);
    this.assignResponsibility(t1, shooterId, "carril_transicion", "Ataca el aro antes de que llegue su defensor.");
    if (!this.emit({ atMs: t1, phase: "reconocido", kind: "transition_read", actors: [carrierId, shooterId], text: reason, detail: { advantage: true, kind: read.kind } }))
      return null;

    // Diez desplazamientos reales mientras se resuelve la ventaja: quienes
    // atacan el aro y los defensores que lo protegen van al aro; el resto,
    // a su puesto o su marca.
    const targets = this.dispositionTargets();
    const toRim = new Set<string>([shooterSlot, read.firstDefender.slot, contesterTimed.slot]);
    if (read.kind === "superioridad") toRim.add(carrierSlot);
    const defenderArrival = new Map<string, number>([
      [read.firstDefender.slot, read.firstDefender.arrivalSeconds],
      [contesterTimed.slot, contesterTimed.arrivalSeconds],
    ]);
    const legs: Record<string, PlannedLeg> = {};
    for (const p of [...attackers, ...defenders]) {
      const to = toRim.has(p.slot) ? ATTACKED_HOOP : targets[p.slot]!;
      const arrive = defenderArrival.get(p.slot) ?? timeToReach(p.position, to, p.runSpeedMps);
      legs[p.slot] = { departSeconds: 0, arriveSeconds: arrive, to };
      if (p.slot.startsWith("D")) {
        this.assignResponsibility(
          t1,
          p.id,
          "retorno_defensivo",
          p.slot === read.firstDefender.slot
            ? "Primer responsable de proteger el aro en la transición."
            : p.slot === contesterTimed.slot
              ? "Segundo en llegar: debe cerrar al compañero liberado."
              : `Vuelve a su marca: ${ROLE_LABELS[p.slot]}.`,
        );
      }
    }
    const contester = defenders.find((d) => d.slot === contesterTimed.slot)!;
    const entry: LinkedEntry = {
      kind: "direct_finish",
      shooterSlot,
      finishSpot: ATTACKED_HOOP,
      shooterAtSpotSeconds: shooterArrival,
      pass:
        read.kind === "penetracion"
          ? null
          : { passerSlot: carrierSlot, releaseSeconds: read.passReleaseSeconds, arrivalSeconds: read.passArrivalSeconds },
      contesterSlot: contester.slot,
      contesterArrivalSeconds: contesterTimed.arrivalSeconds,
      contesterGeometry: {
        originPos: contester.position,
        destinationPos: ATTACKED_HOOP,
        speedMps: contester.runSpeedMps,
        brakingExtraSeconds: closeoutBrakingExtraSeconds(this.profile(contester.id).attributes.F03),
      },
    };
    return this.runCore(frame, t1, entry, legs);
  }

  private secondChance(frame: Frame, t0: Milliseconds, holderId: string): Step | null {
    const local = this.localPositions(frame, t0);
    const slot = frame.idToSlot[holderId]!;
    const rebounder = this.participants(frame, local, [slot])[0]!;
    const defenders = this.participants(frame, local, DEFENSE_SLOTS);
    const read = readSecondChance(rebounder, defenders);
    const remaining = this.shotRemainingAt(t0) / 1000;

    if (!read.putback || remaining <= 2) {
      const reason = `Sin carril tras el rebote: ${read.firstDefender.id} protege el aro en ${formatSeconds(read.firstDefender.arrivalSeconds)} y ${holderId} tardaría ${formatSeconds(read.rebounderArrivalSeconds)}; la posesión sale y se reorganiza.`;
      this.setPhaseEntry("ataque_organizado", reason);
      if (!this.emit({ atMs: t0, phase: "reconocido", kind: "second_chance_read", actors: [holderId], text: reason, detail: { putback: false } }))
        return null;
      return { kind: "organize", frame, atMs: t0, holderId };
    }

    const reason = `Segunda oportunidad: ${holderId} llega al aro en ${formatSeconds(read.rebounderArrivalSeconds)}, antes que ${read.firstDefender.id} (${formatSeconds(read.firstDefender.arrivalSeconds)}).`;
    this.setPhaseEntry("segunda_oportunidad", reason);
    if (!this.emit({ atMs: t0, phase: "reconocido", kind: "second_chance_read", actors: [holderId], text: reason, detail: { putback: true } }))
      return null;
    const contester = defenders.find((d) => d.slot === read.firstDefender.slot)!;
    return this.runCore(
      frame,
      t0,
      {
        kind: "direct_finish",
        shooterSlot: slot,
        finishSpot: ATTACKED_HOOP,
        shooterAtSpotSeconds: read.rebounderArrivalSeconds,
        pass: null,
        contesterSlot: contester.slot,
        contesterArrivalSeconds: read.firstDefender.arrivalSeconds,
        contesterGeometry: {
          originPos: contester.position,
          destinationPos: ATTACKED_HOOP,
          speedMps: contester.lateralSpeedMps,
          brakingExtraSeconds: closeoutBrakingExtraSeconds(this.profile(contester.id).attributes.F03),
        },
      },
      { [slot]: { departSeconds: 0, arriveSeconds: read.rebounderArrivalSeconds, to: ATTACKED_HOOP } },
    );
  }

  // --- balón suelto ------------------------------------------------------------------

  private looseBall(frame: Frame, t0: Milliseconds, ball: Point2D): Step | null {
    if (!isInsideCourt(ball)) {
      this.guardianStop(t0, "balón suelto fuera de la cancha sin último toque adjudicable; ME-03 no inventa la reanudación.");
      return null;
    }
    this.holdAll(t0);
    const ids = Object.keys(this.tracks).sort();
    const candidates = ids.map((id) => {
      const p = this.profile(id);
      return {
        playerId: id,
        arrivalTimeSeconds: timeToReach(this.positionAt(id, t0), ball, REBOUND_CANDIDATE_SPEED_MPS),
        closedOut: false,
        t19: p.attributes.T19,
        f05: p.attributes.F05,
        t20: p.attributes.T20,
      };
    });
    const outcome = resolveRebound({ landingPoint: ball, flightTimeSeconds: 0 }, candidates, this.rng);
    if (outcome.kind === "out_of_bounds") {
      this.guardianStop(t0, "balón suelto sin candidatos para recuperarlo.");
      return null;
    }
    const winner = outcome.kind === "secured" ? outcome.playerId : pickTipWinnerByT20(outcome, (id) => this.profile(id).attributes.T20);
    const arrival = candidates.find((c) => c.playerId === winner)!.arrivalTimeSeconds;
    const tControl = t0 + secondsToMs(arrival);
    const track = truncateTrajectory(this.tracks[winner]!, t0);
    if (tControl > t0) track.push({ atMs: tControl, position: ball, moving: true });
    this.tracks[winner] = track;

    const possessionTeam = this.currentPossession().teamId;
    const winnerTeam = this.teamOf.get(winner)!;
    const sameTeam = winnerTeam === possessionTeam;
    if (
      !this.emit({
        atMs: tControl,
        phase: "concedido",
        kind: "loose_ball_recovered",
        actors: [winner],
        text: sameTeam
          ? `${winner} recupera el balón suelto para su equipo (llega en ${formatSeconds(arrival)}): la posesión continúa.`
          : `${winner} recupera el balón suelto para ${this.team(winnerTeam).name} (llega en ${formatSeconds(arrival)}); no se anota robo porque nadie controlaba el balón.`,
        detail: { sameTeam, contested: outcome.kind === "loose_ball_tip" },
        ball: { status: "held", holderId: winner, fixed: null },
      })
    )
      return null;

    if (sameTeam) {
      // Sin toque de aro no hay reinicio de 14 s: se conserva el reloj restante.
      const remaining = this.shotRemainingAt(tControl);
      this.setShotClock(tControl, shotClockAfterLiveControl("recuperacion_propia_sin_aro", remaining));
      if (!this.newPhase(tControl, "recuperacion_propia", `${winner} recupera el balón suelto: nueva fase de la misma posesión, reloj de lanzamiento sin reiniciar (${(remaining / 1000).toFixed(1)} s).`))
        return null;
      return { kind: "organize", frame, atMs: tControl, holderId: winner };
    }
    if (!this.closePossession(tControl, `balón suelto recuperado por ${winner}: control rival = nueva posesión`)) return null;
    return this.beginLiveControl(winnerTeam, tControl, winner, "recuperacion_rival", `recuperación de balón suelto de ${winner}`);
  }

  // --- resultado ------------------------------------------------------------------------

  private finish(): TramoResult {
    const stop = this.stop!;
    const ids = Object.keys(this.tracks).sort();
    for (const id of ids) this.tracks[id] = truncateTrajectory(this.tracks[id]!, stop.atMs);

    const events: TramoEvent[] = this.events.map((e, i) => {
      const positions: PlayerSnapshot[] = ids.map((id) => ({ playerId: id, position: this.positionAt(id, e.atMs) }));
      const ball: TramoBallState = {
        status: e.ball.status,
        holderId: e.ball.holderId,
        position: e.ball.holderId ? this.positionAt(e.ball.holderId, e.atMs) : (e.ball.fixed ?? { x: 14, y: 7.5 }),
      };
      return { ...e, sequence: i, positions, ball };
    });

    const box: Record<string, TramoTeamBox> = {};
    for (const team of this.input.teams) {
      const mine = (id: string | undefined) => (id ? this.teamOf.get(id) === team.id : false);
      let fga2 = 0,
        fgm2 = 0,
        fga3 = 0,
        fgm3 = 0,
        fta = 0,
        ftm = 0,
        oreb = 0,
        dreb = 0;
      for (const e of events) {
        const actor = e.actors[0];
        if (e.kind === "field_goal_attempt" && mine(actor)) {
          const made = e.detail.made === true;
          if (e.detail.shotType === "three_point") {
            fga3++;
            if (made) fgm3++;
          } else {
            fga2++;
            if (made) fgm2++;
          }
        } else if (e.kind === "free_throws_result" && mine(actor)) {
          fta++;
          if (e.detail.made === true) ftm++;
        } else if ((e.kind === "rebound_secured" || e.kind === "rebound_contested") && mine(actor)) {
          if (e.possessionTeamId === team.id) oreb++;
          else dreb++;
        }
      }
      box[team.id] = {
        fieldGoalAttempts2: fga2,
        fieldGoalMade2: fgm2,
        fieldGoalAttempts3: fga3,
        fieldGoalMade3: fgm3,
        freeThrowAttempts: fta,
        freeThrowMade: ftm,
        points: 2 * fgm2 + 3 * fgm3 + ftm,
        offensiveRebounds: oreb,
        defensiveRebounds: dreb,
      };
    }

    return {
      input: this.input,
      events,
      possessions: this.possessions.map((p) => ({ ...p, phases: p.phases.map((ph) => ({ ...ph })) })),
      responsibilities: this.responsibilities,
      tracks: Object.fromEntries(ids.map((id) => [id, this.tracks[id]!])),
      stop,
      finalScore: { ...this.score },
      box,
      rngStateAtBoundaries: this.rngStates,
      closedPossessions: this.closed,
    };
  }
}

/**
 * Juega un tramo de hasta cuatro posesiones estadísticas enlazadas.
 * Determinista: misma `TramoInput` produce los mismos cierres, hechos,
 * relojes y posiciones.
 */
export function playTramo(input: TramoInput, options: PlayTramoOptions = {}): TramoResult {
  return new TramoRun(input, options).run();
}

