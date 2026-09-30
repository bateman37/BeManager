import { describe, expect, it, vi } from "vitest";

// Partidos completos repetidos: más margen que el límite por defecto bajo carga paralela.
vi.setConfig({ testTimeout: 60_000 });
import { playFullGame } from "./play-full-game";
import { buildGameInput } from "./game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { PlayerProfile } from "../players/player-profile";

/**
 * ME-07B v2 §2.5: el triple del portador en transición se lee en su punto
 * real de lanzamiento (detrás del arco, tras la carrera con balón), con el
 * cierre del defensor que sale desde su posición real, y compite con el
 * valor proyectado de organizar. Antes se leía en el cruce del medio campo y
 * nunca llegaba a existir en un partido natural.
 */
const AUTO = {
  priority: "proteger_balance" as const,
  coverage: "auto" as const,
  offBallDefensiveCall: "auto" as const,
  offensivePlan: "auto" as const,
  creationPriority: "equilibrado" as const,
};
const SC = SIERRA_CLARA.id;

function play(seed: number, home: readonly PlayerProfile[] = SIERRA_CLARA.players) {
  return playFullGame(
    buildGameInput({
      seed,
      auditEnabled: true,
      home: { id: SC, name: SIERRA_CLARA.name, players: home, ...AUTO },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...AUTO },
    }),
  );
}

const SEEDS = [91, 92, 93, 94];
function transitionTriples(home: readonly PlayerProfile[] = SIERRA_CLARA.players) {
  const evaluated: { chosen: boolean; values: Record<string, unknown> }[] = [];
  for (const seed of SEEDS) {
    const r = play(seed, home);
    for (const d of r.audit!.decisions) {
      if (d.point !== "entrada_fase_transicion" || !d.holderId || !home.some((p) => p.id === d.holderId)) continue;
      const opt = d.options.find((o) => o.id === "triple_portador");
      if (!opt || opt.status === "no_evaluada_por_cortocircuito" || !opt.values) continue;
      evaluated.push({ chosen: opt.status === "elegida", values: opt.values });
    }
  }
  return evaluated;
}

describe("ME-07B v2 §2.5: triple del portador en transición", () => {
  const base = transitionTriples();

  it("se evalúa en partidos naturales con su punto, su cerrador y la oposición real, y a veces se elige", () => {
    expect(base.length).toBeGreaterThan(20);
    for (const e of base) {
      expect(e.values.depthBehindLineMeters as number).toBeGreaterThan(0);
      expect(e.values.depthBehindLineMeters as number).toBeLessThanOrEqual(2);
      expect(typeof e.values.closerId).toBe("string");
      expect([0, 0.5, 1]).toContain(e.values.opposition);
      expect(typeof e.values.organizeProjectedValue).toBe("number");
    }
    expect(base.some((e) => e.chosen)).toBe(true);
  });

  it("un triple peor (solo T04 más bajo) se elige menos; la tendencia decidida frente a prudente también cambia la elección", () => {
    const rate = (xs: typeof base) => xs.filter((e) => e.chosen).length / Math.max(1, xs.length);
    const lowT04 = transitionTriples(SIERRA_CLARA.players.map((p) => ({ ...p, attributes: { ...p.attributes, T04: 1 } })));
    expect(rate(lowT04)).toBeLessThan(rate(base));
    const decided = transitionTriples(SIERRA_CLARA.players.map((p) => ({ ...p, shotTendency: "decidida" as const })));
    const prudent = transitionTriples(SIERRA_CLARA.players.map((p) => ({ ...p, shotTendency: "prudente" as const })));
    expect(rate(decided)).toBeGreaterThan(rate(prudent));
  });
});
