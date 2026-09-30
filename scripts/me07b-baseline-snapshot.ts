/**
 * Foto basal reproducible de ME-07B (prompt §0.4), previa a cualquier cambio
 * de comportamiento del motor. Cuatro semillas del fixture vigente con
 * ambos equipos en `auto` (cobertura, orden sin balón y prioridad de
 * creación por defecto): selecciones ofensivas y defensivas (auditoría
 * real), intentos por fase y tirador, marcador, causa de parada y coste
 * temporal. No usa el resumen histórico por familias de ME-06 (defecto de
 * atribución conocido, ADR-0009): cuenta directamente sobre
 * `result.audit.decisions` y los hechos `field_goal_attempt`.
 *
 * Uso: `npx tsx scripts/me07b-baseline-snapshot.ts`
 */
import { performance } from "node:perf_hooks";
import { playFullGame } from "../modules/match/domain/game/play-full-game";
import { buildGameInput, type GameInput, type GameResult } from "../modules/match/domain/game/game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../modules/match/domain/players/lab-roster-fixture";

const SEEDS = [1, 37, 82, 156];

function input(seed: number): GameInput {
  return buildGameInput({
    seed,
    auditEnabled: true,
    home: {
      id: SIERRA_CLARA.id,
      name: SIERRA_CLARA.name,
      players: SIERRA_CLARA.players,
      priority: "proteger_balance",
      coverage: "auto",
      offBallDefensiveCall: "auto",
      offensivePlan: "auto",
      creationPriority: "equilibrado",
    },
    away: {
      id: PUERTO_AMBAR.id,
      name: PUERTO_AMBAR.name,
      players: PUERTO_AMBAR.players,
      priority: "proteger_balance",
      coverage: "auto",
      offBallDefensiveCall: "auto",
      offensivePlan: "auto",
      creationPriority: "equilibrado",
    },
  });
}

function count<T extends string>(xs: readonly T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

for (const seed of SEEDS) {
  const gameInput = input(seed);
  const t0 = performance.now();
  const result: GameResult = playFullGame(gameInput);
  const ms = performance.now() - t0;
  const audit = result.audit!;

  const familySelections = audit.decisions.filter((d) => d.point === "seleccion_familia");
  const chosenFamily = familySelections.map((d) => d.chosenOptionId ?? "sin_elegir");

  const coverageSelections = audit.decisions.filter((d) => d.point === "seleccion_cobertura");
  const chosenCoverage = coverageSelections.map((d) => d.chosenOptionId ?? "sin_elegir");

  const offBallSelections = audit.decisions.filter((d) => d.point === "seleccion_orden_sin_balon");
  const chosenOffBall = offBallSelections.map((d) => d.chosenOptionId ?? "sin_elegir");

  const organize = audit.decisions.filter((d) => d.point === "organizacion_creador");
  const organizeKept = organize.filter((d) =>
    d.options.some((o) => o.reasonCode === "creator_kept_by_real_holder" && o.status === "elegida"),
  ).length;

  const transitionThree = audit.decisions.filter((d) => d.point === "lectura_transicion");

  const fgaEvents = result.events.filter((e) => e.kind === "field_goal_attempt");
  const fgaByTeamAndType: Record<string, { fga2: number; fga3: number; fgm2: number; fgm3: number }> = {};
  const fgaByShooter: Record<string, number> = {};
  for (const e of fgaEvents) {
    const teamId = e.possessionTeamId;
    const three = (e.detail as { shotType?: string }).shotType === "three_point";
    const made = (e.detail as { made?: boolean }).made === true;
    fgaByTeamAndType[teamId] ??= { fga2: 0, fga3: 0, fgm2: 0, fgm3: 0 };
    if (three) {
      fgaByTeamAndType[teamId]!.fga3++;
      if (made) fgaByTeamAndType[teamId]!.fgm3++;
    } else {
      fgaByTeamAndType[teamId]!.fga2++;
      if (made) fgaByTeamAndType[teamId]!.fgm2++;
    }
    const shooter = e.actors[0] ?? "desconocido";
    fgaByShooter[shooter] = (fgaByShooter[shooter] ?? 0) + 1;
  }

  console.log(`\n=== Semilla ${seed} ===`);
  console.log(`  coste: ${ms.toFixed(0)} ms · hechos ${result.events.length} · posesiones ${result.possessions.length}`);
  console.log(`  stop.cause: ${result.stop.cause} · explicación: ${result.stop.explanation}`);
  console.log(`  marcador: ${JSON.stringify(result.finalScore)}`);
  console.log(`  seleccion_familia (${familySelections.length} decisiones): ${JSON.stringify(count(chosenFamily))}`);
  console.log(`  seleccion_cobertura (${coverageSelections.length} decisiones): ${JSON.stringify(count(chosenCoverage))}`);
  console.log(`  seleccion_orden_sin_balon (${offBallSelections.length} decisiones): ${JSON.stringify(count(chosenOffBall))}`);
  console.log(`  organizacion_creador: ${organize.length} decisiones, ${organizeKept} conservan al poseedor real`);
  console.log(`  lectura_transicion (triple de transición evaluado): ${transitionThree.length} decisiones`);
  console.log(`  FGA por equipo/tipo: ${JSON.stringify(fgaByTeamAndType)}`);
  console.log(`  FGA por tirador (top 8): ${JSON.stringify(
    Object.fromEntries(Object.entries(fgaByShooter).sort((a, b) => b[1] - a[1]).slice(0, 8)),
  )}`);
  console.log(`  reconciliación box score: ${audit.decisions.length} decisiones auditadas en total`);
}
