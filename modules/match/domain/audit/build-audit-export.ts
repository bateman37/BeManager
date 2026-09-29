/**
 * Exportador puro de la auditoría de un partido (ME-04A §2, §5): una sola
 * función de dominio que ensambla el `.json` versionado **a partir del
 * resultado y del registro ya calculados** (`GameInput` + `GameResult`), sin
 * recalcular decisiones con el acta ni volver a jugar el partido. Se puede
 * probar sin navegador (`build-audit-export.test.ts`).
 */
import type { GameInput, GameResult } from "../game/game-model";
import type { PhaseEntry } from "../sequence/tramo-model";
import { reconcileBoxScore, type ReconciliationCheck } from "../game/box-score";
import type { AuditCoverageGap, AuditDecisionRecord } from "./audit-types";

export const AUDIT_SCHEMA_VERSION = "ME-04A-AUDIT-1";

export interface AuditExportRun {
  readonly schemaVersion: typeof AUDIT_SCHEMA_VERSION;
  readonly gameId: string;
  readonly seed: number;
  readonly stopCause: GameResult["stop"]["cause"];
  readonly gameVersion: string;
  readonly rulesetVersion: string;
  readonly labParametersVersion: string;
  readonly jumpBallVersion: string;
  readonly substitutionPolicyVersion: string;
  /** Solo si el entorno lo expone (`process.env`), nunca inventado. */
  readonly buildId: string | null;
  /** Fecha de exportación (navegador), separada del cálculo determinista del partido. */
  readonly exportedAt: string;
  readonly auditEnabled: boolean;
}

export interface AuditExportTeamPlayer {
  readonly id: string;
  readonly name: string;
  readonly attributes: Readonly<Record<string, number>>;
  readonly measures: Readonly<Record<string, number>>;
  readonly pnrTendency: string;
}

export interface AuditExportTeam {
  readonly id: string;
  readonly name: string;
  readonly starters: readonly string[];
  readonly declaredRoles: Readonly<Record<string, readonly number[]>>;
  readonly priority: string;
  readonly coverage: string;
  readonly roster: readonly AuditExportTeamPlayer[];
}

export interface AuditExportPossessionRejections {
  readonly point: string;
  readonly total: number;
  readonly byReasonCode: Readonly<Record<string, number>>;
}

export interface AuditExportTeamSummary {
  readonly teamId: string;
  readonly possessions: number;
  readonly pointsByPeriod: readonly number[];
  readonly entryCounts: Readonly<Record<PhaseEntry, number>>;
  readonly loadAssignments: number;
  readonly balanceAssignments: number;
  readonly fga2: number;
  readonly fgm2: number;
  readonly fga3: number;
  readonly fgm3: number;
  readonly fta: number;
  readonly ftm: number;
  readonly points: number;
  readonly oreb: number;
  readonly dreb: number;
  readonly ast: number;
  readonly tov: number;
  readonly pf: number;
  readonly possessionDurationMedianMs: number | null;
  readonly possessionDurationRangeMs: readonly [number, number] | null;
}

export interface AuditExportPlayerSummary {
  readonly playerId: string;
  readonly teamId: string;
  readonly minutesMs: number;
  readonly fga2: number;
  readonly fgm2: number;
  readonly fga3: number;
  readonly fgm3: number;
  readonly fta: number;
  readonly ftm: number;
  readonly points: number;
  readonly oreb: number;
  readonly dreb: number;
  readonly ast: number;
  readonly tov: number;
  readonly stl: number;
  readonly blk: number;
  readonly pf: number;
  readonly pfd: number;
  readonly dnp: boolean;
}

