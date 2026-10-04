/**
 * Diagnóstico de la distancia entre lo proyectado y lo anotado por uso de
 * ficha (ME-07B v2 §2.2, sesión v2-7): por qué la mano a mano central y Delay
 * anotan menos de lo que promete su proyección y el bloqueo directo algo más.
 *
 * Mismas 20 semillas y fotos que `me07b-v2-baseline-20.ts` (todo `auto`), más
 * partidos dirigidos (`--directed`): un equipo con la mano a mano central o
 * Delay por orden, el otro en `auto`, en varias semillas.
 *
 * Por cada uso organizado (una `seleccion_familia` con su fase), en la misma
 * ventana que la muestra observada del motor (`settleObservation`: desde la
 * decisión hasta la siguiente decisión organizada de la posesión o su fin):
 * - proyección: la de la colocación (lo que usa `me07b-v2-projection-calibration.ts`),
 *   la de la familia en el instante real (`seleccion_familia`, sin mezclar lo
 *   observado) y la que vale ante la respuesta defensiva realmente elegida;
 * - primera lectura real: vía elegida, su valor × completado y el mejor de ese
 *   instante (misma regla que la proyección, con el estado ya sorteado);
 * - primer tiro: probabilidad usada por `resolucion_tiro`, oposición geométrica
 *   y la oposición que la lectura había supuesto para esa vía;
 * - resultado: puntos del primer tiro, libres, otros puntos de la ventana
 *   (rebote ofensivo, segunda acción), pérdidas, reorganizaciones y reloj.
 *
 * Uso: `npx tsx scripts/me07b-v2-handoff-delay-gap.ts [--photos] [--directed] [--seeds 1-40] [--json filas.json]`
 */
import { writeFileSync } from "node:fs";
import { playFullGame } from "../modules/match/domain/game/play-full-game";
import { buildGameInput, type GameResult } from "../modules/match/domain/game/game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../modules/match/domain/players/lab-roster-fixture";
import { ACTIVE_ATTRIBUTE_IDS, RATING_MAX, type Rating } from "../modules/match/domain/players/attribute";
import type { PlayerProfile } from "../modules/match/domain/players/player-profile";
import type { AuditDecisionRecord } from "../modules/match/domain/audit/audit-types";

const PHOTOS = [
  { id: "seed", seeds: [91, 92, 93, 94, 95, 96, 98, 99, 100, 101, 102], inc: 0 },
  { id: "sierra+3", seeds: [86, 87, 88, 89, 90, 91], inc: 3 },
  { id: "sierra+5", seeds: [102, 103, 104], inc: 5 },
];
const bump = (ps: readonly PlayerProfile[], n: number) =>
  ps.map((p) => {
    const a = { ...p.attributes };
    for (const id of ACTIVE_ATTRIBUTE_IDS) a[id] = Math.min(RATING_MAX, a[id] + n) as Rating;
    return { ...p, attributes: a };
  });
const common = { priority: "proteger_balance" as const, coverage: "auto" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const };

const FIRST_READS = new Set(["lectura_bloqueo_o1", "lectura_trampa", "lectura_cambio", "lectura_show", "lectura_a_la_altura", "lectura_ice", "lectura_spain", "lectura_mano_a_mano", "lectura_delay", "lectura_delay_pivote"]);
const TOV_KINDS = new Set(["turnover", "shot_clock_violation", "backcourt_violation", "throw_in_violation"]);

