/**
 * Motor de continuidad de posesiones enlazadas (ME-03, ADR-0006),
 * compartido por el tramo de ME-03 (`play-tramo.ts`) y por el partido
 * completo de ME-04 (`domain/game/play-full-game.ts`). La misma cancha, los
 * mismos diez jugadores en pista y el mismo balón atraviesan rebotes,
 * pérdidas, canastas, saques y cambios de dirección: cada frontera hereda
 * posiciones reales, relojes, balón, encargos y el estado del azar. No
 * concatena llamadas a `runPossession` ni recarga el fixture.
 *
 * El árbol de pase/tiro/tapón/falta/rebote es el del núcleo compartido
 * (`possession-core.ts`, modo enlazado). Esta clase solo orquesta: marco
 * local del equipo que ataca, reglas de reloj y reanudación FIBA 2026
 * alcanzables (`fiba-clock-rules.ts`), transición y saques. Lo que
 * distingue un tramo de un partido (quintetos, sentido de ataque por
 * período, fin de período, bonus, sustituciones) entra por los métodos
 * `protected` que cada modo redefine; el tramo conserva exactamente su
 * comportamiento de ME-03.
 */
import type { Point2D } from "../geometry/point";
import { distance, moveToward, timeToReach } from "../geometry/point";
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
import type {
  MatchInput,
  OffensivePlan,
  DefensiveCoverage,
  OffensivePlanChoice,
  DefensiveCoverageChoice,
  OffBallDefensiveCallChoice,
  OffensiveCreationPriority,
  ChainedVariantChoice,
  BackScreenCallChoice,
} from "../lab/match-input";
import { getScenario } from "../lab/scenario";
import type { ObservedOutcome } from "../lab/lab-0-4-parameters";
import { LATERAL_PNR_TARGETS, type ScreenPlacement, type ScreenPlacementChoice } from "../lab/lab-0-7-parameters";
import { HORNS_PNR_TARGETS } from "../lab/lab-0-8-parameters";
import { DELAY_TARGETS } from "../lab/lab-0-10-parameters";
import { eligiblePlacements, type PlaybookCardId } from "../tactics/playbook-card";
import { FIRST_READ_TIE_BAND_POINTS, contestReachMeters, evaluateContestLevel, type LAB_0_3_PARAMETERS_VERSION } from "../lab/lab-0-3-parameters";
import {
  attackerMoveSpeedMps,
  defenderLateralSpeedMps,
  closeoutBrakingExtraSeconds,
  PASS_FLIGHT_SPEED_MPS,
  PASS_RELEASE_SECONDS,
  THREE_POINT_BASE_PROBABILITY,
  shotProbability,
  movingShotPrepSeconds,
  type EffectiveOpposition,
} from "../lab/lab-0-1-parameters";
import type { PlayerProfile } from "../players/player-profile";
import type { FactKind, FactPhase, PlayerSnapshot } from "../simulation/fact";
import type { TerminalOutcome, BallState, BallStatus } from "../simulation/match-state";
import {
  computePossessionCore,
  projectOrganizedOpportunity,
  REBOUND_CANDIDATE_SPEED_MPS,
  type LinkedEntry,
  type LinkedGameRules,
  type PlannedLeg,
  type PossessionCoreResult,
  type RawEvent,
  type ReboundPriority,
} from "../simulation/possession-core";
import { resolvePass } from "../simulation/resolvers/pass-resolver";
import { resolveRebound, pickTipWinnerByT20 } from "../simulation/resolvers/rebound-resolver";
import {
  SHOT_CLOCK_FULL_MS,
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
  planTransitionPullUps,
  type RaceParticipant,
} from "./transition";
import {
  REBOUND_PRIORITY_LABELS,
  type ControlState,
  type PhaseEntry,
  type PhaseKind,
  type PossessionRecord,
  type Responsibility,
  type ResponsibilityChange,
  type TramoBallState,
  type TramoEvent,
} from "./tramo-model";
import { createNoopAuditCollector, type AuditCollector } from "../audit/audit-collector";

export interface LinkedLimits {
  /** Fases (rebotes ofensivos, salidas, recuperaciones) máximas en una posesión. */
  readonly maxPhasesPerPossession: number;
  /** Pasos de orquestación máximos de la corrida completa. */
  readonly maxSteps: number;
  /** Pasos consecutivos sin avanzar el reloj interno antes de declarar un ciclo. */
  readonly maxZeroTimeSteps: number;
}

/** Equipo tal y como lo necesita el motor: identidad, nombre y plan tras tiro. */
export interface LinkedTeam {
  readonly id: string;
  readonly name: string;
  readonly priority: ReboundPriority;
}

export interface LinkedRunSettings {
  readonly seed: number;
  readonly rulesetVersion: "FIBA-2026";
  readonly labParametersVersion: typeof LAB_0_3_PARAMETERS_VERSION;
  /** Disposición del bloqueo directo que usan la organización y el núcleo. */
  readonly dispositionScenarioId: "drop_con_ayuda";
  readonly teams: readonly [LinkedTeam, LinkedTeam];
  /** Todos los perfiles inscritos (copia estable), con su equipo. */
  readonly roster: readonly { readonly teamId: string; readonly profile: PlayerProfile }[];
  readonly limits: LinkedLimits;
  /** Colector de auditoría (ME-04A); por defecto no hace nada (mismo coste que antes). */
  readonly audit?: AuditCollector;
}

export const OFFENSE_SLOTS = ["O1", "O2", "O3", "O4", "O5"] as const;
export const DEFENSE_SLOTS = ["D1", "D2", "D3", "D4", "D5"] as const;
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
  "shooting_foul",
  "non_shooting_foul",
  "second_entry",
]);

export const ROLE_LABELS: Readonly<Record<string, string>> = {
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

/** Equipo en un marco: su quinteto en pista en el orden de rol del sistema. */
export interface FrameTeam {
  readonly id: string;
  readonly name: string;
  readonly priority: ReboundPriority;
  readonly players: readonly PlayerProfile[];
}

/**
 * Marco de una fase: quién ataca, hacia dónde, y qué jugador real ocupa
 * cada rol canónico de la acción (el orden del quinteto da el rol; el
 * equipo lo da el control del balón, no el prefijo del ID).
 */
export interface Frame {
  readonly attacking: FrameTeam;
  readonly defending: FrameTeam;
  readonly dir: AttackDirection;
  readonly slotToId: Readonly<Record<string, string>>;
  readonly idToSlot: Readonly<Record<string, string>>;
}

export function buildFrameFromTeams(attacking: FrameTeam, defending: FrameTeam, dir: AttackDirection): Frame {
  const slotToId: Record<string, string> = {};
  OFFENSE_SLOTS.forEach((slot, i) => (slotToId[slot] = attacking.players[i]!.id));
  DEFENSE_SLOTS.forEach((slot, i) => (slotToId[slot] = defending.players[i]!.id));
  const idToSlot = Object.fromEntries(Object.entries(slotToId).map(([slot, id]) => [id, slot]));
  return { attacking, defending, dir, slotToId, idToSlot };
}

/** Intercambia las marcas de dos defensores (IDs reales) en un marco; `null` si alguno no está en él. */
function swapDefenders(frame: Frame, x: string, y: string): Frame | null {
  const sx = frame.idToSlot[x];
  const sy = frame.idToSlot[y];
  if (!sx || !sy) return null;
  const map = { ...frame.slotToId };
  map[sx] = y;
  map[sy] = x;
  return rebindFrame(frame, map);
}

/**
 * Marco `fresh` (roles del quinteto) con las parejas atacante-defensor vivas de
 * `live`: cada atacante conserva al defensor que lo marcaba en ese instante
 * (ME-07B v2 §5, sesión v2-6: un balón suelto recuperado por el ataque no
 * deshace un cambio defensivo anterior de la misma posesión).
 */
function withLivePairs(fresh: Frame, live: Frame): Frame {
  const map = { ...fresh.slotToId };
  for (let k = 1; k <= 5; k++) {
    const attacker = fresh.slotToId[`O${k}`]!;
    const liveSlot = live.idToSlot[attacker];
    if (!liveSlot) return fresh;
    map[`D${k}`] = live.slotToId[`D${liveSlot.slice(1)}`]!;
  }
  return rebindFrame(fresh, map);
}

/** Mismo marco con otra asignación de roles canónicos (p. ej. la segunda entrada de ME-04). */
export function rebindFrame(frame: Frame, slotToId: Readonly<Record<string, string>>): Frame {
  const idToSlot = Object.fromEntries(Object.entries(slotToId).map(([slot, id]) => [id, slot]));
  return { ...frame, slotToId, idToSlot };
}

export type Step =
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
      /** Texto de la fase cuando el mismo equipo conserva el balón con otro reloj (p. ej. falta sin bonus, ME-04). */
      readonly note?: string;
    }
  /** Paso propio de un modo (p. ej. inicio de período del partido). */
  | { readonly kind: "custom"; readonly label: string; readonly atMs: Milliseconds; readonly run: () => Step | null };

export interface BallMark {
  readonly status: BallStatus;
  readonly holderId: string | null;
  /** Posición fija (balón sin poseedor); con poseedor se sigue su trayectoria. */
  readonly fixed: Point2D | null;
}

export interface PendingEvent {
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
  readonly period: number;
  readonly onCourtIds: readonly string[];
}

export interface EmitArgs {
  readonly atMs: Milliseconds;
  readonly phase: FactPhase;
  readonly kind: FactKind;
  readonly actors: readonly string[];
  readonly text: string;
  readonly detail?: Readonly<Record<string, unknown>>;
  readonly ball?: BallMark;
}

export interface LinkedStop {
  readonly cause: string;
  readonly atMs: Milliseconds;
  readonly explanation: string;
}