export interface AuditExportResult {
  readonly finalScore: Readonly<Record<string, number>>;
  readonly winnerTeamId: string | null;
  readonly stop: GameResult["stop"];
  readonly periods: GameResult["periods"];
  readonly box: GameResult["box"];
  readonly reconciliation: readonly ReconciliationCheck[];
  readonly effectivePlayedMs: number;
  readonly summary: {
    readonly byTeam: readonly AuditExportTeamSummary[];
    readonly byPlayer: readonly AuditExportPlayerSummary[];
    /** Motivos de rechazo de las tres ramas hoy ausentes (§4): solo con auditoría activada. */
    readonly rejectionReasons: readonly AuditExportPossessionRejections[] | null;
  };
}

export interface AuditExportV1 {
  readonly schemaVersion: typeof AUDIT_SCHEMA_VERSION;
  readonly run: AuditExportRun;
  readonly input: {
    readonly teams: readonly [AuditExportTeam, AuditExportTeam];
  };
  readonly timeline: GameResult["events"];
  readonly decisions: {
    readonly available: boolean;
    readonly records: readonly AuditDecisionRecord[];
    readonly coverageGaps: readonly AuditCoverageGap[];
  };
  readonly continuity: {
    readonly possessions: GameResult["possessions"];
    readonly responsibilities: GameResult["responsibilities"];
    readonly substitutions: GameResult["substitutions"];
    readonly fouls: GameResult["fouls"];
    readonly rngStateAtBoundaries: GameResult["rngStateAtBoundaries"];
  };
  readonly result: AuditExportResult;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function buildTeamSummary(
  input: GameInput,
  result: GameResult,
  teamId: string,
): AuditExportTeamSummary {
  const teamPossessions = result.possessions.filter((p) => p.teamId === teamId);
  const entryCounts: Record<PhaseEntry, number> = {
    ataque_organizado: 0,
    ventaja_temprana: 0,
    segunda_oportunidad: 0,
    segunda_entrada: 0,
    pendiente: 0,
  };
  for (const p of teamPossessions) for (const ph of p.phases) entryCounts[ph.entry] += 1;
  const durations = teamPossessions
    .filter((p) => p.endMs !== null)
    .map((p) => p.endMs! - p.startMs);
  const t = result.box.teams[teamId]!;
  const playerIds = new Set(input.teams.find((tm) => tm.id === teamId)!.roster.map((p) => p.id));
  const loadAssignments = result.responsibilities.filter((r) => r.responsibility === "cargar_rebote" && playerIds.has(r.playerId)).length;
  const balanceAssignments = result.responsibilities.filter((r) => r.responsibility === "proteger_balance" && playerIds.has(r.playerId)).length;
  return {
    teamId,
    possessions: teamPossessions.length,
    pointsByPeriod: result.periods.map((p) => p.points[teamId] ?? 0),
    entryCounts,
    loadAssignments,
    balanceAssignments,
    fga2: t.fga2,
    fgm2: t.fgm2,
    fga3: t.fga3,
    fgm3: t.fgm3,
    fta: t.fta,
    ftm: t.ftm,
    points: t.points,
    oreb: t.oreb,
    dreb: t.dreb,
    ast: t.ast,
    tov: t.tov,
    pf: t.pf,
    possessionDurationMedianMs: median(durations),
    possessionDurationRangeMs: durations.length > 0 ? [Math.min(...durations), Math.max(...durations)] : null,
  };
}

/** Ramas hoy ausentes con el fixture (§4): agrupa las decisiones ya trazadas por motivo. */
const REJECTION_TRACKED_POINTS: readonly string[] = ["entrada_fase_transicion", "segunda_entrada", "puerta_falta_sin_tiro"];

function buildRejectionReasons(decisions: readonly AuditDecisionRecord[]): AuditExportPossessionRejections[] {
  return REJECTION_TRACKED_POINTS.map((point) => {
    const records = decisions.filter((d) => d.point === point);
    const byReasonCode: Record<string, number> = {};
    for (const d of records) {
      for (const o of d.options) {
        if (o.status !== "descartada_por_condicion") continue;
        byReasonCode[o.reasonCode] = (byReasonCode[o.reasonCode] ?? 0) + 1;
      }
    }
    return { point, total: records.length, byReasonCode };
  });
}

function exportTeam(team: GameInput["teams"][number]): AuditExportTeam {
  return {
    id: team.id,
    name: team.name,
    starters: team.starters,
    declaredRoles: team.declaredRoles,
    priority: team.priority,
    coverage: team.coverage,
    roster: team.roster.map((p) => ({
      id: p.id,
      name: p.name,
      attributes: { ...p.attributes } as unknown as Record<string, number>,
      measures: { ...p.measures } as unknown as Record<string, number>,
      pnrTendency: p.pnrTendency,
    })),
  };
}

/** Identificador de build/commit, solo si el entorno lo expone; nunca inventado (§2). */
function readBuildId(): string | null {
  const env = typeof process !== "undefined" ? process.env : undefined;
  return env?.NEXT_PUBLIC_BUILD_ID ?? env?.VERCEL_GIT_COMMIT_SHA ?? env?.GIT_COMMIT_SHA ?? null;
}

/**
 * Ensambla el archivo de auditoría de un partido ya jugado. Pura: mismos
 * `input`/`result` producen el mismo objeto (salvo `run.exportedAt`, que es
 * la fecha real de exportación, no parte del cálculo determinista).
 */
export function buildAuditExport(
  input: GameInput,
  result: GameResult,
  options: { readonly exportedAt?: string } = {},
): AuditExportV1 {
  const auditEnabled = input.auditEnabled === true;
  const decisions = result.audit?.decisions ?? [];
  const coverageGaps = result.audit?.coverageGaps ?? [];
  const teamIds = input.teams.map((t) => t.id);
  const reconciliation = reconcileBoxScore({
    box: result.box,
    finalScore: result.finalScore,
    effectivePlayedMs: result.effectivePlayedMs,
    engineMinutesMs: result.engineMinutesMs,
    teamIds,
  });
  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    run: {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      gameId: result.gameId,
      seed: input.seed,
      stopCause: result.stop.cause,
      gameVersion: input.gameVersion,
      rulesetVersion: input.rulesetVersion,
      labParametersVersion: input.labParametersVersion,
      jumpBallVersion: input.jumpBallVersion,
      substitutionPolicyVersion: input.substitutionPolicyVersion,
      buildId: readBuildId(),
      exportedAt: options.exportedAt ?? new Date().toISOString(),
      auditEnabled,
    },
    input: {
      teams: [exportTeam(input.teams[0]), exportTeam(input.teams[1])],
    },
    timeline: result.events,
    decisions: {
      available: auditEnabled,
      records: decisions,
      coverageGaps,
    },
    continuity: {
      possessions: result.possessions,
      responsibilities: result.responsibilities,
      substitutions: result.substitutions,
      fouls: result.fouls,
      rngStateAtBoundaries: result.rngStateAtBoundaries,
    },
    result: {
      finalScore: result.finalScore,
      winnerTeamId: result.winnerTeamId,
      stop: result.stop,
      periods: result.periods,
      box: result.box,
      reconciliation,
      effectivePlayedMs: result.effectivePlayedMs,
      summary: {
        byTeam: teamIds.map((teamId) => buildTeamSummary(input, result, teamId)),
        byPlayer: Object.values(result.box.players).map((line): AuditExportPlayerSummary => ({
          playerId: line.playerId,
          teamId: line.teamId,
          minutesMs: line.minutesMs,
          fga2: line.fga2,
          fgm2: line.fgm2,
          fga3: line.fga3,
          fgm3: line.fgm3,
          fta: line.fta,
          ftm: line.ftm,
          points: line.points,
          oreb: line.oreb,
          dreb: line.dreb,
          ast: line.ast,
          tov: line.tov,
          stl: line.stl,
          blk: line.blk,
          pf: line.pf,
          pfd: line.pfd,
          dnp: line.dnp,
        })),
        rejectionReasons: auditEnabled ? buildRejectionReasons(decisions) : null,
      },
    },
  };
}