export interface UseRow {
  source: string;
  seed: number;
  team: string;
  card: string;
  coverage: string | null;
  placementProjected: number | null;
  placementPlan: string | null;
  familyProjected: number | null;
  /** Valor proyectado ante la respuesta defensiva realmente elegida (si se audita). */
  coverageProjected: number | null;
  readPoint: string | null;
  readChosen: string | null;
  readChosenExpected: number | null;
  readBestExpected: number | null;
  readBestId: string | null;
  readSeconds: number | null;
  firstShot: { p: number; opp: string; pts: 2 | 3; shooter: string; legality: string | null; seconds: number; readOpp: number | null } | null;
  shots: number;
  ptsFirstFg: number;
  ptsFt: number;
  ptsOther: number;
  realized: number;
  tov: string | null;
  /** Pases desviados que quedan sueltos (`pass_control_lost`) y quién recupera el balón. */
  looseToDefense: number;
  looseKept: number;
  reorganized: boolean;
  blocked: boolean;
  secondReads: string[];
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function analyzeGame(source: string, seed: number, r: GameResult): UseRow[] {
  const decs = r.audit!.decisions;
  const possTeam = new Map(r.possessions.map((p) => [p.index, p.teamId]));
  const possEnd = new Map(r.possessions.map((p) => [p.index, p.endMs ?? Number.MAX_SAFE_INTEGER]));
  const fams = decs.filter((d) => d.point === "seleccion_familia");
  const byPoss = new Map<number, AuditDecisionRecord[]>();
  for (const d of decs) {
    if (d.possessionIndex === null) continue;
    (byPoss.get(d.possessionIndex) ?? byPoss.set(d.possessionIndex, []).get(d.possessionIndex)!).push(d);
  }
  const evByPoss = new Map<number, typeof r.events[number][]>();
  for (const e of r.events) (evByPoss.get(e.possessionIndex) ?? evByPoss.set(e.possessionIndex, []).get(e.possessionIndex)!).push(e);
  const teamOf = new Map(Object.values(r.box.players).map((l) => [l.playerId, l.teamId]));
  const rows: UseRow[] = [];
  for (let i = 0; i < fams.length; i++) {
    const f = fams[i]!;
    const pi = f.possessionIndex!;
    const team = possTeam.get(pi)!;
    const pd = byPoss.get(pi)!;
    const next = pd.find((x) => x.point === "seleccion_familia" && x.atMs > f.atMs);
    // Ventana de `settleObservation`: hasta la siguiente organización (su colocación) o el fin.
    const nextOrg = pd.find((x) => x.point === "colocacion_bloqueo" && x.atMs > f.atMs);
    // Exclusiva ante la siguiente organización; inclusiva hasta el hecho que cierra la posesión.
    const endMs = nextOrg ? nextOrg.atMs - 1 : next ? next.atMs - 1 : possEnd.get(pi)!;
    const inWin = (atMs: number) => atMs >= f.atMs && atMs <= endMs;
    const placement = [...pd].reverse().find((x) => x.point === "colocacion_bloqueo" && x.atMs <= f.atMs);
    const placementChosen = placement?.options.find((o) => o.status === "elegida");
    const famChosen = f.options.find((o) => o.status === "elegida")!;
    const card = String(famChosen.values?.cardId ?? "?");
    let familyProjected: number | null = null;
    if (card === "mano_a_mano_central" && f.chosenOptionId && famChosen.reasonCode !== "family_forced_by_plan") familyProjected = num(famChosen.values?.situationalValue);
    else if (card === "bloqueo_directo_central" && famChosen.reasonCode !== "family_forced_by_plan") familyProjected = num(famChosen.values?.expectedValueOverShownCoverages) ?? num(famChosen.values?.situationalValue);
    // Fuera de la elección `auto` de la central (otra colocación o familia por orden), la proyección es la de la colocación.
    if (familyProjected === null) familyProjected = num(placementChosen?.values?.projectedValue);
    const cov = pd.find((x) => x.point === "seleccion_cobertura" && inWin(x.atMs));
    const covChosen = cov?.options.find((o) => o.status === "elegida");
    const read = pd.find((x) => FIRST_READS.has(x.point) && inWin(x.atMs));
    const readChosen = read?.options.find((o) => o.status === "elegida");
    const exp = (o: { values?: Record<string, unknown> }) => {
      const v = num(o.values?.situationalValue);
      if (v === null) return null;
      const c = num(o.values?.completion);
      return v * (c ?? 1);
    };
    let readBestExpected: number | null = null;
    let readBestId: string | null = null;
    for (const o of read?.options ?? []) {
      const e = exp(o);
      if (e !== null && (readBestExpected === null || e > readBestExpected)) {
        readBestExpected = e;
        readBestId = o.id;
      }
    }
    const shotDec = pd.find((x) => x.point === "resolucion_tiro" && inWin(x.atMs));
    const evs = (evByPoss.get(pi) ?? []).filter((e) => inWin(e.atMs));
    let firstShot: UseRow["firstShot"] = null;
    if (shotDec) {
      const p = Number(/Probabilidad de conversión usada: ([0-9]+\.[0-9]+)/.exec(shotDec.note ?? "")?.[1] ?? NaN);
      const opp = /oposición geométrica=([0-9.]+)/.exec(shotDec.note ?? "")?.[1] ?? "?";
      const prepared = evs.find((e) => e.kind === "shot_prepared" && e.atMs === (shotDec.factLink?.atMs ?? shotDec.atMs));
      const pts = prepared?.text.includes("de tres") ? 3 : 2;
      firstShot = { p, opp, pts, shooter: shotDec.holderId ?? "?", legality: shotDec.chosenOptionId, seconds: (shotDec.atMs - f.atMs) / 1000, readOpp: num(readChosen?.values?.opposition) };
    }
    let ptsFirstFg = 0;
    let ptsFt = 0;
    let ptsOther = 0;
    let shots = 0;
    let seenFirst = false;
    let tov: string | null = null;
    let looseToDefense = 0;
    let looseKept = 0;
    let pendingLoose = false;
    let blocked = false;
    for (const e of evs) {
      if (e.kind === "field_goal_attempt") {
        shots++;
        const pts = e.detail.made === true ? Number(e.detail.points ?? (e.detail.shotType === "three_point" ? 3 : 2)) : 0;
        if (!seenFirst) ptsFirstFg += pts;
        else ptsOther += pts;
        seenFirst = true;
      } else if (e.kind === "shooting_foul") {
        seenFirst = true;
      } else if (e.kind === "free_throws_result") {
        if (e.detail.made === true) ptsFt += 1;
      } else if (TOV_KINDS.has(e.kind) && !tov) {
        tov = e.kind === "turnover" ? (/desvía el pase/.test(e.text) ? "robo_de_pase" : /poste/.test(e.text) ? "robo_en_poste" : "robo_otro") : e.kind;
      } else if (e.kind === "pass_control_lost") {
        pendingLoose = true;
      } else if (e.kind === "loose_ball_recovered" && pendingLoose) {
        pendingLoose = false;
        if (teamOf.get(e.actors[0] ?? "") === team) looseKept++;
        else looseToDefense++;
      } else if (e.kind === "shot_blocked") {
        blocked = true;
      }
    }
    // Puntos realmente anotados en la ventana (marcador).
    const scoreAt = (ms: number) => {
      let s = 0;
      for (const e of r.events) {
        if (e.atMs > ms) break;
        s = e.score[team] ?? s;
      }
      return s;
    };
    const realized = scoreAt(endMs) - scoreAt(f.atMs);
    const secondReads = pd.filter((x) => inWin(x.atMs) && ["lectura_segunda_o5", "lectura_poste", "segunda_entrada"].includes(x.point)).map((x) => `${x.point}:${x.chosenOptionId}`);
    rows.push({
      source,
      seed,
      team,
      card,
      coverage: cov?.chosenOptionId ?? null,
      placementProjected: num(placementChosen?.values?.projectedValue),
      placementPlan: (placementChosen?.values?.projectedPlan as string) ?? null,
      familyProjected,
      coverageProjected: num(covChosen?.values?.concessionValue),
      readPoint: read?.point ?? null,
      readChosen: read?.chosenOptionId ?? null,
      readChosenExpected: readChosen ? exp(readChosen) : null,
      readBestExpected,
      readBestId,
      readSeconds: read ? (read.atMs - f.atMs) / 1000 : null,
      firstShot,
      shots,
      ptsFirstFg,
      ptsFt,
      ptsOther,
      realized,
      tov,
      looseToDefense,
      looseKept,
      reorganized: evs.some((e) => e.kind === "possession_continues"),
      blocked,
      secondReads,
    });
  }
  return rows;
}

const mean = (a: readonly (number | null)[]) => {
  const v = a.filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN;
};
const f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : "—");
const count = (xs: readonly string[]) => xs.reduce((a: Record<string, number>, k) => ((a[k] = (a[k] ?? 0) + 1), a), {});

