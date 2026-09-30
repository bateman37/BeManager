/**
 * Foto basal reproducible de ME-07B v2 (encargo §1 y §7.3): recrea desde el
 * `GameInput` del fixture las tres fotos de las 20 auditorías ME-07A-AUDIT-1
 * aportadas por Dennis (los `.json.gz` originales no están en el repositorio
 * ni en esta sesión, así que no se afirma haberlos reanalizado):
 *
 * - `seed`: ambos equipos del fixture, semillas 91–96 y 98–102 (11 partidos).
 * - `sierra+3`: incremento masivo +3 (tope 15) a los 12 de Sierra Clara, Puerto
 *   en fixture, semillas 86–91 (6 partidos).
 * - `sierra+5`: incremento masivo +5 (tope 15) a los 12 de Sierra Clara,
 *   semillas 102–104 (3 partidos).
 *
 * Todos con ofensiva/cobertura/orden sin balón `auto`, prioridad de creación
 * `equilibrado` y rebote `proteger_balance`, igual que las 20 exportaciones.
 * Las fotos se agrupan por huella y **nunca se promedian entre sí**. La huella
 * se recalcula con `buildAuditExport` para compararla con la del informe
 * (`2d8067b0`, `da872180`, `b296cbac`).
 *
 * Uso: `npx tsx scripts/me07b-v2-baseline-20.ts [--json salida.json]`
 */
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { playFullGame } from "../modules/match/domain/game/play-full-game";
import { buildGameInput, type GameInput, type GameResult } from "../modules/match/domain/game/game-model";
import { buildAuditExport } from "../modules/match/domain/audit/build-audit-export";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../modules/match/domain/players/lab-roster-fixture";
import { ACTIVE_ATTRIBUTE_IDS, RATING_MAX, type Rating } from "../modules/match/domain/players/attribute";
import type { PlayerProfile } from "../modules/match/domain/players/player-profile";

type PhotoId = "seed" | "sierra+3" | "sierra+5";

const PHOTOS: readonly { id: PhotoId; seeds: readonly number[]; sierraIncrement: 0 | 3 | 5; reportFingerprint: string }[] = [
  { id: "seed", seeds: [91, 92, 93, 94, 95, 96, 98, 99, 100, 101, 102], sierraIncrement: 0, reportFingerprint: "2d8067b0" },
  { id: "sierra+3", seeds: [86, 87, 88, 89, 90, 91], sierraIncrement: 3, reportFingerprint: "da872180" },
  { id: "sierra+5", seeds: [102, 103, 104], sierraIncrement: 5, reportFingerprint: "b296cbac" },
];

/** Misma operación que `bulkIncrementLabAttributes` (ME-06 §4), sin persistencia. */
function increment(players: readonly PlayerProfile[], amount: number): { players: PlayerProfile[]; deltas: Record<number, number> } {
  const deltas: Record<number, number> = {};
  const out = players.map((p) => {
    const attributes = { ...p.attributes };
    for (const id of ACTIVE_ATTRIBUTE_IDS) {
      const current = attributes[id];
      const next = Math.min(RATING_MAX, current + amount) as Rating;
      const d = next - current;
      if (d > 0) deltas[d] = (deltas[d] ?? 0) + 1;
      attributes[id] = next;
    }
    return { ...p, attributes };
  });
  return { players: out, deltas };
}

function input(seed: number, sierraPlayers: readonly PlayerProfile[]): GameInput {
  const common = {
    priority: "proteger_balance" as const,
    coverage: "auto" as const,
    offBallDefensiveCall: "auto" as const,
    offensivePlan: "auto" as const,
    creationPriority: "equilibrado" as const,
  };
  return buildGameInput({
    seed,
    auditEnabled: true,
    home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: sierraPlayers, ...common },
    away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common },
  });
}

type Counter = Record<string, number>;
const inc = (c: Counter, k: string, n = 1) => {
  c[k] = (c[k] ?? 0) + n;
};

interface TeamAgg {
  points: number;
  possessions: number;
  phasesByEntry: Counter;
  fga2: number;
  fgm2: number;
  fga3: number;
  fgm3: number;
  fgaByShotType: Counter;
  fgaByShooter: Counter;
  fta: number;
  ftm: number;
  pf: number;
  oreb: number;
  dreb: number;
  orebAfterFgMiss: number;
  fgMissLive: number;
  orebAfterFtMiss: number;
  ftMissLive: number;
  tov: number;
  families: Counter;
  /** Coberturas elegidas cuando este equipo DEFIENDE. */
  coveragesAsDefense: Counter;
  coverageReasonsAsDefense: Counter;
  transitionChosen: Counter;
  organizeKept: number;
  organizeTotal: number;
  firstReadPnr: Counter;
  secondReadO5: Counter;
  possessionMsTotal: number;
}

