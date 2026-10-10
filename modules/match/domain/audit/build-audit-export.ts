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
import type { AuditCoverageGap, AuditDecisionRecord, AuditFactLink } from "./audit-types";
import { LAB_ROSTER_FIXTURE } from "../players/lab-roster-fixture";
import type { PlayerProfile } from "../players/player-profile";

/**
 * ME-07A §5: nuevo esquema versionado. Amplía ME-06-AUDIT-1 con la
 * prioridad de creación y la tendencia de tiro por jugador, los puntos de
 * decisión de cobertura/orden sin balón `auto` y `byFamilyUnattributed`;
 * no reinterpreta ni reescribe un `.json` ya exportado con
 * `"ME-06-AUDIT-1"`.
 */
// ME-07B v2 §6: nuevo punto `disputa_rebote` (llegada bruta/efectiva y
// cierres con T19/F05 del cerrador). No reinterpreta `ME-07A-AUDIT-1`.
export const AUDIT_SCHEMA_VERSION = "ME-07B-AUDIT-1";

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
  /**
   * Huella estable del partido (ME-06 §5): deriva de la foto efectiva de
   * ambos equipos y de las versiones del contrato, **excluyendo** semilla,
   * `gameId`, `exportedAt` y `buildId` (campos volátiles o de estudio, no
   * de la foto). Dos exportaciones con la misma huella son comparables
   * aunque cambie la semilla o se recargue el navegador.
   */
  readonly matchFingerprint: string;
}

export interface AuditExportTeamPlayer {
  readonly id: string;
  readonly name: string;
  readonly attributes: Readonly<Record<string, number>>;
  readonly measures: Readonly<Record<string, number>>;
  readonly pnrTendency: string;
  /** ME-07A §2.2: tendencia individual de tiro (`prudente`/`equilibrada`/`decidida`). */
  readonly shotTendency: string;
  /**
   * Diferencias reales de atributos frente a `LAB_ROSTER_FIXTURE` (ME-06
   * §5), `delta = actual - fixture`, solo los atributos que difieren.
   * `null` cuando el ID no pertenece al fixture (jugador añadido a mano):
   * nunca se infiere una diferencia contra un origen que no existe.
   */
  readonly fixtureDiff: Readonly<Record<string, number>> | null;
}

export interface AuditExportTeam {
  readonly id: string;
  readonly name: string;
  readonly starters: readonly string[];
  readonly declaredRoles: Readonly<Record<string, readonly number[]>>;
  readonly priority: string;
  readonly coverage: string;
  /** ME-06 §3.2: plan ofensivo previo de este equipo para todo el partido. */
  readonly offensivePlan: string;
  /** ME-06 §3.1: orden de defensa sin balón de este equipo. */
  readonly offBallDefensiveCall: string;
  /** ME-07A §3.1: prioridad de creación de este equipo. */
  readonly creationPriority: string;
  /** ME-07B v2 §4 (LAB-0.7): colocación del bloqueo directo pedida (auto, central o lateral). */
  readonly screenPlacement: string;
  /** ME-07B v2 §4 (LAB-0.9): variante encadenada pedida al atacar y respuesta al bloqueo ciego al defender. */
  readonly chainedVariant: string;
  readonly backScreenCall: string;
  readonly roster: readonly AuditExportTeamPlayer[];
  /**
   * Huella estable de la foto efectiva de este equipo (ME-06 §5): deriva
   * de atributos, medidas, quinteto, roles, cobertura y órdenes de todo
   * el roster, no de campos volátiles. Se recalcula siempre desde la
   * foto completa: una etiqueta de lote (`+3`, etc.) nunca sustituye a
   * esta huella ni se infiere de atributos saturados en 15.
   */
  readonly fingerprint: string;
}

