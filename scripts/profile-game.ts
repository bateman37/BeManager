/**
 * Perfil de coste del partido completo de ME-04 (prompt ME-04 §8). Sin base
 * de datos y en el mismo proceso: juega al menos diez partidos completos
 * con semillas declaradas sobre el fixture de laboratorio y resume mediana
 * y peor caso observado, hechos, posesiones y memoria aproximada (montículo
 * retenido por un resultado). Mide aparte la proyección del acta
 * (`projectBoxScore`) sobre los hechos ya generados. No impone umbrales ni
 * simula la jornada de ME-10.
 *
 * Uso: `npm run profile:game` (o `npx tsx scripts/profile-game.ts 1 20`).
 * Para la memoria, ejecutar con `node --expose-gc` vía
 * `NODE_OPTIONS=--expose-gc npm run profile:game`; sin `gc` se informa como no medida.
 */
import { performance } from "node:perf_hooks";
import { playFullGame } from "../modules/match/domain/game/play-full-game";
import { buildGameInput, type GameResult } from "../modules/match/domain/game/game-model";
import { projectBoxScore } from "../modules/match/domain/game/box-score";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../modules/match/domain/players/lab-roster-fixture";

const firstSeed = Number(process.argv[2] ?? 1);
const lastSeed = Number(process.argv[3] ?? 12);
const gc = (globalThis as { gc?: () => void }).gc;

function input(seed: number) {
  return buildGameInput({
    seed,
    home: { ...SIERRA_CLARA, priority: "proteger_balance", coverage: "drop" },
    away: { ...PUERTO_AMBAR, priority: "proteger_balance", coverage: "drop" },
  });
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

// Calentamiento del JIT (no se cuenta).
for (let i = 0; i < 3; i++) playFullGame(input(10_000 + i));

const samples: { seed: number; ms: number; events: number; possessions: number; periods: number; boxMs: number; heapMb: number | null }[] = [];
for (let seed = firstSeed; seed <= lastSeed; seed++) {
  const gameInput = input(seed);
  gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  let result: GameResult | null = playFullGame(gameInput);
  const ms = performance.now() - t0;
  gc?.();
  const heapMb = gc ? (process.memoryUsage().heapUsed - heapBefore) / 1e6 : null;
  const rosters = gameInput.teams.map((t) => ({ teamId: t.id, playerIds: t.roster.map((p) => p.id) }));
  const b0 = performance.now();
  for (let i = 0; i < 20; i++) projectBoxScore(result.events, rosters);
  const boxMs = (performance.now() - b0) / 20;
  samples.push({ seed, ms, events: result.events.length, possessions: result.possessions.length, periods: result.periods.length, boxMs, heapMb });
  result = null;
}

console.log(`Partidos completos (drop/drop, proteger balance), semillas ${firstSeed}–${lastSeed}: ${samples.length}`);
for (const s of samples) {
  console.log(
    `  semilla ${s.seed}: ${s.ms.toFixed(0)} ms · ${s.events} hechos · ${s.possessions} posesiones · ${s.periods} períodos · acta ${s.boxMs.toFixed(2)} ms · memoria retenida ${s.heapMb === null ? "no medida" : `${s.heapMb.toFixed(1)} MB`}`,
  );
}
const worst = samples.reduce((a, s) => (s.ms > a.ms ? s : a));
console.log(`  ms por partido: mediana ${median(samples.map((s) => s.ms)).toFixed(0)} · peor ${worst.ms.toFixed(0)} (semilla ${worst.seed})`);
console.log(`  hechos por partido: mediana ${median(samples.map((s) => s.events))} · posesiones: mediana ${median(samples.map((s) => s.possessions))}`);
console.log(`  ms por posesión (mediana de partidos): ${median(samples.map((s) => s.ms / s.possessions)).toFixed(3)}`);
console.log(`  proyección del acta: mediana ${median(samples.map((s) => s.boxMs)).toFixed(2)} ms por partido (una pasada por los hechos)`);
if (gc) console.log(`  memoria retenida por un resultado: mediana ${median(samples.map((s) => s.heapMb!)).toFixed(1)} MB`);