export function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(2).replace(".", ",")} s`;
}

export abstract class LinkedRun {
  protected readonly settings: LinkedRunSettings;
  protected readonly limits: LinkedLimits;
  protected readonly rng: ResumableRandom;
  protected readonly profiles = new Map<string, PlayerProfile>();
  protected readonly teamOf = new Map<string, string>();
  protected readonly teams = new Map<string, LinkedTeam>();
  protected readonly tracks: Record<string, TrajectoryPoint[]> = {};
  protected readonly events: PendingEvent[] = [];
  protected readonly possessions: PossessionRecord[] = [];
  protected readonly responsibilities: ResponsibilityChange[] = [];
  protected readonly currentResponsibility = new Map<string, Responsibility>();
  protected readonly rngStates: { atMs: Milliseconds; state: number }[] = [];
  protected readonly score: Record<string, number> = {};
  protected readonly audit: AuditCollector;
  /**
   * ME-07B v2 §2.3/§5: muestras visibles de este partido. Por equipo, usos y
   * puntos (del atacante, desde la decisión hasta el fin de la posesión o la
   * siguiente decisión organizada) por familia al atacar y por cobertura al
   * defender. Solo resultados ya ocurridos. ME-07B v2 §2.2 (sesión v2-6): la
   * respuesta a la entrega de Delay se guarda aparte (`defenseByHandoffResponse`)
   * y Delay no cuenta como mano a mano central: son otra acción, y mezclarlas
   * hacía que el ataque valorase el bloqueo con lo que la defensa hizo ante
   * una entrega (y al revés).
   */
  protected readonly observations = new Map<
    string,
    {
      offenseByFamily: Partial<Record<OffensivePlan, ObservedOutcome>>;
      defenseByCoverage: Partial<Record<DefensiveCoverage, ObservedOutcome>>;
      defenseByHandoffResponse: Partial<Record<DefensiveCoverage, ObservedOutcome>>;
    }
  >();
  /**
   * Colocación del bloqueo directo de la acción organizada en curso
   * (ME-07B v2 §4, LAB-0.7): la fija `organize` al elegir creador,
   * bloqueador y colocación; vuelve a `central` en cuanto el núcleo la usa.
   */
  protected currentPlacement: ScreenPlacement = "central";
  /**
   * Marco vivo (parejas atacante-defensor, con el cambio de esta acción ya
   * aplicado) de una acción que acabó en balón suelto, pendiente de la
   * recuperación: si la recupera el mismo ataque, las parejas persisten.
   */
  protected pendingLooseBallFrame: Frame | null = null;
  protected pendingObservation: {
    readonly attackingId: string;
    readonly defendingId: string;
    readonly plan: OffensivePlan;
    readonly coverage: DefensiveCoverage;
    readonly card: PlaybookCardId;
    readonly scoreAtDecision: number;
  } | null = null;

  protected game: { ms: Milliseconds; running: boolean; ref: Milliseconds };
  protected shot: { ms: Milliseconds; running: boolean; ref: Milliseconds } | null;
  protected ball: BallMark;
  protected throwInTeamId: string | null = null;
  /** Cuenta de 8 s en curso (art. 28), o `null` si el balón ya está en pista delantera. */
  protected backcourt: { startMs: Milliseconds; elapsedBeforeMs: Milliseconds } | null = null;
  protected closed = 0;
  protected stop: LinkedStop | null = null;
  protected lastMs: Milliseconds = 0;
  /** Instante exacto en que el reloj de partido llegó a 0, si ya ocurrió. */
  protected gameExpiredAtMs: Milliseconds | null = null;

  constructor(settings: LinkedRunSettings) {
    this.settings = settings;
    this.limits = settings.limits;
    this.audit = settings.audit ?? createNoopAuditCollector();
    this.rng = createResumableRandom(settings.seed);
    for (const team of settings.teams) {
      this.teams.set(team.id, team);
      this.score[team.id] = 0;
    }
    for (const { teamId, profile } of settings.roster) {
      this.profiles.set(profile.id, profile);
      this.teamOf.set(profile.id, teamId);
    }
    this.game = { ms: 0, running: false, ref: 0 };
    this.shot = null;
    this.ball = { status: "dead", holderId: null, fixed: { x: 14, y: 7.5 } };
  }

  // --- lo que cada modo define -------------------------------------------------

  /** Quinteto en pista del equipo, en orden de rol del sistema (1–5). */
  protected abstract lineup(teamId: string): readonly PlayerProfile[];
  /** Sentido de ataque vigente del equipo. */
  protected abstract attackDirection(teamId: string): AttackDirection;
  /** Cobertura con la que defiende el equipo (ME-07A §4: admite `"auto"`). */
  protected abstract coverageWhenDefending(teamId: string): DefensiveCoverageChoice;
  /** Qué hacer cuando un hecho alcanza el agotamiento del reloj de partido; `true` si el hecho se registra. */
  protected abstract onGameClockExpired(e: EmitArgs, expiryMs: Milliseconds): boolean;

  /** Tras cerrar una posesión (con su hecho ya emitido o no); `false` detiene el paso en curso. */
  protected afterPossessionClosed(atMs: Milliseconds, emitted: boolean): boolean {
    void atMs;
    return emitted;
  }
  /** ¿Detiene el reloj de partido esta canasta? (FIBA art. 50; el tramo, C1: nunca). */
  protected madeBasketStopsGameClock(): boolean {
    return false;
  }
  /** Reglas de partido que el núcleo debe aplicar (ninguna en el tramo). */
  protected coreRules(): LinkedGameRules | undefined {
    return undefined;
  }
  /**
   * Plan ofensivo con el que ataca el equipo (ME-06 §3.2). Por defecto,
   * siempre el bloqueo directo ya versionado: los modos que no declaren la
   * segunda familia (p. ej. el tramo de ME-03, §3.2 in fine) conservan
   * exactamente su alcance actual sin cambiar nada.
   */
  protected offensivePlanWhenAttacking(teamId: string): OffensivePlanChoice {
    void teamId;
    return "bloqueo_directo";
  }
  /**
   * Orden de defensa sin balón del equipo que defiende ante la mano a
   * mano (ME-06 §3.1; ME-07A §4: admite `"auto"`). Sin efecto cuando la
   * familia resuelta es el bloqueo directo.
   */
  /**
   * Colocación del bloqueo directo pedida por el equipo que ataca (ME-07B v2
   * §4). Por defecto `central`: los modos que no la declaren (p. ej. el
   * tramo de ME-03) conservan su disposición de siempre.
   */
  protected screenPlacementWhenAttacking(teamId: string): ScreenPlacementChoice {
    void teamId;
    return "central";
  }
  protected offBallCallWhenDefending(teamId: string): OffBallDefensiveCallChoice {
    void teamId;
    return "guardar_espacio";
  }
  /**
   * Variante encadenada que puede llamar el equipo que ataca (ME-07B v2 §4,
   * LAB-0.9). Por defecto `ninguna`: los modos que no la declaren (el tramo
   * de ME-03) conservan exactamente su comportamiento.
   */
  protected chainedVariantWhenAttacking(teamId: string): ChainedVariantChoice {
    void teamId;
    return "ninguna";
  }
  /** Respuesta del equipo que defiende al bloqueo ciego de Spain (LAB-0.9). Por defecto `auto`. */
  protected backScreenCallWhenDefending(teamId: string): BackScreenCallChoice {
    void teamId;
    return "auto";
  }
  /**
   * Prioridad de creación del equipo que ataca (ME-07A §3.1). Por defecto
   * `"equilibrado"`: los modos que no la declaren conservan exactamente su
   * comportamiento anterior a ME-07A.
   */
  protected creationPriorityWhenAttacking(teamId: string): OffensiveCreationPriority {
    void teamId;
    return "equilibrado";
  }
  /** Tiempo de juego transcurrido con el reloj en marcha, para minutos. */
  protected onClockRan(deltaMs: Milliseconds): void {
    void deltaMs;
  }
  /** Período al que pertenece un hecho. */
  protected currentPeriod(): number {
    return 1;
  }
  /** Los diez jugadores en pista en este instante (orden estable por ID). */
  protected onCourtIds(): readonly string[] {
    return Object.keys(this.tracks).sort();
  }
  /** Posesión a la que se atribuye un hecho. */
  protected possessionRef(): PossessionRecord | null {
    return this.possessions[this.possessions.length - 1] ?? null;
  }
  /** Cómo se nombra la corrida en los diagnósticos del guardián. */
  protected runLabel(): string {
    return "el tramo";
  }
  /** Tipo del hecho con que se registra una parada del guardián. */
  protected stopEventKind(): FactKind {
    return "tramo_stopped";
  }

  // --- utilidades ---------------------------------------------------------

  protected profile(id: string): PlayerProfile {
    const p = this.profiles.get(id);
    if (!p) throw new Error(`Jugador desconocido: ${id}`);
    return p;
  }

  protected team(id: string): LinkedTeam {
    return this.teams.get(id)!;
  }

  protected otherTeam(teamId: string): LinkedTeam {
    return this.settings.teams[0].id === teamId ? this.settings.teams[1] : this.settings.teams[0];
  }

  protected frameTeam(teamId: string): FrameTeam {
    const t = this.team(teamId);
    return { id: t.id, name: t.name, priority: t.priority, players: this.lineup(teamId) };
  }

  protected frameFor(attackingTeamId: string): Frame {
    return buildFrameFromTeams(
      this.frameTeam(attackingTeamId),
      this.frameTeam(this.otherTeam(attackingTeamId).id),
      this.attackDirection(attackingTeamId),
    );
  }

  protected runSpeed(id: string): number {
    return attackerMoveSpeedMps(this.profile(id).attributes.F01);
  }

  protected positionAt(id: string, atMs: Milliseconds): Point2D {
    return positionOnTrajectory(this.tracks[id]!, atMs);
  }

  protected localPositions(frame: Frame, atMs: Milliseconds): Record<string, Point2D> {
    const out: Record<string, Point2D> = {};
    for (const [slot, id] of Object.entries(frame.slotToId)) out[slot] = toLocal(frame.dir, this.positionAt(id, atMs));
    return out;
  }

  /** Nueva orden de desplazamiento global: sale desde donde está de verdad en `departMs`. */
  protected moveGlobal(id: string, departMs: Milliseconds, target: Point2D): Milliseconds {
    const from = this.positionAt(id, departMs);
    const arriveMs = departMs + secondsToMs(timeToReach(from, target, this.runSpeed(id)));
    const track = truncateTrajectory(this.tracks[id]!, departMs);
    if (arriveMs > departMs) track.push({ atMs: arriveMs, position: target, moving: true });
    this.tracks[id] = track;
    return arriveMs;
  }

  protected holdAll(atMs: Milliseconds): void {
    for (const id of this.onCourtIds()) this.tracks[id] = truncateTrajectory(this.tracks[id]!, atMs);
  }

  protected assignResponsibility(atMs: Milliseconds, id: string, responsibility: Responsibility, reason: string): void {
    if (this.currentResponsibility.get(id) === responsibility && responsibility !== "cargar_rebote" && responsibility !== "proteger_balance") {
      return;
    }
    this.currentResponsibility.set(id, responsibility);
    this.responsibilities.push({ atMs, playerId: id, teamId: this.teamOf.get(id)!, responsibility, reason });
  }

  /**
   * Registra un punto de decisión propio del motor de continuidad (fuera
   * del núcleo del bloqueo): entrada de fase/transición, organización del
   * creador. Sin efecto si el colector está desactivado (ME-04A §3).
   */
  /**
   * Enlace al hecho de `this.events` **efectivamente emitido** (ME-04B §4.2):
   * busca hacia atrás el último hecho ya registrado de ese tipo y usa su
   * instante real, nunca el instante propio de la decisión. Los llamadores
   * deben emitir el hecho antes de llamar a `auditDecision` con
   * `factLinkKind`; si no hay ningún hecho de ese tipo todavía (no llegó a
   * ocurrir: desvío previo, bocina, guardián), el enlace queda ausente
   * (`null`) en vez de inventar un instante.
   */
  private resolveFactLink(kind: string): import("../audit/audit-types").AuditFactLink | null {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i]!.kind === kind) return { atMs: this.events[i]!.atMs, kind };
    }
    return null;
  }

  protected auditDecision(
    atMs: Milliseconds,
    input: {
      readonly point: import("../audit/audit-types").AuditDecisionPoint;
      readonly holderId: string | null;
      readonly participants: readonly string[];
      readonly options: readonly import("../audit/audit-types").AuditOptionRecord[];
      readonly chosenOptionId: string | null;
      readonly factLinkKind?: string;
      readonly note?: string;
    },
  ): void {
    if (!this.audit.enabled) return;
    const possession = this.possessionRef();
    this.audit.recordDecision({
      atMs,
      point: input.point,
      possessionIndex: possession ? possession.index : null,
      // El índice de fase auditado debe coincidir con `phase.index` (1-based,
      // el mismo que usa `pushEvent` para los hechos reales) para que
      // `build-audit-export.ts` pueda enlazar una decisión con sus propios
      // hechos por `${possessionIndex}:${phaseIndex}` (ME-07A §5.1).
      phaseIndex: possession ? possession.phases.length : null,
      holderId: input.holderId,
      participants: input.participants,
      options: input.options,
      chosenOptionId: input.chosenOptionId,
      factLink: input.factLinkKind ? this.resolveFactLink(input.factLinkKind) : null,
      rngStateBefore: null,
      rngStateAfter: null,
      note: input.note,
    });
  }

  protected translateText(frame: Frame, text: string): string {
    return text.replace(SLOT_TOKEN, (token) => frame.slotToId[token] ?? token);
  }

  protected translateDetail(frame: Frame, value: unknown): unknown {
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

  protected sync(atMs: Milliseconds): void {
    if (atMs < this.game.ref) return;
    if (this.game.running) {
      if (this.gameExpiredAtMs === null && atMs >= this.game.ref + this.game.ms) {
        this.gameExpiredAtMs = this.game.ref + this.game.ms;
      }
      const before = this.game.ms;
      this.game.ms = Math.max(0, this.game.ms - (atMs - this.game.ref));
      if (before > this.game.ms) this.onClockRan(before - this.game.ms);
    }
    this.game.ref = atMs;
    if (this.shot) {
      if (this.shot.running) this.shot.ms = Math.max(0, this.shot.ms - (atMs - this.shot.ref));
      this.shot.ref = atMs;
    }
  }

  protected stopGameClock(atMs: Milliseconds): void {
    this.sync(atMs);
    this.game.running = false;
  }

  protected startGameClock(atMs: Milliseconds): void {
    this.sync(atMs);
    this.game.running = true;
  }

  protected setShotClock(atMs: Milliseconds, ms: Milliseconds): void {
    this.sync(atMs);
    this.shot = { ms, running: true, ref: atMs };
  }

  protected stopShotClock(atMs: Milliseconds): void {
    this.sync(atMs);
    if (this.shot) this.shot.running = false;
  }

  protected shotRemainingAt(atMs: Milliseconds): Milliseconds {
    if (!this.shot) return SHOT_CLOCK_FULL_MS;
    return this.shot.running ? Math.max(0, this.shot.ms - (atMs - this.shot.ref)) : this.shot.ms;
  }

  protected shotExpiryMs(): Milliseconds {
    if (!this.shot || !this.shot.running) return Infinity;
    return this.shot.ref + this.shot.ms;
  }

  protected gameExpiryMs(): Milliseconds {
    if (this.gameExpiredAtMs !== null) return this.gameExpiredAtMs;
    return this.game.running ? this.game.ref + this.game.ms : Infinity;
  }

  // --- relato ---------------------------------------------------------------

  protected currentPossession(): PossessionRecord {
    return this.possessions[this.possessions.length - 1]!;
  }

  protected control(): ControlState {
    const b = this.ball;
    if (b.status === "held" || b.status === "in_flight_pass") {
      const holderTeam = b.holderId ? this.teamOf.get(b.holderId)! : (this.possessionRef()?.teamId ?? null);
      return { status: "control", controlTeamId: holderTeam, throwInTeamId: null };
    }
    if (b.status === "in_flight_shot") return { status: "tiro_en_el_aire", controlTeamId: null, throwInTeamId: null };
    if (b.status === "loose") return { status: "balon_suelto", controlTeamId: null, throwInTeamId: null };
    return { status: "balon_muerto", controlTeamId: null, throwInTeamId: this.throwInTeamId };
  }

  protected guardianStop(atMs: Milliseconds, explanation: string): void {
    if (this.stop) return;
    const at = Math.max(atMs, this.lastMs);
    this.stop = { cause: "guardian", atMs: at, explanation };
    this.pushEvent({ atMs: at, phase: "concedido", kind: this.stopEventKind(), actors: [], text: `Guardián de progreso: ${explanation}`, detail: { cause: "guardian" } });
  }

  protected pushEvent(e: EmitArgs): void {
    const possession = this.possessionRef();
    this.events.push({
      atMs: e.atMs,
      possessionIndex: possession ? possession.index : 0,
      phaseIndex: possession ? possession.phases.length : 0,
      possessionTeamId: possession ? possession.teamId : "",
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
      period: this.currentPeriod(),
      onCourtIds: this.onCourtIds(),
    });
    this.lastMs = e.atMs;
  }

  /** Registra un hecho en su instante absoluto; `false` si la corrida (o el período) se detuvo. */
  protected emit(e: EmitArgs): boolean {
    if (this.stop) return false;
    if (e.atMs < this.lastMs) {
      this.guardianStop(this.lastMs, `hecho «${e.kind}» fuera de orden temporal; se detiene en vez de reordenar el relato.`);
      return false;
    }
    if (e.atMs >= this.gameExpiryMs()) {
      if (!this.onGameClockExpired(e, this.gameExpiryMs())) return false;
    }
    this.sync(e.atMs);

    switch (e.kind) {
      case "shooting_foul":
      case "non_shooting_foul":
        // Silbato: se detienen ambos relojes; permanecen parados durante los libres.
        this.stopGameClock(e.atMs);
        this.stopShotClock(e.atMs);
        break;
      case "rebound_secured":
      case "rebound_contested":
        // Último libre fallado y vivo: el reloj vuelve a correr al tocar a un jugador.
        if (!this.game.running && this.gameExpiredAtMs === null) this.startGameClock(e.atMs);
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
        if (this.madeBasketStopsGameClock()) this.stopGameClock(e.atMs);
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

  protected openPossession(teamId: string, atMs: Milliseconds, kind: PhaseKind, reason: string): boolean {
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

  protected closePossession(atMs: Milliseconds, reason: string): boolean {
    this.settleObservation();
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
    return this.afterPossessionClosed(atMs, ok);
  }

  protected newPhase(atMs: Milliseconds, kind: PhaseKind, text: string): boolean {
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

  protected setPhaseEntry(entry: PhaseEntry, reason: string): void {
    const phase = this.currentPossession().phases[this.currentPossession().phases.length - 1]!;
    phase.entry = entry;
    phase.entryReason = reason;
  }

  // --- ciclo principal --------------------------------------------------------

  /** Siguiente paso cuando el paso en curso se interrumpe sin sucesor (p. ej. fin de período). */
  protected takeScheduledStep(): Step | null {
    return null;
  }

  protected loop(first: Step): void {
    let step: Step | null = first;
    let steps = 0;
    let zeroTimeSteps = 0;

    while (step && !this.stop) {
      steps += 1;
      if (steps > this.limits.maxSteps) {
        this.guardianStop(step.atMs, `${this.runLabel()} supera ${this.limits.maxSteps} pasos de orquestación sin completarse.`);
        break;
      }
      const startMs = step.atMs;
      const closedBefore = this.closed;
      const next: Step | null = this.execute(step) ?? (this.stop ? null : this.takeScheduledStep());
      if (next && next.atMs <= startMs && this.closed === closedBefore) {
        zeroTimeSteps += 1;
        if (zeroTimeSteps > this.limits.maxZeroTimeSteps) {
          const label = (s: Step) => (s.kind === "custom" ? `custom:${s.label}` : s.kind);
          this.guardianStop(
            startMs,
            `${zeroTimeSteps} transiciones seguidas sin avanzar el reloj interno ni cerrar una posesión (ciclo inválido «${label(step)}» → «${label(next)}»).`,
          );
          break;
        }
      } else {
        zeroTimeSteps = 0;
      }
      step = next;
    }
  }

  protected execute(step: Step): Step | null {
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
      case "custom":
        return step.run();
    }
  }

  // --- tramo de cálculo del núcleo -------------------------------------------

  protected coreMatchInput(frame: Frame): MatchInput {
    return {
      scenarioId: this.settings.dispositionScenarioId,
      coverage: this.coverageWhenDefending(frame.defending.id),
      seed: this.settings.seed,
      rulesetVersion: this.settings.rulesetVersion,
      labParametersVersion: this.settings.labParametersVersion,
      offensePlayers: frame.attacking.players,
      defensePlayers: frame.defending.players,
      offensivePlan: this.offensivePlanWhenAttacking(frame.attacking.id),
      offBallDefensiveCall: this.offBallCallWhenDefending(frame.defending.id),
      creationPriority: this.creationPriorityWhenAttacking(frame.attacking.id),
      screenPlacement: this.currentPlacement,
      chainedVariant: this.chainedVariantWhenAttacking(frame.attacking.id),
      backScreenCall: this.backScreenCallWhenDefending(frame.defending.id),
    };
  }

  protected computeCore(frame: Frame, t0: Milliseconds, entry: LinkedEntry, legs?: Record<string, PlannedLeg>): PossessionCoreResult {
    const local = this.localPositions(frame, t0);
    const matchInput = this.coreMatchInput(frame);
    const rules = this.coreRules();
    const possession = this.possessionRef();
    return computePossessionCore(matchInput, {
      audit: this.audit,
      linked: {
        binding: frame.slotToId,
        startPositions: local,
        legs,
        shotClockMs: this.shotRemainingAt(t0),
        gameClockMs: this.game.ms,
        rng: this.rng,
        attackingPriority: frame.attacking.priority,
        entry,
        t0,
        possessionIndex: possession ? possession.index : null,
        // Ver nota de `auditDecision`: mismo índice 1-based que `phase.index`
        // y que `pushEvent`, para que las decisiones del núcleo (p.ej.
        // `seleccion_familia`) enlacen con los hechos de su propia fase.
        phaseIndex: possession ? possession.phases.length : null,
        ...(rules ? { rules } : {}),
        observations: {
          offenseByFamily: { ...(this.observations.get(frame.attacking.id)?.offenseByFamily ?? {}) },
          defenseByCoverage: { ...(this.observations.get(frame.defending.id)?.defenseByCoverage ?? {}) },
          defenseByHandoffResponse: { ...(this.observations.get(frame.defending.id)?.defenseByHandoffResponse ?? {}) },
        },
      },
    });
  }

  /** Cierra la muestra pendiente con los puntos anotados desde su decisión (ME-07B v2 §5). */
  protected settleObservation(): void {
    const pending = this.pendingObservation;
    if (!pending) return;
    this.pendingObservation = null;
    const points = (this.score[pending.attackingId] ?? 0) - pending.scoreAtDecision;
    const add = (o: ObservedOutcome | undefined): ObservedOutcome => ({ uses: (o?.uses ?? 0) + 1, points: (o?.points ?? 0) + points });
    const empty = (): { offenseByFamily: Partial<Record<OffensivePlan, ObservedOutcome>>; defenseByCoverage: Partial<Record<DefensiveCoverage, ObservedOutcome>>; defenseByHandoffResponse: Partial<Record<DefensiveCoverage, ObservedOutcome>> } => ({ offenseByFamily: {}, defenseByCoverage: {}, defenseByHandoffResponse: {} });
    const handoffCard = pending.card === "delay_mano_a_mano";
    const off = this.observations.get(pending.attackingId) ?? empty();
    if (!handoffCard) off.offenseByFamily[pending.plan] = add(off.offenseByFamily[pending.plan]);
    this.observations.set(pending.attackingId, off);
    const def = this.observations.get(pending.defendingId) ?? empty();
    const byCoverage = handoffCard ? def.defenseByHandoffResponse : def.defenseByCoverage;
    byCoverage[pending.coverage] = add(byCoverage[pending.coverage]);
    this.observations.set(pending.defendingId, def);
  }

  protected runCore(frame: Frame, t0: Milliseconds, entry: LinkedEntry, legs?: Record<string, PlannedLeg>): Step | null {
    const core = this.computeCore(frame, t0, entry, legs);
    this.currentPlacement = "central";
    if (core.organizedChoice) {
      this.settleObservation();
      this.pendingObservation = {
        attackingId: frame.attacking.id,
        defendingId: frame.defending.id,
        plan: core.organizedChoice.plan,
        coverage: core.organizedChoice.coverage,
        card: core.organizedChoice.card,
        scoreAtDecision: this.score[frame.attacking.id] ?? 0,
      };
    }

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
    const step = this.afterTerminal(frame, core.terminal, endMs);
    // ME-07B v2 §5: tras un cambio, los dos defensores intercambiados siguen
    // con su nueva marca mientras la misma posesión continúa (reorganizar o
    // segunda oportunidad): el desajuste persiste hasta un balón muerto o una
    // nueva posesión, donde la defensa vuelve a emparejarse.
    if (core.defensiveSwap && step && (step.kind === "organize" || step.kind === "second_chance") && step.frame.attacking.id === frame.attacking.id) {
      const x = frame.slotToId[core.defensiveSwap[0]]!;
      const y = frame.slotToId[core.defensiveSwap[1]]!;
      const swapped = swapDefenders(step.frame, x, y);
      if (swapped) return { ...step, frame: swapped };
    }
    // Balón suelto (pase desviado, tapón): sigue vivo, así que si lo recupera
    // el mismo ataque los emparejamientos vivos persisten, incluido el cambio
    // de esta acción y el de una anterior de la misma posesión (sesión v2-6:
    // antes se aplicaba el cambio sobre las parejas del quinteto, y un segundo
    // cambio en la posesión las dejaba al revés).
    this.pendingLooseBallFrame =
      step?.kind === "loose_ball"
        ? core.defensiveSwap
          ? (swapDefenders(frame, frame.slotToId[core.defensiveSwap[0]]!, frame.slotToId[core.defensiveSwap[1]]!) ?? frame)
          : frame
        : null;
    return step;
  }

  protected globalBall(frame: Frame, ball: BallState): BallMark {
    return {
      status: ball.status,
      holderId: ball.holderId ? (frame.slotToId[ball.holderId] ?? ball.holderId) : null,
      fixed: ball.holderId ? null : toGlobal(frame.dir, ball.position),
    };
  }

  protected emitCoreEvent(frame: Frame, raw: RawEvent, atMs: Milliseconds): boolean {
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
      case "non_shooting_foul":
        ball = { status: "dead", holderId: null, fixed: at(actors[1] ?? actors[0]!) };
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

  protected afterTerminal(frame: Frame, terminal: TerminalOutcome, endMs: Milliseconds): Step | null {
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
      case "shooting_foul_free_throws_pending":
      case "non_shooting_foul":
      case "second_entry_kick_out":
        // Solo los produce el núcleo con reglas de partido; un modo sin
        // ellas no sabe adjudicarlas y no inventa una reanudación.
        this.guardianStop(endMs, `desenlace «${terminal.kind}» sin reglas de partido para adjudicarlo.`);
        return null;
      case "simulation_guard_stopped":
        this.guardianStop(endMs, terminal.reason);
        return null;
    }
  }

  protected beginLiveControl(teamId: string, atMs: Milliseconds, holderId: string, kind: PhaseKind, reason: string): Step | null {
    // Art. 29: control rival en balón vivo → 24 s desde el control.
    this.setShotClock(atMs, shotClockAfterLiveControl("control_rival", this.shotRemainingAt(atMs)));
    const frame = this.frameFor(teamId);
    const holderLocal = toLocal(frame.dir, this.positionAt(holderId, atMs));
    this.backcourt = isFrontcourtLocal(holderLocal) ? null : { startMs: atMs, elapsedBeforeMs: 0 };
    if (!this.openPossession(teamId, atMs, kind, `${reason} (reloj de lanzamiento 24 s)`)) return null;
    return { kind: "advance", frame, atMs, holderId };
  }

  protected throwInAfterScore(frame: Frame, atMs: Milliseconds, reason: string): Step | null {
    const hoop = attackedHoopGlobal(frame.dir);
    // El punto exacto depende del sacador real: el más cercano a la línea de fondo.
    const thrower = this.nearestToPoint(frame.defending.id, hoop, atMs, []);
    const spot = endLineThrowInSpot(hoop, this.positionAt(thrower, atMs));
    return this.throwInStep(frame.defending.id, atMs, spot, reason, false, 0);
  }

  protected throwInStep(
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

  protected nearestToPoint(teamId: string, point: Point2D, atMs: Milliseconds, exclude: readonly string[]): string {
    return this.lineup(teamId)
      .filter((p) => !exclude.includes(p.id))
      .map((p) => ({ id: p.id, t: timeToReach(this.positionAt(p.id, atMs), point, this.runSpeed(p.id)) }))
      .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]!.id;
  }

  // --- saque -------------------------------------------------------------------

  protected throwIn(step: Extract<Step, { kind: "throw_in" }>): Step | null {
    const t0 = step.atMs;
    const team = this.team(step.teamId);
    const frame = this.frameFor(step.teamId);
    this.throwInTeamId = team.id;
    this.ball = { status: "dead", holderId: null, fixed: this.ball.fixed ?? step.spot };
    // Sin control todavía: el reloj de lanzamiento no corre para nadie hasta el toque legal.
    this.shot = null;
    if (!step.sameTeamKeepsBall) {
      if (!this.openPossession(team.id, t0, "saque", `saque ${step.reason}`)) return null;
    } else if (!this.newPhase(t0, "saque", step.note ?? `Saque ${step.reason}: ${team.name} conserva el balón y el reloj restante.`)) {
      return null;
    }

    const thrower = this.nearestToPoint(team.id, step.spot, t0, []);
    const receiver = this.lineup(team.id)
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
      this.onThrowInEnded(team.id, false);
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
    this.onThrowInEnded(team.id, true);
    return { kind: "advance", frame, atMs: touchMs + delayMs, holderId: receiver };
  }

  /** Un saque termina (legalmente o por violación): el partido invierte aquí la flecha de alternancia. */
  protected onThrowInEnded(teamId: string, legal: boolean): void {
    void teamId;
    void legal;
  }

  // --- organización y acción organizada ----------------------------------------

  /** Destinos de la disposición del bloqueo directo, en el marco local de quien ataca (central o lateral, LAB-0.7; Horns, LAB-0.8). */
  protected dispositionTargets(placement: ScreenPlacement = "central"): Record<string, Point2D> {
    if (placement === "lateral") return { ...LATERAL_PNR_TARGETS };
    if (placement === "horns") return { ...HORNS_PNR_TARGETS };
    if (placement === "delay") return { ...DELAY_TARGETS };
    const scenario = getScenario(this.settings.dispositionScenarioId);
    const targets: Record<string, Point2D> = {};
    for (const slot of [...scenario.offense, ...scenario.defense]) targets[slot.playerId] = slot.initialPosition;
    return targets;
  }

  /** Planifica a todos (salvo `exclude`) hacia su puesto; devuelve la llegada de cada uno. */
  protected planOrganizeLegs(
    frame: Frame,
    t0: Milliseconds,
    exclude: readonly string[],
    targets: Record<string, Point2D> = this.dispositionTargets(),
  ): Record<string, Milliseconds> {
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

  /**
   * Asignación de funciones al organizar (ME-07B v2 §2.4, primitiva de
   * gramática §3): en vez de devolver siempre el balón al rol fijo O1 del
   * orden del quinteto, compara asignaciones reales de creador (el poseedor
   * o el O1 vigente) y de bloqueador (O5 o O4) con la misma proyección en
   * seco que el selector de familia, desde la disposición que ocuparán y con
   * el reloj que quedará tras situarse (y tras el pase de vuelta si hace
   * falta). Los defensores **siguen a su marca**: si un atacante cambia de
   * rol, su defensor cambia con él (D1 es quien defiende al creador, D5 quien
   * defiende al bloqueador), sin cambios de emparejamiento instantáneos.
   * La colocación (ficha) se elige por su mejor valor proyectado; dentro de
   * ella, gana el mayor valor y, dentro de `FIRST_READ_TIE_BAND_POINTS`, la
   * asignación cuya **primera lectura real** llega antes (situarse, pase de
   * vuelta y preparación de la ficha hasta la lectura); en empate exacto, la
   * vigente. ME-07B v2 §2.2, sesión v2-6: antes la banda (que LAB-0.3 define
   * para la primera lectura de un jugador) se aplicaba también entre fichas y
   * desempataba por el instante en que los cinco quedaban situados: decidía el
   * 82 % de las colocaciones de la foto de las 20 a favor de una ficha que
   * valía menos (la central, situada antes y primera de la lista), y Delay,
   * que nunca valía más, ganaba por estar situada antes aunque leyera después.
   */
  protected assignOrganizedRoles(
    frame: Frame,
    t0: Milliseconds,
    holderId: string,
  ): {
    frame: Frame;
    options: import("../audit/audit-types").AuditOptionRecord[];
    placement: ScreenPlacement;
    placementOptions: import("../audit/audit-types").AuditOptionRecord[];
    targets: Record<string, Point2D>;
  } {
    const originalHandlerId = frame.slotToId.O1!;
    const swapRoles = (map: Readonly<Record<string, string>>, a: string, b: string): Record<string, string> => {
      if (a === b) return { ...map };
      const out = { ...map };
      out[`O${a}`] = map[`O${b}`]!;
      out[`O${b}`] = map[`O${a}`]!;
      out[`D${a}`] = map[`D${b}`]!;
      out[`D${b}`] = map[`D${a}`]!;
      return out;
    };
    const holderRole = frame.idToSlot[holderId]!.slice(1);
    const handlerMaps: Record<string, string>[] = [{ ...frame.slotToId }];
    if (holderId !== originalHandlerId) handlerMaps.push(swapRoles(frame.slotToId, "1", holderRole));
    // ME-07B v2 §4 (LAB-0.7): la colocación del bloqueo (central o lateral)
    // se elige con la misma proyección que el creador y el bloqueador; la
    // lateral es del bloqueo directo, así que no se ofrece si el plan obliga
    // a la mano a mano.
    const matchInput = this.coreMatchInput(frame);
    const placementChoice = this.screenPlacementWhenAttacking(frame.attacking.id);
    // Fichas de libro (§3): las colocaciones que se ofrecen son las de las
    // fichas cuya condición admite el plan y la orden de colocación.
    const placements = eligiblePlacements(matchInput.offensivePlan ?? "bloqueo_directo", placementChoice);
    const candidates: {
      map: Record<string, string>;
      handlerId: string;
      screenerId: string;
      tReadyMs: number;
      /** Instante de la primera lectura real proyectada (situados + preparación de la ficha). */
      tFirstReadMs: number;
      value: number;
      plan: string;
      read: string | null;
      breakdown: Readonly<Record<string, number | string | null>>;
      placement: ScreenPlacement;
      targets: Record<string, Point2D>;
    }[] = [];
    const remainingAtT0 = this.shotRemainingAt(t0);
    for (const placement of placements) {
      const targets = this.dispositionTargets(placement);
      for (const handlerMap of handlerMaps) {
        // Horns (LAB-0.8): los dos cuernos son siempre los dos interiores del
        // quinteto en pista (por su orden de roles; el marco de una posesión
        // que continúa puede venir ya reasignado por otra ficha): uno bloquea
        // (O5) y el otro es el segundo cuerno (O3, el que deja libre la
        // ayuda); los dos exteriores restantes ocupan las esquinas (O2, O4).
        // Si el poseedor es un interior, en Horns no crea él: devuelve el
        // balón al manejador. Los defensores siguen a su marca.
        // Delay (LAB-0.10): los dos interiores son el pívot de arriba (O5) y el poste (O4).
        const maps =
          placement === "horns"
            ? this.hornsRoleMaps(frame, handlerMap)
            : placement === "delay"
              ? this.delayRoleMaps(frame, handlerMap)
              : [handlerMap, swapRoles(handlerMap, "4", "5")];
        for (const map of maps) {
          const handlerId = map.O1!;
          let tAllSet = t0;
          for (const slot of OFFENSE_SLOTS) {
            const id = map[slot]!;
            const arrive = t0 + secondsToMs(timeToReach(this.positionAt(id, t0), toGlobal(frame.dir, targets[slot]!), this.runSpeed(id)));
            tAllSet = Math.max(tAllSet, arrive);
          }
          const passNeeded = holderId !== handlerId;
          const tReadyMs = passNeeded
            ? tAllSet + secondsToMs(PASS_RELEASE_SECONDS) + secondsToMs(distance(targets[this.slotOf(map, holderId)]!, targets.O1!) / PASS_FLIGHT_SPEED_MPS)
            : tAllSet;
          const shotClockMs = Math.max(0, remainingAtT0 - (tReadyMs - t0));
          const projection = projectOrganizedOpportunity(
            { ...matchInput, screenPlacement: placement },
            {
              binding: map,
              startPositions: targets,
              shotClockMs,
              gameClockMs: this.game.ms,
              attackingPriority: frame.attacking.priority,
              rules: this.coreRules(),
              // ME-07B v2 §2.2/§5: lo que el ataque ha visto de la defensa rival en este partido.
              observations: {
                offenseByFamily: { ...(this.observations.get(frame.attacking.id)?.offenseByFamily ?? {}) },
                defenseByCoverage: { ...(this.observations.get(frame.defending.id)?.defenseByCoverage ?? {}) },
                defenseByHandoffResponse: { ...(this.observations.get(frame.defending.id)?.defenseByHandoffResponse ?? {}) },
              },
            },
          );
          const tFirstReadMs = tReadyMs + secondsToMs(projection.decisionSeconds);
          candidates.push({ map, handlerId, screenerId: map.O5!, tReadyMs, tFirstReadMs, value: projection.value, plan: projection.plan, read: projection.bestReadOption, breakdown: projection.breakdown, placement, targets });
        }
      }
    }
    // 1) La ficha (colocación) se elige por su mejor valor proyectado: cada
    //    proyección ya descuenta el reloj que consume (sale con el reloj que
    //    queda tras situarse) y los riesgos de sus pases. Empate exacto: la
    //    primera lectura que llega antes; después, el orden de prioridad.
    const topOf = new Map<ScreenPlacement, (typeof candidates)[number]>();
    for (const c of candidates) {
      const prev = topOf.get(c.placement);
      if (!prev || c.value > prev.value || (c.value === prev.value && c.tFirstReadMs < prev.tFirstReadMs)) topOf.set(c.placement, c);
    }
    let winner = topOf.get(placements[0]!)!;
    for (const placement of placements) {
      const top = topOf.get(placement)!;
      if (top.value > winner.value || (top.value === winner.value && top.tFirstReadMs < winner.tFirstReadMs)) winner = top;
    }
    // 2) Dentro de esa ficha, quién crea y quién bloquea: la regla de §2.4 sin
    //    cambios salvo la frontera (mayor valor y, dentro de
    //    `FIRST_READ_TIE_BAND_POINTS`, la asignación cuya primera lectura real
    //    llega antes, p. ej. el poseedor que no espera el pase de vuelta). La
    //    asignación ejecutada puede valer hasta la banda menos que el mejor de
    //    su ficha, como antes en la central; se audita (`chosenAssignmentValue`).
    //    La banda tampoco cruza de plan: en la central una asignación proyecta la
    //    mano a mano y otra el bloqueo, y desempatar entre ellas por la primera
    //    lectura (que en la entrega llega después) elegía el bloqueo aunque la
    //    mano a mano valiese más (sesión v2-6, segundo corte: 68 de 71 en la foto
    //    Sierra +5). El plan se decide por valor, como la ficha.
    const eligible = (c: (typeof candidates)[number]) => c.plan === winner.plan && winner.value - c.value <= FIRST_READ_TIE_BAND_POINTS;
    const own = candidates.filter((c) => c.placement === winner.placement && eligible(c));
    let chosen = own[0]!;
    for (const c of own) if (c.tFirstReadMs < chosen.tFirstReadMs) chosen = c;
    // Una opción por creador candidato (su mejor bloqueador y colocación),
    // para que el motivo quede legible por jugador real.
    const byHandler = new Map<string, (typeof candidates)[number]>();
    for (const c of candidates) {
      const prev = byHandler.get(c.handlerId);
      if (!prev || c === chosen || (prev !== chosen && c.value > prev.value)) byHandler.set(c.handlerId, c);
    }
    const options = [...byHandler.values()].map((c) => {
      const values = {
        projectedValue: c.value,
        screenerId: c.screenerId,
        projectedPlan: c.plan,
        projectedBestRead: c.read,
        readySeconds: (c.tReadyMs - t0) / 1000,
        firstReadSeconds: (c.tFirstReadMs - t0) / 1000,
        placement: c.placement,
      };
      if (c === chosen) {
        const reasonCode = c.handlerId === holderId && holderId !== originalHandlerId ? "creator_kept_by_real_holder" : "creator_projected_value_higher";
        const note = `${c.handlerId} crea con ${c.screenerId} de bloqueador (${c.placement}): valor proyectado ${c.value.toFixed(3)}, listo en ${((c.tReadyMs - t0) / 1000).toFixed(2)} s, primera lectura a ${((c.tFirstReadMs - t0) / 1000).toFixed(2)} s.`;
        return { id: c.handlerId, status: "elegida" as const, reasonCode: reasonCode as import("../audit/audit-types").AuditReasonCode, reasonNote: note, values };
      }
      const lostByTime = c.placement === chosen.placement && eligible(c);
      return {
        id: c.handlerId,
        status: "descartada_por_condicion" as const,
        reasonCode: (lostByTime ? (c.handlerId === holderId ? "creator_pass_back_faster" : "creator_ready_later_in_band") : "situational_value_lower") as import("../audit/audit-types").AuditReasonCode,
        values,
      };
    });
    // Mejor candidato de cada colocación evaluada (ME-07B v2 §4).
    const placementOptions = placements.map((placement) => {
      // El valor comparado de cada ficha es el de su mejor asignación (`topOf`); la
      // elegida informa además de la asignación que se ejecuta.
      const top = topOf.get(placement)!;
      const isChosen = placement === chosen.placement;
      const values = {
        projectedValue: top.value,
        handlerId: top.handlerId,
        screenerId: top.screenerId,
        projectedPlan: top.plan,
        projectedBestRead: top.read,
        readySeconds: (top.tReadyMs - t0) / 1000,
        firstReadSeconds: (top.tFirstReadMs - t0) / 1000,
        ...top.breakdown,
        ...(isChosen ? { chosenAssignmentValue: chosen.value, chosenHandlerId: chosen.handlerId, chosenScreenerId: chosen.screenerId, chosenFirstReadSeconds: (chosen.tFirstReadMs - t0) / 1000 } : {}),
      };
      // La elegida es siempre la de mayor valor; a igual valor exacto pierde la que lee después.
      const reasonCode: import("../audit/audit-types").AuditReasonCode =
        placements.length === 1
          ? "placement_forced_by_plan"
          : isChosen
            ? "placement_projected_value_higher"
            : top.value === winner.value
              ? "placement_tied_first_read_later"
              : "placement_projected_value_lower";
      return { id: placement, status: isChosen ? ("elegida" as const) : ("descartada_por_condicion" as const), reasonCode, values };
    });
    return {
      // Sin cambio de roles se conserva el marco; Horns siempre reasigna el segundo cuerno (O3↔O4).
      frame: Object.entries(chosen.map).every(([slot, id]) => frame.slotToId[slot] === id) ? frame : rebindFrame(frame, chosen.map),
      options,
      placement: chosen.placement,
      placementOptions,
      targets: chosen.targets,
    };
  }

  /**
   * Asignaciones Horns desde una asignación con su creador ya fijado: cada
   * interior puede bloquear y el otro es el segundo cuerno; los exteriores que
   * no crean van a las esquinas (O2 conserva a quien ya era O2 si es
   * exterior). Cada atacante conserva a su defensor.
   */
  private hornsRoleMaps(frame: Frame, handlerMap: Readonly<Record<string, string>>): Record<string, string>[] {
    const lineupFrame = this.frameFor(frame.attacking.id);
    const interiors = [lineupFrame.slotToId.O4!, lineupFrame.slotToId.O5!];
    // Un interior no crea en Horns: crea el base del quinteto (rol 1) o, si
    // no lo es, el primer exterior.
    const five = OFFENSE_SLOTS.map((slot) => handlerMap[slot]!);
    const handler = !interiors.includes(handlerMap.O1!)
      ? handlerMap.O1!
      : !interiors.includes(lineupFrame.slotToId.O1!)
        ? lineupFrame.slotToId.O1!
        : five.find((id) => !interiors.includes(id))!;
    const slotOf = (id: string) => OFFENSE_SLOTS.find((slot) => handlerMap[slot] === id)!;
    const guardOf = (id: string) => handlerMap[`D${slotOf(id).slice(1)}`]!;
    const perimeter = OFFENSE_SLOTS.map((slot) => handlerMap[slot]!).filter((id) => id !== handler && !interiors.includes(id));
    perimeter.sort((a, b) => (a === handlerMap.O2 ? -1 : b === handlerMap.O2 ? 1 : 0));
    const out: Record<string, string>[] = [];
    for (const screener of interiors) {
      const second = interiors.find((id) => id !== screener)!;
      const attackers: Record<string, string> = { O1: handler, O2: perimeter[0]!, O3: second, O4: perimeter[1]!, O5: screener };
      const map: Record<string, string> = { ...attackers };
      for (const [slot, id] of Object.entries(attackers)) map[`D${slot.slice(1)}`] = guardOf(id);
      out.push(map);
    }
    return out;
  }

  /**
   * Asignaciones Delay (LAB-0.10) desde una asignación con su creador ya
   * fijado: cada interior del quinteto puede ser el pívot de arriba (O5) y el
   * otro el poste (O4); los exteriores que no crean van a la esquina fuerte
   * (O2, quien ya era O2 si es exterior) y al ala débil (O3). Un interior no
   * crea en Delay (como en Horns). Cada atacante conserva a su defensor.
   */
  private delayRoleMaps(frame: Frame, handlerMap: Readonly<Record<string, string>>): Record<string, string>[] {
    return this.hornsRoleMaps(frame, handlerMap).map((horns) => {
      // Misma elección de manejador e interiores que Horns, con el segundo interior en el poste (O4) y el exterior en el ala débil (O3).
      const map: Record<string, string> = { ...horns, O3: horns.O4!, O4: horns.O3!, D3: horns.D4!, D4: horns.D3! };
      return map;
    });
  }

  private slotOf(map: Readonly<Record<string, string>>, id: string): string {
    for (const [slot, v] of Object.entries(map)) if (v === id) return slot;
    throw new Error(`Jugador sin rol en la asignación: ${id}`);
  }

  protected organize(frame: Frame, t0: Milliseconds, holderId: string): Step | null {
    const phase = this.currentPossession().phases[this.currentPossession().phases.length - 1]!;
    if (phase.entry === "pendiente") {
      this.setPhaseEntry(
        "ataque_organizado",
        `La posesión continúa y se reorganiza con ${(this.shotRemainingAt(t0) / 1000).toFixed(1)} s de lanzamiento, desde las posiciones que ya ocupaban.`,
      );
    }

    // ME-07A §3.2: el poseedor real puede conservar la iniciativa en vez de
    // devolver siempre el balón al rol fijo O1. Compara, con la misma
    // geometría real (F01 del portador, T09/T11/flight del pase), si le
    // sale más a cuenta llegar él mismo al puesto de creador que esperar el
    // pase de vuelta; en empate exacto se conserva devolver a O1 (mismo
    // criterio de plan base que el resto de esta entrega). Si conserva la
    // iniciativa, se reasigna su rol y el de O1 (`rebindFrame`, ya usado
    // por la segunda entrada del bloqueo, ME-04): los otros tres atacantes
    // mantienen su tarea de espaciado/corte/balance sin cambios.
    const originalHandlerId = frame.slotToId.O1!;
    const assignment = this.assignOrganizedRoles(frame, t0, holderId);
    const effectiveFrame = assignment.frame;

    const targets = assignment.targets;
    const arrivals = this.planOrganizeLegs(effectiveFrame, t0, [], targets);
    const holderSlot = effectiveFrame.idToSlot[holderId]!;
    // La acción organizada empieza cuando los cinco atacantes están
    // situados; el ataque no espera a una defensa que llega tarde.
    const attackerIds = OFFENSE_SLOTS.map((slot) => effectiveFrame.slotToId[slot]!);
    const tAllSet = Math.max(t0, ...attackerIds.map((id) => arrivals[id]!));
    const handlerId = effectiveFrame.slotToId.O1!;
    this.auditDecision(t0, {
      point: "organizacion_creador",
      holderId,
      participants: [...new Set([holderId, originalHandlerId, effectiveFrame.slotToId.O5!])],
      chosenOptionId: handlerId,
      options: assignment.options,
    });
    this.auditDecision(t0, {
      point: "colocacion_bloqueo",
      holderId,
      participants: [handlerId, effectiveFrame.slotToId.O5!],
      chosenOptionId: assignment.placement,
      options: assignment.placementOptions,
    });

    // Cuenta de 8 s si el control empezó en pista trasera (art. 28).
    if (this.backcourt) {
      const from = toLocal(effectiveFrame.dir, this.positionAt(holderId, t0));
      const to = targets[holderSlot]!;
      const offset = frontcourtEntryOffsetSeconds(from, to, (arrivals[holderId]! - t0) / 1000);
      const crossingMs = offset === null ? null : t0 + secondsToMs(offset);
      const count = evaluateBackcourtCount(this.backcourt.startMs, crossingMs, this.backcourt.elapsedBeforeMs);
      if (count.violation && count.violationAtMs! <= tAllSet) return this.backcourtViolation(effectiveFrame, count.violationAtMs!, holderId);
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
      return this.shotClockViolationDuringPlay(effectiveFrame, expiry, holderAtExpiry);
    }

    if (passNeeded) {
      const outcome = resolvePass(this.profile(holderId).attributes.T09, this.profile(handlerId).attributes.T11, false, 0, 0, this.rng);
      if (!this.emit({ atMs: releaseMs, phase: "ejecutado", kind: "pass_released", actors: [holderId, handlerId], text: `${holderId} devuelve el balón al base ${handlerId} para iniciar la acción.`, ball: { status: "in_flight_pass", holderId: null, fixed: this.positionAt(holderId, releaseMs) } }))
        return null;
      if (!this.emit({ atMs: tReady, phase: "concedido", kind: "pass_received", actors: [handlerId], text: `${handlerId} recibe en su puesto.`, ball: { status: "held", holderId: handlerId, fixed: null } }))
        return null;
      if (outcome.kind === "awkward_control") tReady += secondsToMs(outcome.extraDelaySeconds);
      if (this.shotExpiryMs() <= tReady) return this.shotClockViolationDuringPlay(effectiveFrame, this.shotExpiryMs(), handlerId);
    }
    this.currentPlacement = assignment.placement;
    return this.runSet(effectiveFrame, tReady, targets);
  }

  protected runSet(
    frame: Frame,
    t0: Milliseconds,
    targets: Record<string, Point2D> = this.dispositionTargets(),
    entryText?: string,
  ): Step | null {
    const remaining = this.shotRemainingAt(t0);
    const local = this.localPositions(frame, t0);
    const coverage = this.coverageWhenDefending(frame.defending.id);
    // Defensores que aún no han llegado a su puesto: entran en la acción
    // desde donde están de verdad. Los que el árbol del bloqueo usa como
    // origen de una ayuda, reparación o protección del aro parten de esa
    // posición real (así el retraso tiene efecto causal); el resto sigue
    // su carrera hacia su marca mientras se juega. Con cobertura `auto`
    // (ME-07A §4) se posiciona igual que en `drop`: la resolución real de
    // `auto` ocurre dentro del núcleo, con su propia geometría en ese
    // instante; D2 solo se preposiciona aquí cuando ya se sabe con
    // certeza que la cobertura es `trampa`.
    const positionalDefenders = coverage === "trampa" ? ["D2", "D3", "D4", "D5"] : ["D3", "D4", "D5"];
    const coverageText: Record<string, string> = { trampa: "trampa", auto: "cobertura automática", drop: "drop", cambio: "cambio", show: "show", a_la_altura: "a la altura", por_debajo: "por debajo", ice: "ICE" };
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
        text:
          entryText ??
          (this.currentPlacement === "delay"
            ? `Los cinco atacantes están situados en Delay: ${frame.slotToId.O5} arriba por encima del arco, ${frame.slotToId.O4} en el poste bajo, ${frame.slotToId.O2} en la esquina fuerte y ${frame.slotToId.O3} en el ala débil; ${frame.slotToId.O1} retrasa la acción desde el ala (${coverageText[coverage] ?? coverage}) con ${(remaining / 1000).toFixed(1)} s de lanzamiento.${lateText}`
            : this.currentPlacement === "horns"
            ? `Los cinco atacantes están situados en Horns: ${frame.slotToId.O5} y ${frame.slotToId.O3} en los codos, ${frame.slotToId.O2} y ${frame.slotToId.O4} en las esquinas; ${frame.slotToId.O1} usa el bloqueo de ${frame.slotToId.O5} (${coverageText[coverage] ?? coverage}) con ${(remaining / 1000).toFixed(1)} s de lanzamiento.${lateText}`
            : `Los cinco atacantes están situados: ${frame.slotToId.O1} y ${frame.slotToId.O5} inician el bloqueo directo ${this.currentPlacement} (${coverageText[coverage] ?? coverage}) con ${(remaining / 1000).toFixed(1)} s de lanzamiento.${lateText}`),
        detail: { shotClockMs: remaining, lateDefenders: late, roles: { ...frame.slotToId }, placement: this.currentPlacement },
        ball: { status: "held", holderId: frame.slotToId.O1!, fixed: null },
      })
    )
      return null;
    return this.runCore(frame, t0, { kind: "organized_set" }, legs);
  }

  protected backcourtViolation(frame: Frame, atMs: Milliseconds, holderId: string): Step | null {
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

  protected shotClockViolationDuringPlay(frame: Frame, atMs: Milliseconds, holderId: string): Step | null {
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

  protected participants(frame: Frame, local: Record<string, Point2D>, slots: readonly string[]): RaceParticipant[] {
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

  /**
   * Oposición que conseguiría un defensor que sale a cerrar desde su
   * posición real (misma regla R_contest de LAB-0.3 que el resolvedor del
   * tiro): dentro de alcance al soltar y, para el nivel 1, colocado (llegada
   * + frenada F03) antes de empezar el gesto.
   */
  protected closeoutLevel(closer: RaceParticipant, spot: Point2D, arrivalSeconds: number, tGesture: number, tReady: number): EffectiveOpposition {
    const reach = contestReachMeters(this.profile(closer.id).measures.wingspanCm);
    const at = (t: number) => moveToward(closer.position, spot, closer.lateralSpeedMps, t);
    const braking = closeoutBrakingExtraSeconds(this.profile(closer.id).attributes.F03);
    return evaluateContestLevel({
      withinReachAtRelease: distance(at(tReady), spot) <= reach,
      settledBeforeGesture: distance(at(tGesture), spot) <= reach && arrivalSeconds + braking <= tGesture,
    });
  }

  protected advance(frame: Frame, t0: Milliseconds, holderId: string): Step | null {
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

    // Ventana leída en el instante real en que el balón entra en pista
    // delantera (ME-03, aclaración opción B): se avanza primero el balón
    // (botando con el portador, con todos los demás desplazamientos ya en
    // marcha) hasta ese cruce, y solo entonces se reconstruyen posiciones y
    // trayectorias para leer la ventaja. Un defensor que a esa altura
    // todavía no ha cruzado no protege nada todavía, por rápido que sea.
    // El portador bota hacia el aro: hace falta un tramo de trayectoria real
    // (no solo el instante t1) para poder interpolar su posición más
    // adelante, en el cruce real de la mitad de la pista.
    const originGlobal = this.positionAt(carrierId, t1);
    const originLocal = toLocal(frame.dir, originGlobal);
    const fullArriveMs = this.moveGlobal(carrierId, t1, attackedHoopGlobal(frame.dir));
    const crossOffset = frontcourtEntryOffsetSeconds(originLocal, ATTACKED_HOOP, (fullArriveMs - t1) / 1000);
    if (crossOffset !== null) t1 += secondsToMs(crossOffset);

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
      // ME-07A §3.2: el aro contenido no cierra por sí solo una ventana de
      // triple limpia del propio portador. Comprueba, con la misma
      // geometría real ya calculada (posiciones, velocidades), si detrás
      // de la línea le queda un margen real antes de que el defensor que
      // protege el aro pueda cerrarle el tiro (mismo margen 0,25 s que la
      // primera lectura del bloqueo directo). No es un tiro concedido: la
      // tendencia de tiro del portador decide si lo toma (`decidida`
      // siempre; `prudente` nunca; `equilibrada` con la misma elección
      // sembrada `secondOptionProbability(M03)` que el resto del motor).
      const remaining = this.shotRemainingAt(t1) / 1000;
      // ME-07B v2 §2.5: la ventana se lee en el punto real de lanzamiento,
      // no en el cruce del medio campo. El portador sigue botando hacia el
      // aro hasta un punto detrás del arco; cada defensor puede salir a
      // cerrarle desde su posición real en el cruce. El triple (tras bote,
      // preparación T06) se compara con el valor proyectado de organizar
      // (misma proyección que la asignación de creador): gana el mayor y,
      // dentro de la banda de empate, decide la tendencia de tiro del
      // portador (`decidida` tira, `prudente` organiza).
      const carrierProfile = this.profile(carrierId);
      const pullUpPrep = movingShotPrepSeconds(carrierProfile.attributes.T06);
      const pullUps = remaining > 2 ? planTransitionPullUps(carrier, defenders) : [];
      let bestPullUp: { cand: (typeof pullUps)[number]; level: EffectiveOpposition; value: number } | null = null;
      for (const cand of pullUps) {
        const tReady = cand.travelSeconds + pullUpPrep;
        if (tReady >= remaining) continue;
        const level = this.closeoutLevel(cand.closer, cand.spot, cand.closeoutArrivalSeconds, cand.travelSeconds, tReady);
        const value = 3 * shotProbability(THREE_POINT_BASE_PROBABILITY, carrierProfile.attributes.T04, level);
        if (!bestPullUp || value > bestPullUp.value + 1e-12) bestPullUp = { cand, level, value };
      }
      if (bestPullUp) {
        const organizeValue = Math.max(0, ...this.assignOrganizedRoles(frame, t1, carrierId).options.map((o) => (o.values?.projectedValue as number) ?? 0));
        const gap = bestPullUp.value - organizeValue;
        let takeTriple = gap > 0;
        let byTendency = false;
        if (Math.abs(gap) <= FIRST_READ_TIE_BAND_POINTS) {
          if (carrierProfile.shotTendency === "decidida" && !takeTriple) {
            takeTriple = true;
            byTendency = true;
          } else if (carrierProfile.shotTendency === "prudente" && takeTriple) {
            takeTriple = false;
            byTendency = true;
          }
        }
        const { cand, level, value } = bestPullUp;
        const closerId = cand.closer.id;
        const values = {
          situationalValue: value,
          organizeProjectedValue: organizeValue,
          depthBehindLineMeters: cand.depthBehindLineMeters,
          travelSeconds: cand.travelSeconds,
          closerId,
          closeoutArrivalSeconds: cand.closeoutArrivalSeconds,
          opposition: level,
          shotTendency: carrierProfile.shotTendency,
        };
        const reason = `Triple del portador en transición: ${carrierId} llegaría a tirar ${cand.depthBehindLineMeters.toFixed(2)} m detrás del arco en ${cand.travelSeconds.toFixed(2)} s, con ${closerId} cerrando (oposición ${level}); valor ${value.toFixed(3)} frente a organizar ${organizeValue.toFixed(3)} — ${takeTriple ? "toma el tiro" : "organiza"}${byTendency ? ` por su tendencia ${carrierProfile.shotTendency}` : ""}.`;
        if (takeTriple && this.backcourt) {
          const count = evaluateBackcourtCount(this.backcourt.startMs, crossOffset === null ? null : t1, this.backcourt.elapsedBeforeMs);
          if (count.violation) return this.backcourtViolation(frame, count.violationAtMs!, carrierId);
          this.backcourt = null;
        }
        this.setPhaseEntry(takeTriple ? "ventaja_temprana" : "ataque_organizado", reason);
        if (!this.emit({ atMs: t1, phase: "reconocido", kind: "transition_read", actors: [carrierId, closerId], text: reason, detail: { advantage: takeTriple, kind: "triple_portador", ...values } }))
          return null;
        this.auditDecision(t1, {
          point: "entrada_fase_transicion",
          holderId: carrierId,
          participants: [carrierId, closerId],
          chosenOptionId: takeTriple ? "triple_portador" : "sin_ventaja",
          factLinkKind: "transition_read",
          options: [
            {
              id: "triple_portador",
              status: takeTriple ? "elegida" : "descartada_por_condicion",
              reasonCode: takeTriple ? (byTendency ? "shot_tendency_favors_shot" : "transition_three_point_window_open") : byTendency ? "shot_tendency_favors_continuation" : "situational_value_lower",
              values,
            },
            {
              id: "sin_ventaja",
              status: takeTriple ? "descartada_por_condicion" : "elegida",
              reasonCode: takeTriple ? "situational_value_lower" : "transition_no_advantage",
              reasonNote: read.reason,
              values: { organizeProjectedValue: organizeValue },
            },
            { id: "penetracion", status: "no_evaluada_por_cortocircuito", reasonCode: "not_evaluated_short_circuit" },
            { id: "pase_adelantado", status: "no_evaluada_por_cortocircuito", reasonCode: "not_evaluated_short_circuit" },
            { id: "superioridad_2x1", status: "no_evaluada_por_cortocircuito", reasonCode: "not_evaluated_short_circuit" },
            { id: "superioridad_3x2", status: "no_evaluada_por_cortocircuito", reasonCode: "not_evaluated_short_circuit" },
          ],
        });
        if (takeTriple) {
          this.assignResponsibility(t1, carrierId, "carril_transicion", "Sube botando y se levanta para el triple antes de organizar.");
          const closer = cand.closer;
          const entry: LinkedEntry = {
            kind: "direct_finish",
            shooterSlot: carrierSlot,
            finishSpot: cand.spot,
            shooterAtSpotSeconds: cand.travelSeconds,
            shotType: "three_point",
            prepSeconds: pullUpPrep,
            pass: null,
            contesterSlot: closer.slot,
            contesterArrivalSeconds: cand.closeoutArrivalSeconds,
            contesterGeometry: {
              originPos: closer.position,
              destinationPos: cand.spot,
              speedMps: closer.lateralSpeedMps,
              brakingExtraSeconds: closeoutBrakingExtraSeconds(this.profile(closer.id).attributes.F03),
            },
          };
          const legs: Record<string, PlannedLeg> = {
            [carrierSlot]: { departSeconds: 0, arriveSeconds: cand.travelSeconds, to: cand.spot },
          };
          for (const p of [...attackers, ...defenders]) {
            if (p.slot === carrierSlot) continue;
            const to = p.slot === closer.slot ? cand.spot : this.dispositionTargets()[p.slot]!;
            legs[p.slot] = { departSeconds: 0, arriveSeconds: p.slot === closer.slot ? cand.closeoutArrivalSeconds : timeToReach(p.position, to, p.runSpeedMps), to };
          }
          return this.runCore(frame, t1, entry, legs);
        }
        return { kind: "organize", frame, atMs: t1, holderId: carrierId };
      }

      const reason = `Sin ventaja: ataque organizado. Primer defensor en el aro: ${read.firstDefender.id} (${formatSeconds(read.firstDefender.arrivalSeconds)}); atacante más rápido: ${read.fastestAttacker.id} (${formatSeconds(read.fastestAttacker.arrivalSeconds)}); ${read.reason}.`;
      this.setPhaseEntry("ataque_organizado", reason);
      // El hecho se emite primero: el enlace de auditoría (§4.2) apunta al
      // instante en que `transition_read` realmente se registró, no al
      // instante propio de esta decisión (aquí coinciden en t1, pero la
      // búsqueda hacia atrás en `this.events` es la misma regla que usan los
      // demás puntos, para no depender de que ambos instantes coincidan).
      if (!this.emit({ atMs: t1, phase: "reconocido", kind: "transition_read", actors: [carrierId], text: reason, detail: { advantage: false } }))
        return null;
      this.auditDecision(t1, {
        point: "entrada_fase_transicion",
        holderId: carrierId,
        participants: [carrierId, read.firstDefender.id, read.fastestAttacker.id],
        chosenOptionId: "sin_ventaja",
        factLinkKind: "transition_read",
        options: [
          { id: "sin_ventaja", status: "elegida", reasonCode: "transition_no_advantage", reasonNote: read.reason, values: { firstDefenderArrivalSeconds: read.firstDefender.arrivalSeconds, fastestAttackerArrivalSeconds: read.fastestAttacker.arrivalSeconds } },
          { id: "penetracion", status: "no_evaluada_por_cortocircuito", reasonCode: "not_evaluated_short_circuit" },
          { id: "pase_adelantado", status: "no_evaluada_por_cortocircuito", reasonCode: "not_evaluated_short_circuit" },
          { id: "superioridad_2x1", status: "no_evaluada_por_cortocircuito", reasonCode: "not_evaluated_short_circuit" },
          { id: "superioridad_3x2", status: "no_evaluada_por_cortocircuito", reasonCode: "not_evaluated_short_circuit" },
        ],
      });
      return { kind: "organize", frame, atMs: t1, holderId: carrierId };
    }

    const shooterSlot = read.kind === "penetracion" ? carrierSlot : read.receiver.slot;
    const shooterId = frame.slotToId[shooterSlot]!;
    const shooterArrival =
      read.kind === "penetracion" ? read.carrier.arrivalSeconds : timeToReach(local[shooterSlot]!, ATTACKED_HOOP, this.runSpeed(shooterId));
    const contesterTimed =
      read.kind === "superioridad"
        ? read.secondDefender
        : read.kind === "superioridad_3x2"
          ? (read.thirdDefender ?? read.secondDefender)
          : read.firstDefender;
    const reason =
      read.kind === "penetracion"
        ? `Ventaja temprana: ${carrierId} ataca el aro y llega en ${formatSeconds(read.carrier.arrivalSeconds)}, antes que el primer defensor (${read.firstDefender.id}, ${formatSeconds(read.firstDefender.arrivalSeconds)}).`
        : read.kind === "pase_adelantado"
          ? `Ventaja temprana: ${carrierId} adelanta el balón a ${shooterId}, que llega al aro en ${formatSeconds(read.receiver.arrivalSeconds)}, antes que el primer defensor (${read.firstDefender.id}, ${formatSeconds(read.firstDefender.arrivalSeconds)}).`
          : read.kind === "superioridad"
            ? `Ventaja temprana 2×1: ${read.firstDefender.id} para a ${carrierId} en el aro (${formatSeconds(read.carrier.arrivalSeconds)}) y ${shooterId} recibe en ${formatSeconds(read.receiver.arrivalSeconds)}, antes que el segundo defensor (${read.secondDefender.id}, ${formatSeconds(read.secondDefender.arrivalSeconds)}).`
            : `Ventaja temprana 3×2: ${read.firstDefender.id} para a ${carrierId} y ${read.secondDefender.id} cierra a ${read.contained.id} (el corredor); ${shooterId} recibe abierto en ${formatSeconds(read.receiver.arrivalSeconds)}${read.thirdDefender ? `, antes que el tercer defensor (${read.thirdDefender.id}, ${formatSeconds(read.thirdDefender.arrivalSeconds)})` : " sin un tercer defensor todavía situado"}.`;

    // Cuenta de 8 s: el cruce ya se fijó en `t1` antes de leer la ventaja.
    if (this.backcourt) {
      const count = evaluateBackcourtCount(
        this.backcourt.startMs,
        crossOffset === null ? null : t1,
        this.backcourt.elapsedBeforeMs,
      );
      if (count.violation) return this.backcourtViolation(frame, count.violationAtMs!, carrierId);
      this.backcourt = null;
    }

    this.setPhaseEntry("ventaja_temprana", reason);
    this.assignResponsibility(t1, shooterId, "carril_transicion", "Ataca el aro antes de que llegue su defensor.");
    // El hecho se emite primero (§4.2): el enlace de auditoría busca el
    // `transition_read` ya registrado, con su instante real.
    if (!this.emit({ atMs: t1, phase: "reconocido", kind: "transition_read", actors: [carrierId, shooterId], text: reason, detail: { advantage: true, kind: read.kind } }))
      return null;
    this.auditDecision(t1, {
      point: "entrada_fase_transicion",
      holderId: carrierId,
      participants: [carrierId, shooterId, read.firstDefender.id],
      chosenOptionId: read.kind === "superioridad" ? "superioridad_2x1" : read.kind === "superioridad_3x2" ? "superioridad_3x2" : read.kind,
      factLinkKind: "transition_read",
      options: [
        { id: read.kind === "superioridad" ? "superioridad_2x1" : read.kind === "superioridad_3x2" ? "superioridad_3x2" : read.kind, status: "elegida", reasonCode: "transition_advantage_found", reasonNote: reason },
        ...(["penetracion", "pase_adelantado", "superioridad_2x1", "superioridad_3x2", "sin_ventaja"] as const)
          .filter((id) => id !== (read.kind === "superioridad" ? "superioridad_2x1" : read.kind === "superioridad_3x2" ? "superioridad_3x2" : read.kind))
          .map((id) => ({ id, status: "no_evaluada_por_cortocircuito" as const, reasonCode: "not_evaluated_short_circuit" as const })),
      ],
    });

    // Diez desplazamientos reales mientras se resuelve la ventaja: quienes
    // atacan el aro y los defensores que lo protegen van al aro; el resto,
    // a su puesto o su marca.
    const targets = this.dispositionTargets();
    const toRim = new Set<string>([shooterSlot, read.firstDefender.slot, contesterTimed.slot]);
    if (read.kind === "superioridad") toRim.add(carrierSlot);
    if (read.kind === "superioridad_3x2") {
      toRim.add(carrierSlot);
      toRim.add(read.contained.slot);
      toRim.add(read.secondDefender.slot);
    }
    const defenderArrival = new Map<string, number>([
      [read.firstDefender.slot, read.firstDefender.arrivalSeconds],
      [contesterTimed.slot, contesterTimed.arrivalSeconds],
      ...(read.kind === "superioridad_3x2" ? ([[read.secondDefender.slot, read.secondDefender.arrivalSeconds]] as const) : []),
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

  protected secondChance(frame: Frame, t0: Milliseconds, holderId: string): Step | null {
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

  protected looseBall(_frame: Frame, t0: Milliseconds, ball: Point2D): Step | null {
    if (!isInsideCourt(ball)) {
      this.guardianStop(t0, "balón suelto fuera de la cancha sin último toque adjudicable; ME-03 no inventa la reanudación.");
      return null;
    }
    this.holdAll(t0);
    const ids = [...this.onCourtIds()].sort();
    const candidates = ids.map((id) => {
      const p = this.profile(id);
      return {
        playerId: id,
        teamId: this.teamOf.get(id)!,
        position: this.positionAt(id, t0),
        arrivalTimeSeconds: timeToReach(this.positionAt(id, t0), ball, REBOUND_CANDIDATE_SPEED_MPS),
        t19: p.attributes.T19,
        f05: p.attributes.F05,
        t20: p.attributes.T20,
      };
    });
    // Balón ya en el suelo: sin vuelo no hay cierre de rebote (ME-07B v2 §2.1).
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

    const live = this.pendingLooseBallFrame;
    this.pendingLooseBallFrame = null;
    const fresh = this.frameFor(possessionTeam);
    const frame = sameTeam && live && live.attacking.id === possessionTeam ? withLivePairs(fresh, live) : fresh;
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

  /**
   * Materializa los hechos con la foto de los diez que estaban en pista en
   * cada instante (coordenadas globales), recorriendo cada trayectoria una
   * sola vez en orden temporal.
   */
  protected materializeEvents(stopAtMs: Milliseconds): TramoEvent[] {
    for (const id of Object.keys(this.tracks)) this.tracks[id] = truncateTrajectory(this.tracks[id]!, stopAtMs);
    return this.events.map((e, i) => {
      const positions: PlayerSnapshot[] = e.onCourtIds.map((id) => ({ playerId: id, position: this.positionAt(id, e.atMs) }));
      const ball: TramoBallState = {
        status: e.ball.status,
        holderId: e.ball.holderId,
        position: e.ball.holderId ? this.positionAt(e.ball.holderId, e.atMs) : (e.ball.fixed ?? { x: 14, y: 7.5 }),
      };
      return { ...e, sequence: i, positions, ball };
    });
  }
}
