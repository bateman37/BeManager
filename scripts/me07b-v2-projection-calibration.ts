/**
 * Calibración del comparador (ME-07B v2 §2.2, sesión v2-6), mismas 20 semillas
 * y fotos que `me07b-v2-baseline-20.ts`: por cada `colocacion_bloqueo` (organización),
 * valor proyectado de la colocación elegida frente a los puntos realmente
 * anotados por el atacante desde esa decisión hasta la siguiente organización
 * de la misma posesión (o su final). Por foto y colocación/ficha.
 * Uso: `npx tsx scripts/me07b-v2-projection-calibration.ts [foto...]` (`ROWS=filas.json` para volcar las filas)
 */
import { writeFileSync } from "node:fs";
import { playFullGame } from "../modules/match/domain/game/play-full-game";
import { buildGameInput, type GameResult } from "../modules/match/domain/game/game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../modules/match/domain/players/lab-roster-fixture";
import { ACTIVE_ATTRIBUTE_IDS, RATING_MAX, type Rating } from "../modules/match/domain/players/attribute";
import type { PlayerProfile } from "../modules/match/domain/players/player-profile";

const PHOTOS = [
  { id: "seed", seeds: [91, 92, 93, 94, 95, 96, 98, 99, 100, 101, 102], inc: 0 },
  { id: "sierra+3", seeds: [86, 87, 88, 89, 90, 91], inc: 3 },
  { id: "sierra+5", seeds: [102, 103, 104], inc: 5 },
];
function bump(players: readonly PlayerProfile[], n: number): PlayerProfile[] {
  return players.map((p) => {
    const a = { ...p.attributes };
    for (const id of ACTIVE_ATTRIBUTE_IDS) a[id] = Math.min(RATING_MAX, a[id] + n) as Rating;
    return { ...p, attributes: a };
  });
}
const common = { priority: "proteger_balance" as const, coverage: "auto" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const };

type Row = { photo: string; team: string; card: string; placement: string; projected: number; realized: number; alt: Record<string, number>; ready: Record<string, number>; first: Record<string, number>; reason: string; coverage: string | null; ms: number };
const rows: Row[] = [];

function analyze(photo: string, r: GameResult) {
  const possTeam = new Map(r.possessions.map((p) => [p.index, p.teamId]));
  const possEnd = new Map(r.possessions.map((p) => [p.index, p.endMs ?? Infinity]));
  const decs = r.audit!.decisions;
  const orgs = decs.filter((d) => d.point === "colocacion_bloqueo");
  // Puntuación del equipo en cada instante: desde los hechos.
  const scoreAt = (team: string, ms: number) => {
    let s = 0;
    for (const e of r.events) {
      if (e.atMs > ms) break;
      s = e.score[team] ?? s;
    }
    return s;
  };
  for (let i = 0; i < orgs.length; i++) {
    const d = orgs[i]!;
    const team = possTeam.get(d.possessionIndex!)!;
    const next = orgs.slice(i + 1).find((x) => x.possessionIndex === d.possessionIndex);
    const endMs = next ? next.atMs - 1 : possEnd.get(d.possessionIndex!)!;
    const realized = scoreAt(team, endMs === Infinity ? Number.MAX_SAFE_INTEGER : endMs) - scoreAt(team, d.atMs);
    const chosen = d.options.find((o) => o.status === "elegida")!;
    const alt: Record<string, number> = {};
    const ready: Record<string, number> = {};
    const first: Record<string, number> = {};
    for (const o of d.options) { alt[o.id] = o.values?.projectedValue as number; ready[o.id] = o.values?.readySeconds as number; first[o.id] = o.values?.firstReadSeconds as number; }
    const fam = decs.find((x) => x.point === "seleccion_familia" && x.possessionIndex === d.possessionIndex && x.atMs >= d.atMs && (!next || x.atMs < next.atMs));
    const famChosen = fam?.options.find((o) => o.status === "elegida");
    const card = (famChosen?.values?.cardId as string) ?? `${chosen.id}?`;
    const cov = decs.find((x) => x.point === "seleccion_cobertura" && x.possessionIndex === d.possessionIndex && x.atMs >= d.atMs && (!next || x.atMs < next.atMs));
    rows.push({ photo, team, card, placement: chosen.id, projected: chosen.values?.projectedValue as number, realized, alt, ready, first, reason: chosen.reasonCode, coverage: cov?.chosenOptionId ?? null, ms: d.atMs });
  }
}

const which = process.argv.slice(2);
for (const ph of PHOTOS) {
  if (which.length && !which.includes(ph.id)) continue;
  const sierra = ph.inc ? bump(SIERRA_CLARA.players, ph.inc) : [...SIERRA_CLARA.players];
  for (const seed of ph.seeds) {
    const gi = buildGameInput({ seed, auditEnabled: true, home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: sierra, ...common }, away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common } });
    analyze(ph.id, playFullGame(gi));
  }
}

const groups = new Map<string, Row[]>();
for (const r of rows) {
  const k = `${r.photo}|${r.team}|${r.card}`;
  groups.set(k, [...(groups.get(k) ?? []), r]);
}
console.log("photo|team|card  n  meanProjected  meanRealized  ratio");
for (const [k, rs] of [...groups.entries()].sort()) {
  const mp = rs.reduce((a, r) => a + r.projected, 0) / rs.length;
  const mr = rs.reduce((a, r) => a + r.realized, 0) / rs.length;
  console.log(`${k.padEnd(48)} ${String(rs.length).padStart(5)} ${mp.toFixed(3)} ${mr.toFixed(3)} ${(mr / mp).toFixed(2)}`);
}
// Por cobertura/respuesta para Delay y para la central.
const byCov = new Map<string, Row[]>();
for (const r of rows) {
  const k = `${r.card}|${r.coverage}`;
  byCov.set(k, [...(byCov.get(k) ?? []), r]);
}
console.log("\ncard|cobertura  n  meanProjected  meanRealized");
for (const [k, rs] of [...byCov.entries()].sort()) {
  const mp = rs.reduce((a, r) => a + r.projected, 0) / rs.length;
  const mr = rs.reduce((a, r) => a + r.realized, 0) / rs.length;
  console.log(`${k.padEnd(48)} ${String(rs.length).padStart(5)} ${mp.toFixed(3)} ${mr.toFixed(3)}`);
}
if (process.env.ROWS) {
  writeFileSync(process.env.ROWS, JSON.stringify(rows));
}
