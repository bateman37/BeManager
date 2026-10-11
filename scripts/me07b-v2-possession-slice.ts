/**
 * Posesiones consecutivas de una exportación `ME-07B-AUDIT-1` (ME-07B v2 §7.4,
 * sesión v2-6): para un tramo **contiguo** de posesiones (sin escoger
 * ejemplos), cada fase organizada con la ficha elegida y su valor proyectado,
 * la segunda mejor y Delay (con la brecha), la familia/ficha ejecutada, la
 * cobertura de la defensa y su motivo, la primera lectura del manejador y el
 * desenlace (puntos de la posesión). Al final, el recuento de todo el partido.
 *
 * Lee solo la exportación (la que descarga `/lab`), no el motor.
 *
 * Uso: `npx tsx scripts/me07b-v2-possession-slice.ts auditoria.json.gz [desde] [hasta]`
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

interface Opt {
  id: string;
  status: string;
  reasonCode: string;
  values?: Record<string, unknown>;
}
interface Rec {
  atMs: number;
  point: string;
  possessionIndex: number | null;
  phaseIndex: number | null;
  holderId: string | null;
  options: Opt[];
  chosenOptionId: string | null;
}
interface Ev {
  atMs: number;
  possessionIndex: number | null;
  possessionTeamId: string | null;
  kind: string;
  actors: string[];
  score: Record<string, number>;
  text: string;
}
interface Poss {
  index: number;
  teamId: string;
  startReason: string;
  endReason: string | null;
  phases: { index: number; kind: string; entry: string }[];
}

const [file, fromArg, toArg] = process.argv.slice(2);
if (!file) throw new Error("Uso: me07b-v2-possession-slice.ts auditoria.json.gz [desde] [hasta]");
const raw = readFileSync(file);
const j = JSON.parse((file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8"));
const records: Rec[] = j.decisions.records;
const events: Ev[] = Object.values(j.timeline);
const possessions: Poss[] = j.continuity.possessions;
const from = Number(fromArg ?? 1);
const to = Number(toArg ?? from + 19);

const short = (team: string) => (team.startsWith("sierra") ? "SC" : team.startsWith("puerto") ? "PA" : team);
const num = (v: unknown) => (typeof v === "number" ? v.toFixed(3) : "—");
const HANDLER_READS = new Set(["lectura_bloqueo_o1", "lectura_spain", "lectura_trampa", "lectura_cambio", "lectura_show", "lectura_a_la_altura", "lectura_ice", "lectura_delay", "lectura_delay_pivote", "lectura_mano_a_mano"]);

function pointsOf(p: Poss): number {
  const own = events.filter((e) => e.possessionIndex === p.index);
  if (own.length === 0) return 0;
  const before = events.filter((e) => e.atMs < own[0]!.atMs).at(-1);
  return (own.at(-1)!.score[p.teamId] ?? 0) - (before?.score[p.teamId] ?? 0);
}

console.log(`semilla ${j.run.seed} · stop ${j.run.stopCause} · ${j.result.stop.explanation}`);
console.log(`posesiones ${from}–${to} (contiguas)\n`);
for (const p of possessions.filter((x) => x.index >= from && x.index <= to)) {
  const pts = pointsOf(p);
  console.log(`#${p.index} ${short(p.teamId)} · inicio: ${p.startReason} · fin: ${p.endReason ?? "—"} · puntos ${pts}`);
  const recs = records.filter((r) => r.possessionIndex === p.index);
  const transition = recs.find((r) => r.point === "entrada_fase_transicion");
  if (transition) console.log(`   transición: ${transition.chosenOptionId}`);
  for (const place of recs.filter((r) => r.point === "colocacion_bloqueo")) {
    const ph = place.phaseIndex;
    const inPhase = recs.filter((r) => r.phaseIndex === ph);
    const vals = place.options.map((o) => ({ id: o.id, v: o.values?.projectedValue as number, chosen: o.status === "elegida" }));
    const chosen = vals.find((v) => v.chosen)!;
    const others = vals.filter((v) => !v.chosen).sort((a, b) => b.v - a.v);
    const delay = vals.find((v) => v.id === "delay");
    const fam = inPhase.find((r) => r.point === "seleccion_familia");
    const card = fam?.options.find((o) => o.id === fam.chosenOptionId)?.values?.cardId ?? "—";
    const cov = inPhase.find((r) => r.point === "seleccion_cobertura");
    const covOpt = cov?.options.find((o) => o.id === cov.chosenOptionId);
    const variant = inPhase.find((r) => r.point === "seleccion_variante")?.chosenOptionId;
    const variantNote = variant && variant !== "ninguna" && variant !== card ? ` (variante ${variant})` : "";
    const read = inPhase.find((r) => HANDLER_READS.has(r.point));
    const second = inPhase.find((r) => r.point === "lectura_segunda_o5");
    const placeLine =
      vals.length === 1
        ? `colocación ${chosen.id} (única)`
        : `colocación ${chosen.id} ${num(chosen.v)} · 2.ª ${others[0]?.id} ${num(others[0]?.v)} (${num(chosen.v - (others[0]?.v ?? 0))})` +
          (delay && !delay.chosen ? ` · delay ${num(delay.v)} (${num(delay.v - chosen.v)})` : "");
    console.log(`   fase ${ph}: ${placeLine} · ficha ${card}${variantNote}`);
    console.log(
      `           defensa ${cov?.chosenOptionId ?? "—"} (${covOpt?.reasonCode ?? "—"}, concesión ${num(covOpt?.values?.concessionValue)})` +
        ` · lectura ${read ? `${read.point}→${read.chosenOptionId} (${read.holderId})` : "—"}` +
        (second ? ` · receptor→${second.chosenOptionId ?? "sin vía"}` : ""),
    );
  }
  const shots = events.filter((e) => e.possessionIndex === p.index && e.kind === "shot_result");
  for (const s of shots) console.log(`   tiro: ${s.text}`);
}

// Recuento de todo el partido (mismo denominador: organizaciones con más de una ficha).
const multi = records.filter((r) => r.point === "colocacion_bloqueo" && r.options.length > 1);
const teamOf = new Map(possessions.map((p) => [p.index, p.teamId]));
const count: Record<string, Record<string, number>> = {};
const cards: Record<string, Record<string, number>> = {};
for (const r of multi) {
  const t = short(teamOf.get(r.possessionIndex!)!);
  (count[t] ??= {})[r.chosenOptionId!] = (count[t]![r.chosenOptionId!] ?? 0) + 1;
}
for (const r of records.filter((x) => x.point === "seleccion_familia")) {
  const t = short(teamOf.get(r.possessionIndex!)!);
  const card = String(r.options.find((o) => o.id === r.chosenOptionId)?.values?.cardId ?? r.chosenOptionId);
  (cards[t] ??= {})[card] = (cards[t]![card] ?? 0) + 1;
}
console.log(`\npartido completo · colocaciones elegidas (de ${multi.length} con más de una ficha): ${JSON.stringify(count)}`);
console.log(`fichas ejecutadas (seleccion_familia): ${JSON.stringify(cards)}`);