function emptyTeam(): TeamAgg {
  return {
    points: 0, possessions: 0, phasesByEntry: {}, fga2: 0, fgm2: 0, fga3: 0, fgm3: 0,
    fgaByShotType: {}, fgaByShooter: {}, fta: 0, ftm: 0, pf: 0, oreb: 0, dreb: 0,
    orebAfterFgMiss: 0, fgMissLive: 0, orebAfterFtMiss: 0, ftMissLive: 0, tov: 0,
    families: {}, coveragesAsDefense: {}, coverageReasonsAsDefense: {}, transitionChosen: {},
    organizeKept: 0, organizeTotal: 0, firstReadPnr: {}, secondReadO5: {}, possessionMsTotal: 0,
  };
}

function accumulate(result: GameResult, agg: Record<string, TeamAgg>): void {
  const teamIds = Object.keys(result.box.teams);
  for (const t of teamIds) {
    agg[t] ??= emptyTeam();
    const box = result.box.teams[t]!;
    const a = agg[t]!;
    a.points += box.points;
    a.fga2 += box.fga2; a.fgm2 += box.fgm2; a.fga3 += box.fga3; a.fgm3 += box.fgm3;
    a.fta += box.fta; a.ftm += box.ftm; a.pf += box.pf; a.oreb += box.oreb; a.dreb += box.dreb;
    a.tov += box.tov + box.teamTurnovers;
  }
  const possTeam = new Map<number, string>();
  for (const p of result.possessions) {
    possTeam.set(p.index, p.teamId);
    const a = agg[p.teamId]!;
    a.possessions += 1;
    if (p.endMs !== null) a.possessionMsTotal += p.endMs - p.startMs;
    for (const ph of p.phases) inc(a.phasesByEntry, ph.entry);
  }
  // Rebote ofensivo según el fallo que lo precede (campo o último libre).
  let pending: { team: string; kind: "fg" | "ft" } | null = null;
  for (const e of result.events) {
    if (e.kind === "field_goal_attempt") {
      const a = agg[e.possessionTeamId]!;
      inc(a.fgaByShotType, String(e.detail.shotType));
      inc(a.fgaByShooter, e.actors[0] ?? "?");
      pending = e.detail.made === true ? null : { team: e.possessionTeamId, kind: "fg" };
    } else if (e.kind === "free_throws_result") {
      if (e.detail.index === e.detail.of) pending = e.detail.made === true ? null : { team: e.possessionTeamId, kind: "ft" };
    } else if (e.kind === "shooting_foul" || e.kind === "shot_blocked") {
      pending = null;
    } else if ((e.kind === "rebound_secured" || e.kind === "rebound_contested") && pending) {
      const a = agg[pending.team]!;
      const offensive = e.possessionTeamId === pending.team && teamOfActor(result, e.actors[0]) === pending.team;
      if (pending.kind === "fg") {
        a.fgMissLive += 1;
        if (offensive) a.orebAfterFgMiss += 1;
      } else {
        a.ftMissLive += 1;
        if (offensive) a.orebAfterFtMiss += 1;
      }
      pending = null;
    } else if (e.kind === "out_of_bounds" || e.kind === "period_ended") {
      pending = null;
    }
  }
  for (const d of result.audit?.decisions ?? []) {
    const team = d.possessionIndex !== null ? possTeam.get(d.possessionIndex) : undefined;
    if (!team) continue;
    const a = agg[team]!;
    const defense = teamIds.find((t) => t !== team)!;
    if (d.point === "seleccion_familia") inc(a.families, d.chosenOptionId ?? "sin_elegir");
    if (d.point === "seleccion_cobertura") {
      inc(agg[defense]!.coveragesAsDefense, d.chosenOptionId ?? "sin_elegir");
      for (const o of d.options) inc(agg[defense]!.coverageReasonsAsDefense, `${o.id}:${o.reasonCode}`);
    }
    if (d.point === "entrada_fase_transicion") inc(a.transitionChosen, d.chosenOptionId ?? "sin_elegir");
    if (d.point === "organizacion_creador") {
      a.organizeTotal += 1;
      if (d.options.some((o) => o.status === "elegida" && o.reasonCode === "creator_kept_by_real_holder")) a.organizeKept += 1;
    }
    if (d.point === "lectura_bloqueo_o1") inc(a.firstReadPnr, d.chosenOptionId ?? "sin_elegir");
    if (d.point === "lectura_segunda_o5") inc(a.secondReadO5, d.chosenOptionId ?? "sin_elegir");
  }
}

const actorTeamCache = new WeakMap<GameResult, Map<string, string>>();
function teamOfActor(result: GameResult, id: string | undefined): string | undefined {
  if (!id) return undefined;
  let m = actorTeamCache.get(result);
  if (!m) {
    m = new Map(Object.values(result.box.players).map((l) => [l.playerId, l.teamId]));
    actorTeamCache.set(result, m);
  }
  return m.get(id);
}

