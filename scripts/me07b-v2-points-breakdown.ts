/**
 * Descomposición de los puntos de la foto de las 20 (ME-07B v2 §2.5/§7.3) a
 * partir de hechos y decisiones auditadas, para explicar con denominadores
 * por qué cambia el total entre dos versiones del motor. No calibra nada:
 * solo cuenta.
 *
 * Por equipo atacante y foto:
 * - posesiones, segundos por posesión, motivo de fin de posesión;
 * - fases por tipo de entrada con puntos, 2FGA/3FGA, FTA y pérdidas;
 * - en cada fase organizada con cobertura auditada: cobertura que enfrenta
 *   (`seleccion_cobertura`), colocación (`colocacion_bloqueo`) y primera
 *   lectura del manejador, con los puntos y tiros **de esa fase**;
 * - FGA por tipo de tiro con aciertos.
 *
 * Uso (también en un árbol de trabajo de un commit anterior):
 *   npx tsx scripts/me07b-v2-points-breakdown.ts [--photo seed|sierra+3|sierra+5|all] [--regulation] [--json salida.json]
 */
import { writeFileSync } from "node:fs";
import { playFullGame } from "../modules/match/domain/game/play-full-game";
import { buildGameInput, type GameInput, type GameResult } from "../modules/match/domain/game/game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../modules/match/domain/players/lab-roster-fixture";
import { ACTIVE_ATTRIBUTE_IDS, RATING_MAX, type Rating } from "../modules/match/domain/players/attribute";
import type { PlayerProfile } from "../modules/match/domain/players/player-profile";

const PHOTOS = [
  { id: "seed", seeds: [91, 92, 93, 94, 95, 96, 98, 99, 100, 101, 102], inc: 0 },
  { id: "sierra+3", seeds: [86, 87, 88, 89, 90, 91], inc: 3 },
  { id: "sierra+5", seeds: [102, 103, 104], inc: 5 },
] as const;

function increment(players: readonly PlayerProfile[], amount: number): PlayerProfile[] {
  return players.map((p) => {
    const attributes = { ...p.attributes };
    for (const id of ACTIVE_ATTRIBUTE_IDS) attributes[id] = Math.min(RATING_MAX, attributes[id] + amount) as Rating;
    return { ...p, attributes };
  });
}

function input(seed: number, sierra: readonly PlayerProfile[]): GameInput {
  const common = { priority: "proteger_balance" as const, coverage: "auto" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const };
  return buildGameInput({
    seed,
    auditEnabled: true,
    home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: sierra, ...common },
    away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common },
  });
}

interface Bucket {
  phases: number;
  pts: number;
  fga2: number;
  fgm2: number;
  fga3: number;
  fgm3: number;
  fta: number;
  ftm: number;
  tov: number;
  /** Tapones sufridos (fallo que la probabilidad de `resolucion_tiro` no incluye). */
  blk: number;
}
const emptyBucket = (): Bucket => ({ phases: 0, pts: 0, fga2: 0, fgm2: 0, fga3: 0, fgm3: 0, fta: 0, ftm: 0, tov: 0, blk: 0 });
const add = (a: Bucket, b: Bucket) => {
  for (const k of Object.keys(a) as (keyof Bucket)[]) a[k] += b[k];
};

interface TeamAgg {
  possessions: number;
  possessionMs: number;
  endReasons: Record<string, number>;
  byEntry: Record<string, Bucket>;
  byCoverage: Record<string, Bucket>;
  byPlacement: Record<string, Bucket>;
  byFirstRead: Record<string, Bucket>;
  shotTypes: Record<string, { fga: number; fgm: number }>;
  /**
   * Calidad del tiro según la regla que lo resolvió (`resolucion_tiro`):
   * tiros, suma de la probabilidad usada (aciertos esperados) y oposición
   * geométrica (0 / 0,5 / 1), por clase (2 ó 3) y cobertura enfrentada.
   */
  quality: Record<string, { shots: number; expectedMakes: number; opp0: number; opp05: number; opp1: number }>;
  total: Bucket;
}
const emptyTeam = (): TeamAgg => ({ possessions: 0, possessionMs: 0, endReasons: {}, byEntry: {}, byCoverage: {}, byPlacement: {}, byFirstRead: {}, shotTypes: {}, quality: {}, total: emptyBucket() });

