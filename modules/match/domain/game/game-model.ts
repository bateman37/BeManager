/**
 * Contrato del partido completo de laboratorio (ME-04 §2). `GameInput` es
 * **una sola foto** de los dos equipos (hasta doce inscritos cada uno,
 * cinco titulares), la semilla, la cobertura y la prioridad tras tiro de
 * cada equipo y las versiones de motor y reglamento. Misma foto y semilla
 * reproducen marcador, hechos, rotación, relojes y acta; editar perfiles
 * después no reescribe un partido ya resuelto (se guarda una copia).
 */
import type { Milliseconds } from "../time/clock";
import type { PlayerProfile } from "../players/player-profile";
import type { DefensiveCoverage } from "../lab/match-input";
import { LAB_0_2_PARAMETERS_VERSION } from "../lab/lab-0-2-parameters";
import type { ReboundPriority } from "../simulation/possession-core";
import { LAB_STARTER_IDS } from "../players/lab-roster-fixture";
import { LAB_DECLARED_ROLES, type FunctionalRole } from "../players/functional-roles";
import type { PhaseEntry, PossessionRecord, ResponsibilityChange, TramoEvent } from "../sequence/tramo-model";
import { JUMP_BALL_APPROXIMATION_VERSION, type DeadBallCause, type FoulSanction, type DefensiveFoulType } from "./fiba-2026-rules";
import { SUBSTITUTION_POLICY_VERSION, type SubstitutionReason } from "./substitution-policy";
import type { BoxScore } from "./box-score";
import type { RawAuditLog } from "../audit/audit-types";

export const GAME_VERSION = "ME-04-GAME-1";
export const MAX_ROSTER_SIZE = 12;

export interface GameTeamInput {
  readonly id: string;
  readonly name: string;
  /** Inscritos (máximo doce), copia estable. */
  readonly roster: readonly PlayerProfile[];
  /** Cinco titulares en orden de rol funcional 1–5. */
  readonly starters: readonly string[];
  /** Roles funcionales declarados de cada inscrito (uno o dos). */
  readonly declaredRoles: Readonly<Record<string, readonly FunctionalRole[]>>;
  readonly priority: ReboundPriority;
  /** Cobertura con la que este equipo defiende el bloqueo directo. */
  readonly coverage: DefensiveCoverage;
}

export interface GameInput {
  readonly gameVersion: typeof GAME_VERSION;
  readonly seed: number;
  readonly rulesetVersion: "FIBA-2026";
  readonly labParametersVersion: typeof LAB_0_2_PARAMETERS_VERSION;
  readonly jumpBallVersion: typeof JUMP_BALL_APPROXIMATION_VERSION;
  readonly substitutionPolicyVersion: typeof SUBSTITUTION_POLICY_VERSION;
  /** `[0]` ataca hacia x creciente en la primera mitad. */
  readonly teams: readonly [GameTeamInput, GameTeamInput];
  /**
   * Registrar auditoría (ME-04A §2), desactivado por defecto a nivel de
   * tipo: la UI de `/lab` lo activa por defecto. Sin esto, `GameResult.audit`
   * queda ausente y el coste/comportamiento son los de antes de ME-04A.
   */
  readonly auditEnabled?: boolean;
}

export interface BuildGameTeamArgs {
  readonly id: string;
  readonly name: string;
  readonly players: readonly PlayerProfile[];
  readonly priority: ReboundPriority;
  readonly coverage: DefensiveCoverage;
  readonly starters?: readonly string[];
  readonly declaredRoles?: Readonly<Record<string, readonly FunctionalRole[]>>;
}

function buildTeam(args: BuildGameTeamArgs): GameTeamInput {
  if (args.players.length > MAX_ROSTER_SIZE) {
    throw new Error(`${args.name} inscribe ${args.players.length} jugadores; el máximo es ${MAX_ROSTER_SIZE}.`);
  }
  const starters = args.starters ?? LAB_STARTER_IDS[args.id];
  if (!starters || starters.length !== 5) throw new Error(`${args.name} no tiene cinco titulares declarados.`);
  const declaredSource = args.declaredRoles ?? LAB_DECLARED_ROLES;
  const declaredRoles: Record<string, readonly FunctionalRole[]> = {};
  for (const p of args.players) declaredRoles[p.id] = [...(declaredSource[p.id] ?? [])];
  starters.forEach((id, i) => {
    if (!args.players.some((p) => p.id === id)) throw new Error(`Falta el titular ${id} en ${args.name}.`);
    const role = (i + 1) as FunctionalRole;
    if (!declaredRoles[id]!.includes(role)) {
      throw new Error(`El titular ${id} de ${args.name} no declara el rol ${role}: el quinteto no cubre los cinco roles.`);
    }
  });
  return {
    id: args.id,
    name: args.name,
    // Copia profunda: el partido conserva su propio snapshot de perfiles.
    roster: args.players.map((p) => structuredClone(p)),
    starters: [...starters],
    declaredRoles,
    priority: args.priority,
    coverage: args.coverage,
  };
}