export interface AuditExportPossessionRejections {
  readonly point: string;
  readonly total: number;
  /**
   * Por qué código real se eligió el desenlace de este punto (ME-04B §4.3):
   * antes se perdía porque solo se contaban las opciones `descartada_por_
   * condicion`, dejando en `{}` un punto donde la única información real
   * estaba en la opción `elegida` (p. ej. «sin_ventaja», «no_evaluada»).
   */
  readonly chosenByReasonCode: Readonly<Record<string, number>>;
  /** Motivos de las alternativas realmente evaluadas y descartadas (no cortocircuitadas). */
  readonly alternativesByReasonCode: Readonly<Record<string, number>>;
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

export interface AuditExportFamilyTeamSummary {
  readonly teamId: string;
  /** `"bloqueo_directo"` | `"mano_a_mano_sin_balon"` (ME-06 §3). */
  readonly family: string;
  /** Veces que `seleccion_familia` eligió realmente esta familia para este equipo. */
  readonly entries: number;
  readonly fga2: number;
  readonly fgm2: number;
  readonly fga3: number;
  readonly fgm3: number;
}

/**
 * FGA de un equipo que no pertenecen a ninguna fase con `seleccion_familia`
 * registrada (transición/ventaja temprana, segunda oportunidad, segunda
 * entrada del bloqueo directo). ME-07A §5.1: por equipo,
 * `byFamily` (fga2+fga3) + `byFamilyUnattributed` (fga2+fga3) = FGA del acta
 * de ese equipo, separando dos y tres puntos — invariante verificado en
 * `phase-index-attribution.test.ts`.
 */
export interface AuditExportFamilyUnattributed {
  readonly teamId: string;
  readonly fga2: number;
  readonly fga3: number;
}

/**
 * ME-07B v2 §2.6: cada FGA enlazado a la acción efectiva anterior que lo
 * causó (misma posesión y fase, instante ≤ al del tiro), con su cadena:
 * familia elegida **antes** del tiro en esa fase (no la última de la fase),
 * decisión de lectura/entrada causante, tirador real, posición e instante.
 * Transición y segunda oportunidad son categorías propias, sin familia
 * ficticia.
 */
export interface AuditExportShotAttribution {
  readonly atMs: number;
  readonly possessionIndex: number;
  readonly phaseIndex: number;
  readonly teamId: string;
  readonly shooterId: string;
  readonly shotType: string;
  readonly made: boolean;
  readonly shooterPosition: { readonly x: number; readonly y: number } | null;
  readonly category: "familia" | "transicion" | "segunda_oportunidad" | "otra_fase";
  readonly family: string | null;
  readonly familyDecisionId: number | null;
  /** ME-07B v2 §3: ficha de libro en vigor en esa fase (`seleccion_familia` → `cardId`), p. ej. `horns_bloqueo`. */
  readonly cardId: string | null;
  readonly causingDecision: {
    readonly id: number;
    readonly point: string;
    readonly chosenOptionId: string | null;
    readonly atMs: number;
    readonly factLink: AuditFactLink | null;
  } | null;
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
    /**
     * Entradas y tiros por familia ofensiva y equipo (ME-06 §5), a partir
     * de hechos reales: solo cubre entradas de ataque organizado con
     * `seleccion_familia` registrada (con auditoría activada). Los FGA de
     * transición/segunda oportunidad/segunda entrada no se atribuyen a
     * ninguna familia aquí; su hueco se declara en `coverageGaps`.
     */
    readonly byFamily: readonly AuditExportFamilyTeamSummary[] | null;
    /** Ver `AuditExportFamilyUnattributed`. `null` sin auditoría activada. */
    readonly byFamilyUnattributed: readonly AuditExportFamilyUnattributed[] | null;
    /** ME-07B v2 §2.6: atribución causal tiro a tiro. `null` sin auditoría. */
    readonly shots: readonly AuditExportShotAttribution[] | null;
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
    const chosenByReasonCode: Record<string, number> = {};
    const alternativesByReasonCode: Record<string, number> = {};
    for (const d of records) {
      for (const o of d.options) {
        if (o.status === "elegida") {
          chosenByReasonCode[o.reasonCode] = (chosenByReasonCode[o.reasonCode] ?? 0) + 1;
        } else if (o.status === "descartada_por_condicion") {
          alternativesByReasonCode[o.reasonCode] = (alternativesByReasonCode[o.reasonCode] ?? 0) + 1;
        }
      }
    }
    return { point, total: records.length, chosenByReasonCode, alternativesByReasonCode };
  });
}