const jsonOut = process.argv.indexOf("--json");
const report: Record<string, unknown> = {};

for (const photo of PHOTOS) {
  const { players: sierra, deltas } = photo.sierraIncrement === 0
    ? { players: [...SIERRA_CLARA.players], deltas: {} }
    : increment(SIERRA_CLARA.players, photo.sierraIncrement);
  const agg: Record<string, TeamAgg> = {};
  const games: Record<string, unknown>[] = [];
  const fingerprints = new Set<string>();
  let totalMs = 0;
  let allFinal = true;
  let allReconciled = true;
  for (const seed of photo.seeds) {
    const gi = input(seed, sierra);
    const t0 = performance.now();
    const result = playFullGame(gi);
    const ms = performance.now() - t0;
    totalMs += ms;
    const exp = buildAuditExport(gi, result, { exportedAt: "baseline" });
    fingerprints.add(exp.run.matchFingerprint);
    const reconciled = exp.result.reconciliation.every((c) => c.ok);
    allReconciled &&= reconciled;
    allFinal &&= result.stop.cause === "final";
    accumulate(result, agg);
    const puerto = result.box.teams[PUERTO_AMBAR.id]!;
    games.push({
      seed,
      score: `${result.finalScore[SIERRA_CLARA.id]}–${result.finalScore[PUERTO_AMBAR.id]}`,
      stop: result.stop.cause,
      puerto2fga3fga: `${puerto.fga2}/${puerto.fga3}`,
      sierraOreb: result.box.teams[SIERRA_CLARA.id]!.oreb,
      ms: Math.round(ms),
    });
  }
  report[photo.id] = { seeds: photo.seeds, deltas, fingerprints: [...fingerprints], reportFingerprint: photo.reportFingerprint, allFinal, allReconciled, totalMs: Math.round(totalMs), games, teams: agg };

  console.log(`\n##### Foto ${photo.id} — ${photo.seeds.length} partidos, semillas ${photo.seeds.join(",")}`);
  console.log(`deltas efectivos Sierra: ${JSON.stringify(deltas)} · huella(s) ${[...fingerprints].join(",")} (informe ${photo.reportFingerprint})`);
  console.log(`stop=final en todos: ${allFinal} · actas conciliadas: ${allReconciled} · coste total ${Math.round(totalMs)} ms`);
  for (const g of games) console.log(`  ${JSON.stringify(g)}`);
  for (const [team, a] of Object.entries(agg)) {
    const fgMiss = a.fga2 + a.fga3 - a.fgm2 - a.fgm3;
    const topShooters = Object.entries(a.fgaByShooter).sort((x, y) => y[1] - x[1]).slice(0, 4);
    const totalFga = a.fga2 + a.fga3;
    console.log(`  [${team}] pts ${a.points} · poss ${a.possessions} · seg/poss ${(a.possessionMsTotal / 1000 / a.possessions).toFixed(1)}`);
    console.log(`    fases por entrada ${JSON.stringify(a.phasesByEntry)}`);
    console.log(`    2FGA ${a.fgm2}/${a.fga2} · 3FGA ${a.fgm3}/${a.fga3} · tipos ${JSON.stringify(a.fgaByShotType)}`);
    console.log(`    top tiradores ${topShooters.map(([id, n]) => `${id} ${n}/${totalFga}`).join(", ")}`);
    console.log(`    FT ${a.ftm}/${a.fta} · PF ${a.pf} · TOV ${a.tov}`);
    console.log(`    OREB ${a.oreb} (tras fallo de campo vivo ${a.orebAfterFgMiss}/${a.fgMissLive}; tras libre ${a.orebAfterFtMiss}/${a.ftMissLive}) · razón OREB/fallos campo ${a.oreb}/${fgMiss}`);
    console.log(`    familias ${JSON.stringify(a.families)} · coberturas como defensa ${JSON.stringify(a.coveragesAsDefense)}`);
    console.log(`    motivos cobertura ${JSON.stringify(a.coverageReasonsAsDefense)}`);
    console.log(`    transición ${JSON.stringify(a.transitionChosen)} · organiza conserva ${a.organizeKept}/${a.organizeTotal}`);
    console.log(`    1ª lectura PnR ${JSON.stringify(a.firstReadPnr)} · 2ª lectura O5 ${JSON.stringify(a.secondReadO5)}`);
  }
}

if (jsonOut > 0 && process.argv[jsonOut + 1]) {
  writeFileSync(process.argv[jsonOut + 1]!, JSON.stringify(report, null, 2));
  console.log(`\nJSON escrito en ${process.argv[jsonOut + 1]}`);
}
