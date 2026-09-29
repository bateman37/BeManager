import type { Point2D } from "../geometry/point";
import type { AttackDirection } from "../geometry/frame";
import type { TrajectoryPoint } from "../geometry/trajectory";
import type { Milliseconds } from "../time/clock";
import type { PlayerProfile } from "../players/player-profile";
import type { DefensiveCoverage } from "../lab/match-input";
import { LAB_0_3_PARAMETERS_VERSION } from "../lab/lab-0-3-parameters";
import type { BallStatus } from "../simulation/match-state";
import type { FactKind, FactPhase, PlayerSnapshot } from "../simulation/fact";
import type { ReboundPriority } from "../simulation/possession-core";
import { LAB_STARTER_IDS } from "../players/lab-roster-fixture";

export type { ReboundPriority } from "../simulation/possession-core";

/** Versión del contrato del tramo enlazado (ME-03). */
export const TRAMO_VERSION = "ME-03-TRAMO-1";

/** Máximo de posesiones estadísticas cerradas de un tramo (ME-03 §2). */
export const TRAMO_MAX_POSSESSIONS = 4;

export const REBOUND_PRIORITY_LABELS: Readonly<Record<ReboundPriority, string>> = {
  proteger_balance: "Proteger balance",
  cargar_rebote: "Cargar rebote",
};

/**
 * Quinteto del tramo de cada equipo: los titulares del fixture (ME-04 amplía
 * la plantilla a doce, pero el tramo sigue jugando con este quinteto), en
 * orden de rol (1 base,
 * 2 escolta, 3 alero, 4 ala-pívot, 5 pívot). El prefijo del ID identifica
 * el equipo del fixture; el número, el rol natural del jugador en la acción
 * organizada. Ninguno de los dos decide quién ataca: eso lo decide el
 * control real del balón.
 */
export const QUINTET_IDS_BY_TEAM: Readonly<Record<string, readonly string[]>> = LAB_STARTER_IDS;

export interface TramoTeamSnapshot {
  readonly id: string;
  readonly name: string;
  /** Exactamente cinco perfiles, en orden de rol; copia estable (snapshot). */
  readonly players: readonly PlayerProfile[];
  /** Dirección de ataque fija durante el tramo (primer cuarto). */
  readonly attackDirection: AttackDirection;
  readonly priority: ReboundPriority;
}

/**
 * Snapshot único del tramo (ME-03 §2): semilla, perfiles efectivos,
 * planes de ambos equipos, cobertura y versiones. Repetirlo con la misma
 * entrada reproduce hechos, relojes y posiciones; editar un jugador después
 * no altera un tramo ya generado, porque aquí se guarda una copia.
 */
export interface TramoInput {
  readonly seed: number;
  readonly coverage: DefensiveCoverage;
  readonly rulesetVersion: "FIBA-2026";
  readonly labParametersVersion: typeof LAB_0_3_PARAMETERS_VERSION;
  readonly tramoVersion: typeof TRAMO_VERSION;
  /** Posición de partida: la del escenario `drop_con_ayuda`, 7:12 de C1 y 18 s de tiro. */
  readonly startScenarioId: "drop_con_ayuda";
  /** `[0]` empieza atacando (hacia x creciente); `[1]` defiende. */
  readonly teams: readonly [TramoTeamSnapshot, TramoTeamSnapshot];
}

export interface BuildTramoTeamArgs {
  readonly id: string;
  readonly name: string;
  readonly players: readonly PlayerProfile[];
  readonly priority: ReboundPriority;
}

function pickQuintet(team: BuildTramoTeamArgs): PlayerProfile[] {
  const ids = QUINTET_IDS_BY_TEAM[team.id];
  if (!ids) throw new Error(`Equipo sin quinteto de laboratorio conocido: ${team.id}`);
  return ids.map((id) => {
    const found = team.players.find((p) => p.id === id);
    if (!found) throw new Error(`Falta el jugador ${id} en ${team.name}: el tramo necesita su quinteto completo.`);
    // Copia profunda: el tramo conserva su propio snapshot de perfiles.
    return structuredClone(found);
  });
}

export function buildTramoInput(args: {
  readonly seed: number;
  readonly coverage: DefensiveCoverage;
  readonly offenseTeam: BuildTramoTeamArgs;
  readonly defenseTeam: BuildTramoTeamArgs;
}): TramoInput {
  return {
    seed: args.seed,
    coverage: args.coverage,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: LAB_0_3_PARAMETERS_VERSION,
    tramoVersion: TRAMO_VERSION,
    startScenarioId: "drop_con_ayuda",
    teams: [
      {
        id: args.offenseTeam.id,
        name: args.offenseTeam.name,
        players: pickQuintet(args.offenseTeam),
        attackDirection: "hacia_x_creciente",
        priority: args.offenseTeam.priority,
      },
      {
        id: args.defenseTeam.id,
        name: args.defenseTeam.name,
        players: pickQuintet(args.defenseTeam),
        attackDirection: "hacia_x_decreciente",
        priority: args.defenseTeam.priority,
      },
    ],
  };
}

/**
 * Estado del control del balón en un instante (ME-03 §2): se distinguen
 * el **equipo con control**, el **equipo con derecho a saque** y el
 * **balón suelto sin control**; ninguno es lo mismo que la posesión
 * estadística, que puede seguir abierta con el balón suelto.
 */
