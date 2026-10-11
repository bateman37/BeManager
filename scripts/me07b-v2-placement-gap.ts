/**
 * Diagnóstico del monopolio del bloqueo (ME-07B v2 §2.2/§7.4, sesión v2-6):
 * en cada `colocacion_bloqueo` de las 20 semillas de la foto, las cuatro fichas
 * (central, lateral, Horns, Delay) se proyectan con el mismo quinteto, el mismo
 * instante, el mismo reloj y las mismas observaciones (comparación emparejada).
 * Resume por foto y equipo la brecha Delay − mejor bloqueo, su descomposición
 * (misma respuesta base —drop frente a hundirse— y efecto de la mezcla de
 * coberturas vistas), la mejor vía de cada ficha ante el plan base, su valor
 * bruto, su probabilidad de completarse y el instante de su primera lectura.
 *
 * Uso: `npx tsx scripts/me07b-v2-placement-gap.ts` (`OUT=filas.json` para volcar las filas)
 */
import { writeFileSync } from "node:fs";
import { playFullGame } from "../modules/match/domain/game/play-full-game";
import { buildGameInput } from "../modules/match/domain/game/game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../modules/match/domain/players/lab-roster-fixture";
import { ACTIVE_ATTRIBUTE_IDS, RATING_MAX, type Rating } from "../modules/match/domain/players/attribute";
import type { PlayerProfile } from "../modules/match/domain/players/player-profile";

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
const q = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map((p) => s[Math.floor(p * (s.length - 1))]!.toFixed(3)).join(" ");
};
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

type O = Record<string, unknown>;
const out: O[] = [];
/** `seleccion_familia` en la central (bloqueo frente a mano a mano): proyección sola y con lo observado. */
const fams: { photo: string; team: string; placementPlan: string; rawDho: boolean; chosenDho: boolean; shiftPnr: number; shiftDho: number; dhoObserved: boolean }[] = [];
for (const ph of PHOTOS) {
  const sierra = ph.inc ? bump(SIERRA_CLARA.players, ph.inc) : [...SIERRA_CLARA.players];
  for (const seed of ph.seeds) {
    const gi = buildGameInput({ seed, auditEnabled: true, home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: sierra, ...common }, away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common } });
    const r = playFullGame(gi);
    const team = new Map(r.possessions.map((p) => [p.index, p.teamId]));
    for (const d of r.audit!.decisions) {
      if (d.point === "seleccion_familia") {
        const b = d.options.find((o) => o.id === "bloqueo_directo")?.values;
        const h = d.options.find((o) => o.id === "mano_a_mano_sin_balon")?.values;
        if (typeof b?.situationalValue !== "number" || typeof h?.situationalValue !== "number") continue;
        const pl = r.audit!.decisions.find((x) => x.point === "colocacion_bloqueo" && x.possessionIndex === d.possessionIndex && x.phaseIndex === d.phaseIndex);
        const blended = (v: O) => (typeof v.blendedValue === "number" ? v.blendedValue : (v.situationalValue as number));
        fams.push({
          photo: ph.id,
          team: team.get(d.possessionIndex!)!,
          placementPlan: String(pl?.options.find((o) => o.status === "elegida")?.values?.projectedPlan),
          rawDho: h.situationalValue > b.situationalValue,
          chosenDho: d.chosenOptionId === "mano_a_mano_sin_balon",
          shiftPnr: blended(b) - b.situationalValue,
          shiftDho: blended(h) - h.situationalValue,
          dhoObserved: typeof h.observedUses === "number" && h.observedUses > 0,
        });
        continue;
      }
      if (d.point !== "colocacion_bloqueo" || d.options.length < 2) continue;
      const by: Record<string, O> = {};
      for (const o of d.options) by[o.id] = { ...(o.values ?? {}), status: o.status };
      out.push({ photo: ph.id, seed, team: team.get(d.possessionIndex!), chosen: d.chosenOptionId, by });
    }
  }
}
writeFileSync(process.env.OUT ?? "/dev/null", JSON.stringify(out));

