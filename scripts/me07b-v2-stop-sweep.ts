/**
 * Barrido de parada final de ME-07B v2 (§7.5): juega las semillas naturales
 * 1–60 con ambos equipos en `auto` (fixture en las tres fotos: seed, Sierra
 * +3 y Sierra +5, tope 15) y comprueba en cada partido `stop.cause`, la
 * conciliación del acta y las sustituciones de emergencia (`ME-04-ROT-3`).
 * Sin auditoría (mismos hechos que con ella, ME-04A).
 *
 * Uso: `npx tsx scripts/me07b-v2-stop-sweep.ts [desde] [hasta]`
 */
import { playFullGame } from "../modules/match/domain/game/play-full-game";
import { buildGameInput } from "../modules/match/domain/game/game-model";
import { reconcileBoxScore } from "../modules/match/domain/game/box-score";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../modules/match/domain/players/lab-roster-fixture";
import { ACTIVE_ATTRIBUTE_IDS, RATING_MAX, type Rating } from "../modules/match/domain/players/attribute";
import type { PlayerProfile } from "../modules/match/domain/players/player-profile";

const from = Number(process.argv[2] ?? 1);
const to = Number(process.argv[3] ?? 60);

function increment(players: readonly PlayerProfile[], amount: number): PlayerProfile[] {
  return players.map((p) => {
    const attributes = { ...p.attributes };
    for (const id of ACTIVE_ATTRIBUTE_IDS) attributes[id] = Math.min(RATING_MAX, attributes[id] + amount) as Rating;
    return { ...p, attributes };
  });
}

const common = {
  priority: "proteger_balance" as const,
  coverage: "auto" as const,
  offBallDefensiveCall: "auto" as const,
  offensivePlan: "auto" as const,
  creationPriority: "equilibrado" as const,
};

let bad = 0;
for (const [photo, amount] of [["seed", 0], ["sierra+3", 3], ["sierra+5", 5]] as const) {
  const sierra = amount === 0 ? SIERRA_CLARA.players : increment(SIERRA_CLARA.players, amount);
  const guardians: string[] = [];
  const emergencies: string[] = [];
  let unreconciled = 0;
  for (let seed = from; seed <= to; seed++) {
    const r = playFullGame(
      buildGameInput({
        seed,
        auditEnabled: false,
        home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: sierra, ...common },
        away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common },
      }),
    );
    const checks = reconcileBoxScore({
      box: r.box,
      finalScore: r.finalScore,
      effectivePlayedMs: r.effectivePlayedMs,
      engineMinutesMs: r.engineMinutesMs,
      teamIds: [SIERRA_CLARA.id, PUERTO_AMBAR.id],
    });
    if (checks.some((c) => !c.ok)) unreconciled += 1;
    if (r.stop.cause !== "final") guardians.push(`${seed}: ${r.stop.explanation}`);
    for (const s of r.substitutions) if (s.emergency) emergencies.push(`${seed} ${s.teamId}: ${s.emergency.summary}`);
  }
  bad += guardians.length + unreconciled;
  console.log(`[${photo}] semillas ${from}–${to}: guardián ${guardians.length}, actas sin conciliar ${unreconciled}, relevos de emergencia ${emergencies.length}`);
  for (const g of guardians) console.log(`  guardián ${g}`);
  for (const e of emergencies) console.log(`  emergencia ${e}`);
}
process.exitCode = bad > 0 ? 1 : 0;