export interface ControlState {
  readonly status: "control" | "tiro_en_el_aire" | "balon_suelto" | "balon_muerto";
  /** Equipo con control (solo si `status === "control"`). */
  readonly controlTeamId: string | null;
  /** Equipo con derecho a saque (solo con balón muerto adjudicado). */
  readonly throwInTeamId: string | null;
}

export interface TramoBallState {
  readonly status: BallStatus;
  readonly holderId: string | null;
  readonly position: Point2D;
}

/** Cómo empezó una fase ofensiva dentro de una posesión estadística. */
export type PhaseKind =
  | "inicio_tramo"
  | "rebote_defensivo"
  | "robo"
  | "recuperacion_rival"
  | "saque"
  | "rebote_ofensivo"
  | "salida_segura"
  | "recuperacion_propia"
  /** ME-04: primer control vivo tras el salto inicial (solo en el partido). */
  | "salto_inicial";

/** Cómo se resolvió el ataque de la fase (ventaja temprana frente a ataque organizado). */
export type PhaseEntry =
  | "ataque_organizado"
  | "ventaja_temprana"
  | "segunda_oportunidad"
  /** ME-04: segunda entrada del mismo bloqueo directo tras negarse la primera (solo en el partido). */
  | "segunda_entrada"
  | "pendiente";

export interface PhaseRecord {
  readonly index: number;
  readonly kind: PhaseKind;
  readonly startMs: Milliseconds;
  entry: PhaseEntry;
  entryReason: string;
}

export interface PossessionRecord {
  readonly index: number;
  readonly teamId: string;
  readonly startMs: Milliseconds;
  readonly startReason: string;
  endMs: Milliseconds | null;
  endReason: string | null;
  readonly phases: PhaseRecord[];
}

/**
 * Responsabilidad asumida por un jugador y cuándo (ME-03 §2, §4): cargar el
 * rebote, proteger el balance, retornar a defender, salida del balón,
 * saque, colocarse para la acción organizada o su rol en ella.
 */
export type Responsibility =
  | "cargar_rebote"
  | "proteger_balance"
  | "retorno_defensivo"
  | "salida"
  | "carril_transicion"
  | "sacador"
  | "receptor_saque"
  | "organizacion"
  | "accion_organizada";

export interface ResponsibilityChange {
  readonly atMs: Milliseconds;
  readonly playerId: string;
  readonly teamId: string;
  readonly responsibility: Responsibility;
  readonly reason: string;
}

export interface TramoEvent {
  readonly sequence: number;
  readonly atMs: Milliseconds;
  readonly possessionIndex: number;
  readonly phaseIndex: number;
  /** Equipo de la posesión estadística abierta en ese instante. */
  readonly possessionTeamId: string;
  readonly phase: FactPhase;
  readonly kind: FactKind;
  readonly actors: readonly string[];
  readonly text: string;
  readonly detail: Readonly<Record<string, unknown>>;
  /** Foto de los diez en el instante del hecho, coordenadas globales. */
  readonly positions: readonly PlayerSnapshot[];
  readonly ball: TramoBallState;
  readonly control: ControlState;
  readonly gameClockMs: Milliseconds;
  /** `null` mientras no corre para nadie (p. ej. antes del toque legal de un saque). */
  readonly shotClockMs: Milliseconds | null;
  readonly score: Readonly<Record<string, number>>;
  /** Período del hecho (el tramo siempre es 1; el partido de ME-04, 1–4 y prórrogas 5…). */
  readonly period: number;
  /** Los diez IDs en pista en ese instante (orden estable). */
  readonly onCourtIds: readonly string[];
}

export type TramoStopCause = "cuatro_posesiones" | "tiempo_agotado" | "guardian";

export const TRAMO_STOP_LABELS: Readonly<Record<TramoStopCause, string>> = {
  cuatro_posesiones: "Cuatro posesiones cerradas",
  tiempo_agotado: "Tiempo reglamentario agotado",
  guardian: "Detenido por el guardián de progreso",
};

export interface TramoStop {
  readonly cause: TramoStopCause;
  readonly atMs: Milliseconds;
  readonly explanation: string;
}

/** Estadística de equipo derivada solo de hechos (sin ajustes posteriores). */
export interface TramoTeamBox {
  readonly fieldGoalAttempts2: number;
  readonly fieldGoalMade2: number;
  readonly fieldGoalAttempts3: number;
  readonly fieldGoalMade3: number;
  readonly freeThrowAttempts: number;
  readonly freeThrowMade: number;
  readonly points: number;
  readonly offensiveRebounds: number;
  readonly defensiveRebounds: number;
}

export interface TramoResult {
  readonly input: TramoInput;
  readonly events: readonly TramoEvent[];
  readonly possessions: readonly PossessionRecord[];
  readonly responsibilities: readonly ResponsibilityChange[];
  /** Trayectorias globales de los diez, para reconstruir cualquier instante. */
  readonly tracks: Readonly<Record<string, readonly TrajectoryPoint[]>>;
  readonly stop: TramoStop;
  readonly finalScore: Readonly<Record<string, number>>;
  readonly box: Readonly<Record<string, TramoTeamBox>>;
  /** Estado del azar al cerrar cada posesión (reproducibilidad por frontera). */
  readonly rngStateAtBoundaries: readonly { readonly atMs: Milliseconds; readonly state: number }[];
  readonly closedPossessions: number;
}