export function summarize(label: string, rows: readonly UseRow[]): void {
  const n = rows.length;
  if (n === 0) return;
  const withShot = rows.filter((r) => r.firstShot);
  console.log(`\n== ${label}: n=${n}`);
  console.log(
    `  proyectado: colocación ${f3(mean(rows.map((r) => r.placementProjected)))} · familia (instante real) ${f3(mean(rows.map((r) => r.familyProjected)))} · ante la respuesta elegida ${f3(mean(rows.map((r) => r.coverageProjected)))} (n ${rows.filter((r) => r.coverageProjected !== null).length})`,
  );
  console.log(
    `  1ª lectura real: mejor ${f3(mean(rows.map((r) => r.readBestExpected)))} · elegida ${f3(mean(rows.map((r) => r.readChosenExpected)))} · a ${f3(mean(rows.map((r) => r.readSeconds)))} s · sin lectura ${rows.filter((r) => !r.readPoint).length} · vías ${JSON.stringify(count(rows.map((r) => r.readChosen ?? "—")))}`,
  );
  console.log(
    `  anotado ${f3(mean(rows.map((r) => r.realized)))} = 1.er tiro de campo ${f3(mean(rows.map((r) => r.ptsFirstFg)))} + libres ${f3(mean(rows.map((r) => r.ptsFt)))} + resto ${f3(mean(rows.map((r) => r.ptsOther)))}`,
  );
  const tovs = rows.filter((r) => r.tov);
  const lost = rows.filter((r) => r.tov || r.looseToDefense > 0).length;
  console.log(
    `  pérdidas ${lost}/${n} (${f3(lost / n)}): con hecho de pérdida ${tovs.length} ${JSON.stringify(count(tovs.map((r) => r.tov!)))} + pase desviado que recupera la defensa ${rows.filter((r) => !r.tov && r.looseToDefense > 0).length} · pase desviado que recupera el ataque ${rows.filter((r) => r.looseKept > 0).length} · reorganizadas ${rows.filter((r) => r.reorganized).length} · tapones ${rows.filter((r) => r.blocked).length} · con 1.er tiro ${withShot.length}`,
  );
  if (withShot.length) {
    const xp = mean(withShot.map((r) => r.firstShot!.p * r.firstShot!.pts));
    const opp = count(withShot.map((r) => r.firstShot!.opp));
    const readOpp = count(withShot.map((r) => String(r.firstShot!.readOpp ?? "?")));
    const mism = withShot.filter((r) => r.firstShot!.readOpp !== null && String(r.firstShot!.readOpp) !== r.firstShot!.opp).length;
    console.log(
      `  1.er tiro: puntos esperados con la probabilidad usada ${f3(xp)} · lectura elegida (cuando hubo tiro) ${f3(mean(withShot.map((r) => r.readChosenExpected)))} · oposición usada ${JSON.stringify(opp)} · supuesta por la lectura ${JSON.stringify(readOpp)} (distinta en ${mism}) · a ${f3(mean(withShot.map((r) => r.firstShot!.seconds)))} s · faltas ${withShot.filter((r) => r.firstShot!.legality !== "no_contest" && r.ptsFt > 0).length}`,
    );
    const byRead = new Map<string, UseRow[]>();
    for (const r of withShot) byRead.set(r.readChosen ?? "—", [...(byRead.get(r.readChosen ?? "—") ?? []), r]);
    for (const [k, rs] of [...byRead.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(
        `    vía ${k}: n ${rs.length} · lectura ${f3(mean(rs.map((r) => r.readChosenExpected)))} · tiro esperado ${f3(mean(rs.map((r) => r.firstShot!.p * r.firstShot!.pts)))} · oposición ${JSON.stringify(count(rs.map((r) => r.firstShot!.opp)))} (lectura ${JSON.stringify(count(rs.map((r) => String(r.firstShot!.readOpp ?? "?"))))}) · anotado ${f3(mean(rs.map((r) => r.realized)))}`,
      );
    }
  }
  const sr = rows.flatMap((r) => r.secondReads);
  if (sr.length) console.log(`  segundas lecturas ${JSON.stringify(count(sr))}`);
}

function main() {
  const args = process.argv.slice(2);
  const all: UseRow[] = [];
  const doPhotos = args.includes("--photos") || !args.includes("--directed");
  if (doPhotos) {
    for (const ph of PHOTOS) {
      const sierra = ph.inc ? bump(SIERRA_CLARA.players, ph.inc) : [...SIERRA_CLARA.players];
      for (const seed of ph.seeds) {
        const gi = buildGameInput({ seed, auditEnabled: true, home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: sierra, ...common }, away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common } });
        all.push(...analyzeGame(ph.id, seed, playFullGame(gi)));
      }
    }
    for (const ph of PHOTOS.map((p) => p.id)) {
      for (const card of ["bloqueo_directo_central", "mano_a_mano_central", "delay_mano_a_mano"]) {
        summarize(`${ph} · ${card}`, all.filter((r) => r.source === ph && r.card === card));
      }
    }
    for (const card of ["bloqueo_directo_central", "bloqueo_directo_lateral", "horns_bloqueo", "horns_spain", "mano_a_mano_central", "delay_mano_a_mano"]) {
      summarize(`20 semillas · ${card}`, all.filter((r) => PHOTOS.some((p) => p.id === r.source) && r.card === card));
    }
  }
  if (args.includes("--directed")) {
    const si = args.indexOf("--seeds");
    const [a, b] = si > 0 ? args[si + 1]!.split("-").map(Number) : [1, 20];
    const seeds = Array.from({ length: b! - a! + 1 }, (_, k) => a! + k);
    const orders = [
      { id: "dirigido:mano_a_mano", order: { offensivePlan: "mano_a_mano_sin_balon" as const, screenPlacement: "central" as const } },
      { id: "dirigido:delay", order: { screenPlacement: "delay" as const } },
      { id: "dirigido:bloqueo_central", order: { offensivePlan: "bloqueo_directo" as const, screenPlacement: "central" as const } },
    ];
    for (const o of orders) {
      for (const seed of seeds) {
        // El equipo dirigido alterna: Sierra en semillas impares, Puerto en pares (mismo número de usos por equipo).
        const sierraDirected = seed % 2 === 1;
        const gi = buildGameInput({
          seed,
          auditEnabled: true,
          home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: [...SIERRA_CLARA.players], ...common, ...(sierraDirected ? o.order : {}) },
          away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common, ...(!sierraDirected ? o.order : {}) },
        });
        const rows = analyzeGame(o.id, seed, playFullGame(gi)).filter((r) => r.team === (sierraDirected ? SIERRA_CLARA.id : PUERTO_AMBAR.id));
        all.push(...rows);
      }
      const rows = all.filter((r) => r.source === o.id);
      summarize(`${o.id} (semillas ${a}–${b})`, rows);
      for (const t of [SIERRA_CLARA.id, PUERTO_AMBAR.id]) summarize(`${o.id} · ${t}`, rows.filter((r) => r.team === t));
      const perSeed = seeds.map((s) => {
        const rs = rows.filter((r) => r.seed === s);
        return rs.length ? mean(rs.map((r) => r.realized)) - mean(rs.map((r) => r.familyProjected)) : NaN;
      });
      const v = perSeed.filter(Number.isFinite);
      const m = mean(v);
      const sd = Math.sqrt(v.reduce((acc, x) => acc + (x - m) ** 2, 0) / Math.max(1, v.length - 1));
      console.log(`  anotado − proyectado (familia) por partido: media ${f3(m)} · desviación ${f3(sd)} · error típico ${f3(sd / Math.sqrt(v.length))} · partidos por debajo ${v.filter((x) => x < 0).length}/${v.length}`);
    }
  }
  const ji = args.indexOf("--json");
  if (ji > 0) writeFileSync(args[ji + 1]!, JSON.stringify(all));
}

main();