for (const ph of PHOTOS.map((p) => p.id)) {
  for (const t of [SIERRA_CLARA.id, PUERTO_AMBAR.id]) {
    const rows = out.filter((x) => x.photo === ph && x.team === t);
    const by = (x: O) => x.by as Record<string, O>;
    const gapDelay = rows.map((x) => (by(x).delay!.projectedValue as number) - Math.max(...["central", "lateral", "horns"].map((k) => by(x)[k]!.projectedValue as number)));
    const pnrBest = rows.map((x) => Math.max(...["central", "lateral", "horns"].map((k) => by(x)[k]!.projectedValue as number)));
    console.log(`\n== ${ph} ${t}: n=${rows.length}, elegidas ${JSON.stringify(rows.reduce((a: Record<string, number>, x) => ((a[x.chosen as string] = (a[x.chosen as string] ?? 0) + 1), a), {}))}`);
    console.log(`  Delay − mejor de las otras tres (cuantiles 0/10/25/50/75/90/100): ${q(gapDelay)}; Delay por encima en ${gapDelay.filter((g) => g > 0).length}`);
    // Descomposición emparejada: brecha = (Delay ante hundirse − mejor bloqueo ante drop)
    //   + (mezcla de respuestas vistas de Delay) − (mezcla de coberturas vistas del bloqueo).
    const pnrKeys = ["central", "lateral", "horns"];
    // Valor ante la respuesta base (drop) de cada colocación; la central que proyecta la mano a mano no tiene desglose por cobertura y entra con su valor.
    const vsDrop = (x: O, k: string) => {
      const o = by(x)[k]!;
      return typeof o.valueAgainst_drop === "number" ? o.valueAgainst_drop : (o.projectedValue as number);
    };
    const bestVsDrop = (x: O) => Math.max(...pnrKeys.map((k) => vsDrop(x, k)));
    const likeForLike = rows.map((x) => (by(x).delay!.valueAgainst_hundirse as number) - bestVsDrop(x));
    const pnrMix = rows.map((x, i) => pnrBest[i]! - bestVsDrop(x));
    const delayMix = rows.map((x) => (by(x).delay!.projectedValue as number) - (by(x).delay!.valueAgainst_hundirse as number));
    const firstReadLag = rows.map((x) => (by(x).delay!.firstReadSeconds as number) - Math.min(...pnrKeys.map((k) => by(x)[k]!.firstReadSeconds as number)));
    console.log(`  brecha media ${mean(gapDelay).toFixed(3)} = misma respuesta base (hundirse − drop) ${mean(likeForLike).toFixed(3)} + mezcla Delay ${mean(delayMix).toFixed(3)} − mezcla de las otras ${mean(pnrMix).toFixed(3)}; Delay ≥ las otras ante la respuesta base en ${likeForLike.filter((g) => g >= 0).length}/${rows.length}; primera lectura de Delay ${mean(firstReadLag).toFixed(2)} s después`);
    console.log(`  valor medio: mejor de las otras tres ${mean(pnrBest).toFixed(3)} · Delay ${mean(rows.map((x) => by(x).delay!.projectedValue as number)).toFixed(3)}`);
    for (const k of ["central", "lateral", "horns", "delay"]) {
      const reads: Record<string, number> = {};
      const raw: number[] = [];
      const comp: number[] = [];
      const dec: number[] = [];
      const first: number[] = [];
      for (const x of rows) {
        const o = by(x)[k]!;
        reads[String(o.baseBestRead)] = (reads[String(o.baseBestRead)] ?? 0) + 1;
        if (typeof o.baseBestReadRawValue === "number") raw.push(o.baseBestReadRawValue);
        if (typeof o.baseBestReadCompletion === "number") comp.push(o.baseBestReadCompletion);
        if (typeof o.baseDecisionSeconds === "number") dec.push(o.baseDecisionSeconds);
        first.push(o.firstReadSeconds as number);
      }
      const vs = (c: string) => {
        const v = rows.map((x) => by(x)[k]![`valueAgainst_${c}`]).filter((v): v is number => typeof v === "number");
        return v.length ? `${c} ${mean(v).toFixed(3)} (n ${v.length})` : null;
      };
      const against = ["drop", "por_debajo", "cambio", "show", "a_la_altura", "trampa", "ice", "hundirse", "cambiar_entrega", "saltar_entrega"].map(vs).filter(Boolean).join(" · ");
      console.log(`  [${k}] valor ${mean(rows.map((x) => by(x)[k]!.projectedValue as number)).toFixed(3)} · ante plan base: mejor vía ${JSON.stringify(reads)} valor bruto ${mean(raw).toFixed(3)} completado ${mean(comp).toFixed(3)} lectura a ${mean(dec).toFixed(2)} s de situarse · 1ª lectura desde t0 ${mean(first).toFixed(2)} s`);
      console.log(`      frente a: ${against}`);
    }
  }
}

// Segunda etapa: en la central, la familia se vuelve a elegir con las posiciones reales y
// mezclando la proyección con lo observado en el partido (`blendProjectionWithObservation`).
console.log("\n== seleccion_familia en la central (bloqueo frente a mano a mano)");
for (const ph of PHOTOS.map((p) => p.id)) {
  for (const t of [SIERRA_CLARA.id, PUERTO_AMBAR.id]) {
    const rows = fams.filter((x) => x.photo === ph && x.team === t);
    if (rows.length === 0) continue;
    const c = (f: (x: (typeof rows)[number]) => boolean) => rows.filter(f).length;
    console.log(
      `  ${ph} ${t}: n=${rows.length} · colocación proyectó mano a mano ${c((x) => x.placementPlan === "mano_a_mano_sin_balon")} · proyección sola prefiere mano a mano ${c((x) => x.rawDho)} · elegida mano a mano ${c((x) => x.chosenDho)}` +
        ` · proyección sola mano a mano pero elegido bloqueo ${c((x) => x.rawDho && !x.chosenDho)} · al revés ${c((x) => !x.rawDho && x.chosenDho)}` +
        ` · desplazamiento medio por lo observado: bloqueo ${mean(rows.map((x) => x.shiftPnr).filter(Number.isFinite)).toFixed(3)}, mano a mano ${mean(rows.map((x) => x.shiftDho).filter(Number.isFinite)).toFixed(3)} (con muestras propias en ${c((x) => x.dhoObserved)})`,
    );
  }
}