export function buildGameInput(args: {
  readonly seed: number;
  readonly home: BuildGameTeamArgs;
  readonly away: BuildGameTeamArgs;
  readonly auditEnabled?: boolean;
}): GameInput {
  const home = buildTeam(args.home);
  const away = buildTeam(args.away);
  const ids = [...home.roster, ...away.roster].map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error("Hay IDs de jugador repetidos entre los dos equipos.");
  return {
    gameVersion: GAME_VERSION,
    seed: args.seed,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: LAB_0_2_PARAMETERS_VERSION,
    jumpBallVersion: JUMP_BALL_APPROXIMATION_VERSION,
    substitutionPolicyVersion: SUBSTITUTION_POLICY_VERSION,
    teams: [home, away],
    auditEnabled: args.auditEnabled ?? false,
  };
}

export type GameEvent = TramoEvent;

export interface PeriodRecord {
  readonly period: number;
  readonly label: string;
  readonly overtime: boolean;
  readonly startMs: Milliseconds;
  endMs: Milliseconds | null;
  /** Puntos anotados en este período por equipo. */
  points: Record<string, number>;
}

export interface SubstitutionRecord {
  readonly atMs: Milliseconds;
  readonly period: number;
  readonly gameClockMs: Milliseconds;
  readonly teamId: string;
  readonly outId: string;
  readonly inId: string;
  readonly role: FunctionalRole;
  readonly reason: SubstitutionReason;
  readonly window: DeadBallCause;
  readonly outContinuousMs: Milliseconds;
}

export interface FoulRecord {
  readonly atMs: Milliseconds;
  readonly period: number;
  readonly gameClockMs: Milliseconds;
  readonly teamId: string;
  readonly foulerId: string;
  readonly fouledId: string;
  readonly type: DefensiveFoulType;
  readonly personalFoulsAfter: number;
  readonly teamFoulsAfter: number;
  readonly teamInPenalty: boolean;
  readonly sanction: FoulSanction;
  readonly disqualified: boolean;
}

export type GameStopCause = "final" | "guardian";

export const GAME_STOP_LABELS: Readonly<Record<GameStopCause, string>> = {
  final: "Final del partido",
  guardian: "Detenido por el guardián de progreso (sin ganador)",
};

export interface GameStop {
  readonly cause: GameStopCause;
  readonly atMs: Milliseconds;
  readonly explanation: string;
}

export interface GameResult {
  /** Identificador local y reproducible de esta corrida (no se persiste; ME-09). */
  readonly gameId: string;
  readonly input: GameInput;
  readonly events: readonly GameEvent[];
  readonly possessions: readonly PossessionRecord[];
  readonly periods: readonly PeriodRecord[];
  readonly substitutions: readonly SubstitutionRecord[];
  readonly fouls: readonly FoulRecord[];
  readonly responsibilities: readonly ResponsibilityChange[];
  readonly finalScore: Readonly<Record<string, number>>;
  /** `null` si el guardián detuvo el partido: nunca se inventa un ganador. */
  readonly winnerTeamId: string | null;
  readonly stop: GameStop;
  /** Acta proyectada una sola vez desde los hechos. */
  readonly box: BoxScore;
  /** Minutos que el motor acumuló con el reloj en marcha (para conciliar con el acta). */
  readonly engineMinutesMs: Readonly<Record<string, Milliseconds>>;
  /** Tiempo de juego efectivo disputado (suma de períodos jugados). */
  readonly effectivePlayedMs: Milliseconds;
  readonly entryCounts: Readonly<Record<PhaseEntry, number>>;
  readonly rngStateAtBoundaries: readonly { readonly atMs: Milliseconds; readonly state: number }[];
  /** Registro crudo de auditoría (ME-04A), solo presente cuando `input.auditEnabled` fue `true`. */
  readonly audit?: RawAuditLog;
}