const TOV_KINDS = new Set(["turnover", "shot_clock_violation", "backcourt_violation", "throw_in_violation"]);
const FIRST_READS = new Set(["lectura_bloqueo_o1", "lectura_trampa", "lectura_cambio", "lectura_show", "lectura_a_la_altura", "lectura_ice"]);

/** `--regulation`: solo posesiones que empiezan en los cuatro cuartos (separa el efecto de las prórrogas). */
const REGULATION_ONLY = process.argv.includes("--regulation");

function accumulate(result: GameResult, agg: Record<string, TeamAgg>): void {
  const phaseBuckets = new Map<string, { team: string; entry: string; b: Bucket }>();
  const periodOfPossession = new Map<number, number>();
  for (const e of result.events) if (!periodOfPossession.has(e.possessionIndex)) periodOfPossession.set(e.possessionIndex, e.period);
  for (const p of result.possessions) {
    if (REGULATION_ONLY && (periodOfPossession.get(p.index) ?? 1) > 4) continue;
    const a = (agg[p.teamId] ??= emptyTeam());
    a.possessions += 1;
    if (p.endMs !== null) a.possessionMs += p.endMs - p.startMs;
    a.endReasons[p.endReason ?? "abierta"] = (a.endReasons[p.endReason ?? "abierta"] ?? 0) + 1;
    for (const ph of p.phases) phaseBuckets.set(`${p.index}:${ph.index}`, { team: p.teamId, entry: ph.entry, b: { ...emptyBucket(), phases: 1 } });
  }
  for (const e of result.events) {
    const ph = phaseBuckets.get(`${e.possessionIndex}:${e.phaseIndex}`);
    if (!ph) continue;
    const b = ph.b;
    if (e.kind === "field_goal_attempt") {
      const three = e.detail.shotType === "three_point";
      const made = e.detail.made === true;
      if (three) {
        b.fga3++;
        if (made) { b.fgm3++; b.pts += 3; }
      } else {
        b.fga2++;
        if (made) { b.fgm2++; b.pts += 2; }
      }
      const st = (agg[ph.team]!.shotTypes[String(e.detail.shotType)] ??= { fga: 0, fgm: 0 });
      st.fga++;
      if (made) st.fgm++;
    } else if (e.kind === "free_throws_result") {
      b.fta++;
      if (e.detail.made === true) { b.ftm++; b.pts += 1; }
    } else if (TOV_KINDS.has(e.kind)) {
      b.tov++;
    } else if (e.kind === "shot_blocked") {
      b.blk++;
    }
  }
  const coverage = new Map<string, string>();
  const placement = new Map<string, string>();
  const firstRead = new Map<string, string>();
  for (const d of result.audit?.decisions ?? []) {
    const key = `${d.possessionIndex}:${d.phaseIndex}`;
    if (d.point === "seleccion_cobertura" && !coverage.has(key)) coverage.set(key, d.chosenOptionId ?? "?");
    if (d.point === "colocacion_bloqueo" && !placement.has(key)) placement.set(key, d.chosenOptionId ?? "?");
    if (FIRST_READS.has(d.point) && !firstRead.has(key)) firstRead.set(key, `${d.point.replace("lectura_", "")}:${d.chosenOptionId ?? "?"}`);
  }
  const preparedText = new Map<string, string>();
  for (const e of result.events) if (e.kind === "shot_prepared") preparedText.set(`${e.possessionIndex}:${e.phaseIndex}:${e.atMs}:${e.actors[0]}`, e.text);
  for (const d of result.audit?.decisions ?? []) {
    if (d.point !== "resolucion_tiro") continue;
    const key = `${d.possessionIndex}:${d.phaseIndex}`;
    const ph = phaseBuckets.get(key);
    if (!ph) continue;
    const text = preparedText.get(`${key}:${d.factLink?.atMs ?? d.atMs}:${d.holderId}`) ?? "";
    const cls = text.includes("de tres") ? "3" : "2";
    const p = Number(/Probabilidad de conversión usada: ([0-9]+\.[0-9]+)/.exec(d.note ?? "")?.[1] ?? NaN);
    const opp = /oposición geométrica=([0-9.]+)/.exec(d.note ?? "")?.[1] ?? "?";
    const where = ph.entry === "ataque_organizado" ? (coverage.get(key) ?? "sin_cobertura") : ph.entry;
    for (const k of [`${cls}P:todas`, `${cls}P:${where}`, `${cls}P:${where}:${d.holderId}`]) {
      const q = (agg[ph.team]!.quality[k] ??= { shots: 0, expectedMakes: 0, opp0: 0, opp05: 0, opp1: 0 });
      q.shots++;
      if (Number.isFinite(p)) q.expectedMakes += p;
      if (opp === "0") q.opp0++;
      else if (opp === "0.5") q.opp05++;
      else if (opp === "1") q.opp1++;
    }
  }
  for (const [key, ph] of phaseBuckets) {
    const a = agg[ph.team]!;
    add(a.total, ph.b);
    add((a.byEntry[ph.entry] ??= emptyBucket()), ph.b);
    const cov = coverage.get(key);
    if (cov) {
      add((a.byCoverage[cov] ??= emptyBucket()), ph.b);
      add((a.byPlacement[placement.get(key) ?? "central(sin decisión)"] ??= emptyBucket()), ph.b);
      add((a.byFirstRead[firstRead.get(key) ?? "sin_lectura"] ??= emptyBucket()), ph.b);
    }
  }
}

