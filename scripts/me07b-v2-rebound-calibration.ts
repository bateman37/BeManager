/**
 * Calibración del rebote proyectado (ME-07B v2 §2.1/§2.2, sesión v2-9): en
 * cada tiro real, `resolucion_tiro` deja lo que la proyección del comparador
 * espera tras un fallo vivo de ese mismo tiro (probabilidad de rebote
 * ofensivo, de palmeada inmediata y puntos de palmeada, calculados en seco).
 * Aquí se comparan, solo en los tiros que de verdad fallan y tocan aro, con
 * lo que ocurre: rebote ofensivo, `second_chance_read` con palmeada y puntos
 * de esa finalización (campo y libres) hasta el siguiente fallo o el fin.
 *
 * Uso: `npx tsx scripts/me07b-v2-rebound-calibration.ts [--seeds 1-20] [--order mano_a_mano|bloqueo_central|delay|horns|spain]`
 */
import { playFullGame } from "../modules/match/domain/game/play-full-game";
import { buildGameInput } from "../modules/match/domain/game/game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../modules/match/domain/players/lab-roster-fixture";

const args = process.argv.slice(2);
const si = args.indexOf("--seeds");
const [from, to] = si >= 0 ? args[si + 1]!.split("-").map(Number) : [1, 20];
const oi = args.indexOf("--order");
const ORDERS = {
  mano_a_mano: { offensivePlan: "mano_a_mano_sin_balon" as const, screenPlacement: "central" as const },
  bloqueo_central: { offensivePlan: "bloqueo_directo" as const, screenPlacement: "central" as const },
  delay: { screenPlacement: "delay" as const },
  horns: { offensivePlan: "bloqueo_directo" as const, screenPlacement: "horns" as const, chainedVariant: "ninguna" as const },
  spain: { offensivePlan: "bloqueo_directo" as const, screenPlacement: "horns" as const, chainedVariant: "spain" as const },
};
const order = oi >= 0 ? ORDERS[args[oi + 1] as keyof typeof ORDERS] : null;
const common = { priority: "proteger_balance" as const, coverage: "auto" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const };

interface Bucket {
  shots: number;
  liveMisses: number;
  predOreb: number;
  oreb: number;
  predPutback: number;
  putback: number;
  predPoints: number;
  points: number;
}
const buckets = new Map<string, Bucket>();
const bucket = (k: string) => buckets.get(k) ?? buckets.set(k, { shots: 0, liveMisses: 0, predOreb: 0, oreb: 0, predPutback: 0, putback: 0, predPoints: 0, points: 0 }).get(k)!;

for (let seed = from!; seed <= to!; seed++) {
  const directed = seed % 2 === 1 ? SIERRA_CLARA.id : PUERTO_AMBAR.id;
  const gi = buildGameInput({
    seed,
    auditEnabled: true,
    home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...common, ...(order && directed === SIERRA_CLARA.id ? order : {}) },
    away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common, ...(order && directed === PUERTO_AMBAR.id ? order : {}) },
  });
  const r = playFullGame(gi);
  const team = new Map(r.possessions.map((p) => [p.index, p.teamId]));
  const ev = r.events;
  for (const d of r.audit!.decisions) {
    if (d.point !== "resolucion_tiro") continue;
    if (order && team.get(d.possessionIndex!) !== directed) continue;
    const chosen = d.options.find((o) => o.id === d.chosenOptionId)?.values;
    if (!chosen || typeof chosen.projectedOffensiveReboundProbability !== "number") continue;
    const prepared = ev.findIndex((e) => e.kind === "shot_prepared" && e.atMs === (d.factLink?.atMs ?? d.atMs) && e.possessionIndex === d.possessionIndex);
    if (prepared < 0) continue;
    const shotType = ev[prepared]!.text.includes("de tres") ? "triple" : "dos";
    const b = bucket(`${shotType}`);
    const all = bucket("total");
    for (const x of [b, all]) x.shots++;
    // Desenlace de este tiro: el primer hecho decisivo tras prepararlo.
    const outcome = ev.slice(prepared + 1, prepared + 12).find((e) => ["rebound_seeded", "shot_result", "shooting_foul", "shot_blocked", "game_ended", "possession_ended"].includes(e.kind));
    if (outcome?.kind !== "rebound_seeded") continue;
    const i = ev.indexOf(outcome);
    const reb = ev.slice(i, i + 12).find((e) => e.kind === "rebound_secured" || e.kind === "rebound_contested" || e.kind === "out_of_bounds" || e.kind === "non_shooting_foul");
    const offensive = (reb?.kind === "rebound_secured" || reb?.kind === "rebound_contested") && reb.detail.offensive === true;
    const sc = offensive ? ev.slice(ev.indexOf(reb!), ev.indexOf(reb!) + 6).find((e) => e.kind === "second_chance_read") : undefined;
    let pts = 0;
    if (sc?.detail.putback === true) {
      for (let m = ev.indexOf(sc) + 1; m < ev.length && ev[m]!.possessionIndex === sc.possessionIndex; m++) {
        const x = ev[m]!;
        if (x.kind === "field_goal_attempt" && x.detail.made === true) pts += Number(x.detail.points ?? 2);
        if (x.kind === "free_throws_result" && x.detail.made === true) pts += 1;
        if (x.kind === "rebound_seeded" || x.kind === "possession_ended") break;
      }
    }
    for (const x of [b, all]) {
      x.liveMisses++;
      x.predOreb += chosen.projectedOffensiveReboundProbability as number;
      x.predPutback += chosen.projectedPutbackProbability as number;
      x.predPoints += chosen.projectedPutbackValue as number;
      if (offensive) x.oreb++;
      if (sc?.detail.putback === true) x.putback++;
      x.points += pts;
    }
  }
}

const f = (x: number) => x.toFixed(1);
console.log(`Semillas ${from}–${to}${order ? ` · ${args[oi + 1]} por orden (equipo dirigido)` : " · todo auto (ambos equipos)"}`);
for (const [k, b] of [...buckets.entries()].sort()) {
  console.log(
    `${k.padEnd(7)} tiros ${b.shots} · fallos vivos ${b.liveMisses} · rebote ofensivo proyectado ${f(b.predOreb)} / real ${b.oreb} · palmeadas ${f(b.predPutback)} / ${b.putback} · puntos de palmeada ${f(b.predPoints)} / ${b.points}`,
  );
}
