import { describe, expect, it, vi } from "vitest";

// Partidos completos repetidos: más margen que el límite por defecto bajo carga paralela.
vi.setConfig({ testTimeout: 60_000 });
import { playFullGame } from "./play-full-game";
import { buildGameInput } from "./game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { PlayerProfile } from "../players/player-profile";

/**
 * ME-07B v2 §2.5: las faltas nacen de contactos defensivos reales en balón
 * vivo (cierre legal con solape en una finalización o tiro, trampa cerrada,
 * rebote por encima de la espalda), además del cierre tardío de siempre, y
 * no dependen de las segundas oportunidades. M07 (disciplina) del defensor
 * es la capacidad consultada (LAB-0.6).
 */
const AUTO = {
  priority: "proteger_balance" as const,
  coverage: "auto" as const,
  offBallDefensiveCall: "auto" as const,
  offensivePlan: "auto" as const,
  creationPriority: "equilibrado" as const,
};

function play(seed: number, away: readonly PlayerProfile[] = PUERTO_AMBAR.players) {
  return playFullGame(
    buildGameInput({
      seed,
      auditEnabled: true,
      home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...AUTO },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: away, ...AUTO },
    }),
  );
}

describe("ME-07B v2 §2.5: faltas por contacto real en balón vivo", () => {
  const games = [play(92), play(93)];

  it("hay faltas sin tiro de trampa y de rebote, cada una con su hecho y su decisión adjudicada", () => {
    const situations = new Set<string>();
    for (const r of games) {
      const facts = r.events.filter((e) => e.kind === "non_shooting_foul");
      for (const e of facts) if (typeof e.detail.situation === "string") situations.add(e.detail.situation);
      const gates = r.audit!.decisions.filter((d) => d.point === "puerta_falta_sin_tiro" && d.chosenOptionId === "ilegal");
      expect(gates.length).toBe(facts.length);
      expect(r.stop.cause).toBe("final");
    }
    expect(situations.has("trampa")).toBe(true);
    expect(situations.has("rebote_sobre_espalda")).toBe(true);
  });

  it("hay faltas de tiro por contacto legal con solape (no solo cierres tardíos), con su probabilidad y M07 auditados", () => {
    let legalContactFouls = 0;
    let lateFouls = 0;
    for (const r of games) {
      for (const d of r.audit!.decisions.filter((x) => x.point === "resolucion_tiro")) {
        const legal = d.options.find((o) => o.id === "legal_contest")!;
        if (d.chosenOptionId === "legal_contest" && legal.values!.contactFoul === true) {
          legalContactFouls += 1;
          expect(legal.values!.contactFoulProbability as number).toBeGreaterThan(0);
          expect(typeof legal.values!.contesterM07).toBe("number");
        }
        if (d.chosenOptionId === "late_illegal_contact") lateFouls += 1;
      }
    }
    expect(legalContactFouls).toBeGreaterThan(0);
    expect(lateFouls).toBeGreaterThan(0);
  });

  it("las faltas de tiro no nacen casi solo de segundas oportunidades", () => {
    let outside = 0;
    let total = 0;
    for (const r of games) {
      const phaseEntry = new Map<string, string>();
      for (const p of r.possessions) for (const ph of p.phases) phaseEntry.set(`${p.index}|${ph.index}`, ph.entry);
      for (const e of r.events.filter((x) => x.kind === "shooting_foul")) {
        total += 1;
        if (phaseEntry.get(`${e.possessionIndex}|${e.phaseIndex}`) !== "segunda_oportunidad") outside += 1;
      }
    }
    expect(total).toBeGreaterThan(10);
    expect(outside / total).toBeGreaterThan(0.5);
  });

  it("solo cambiar M07 de los defensores de Puerto cambia cuántas faltas comete Puerto (disciplina alta < baja)", () => {
    const withM07 = (v: number) => PUERTO_AMBAR.players.map((p) => ({ ...p, attributes: { ...p.attributes, M07: v } }));
    const count = (m07: number) =>
      [92, 93].reduce((n, seed) => n + play(seed, withM07(m07)).fouls.filter((f) => f.teamId === PUERTO_AMBAR.id).length, 0);
    expect(count(15)).toBeLessThan(count(1));
  });
});
