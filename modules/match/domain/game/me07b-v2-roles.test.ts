import { describe, expect, it, vi } from "vitest";

// Partidos completos repetidos: más margen que el límite por defecto bajo carga paralela.
vi.setConfig({ testTimeout: 60_000 });
import { playFullGame } from "./play-full-game";
import { buildGameInput } from "./game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { PlayerProfile } from "../players/player-profile";
import { FIRST_READ_TIE_BAND_POINTS } from "../lab/lab-0-3-parameters";

/**
 * ME-07B v2 §2.4 (primitiva «asignación de funciones», §3): al organizar,
 * creador (O1) y bloqueador (O5) se asignan entre jugadores reales por la
 * misma proyección en seco que el selector de familia, y los defensores
 * siguen a su marca (sin cambio de emparejamiento instantáneo).
 */
const AUTO = {
  priority: "proteger_balance" as const,
  coverage: "auto" as const,
  offBallDefensiveCall: "auto" as const,
  offensivePlan: "auto" as const,
  creationPriority: "equilibrado" as const,
};

function play(seed: number, home: readonly PlayerProfile[] = SIERRA_CLARA.players, auditEnabled = true) {
  return playFullGame(
    buildGameInput({
      seed,
      auditEnabled,
      home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: home, ...AUTO },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...AUTO },
    }),
  );
}

describe("ME-07B v2 §2.4: asignación de creador y bloqueador al organizar", () => {
  const r = play(92);
  const decisions = r.audit!.decisions.filter((d) => d.point === "organizacion_creador");

  it("elige la mejor proyección (o, dentro de la banda y de la misma ficha, la que llega antes a su primera lectura), con valores auditados", () => {
    expect(decisions.length).toBeGreaterThan(50);
    for (const d of decisions) {
      const values = d.options.map((o) => o.values!.projectedValue as number);
      const best = Math.max(...values);
      const chosen = d.options.find((o) => o.status === "elegida")!;
      expect(chosen.id).toBe(d.chosenOptionId);
      expect(best - (chosen.values!.projectedValue as number)).toBeLessThanOrEqual(FIRST_READ_TIE_BAND_POINTS + 1e-12);
      for (const o of d.options) {
        if (o === chosen) continue;
        // Sesión v2-6: la banda solo desempata asignaciones de la misma ficha y por la primera lectura real.
        const inBand = best - (o.values!.projectedValue as number) <= FIRST_READ_TIE_BAND_POINTS;
        // y del mismo plan proyectado (la mano a mano y el bloqueo de la central se deciden por valor).
        if (inBand && o.values!.placement === chosen.values!.placement && o.values!.projectedPlan === chosen.values!.projectedPlan) expect(o.values!.firstReadSeconds as number).toBeGreaterThanOrEqual(chosen.values!.firstReadSeconds as number);
      }
    }
  });

  it("el poseedor real crea a veces y a veces devuelve el balón, y el bloqueador no es siempre el mismo rol", () => {
    const kept = decisions.filter((d) => d.chosenOptionId === d.holderId);
    const passedBack = decisions.filter((d) => d.chosenOptionId !== d.holderId);
    expect(kept.length).toBeGreaterThan(0);
    expect(passedBack.length).toBeGreaterThan(0);
    const entries = r.events.filter((e) => e.kind === "organized_entry");
    const screeners = new Set(entries.map((e) => (e.detail.roles as Record<string, string>).O5));
    expect(screeners.size).toBeGreaterThan(2);
  });

  it("los defensores siguen a su marca: dentro de una posesión, las parejas atacante-defensor no cambian por reasignar roles", () => {
    const entries = r.events.filter((e) => e.kind === "organized_entry");
    expect(entries.length).toBeGreaterThan(50);
    const pairsOf = (roles: Record<string, string>) =>
      [1, 2, 3, 4, 5].map((k) => `${roles[`O${k}`]}>${roles[`D${k}`]}`).sort().join(",");
    const seen = new Map<string, { pairs: string; onCourt: string; atMs: number }>();
    let compared = 0;
    for (const e of entries) {
      const key = String(e.possessionIndex);
      const now = { pairs: pairsOf(e.detail.roles as Record<string, string>), onCourt: e.onCourtIds.join(), atMs: e.atMs };
      const prev = seen.get(key);
      // Un cambio defensivo (switch, ME-07B v2 §5; cambio en el bloqueo ciego de
      // Spain, LAB-0.9) sí cambia las parejas a propósito; se comprueba en
      // `me07b-v2-switch-show.test.ts` y `me07b-v2-spain.test.ts`.
      const switched = r.events.some((x) => (x.kind === "switch_committed" || x.kind === "back_screen_switch") && x.possessionIndex === e.possessionIndex && prev && x.atMs >= prev.atMs && x.atMs <= e.atMs);
      if (prev && prev.onCourt === now.onCourt && !switched) {
        expect(now.pairs).toBe(prev.pairs);
        compared += 1;
      }
      seen.set(key, now);
    }
    expect(compared).toBeGreaterThan(5);
  });

  it("un creador inhábil (solo cambia su capacidad) cede la creación con más frecuencia", () => {
    const baseO1 = SIERRA_CLARA.players[0]!;
    const weak = SIERRA_CLARA.players.map((p) =>
      p.id === baseO1.id ? { ...p, attributes: { ...p.attributes, T01: 1, T04: 1, T06: 1, T09: 1, M01: 1, M05: 1, F01: 1 } } : p,
    );
    const meanValue = (res: ReturnType<typeof play>) => {
      const vs = res.audit!.decisions
        .filter((d) => d.point === "organizacion_creador")
        .flatMap((d) => d.options.filter((o) => o.id === baseO1.id).map((o) => o.values!.projectedValue as number));
      expect(vs.length).toBeGreaterThan(10);
      return vs.reduce((a, b) => a + b, 0) / vs.length;
    };
    expect(meanValue(play(92, weak))).toBeLessThan(meanValue(r));
  });

  it("auditoría ON/OFF deja idéntica la secuencia deportiva", () => {
    const off = play(92, SIERRA_CLARA.players, false);
    expect(off.finalScore).toEqual(r.finalScore);
    expect(off.events.length).toBe(r.events.length);
  });
});