const fmt = (b: Bucket) => `fases ${b.phases} · pts ${b.pts} (${(b.pts / Math.max(1, b.phases)).toFixed(3)}/fase) · 2P ${b.fgm2}/${b.fga2} · 3P ${b.fgm3}/${b.fga3} · FT ${b.ftm}/${b.fta} · TOV ${b.tov} · tapones sufridos ${b.blk}`;

const photoArg = process.argv.indexOf("--photo");
const which = photoArg > 0 ? process.argv[photoArg + 1] : "seed";
const jsonOut = process.argv.indexOf("--json");
const report: Record<string, unknown> = {};
for (const photo of PHOTOS) {
  if (which !== "all" && photo.id !== which) continue;
  const sierra = photo.inc === 0 ? [...SIERRA_CLARA.players] : increment(SIERRA_CLARA.players, photo.inc);
  const agg: Record<string, TeamAgg> = {};
  for (const seed of photo.seeds) accumulate(playFullGame(input(seed, sierra)), agg);
  report[photo.id] = agg;
  console.log(`\n##### ${photo.id}`);
  for (const [team, a] of Object.entries(agg)) {
    console.log(`[${team}] posesiones ${a.possessions} · s/pos ${(a.possessionMs / 1000 / a.possessions).toFixed(2)} · ${fmt(a.total)}`);
    console.log(`  fin de posesión ${JSON.stringify(a.endReasons)}`);
    for (const [k, b] of Object.entries(a.byEntry)) console.log(`  entrada ${k}: ${fmt(b)}`);
    for (const [k, b] of Object.entries(a.byCoverage).sort((x, y) => y[1].phases - x[1].phases)) console.log(`  cobertura ${k}: ${fmt(b)}`);
    for (const [k, b] of Object.entries(a.byPlacement)) console.log(`  colocación ${k}: ${fmt(b)}`);
    for (const [k, b] of Object.entries(a.byFirstRead).sort((x, y) => y[1].phases - x[1].phases)) console.log(`  1ª lectura ${k}: ${fmt(b)}`);
    console.log(`  tipos de tiro ${JSON.stringify(a.shotTypes)}`);
    for (const [k, q] of Object.entries(a.quality).sort()) console.log(`  calidad ${k}: tiros ${q.shots} · aciertos esperados ${q.expectedMakes.toFixed(1)} (${(q.expectedMakes / q.shots).toFixed(3)}) · oposición 0/0,5/1 = ${q.opp0}/${q.opp05}/${q.opp1}`);
  }
}
if (jsonOut > 0 && process.argv[jsonOut + 1]) writeFileSync(process.argv[jsonOut + 1]!, JSON.stringify(report, null, 2));
