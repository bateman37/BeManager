/**
 * Perfil de coste del tramo enlazado de ME-03 (prompt ME-03 §5). Sin base
 * de datos y en el mismo proceso: juega una muestra reproducible de tramos
 * detallados de cuatro posesiones y resume ms por posesión y por tramo,
 * peor caso, número de hechos y semilla del peor caso. No es una prueba de
 * carga ni impone umbrales: sirve para detectar bucles o explosiones de
 * hechos antes de ME-04/ME-08.
 *
 * Uso: `npm run profile:tramo` (o `npx tsx scripts/profile-tramo.ts 1 100`).
 */
import { performance } from "node:perf_hooks";
import { playTramo } from "../modules/match/domain/sequence/play-tramo";
import { buildTramoInput, type ReboundPriority } from "../modules/match/domain/sequence/tramo-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../modules/match/domain/players/lab-roster-fixture";
import type { DefensiveCoverage } from "../modules/match/domain/lab/match-input";

const firstSeed = Number(process.argv[2] ?? 1);
const lastSeed = Number(process.argv[3] ?? 100);
const WARMUP_TRAMOS = 20;

const configurations: { coverage: DefensiveCoverage; priorities: [ReboundPriority, ReboundPriority] }[] = [
  { coverage: "drop", priorities: ["proteger_balance", "proteger_balance"] },
  { coverage: "drop", priorities: ["cargar_rebote", "cargar_rebote"] },
  { coverage: "trampa", priorities: ["proteger_balance", "cargar_rebote"] },
];

function input(seed: number, coverage: DefensiveCoverage, priorities: [ReboundPriority, ReboundPriority]) {
  return buildTramoInput({
    seed,
    coverage,
    offenseTeam: { ...SIERRA_CLARA, priority: priorities[0] },
    defenseTeam: { ...PUERTO_AMBAR, priority: priorities[1] },
  });
}

for (let i = 0; i < WARMUP_TRAMOS; i++) playTramo(input(10_000 + i, "drop", ["proteger_balance", "proteger_balance"]));

for (const config of configurations) {
  const samples: { seed: number; ms: number; possessions: number; events: number; cause: string }[] = [];
  for (let seed = firstSeed; seed <= lastSeed; seed++) {
    const tramoInput = input(seed, config.coverage, config.priorities);
    const start = performance.now();
    const result = playTramo(tramoInput);
    const ms = performance.now() - start;
    samples.push({ seed, ms, possessions: result.closedPossessions, events: result.events.length, cause: result.stop.cause });
  }
  const totalMs = samples.reduce((a, s) => a + s.ms, 0);
  const totalPossessions = samples.reduce((a, s) => a + s.possessions, 0);
  const worst = samples.reduce((a, s) => (s.ms > a.ms ? s : a));
  const mostEvents = samples.reduce((a, s) => (s.events > a.events ? s : a));
  const causes = samples.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.cause]: (acc[s.cause] ?? 0) + 1 }), {});
  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
  const p95 = sorted[Math.floor(0.95 * (sorted.length - 1))]!;
  console.log(`\n${config.coverage} · ${config.priorities.join(" / ")} · semillas ${firstSeed}–${lastSeed}`);
  console.log(`  tramos: ${samples.length} · posesiones cerradas: ${totalPossessions} · causas: ${JSON.stringify(causes)}`);
  console.log(`  ms por tramo: media ${(totalMs / samples.length).toFixed(3)} · p95 ${p95.toFixed(3)} · peor ${worst.ms.toFixed(3)} (semilla ${worst.seed}, ${worst.events} hechos)`);
  console.log(`  ms por posesión: media ${(totalMs / totalPossessions).toFixed(3)}`);
  console.log(`  hechos por tramo: media ${(samples.reduce((a, s) => a + s.events, 0) / samples.length).toFixed(1)} · máximo ${mostEvents.events} (semilla ${mostEvents.seed})`);
}