/** Hash estable no criptográfico (FNV-1a de 32 bits), suficiente para comparar fotos, no para seguridad. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** `JSON.stringify` con claves de objeto ordenadas: el mismo contenido siempre produce el mismo texto, con independencia del orden real de construcción. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function findFixturePlayer(playerId: string): PlayerProfile | null {
  for (const team of LAB_ROSTER_FIXTURE) {
    const player = team.players.find((p) => p.id === playerId);
    if (player) return player;
  }
  return null;
}

function attributeFixtureDiff(actual: PlayerProfile): Readonly<Record<string, number>> | null {
  const fixture = findFixturePlayer(actual.id);
  if (!fixture) return null;
  const diffs: Record<string, number> = {};
  for (const key of Object.keys(actual.attributes)) {
    const a = (actual.attributes as unknown as Record<string, number>)[key]!;
    const f = (fixture.attributes as unknown as Record<string, number>)[key];
    if (f !== undefined && a !== f) diffs[key] = a - f;
  }
  return diffs;
}

/** Huella de la foto efectiva de un equipo (ME-06 §5): sin campos volátiles. */
function teamFingerprint(team: GameInput["teams"][number]): string {
  return fnv1a(
    stableStringify({
      priority: team.priority,
      coverage: team.coverage,
      offensivePlan: team.offensivePlan,
      offBallDefensiveCall: team.offBallDefensiveCall,
      creationPriority: team.creationPriority,
      screenPlacement: team.screenPlacement ?? "auto",
      chainedVariant: team.chainedVariant ?? "auto",
      backScreenCall: team.backScreenCall ?? "auto",
      starters: [...team.starters].sort(),
      declaredRoles: team.declaredRoles,
      roster: team.roster
        .map((p) => ({
          id: p.id,
          name: p.name,
          age: p.age,
          template: p.template,
          pnrTendency: p.pnrTendency,
          shotTendency: p.shotTendency,
          attributes: p.attributes,
          measures: p.measures,
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    }),
  );
}

function playerTeamId(input: GameInput, playerId: string): string | null {
  for (const t of input.teams) if (t.roster.some((p) => p.id === playerId)) return t.id;
  return null;
}

/**
 * Entradas y tiros por familia ofensiva y equipo (ME-06 §5): agrupa
 * `seleccion_familia` por (posesión, fase) para saber qué familia se jugó
 * en cada ataque organizado, y atribuye los `field_goal_attempt` reales
 * de la misma (posesión, fase) a esa familia — nunca un tiro dos veces
 * (una sola fase por decisión) ni una magnitud inventada. Los FGA de
 * fases sin `seleccion_familia` (transición, segunda oportunidad, segunda
 * entrada) quedan fuera; se cuentan aparte como hueco de cobertura.
 */
/** Decisiones de acción que pueden originar un tiro (lectura/entrada), por orden de prioridad causal. */
const SHOT_CAUSING_POINTS: ReadonlySet<string> = new Set([
  "lectura_bloqueo_o1",
  "lectura_segunda_o5",
  "lectura_trampa",
  // ME-07B v2 §5: lecturas del manejador ante cambio, show, «a la altura» e ICE
  // (antes faltaban: el tiro tras esas lecturas quedaba sin acción causante).
  "lectura_cambio",
  "lectura_show",
  "lectura_a_la_altura",
  "lectura_ice",
  // ME-07B v2 §4 (LAB-0.9): lectura del manejador en Horns→Spain.
  "lectura_spain",
  // ME-07B v2 §4 (LAB-0.10): lecturas de Delay (manejador tras la entrega, pívot que se la queda, poste).
  "lectura_delay",
  "lectura_delay_pivote",
  "lectura_poste",
  "segunda_entrada",
  "lectura_mano_a_mano",
  "entrada_fase_transicion",
  "lectura_transicion",
]);

/**
 * ME-07B v2 §2.6: atribución tiro a tiro. Para cada `field_goal_attempt`,
 * la familia es la última `seleccion_familia` de su misma (posesión, fase)
 * **anterior o simultánea** al tiro, y la acción causante es la última
 * decisión de lectura/entrada de esa misma fase anterior al tiro. Una fase
 * sin familia se clasifica por su entrada real (transición o segunda
 * oportunidad), nunca con una familia ficticia.
 */
export function attributeShots(result: GameResult, decisions: readonly AuditDecisionRecord[]): AuditExportShotAttribution[] {
  const byPhase = new Map<string, AuditDecisionRecord[]>();
  for (const d of decisions) {
    if (d.possessionIndex === null || d.phaseIndex === null) continue;
    if (d.point !== "seleccion_familia" && !SHOT_CAUSING_POINTS.has(d.point)) continue;
    const key = `${d.possessionIndex}:${d.phaseIndex}`;
    const list = byPhase.get(key) ?? [];
    list.push(d);
    byPhase.set(key, list);
  }
  const phaseEntry = new Map<string, string>();
  for (const p of result.possessions) for (const ph of p.phases) phaseEntry.set(`${p.index}:${ph.index}`, ph.entry);

  const out: AuditExportShotAttribution[] = [];
  for (const ev of result.events) {
    if (ev.kind !== "field_goal_attempt") continue;
    const key = `${ev.possessionIndex}:${ev.phaseIndex}`;
    const before = (byPhase.get(key) ?? []).filter((d) => d.atMs <= ev.atMs);
    let familyDecision: AuditDecisionRecord | null = null;
    let causing: AuditDecisionRecord | null = null;
    for (const d of before) {
      if (d.point === "seleccion_familia") {
        if (!familyDecision || d.atMs >= familyDecision.atMs) familyDecision = d;
      } else if (!causing || d.atMs > causing.atMs || (d.atMs === causing.atMs && d.id > causing.id)) {
        causing = d;
      }
    }
    const entry = phaseEntry.get(key);
    const shooterId = ev.actors[0] ?? "";
    const pos = ev.positions.find((p) => p.playerId === shooterId)?.position ?? null;
    out.push({
      atMs: ev.atMs,
      possessionIndex: ev.possessionIndex,
      phaseIndex: ev.phaseIndex,
      teamId: ev.possessionTeamId,
      shooterId,
      shotType: String(ev.detail.shotType),
      made: ev.detail.made === true,
      shooterPosition: pos ? { x: pos.x, y: pos.y } : null,
      category: familyDecision
        ? "familia"
        : entry === "ventaja_temprana"
          ? "transicion"
          : entry === "segunda_oportunidad"
            ? "segunda_oportunidad"
            : "otra_fase",
      family: familyDecision?.chosenOptionId ?? null,
      familyDecisionId: familyDecision?.id ?? null,
      cardId: (familyDecision?.options.find((o) => o.id === familyDecision!.chosenOptionId)?.values?.cardId as string | undefined) ?? null,
      causingDecision: causing
        ? { id: causing.id, point: causing.point, chosenOptionId: causing.chosenOptionId, atMs: causing.atMs, factLink: causing.factLink }
        : null,
    });
  }
  return out;
}

/**
 * Entradas y tiros por familia ofensiva y equipo (ME-06 §5; ME-07B v2 §2.6):
 * las entradas cuentan cada `seleccion_familia`; los tiros salen de la
 * atribución causal tiro a tiro (`attributeShots`), así que un tiro se
 * atribuye a la familia elegida antes que él en su fase, no a la última
 * familia registrada en esa fase.
 */
function buildFamilySummary(
  input: GameInput,
  decisions: readonly AuditDecisionRecord[],
  shotsAttributed: readonly AuditExportShotAttribution[],
): {
  readonly rows: AuditExportFamilyTeamSummary[];
  readonly unattributed: AuditExportFamilyUnattributed[];
  readonly unattributedFga: number;
  readonly unattributedPossessions: number;
} {
  const entries = new Map<string, number>();
  for (const d of decisions) {
    if (d.point !== "seleccion_familia" || d.possessionIndex === null || d.phaseIndex === null) continue;
    if (!d.chosenOptionId) continue;
    const teamId = d.holderId ? playerTeamId(input, d.holderId) : null;
    if (!teamId) continue;
    const entryKey = `${teamId}|${d.chosenOptionId}`;
    entries.set(entryKey, (entries.get(entryKey) ?? 0) + 1);
  }

  const shots = new Map<string, { fga2: number; fgm2: number; fga3: number; fgm3: number }>();
  const unattributedByTeam = new Map<string, { fga2: number; fga3: number }>();
  let unattributedFga = 0;
  const unattributedPossessions = new Set<number>();
  for (const shot of shotsAttributed) {
    const three = shot.shotType === "three_point";
    if (!shot.family) {
      unattributedFga += 1;
      unattributedPossessions.add(shot.possessionIndex);
      // El equipo real que intentó el tiro es siempre el que tenía el
      // control en esa posesión (`possessionTeamId`, ME-07A §5.1).
      const line = unattributedByTeam.get(shot.teamId) ?? { fga2: 0, fga3: 0 };
      if (three) line.fga3 += 1;
      else line.fga2 += 1;
      unattributedByTeam.set(shot.teamId, line);
      continue;
    }
    const shotKey = `${shot.teamId}|${shot.family}`;
    const line = shots.get(shotKey) ?? { fga2: 0, fgm2: 0, fga3: 0, fgm3: 0 };
    if (three) {
      line.fga3 += 1;
      if (shot.made) line.fgm3 += 1;
    } else {
      line.fga2 += 1;
      if (shot.made) line.fgm2 += 1;
    }
    shots.set(shotKey, line);
  }
  const unattributed = [...unattributedByTeam.entries()].map(([teamId, line]): AuditExportFamilyUnattributed => ({ teamId, ...line }));

  const keys = new Set<string>([...entries.keys(), ...shots.keys()]);
  const rows = [...keys].map((key): AuditExportFamilyTeamSummary => {
    const [teamId, family] = key.split("|") as [string, string];
    const line = shots.get(key) ?? { fga2: 0, fgm2: 0, fga3: 0, fgm3: 0 };
    return { teamId, family, entries: entries.get(key) ?? 0, ...line };
  });
  return { rows, unattributed, unattributedFga, unattributedPossessions: unattributedPossessions.size };
}

function exportTeam(team: GameInput["teams"][number]): AuditExportTeam {
  return {
    id: team.id,
    name: team.name,
    starters: team.starters,
    declaredRoles: team.declaredRoles,
    priority: team.priority,
    coverage: team.coverage,
    offensivePlan: team.offensivePlan,
    offBallDefensiveCall: team.offBallDefensiveCall,
    creationPriority: team.creationPriority,
    screenPlacement: team.screenPlacement ?? "auto",
    chainedVariant: team.chainedVariant ?? "auto",
    backScreenCall: team.backScreenCall ?? "auto",
    roster: team.roster.map((p) => ({
      id: p.id,
      name: p.name,
      attributes: { ...p.attributes } as unknown as Record<string, number>,
      measures: { ...p.measures } as unknown as Record<string, number>,
      pnrTendency: p.pnrTendency,
      shotTendency: p.shotTendency,
      fixtureDiff: attributeFixtureDiff(p),
    })),
    fingerprint: teamFingerprint(team),
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
  const shotAttribution = auditEnabled ? attributeShots(result, decisions) : null;
  const family = shotAttribution ? buildFamilySummary(input, decisions, shotAttribution) : null;
  const coverageGaps = [
    ...(result.audit?.coverageGaps ?? []),
    ...(family && family.unattributedFga > 0
      ? [
          {
            point: "seleccion_familia",
            reason:
              "Los FGA de fases sin `seleccion_familia` registrada (transición/ventaja temprana, segunda oportunidad, segunda entrada del bloqueo directo) no se atribuyen a ninguna familia en result.summary.byFamily.",
            possessionsAffected: family.unattributedPossessions,
          },
        ]
      : []),
  ];
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
      matchFingerprint: fnv1a(
        stableStringify({
          rulesetVersion: input.rulesetVersion,
          labParametersVersion: input.labParametersVersion,
          gameVersion: input.gameVersion,
          teams: input.teams.map((t) => teamFingerprint(t)).sort(),
        }),
      ),
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
        byFamily: family?.rows ?? null,
        byFamilyUnattributed: family?.unattributed ?? null,
        shots: shotAttribution,
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
