import { describe, expect, it } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput } from "./game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";

/**
 * ME-07B v2 §2.3: la defensa `auto` decide la cobertura cuando empieza a
 * prepararse la pantalla, compara la concesión de drop y trampa desde la
 * misma geometría (proyección en seco de su propia ejecución) y la combina
 * con lo que ya ha concedido de verdad en el partido (LAB-0.4). Pruebas
 * sobre el motor real y la auditoría, sin cuotas.
 */
const AUTO = {
  priority: "proteger_balance" as const,
  coverage: "auto" as const,
  offBallDefensiveCall: "auto" as const,
  offensivePlan: "auto" as const,
  creationPriority: "equilibrado" as const,
};

// Semilla 93 (antes 92): con el under en competencia (ME-07B v2 §5) la 92
// apenas elige trampa (5 de 236) y la comprobación de la trampa ejecutada
// necesita muestra; la 93 la elige 57 veces.
const r = playFullGame(
  buildGameInput({
    seed: 93,
    auditEnabled: true,
    home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...AUTO },
    away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...AUTO },
  }),
);
const coverage = r.audit!.decisions.filter((d) => d.point === "seleccion_cobertura");
const teamOfPossession = new Map(r.possessions.map((p) => [p.index, p.teamId]));

describe("ME-07B v2 §2.3: defensa auto con drop y trampa en competencia", () => {
  it("un partido natural usa más de una cobertura y cada elección tiene la menor concesión combinada", () => {
    const chosen = new Set(coverage.map((d) => d.chosenOptionId));
    expect(chosen.has("drop")).toBe(true);
    expect(chosen.has("trampa")).toBe(true);
    // ME-07B v2 §5: compiten drop, trampa, cambio y show; la elegida tiene la
    // menor concesión combinada entre las elegibles (empate: plan base).
    for (const d of coverage) {
      const eligible = d.options.filter((o) => o.values!.blendedValue !== null && o.reasonCode !== "coverage_tied_base_kept");
      const best = Math.min(...eligible.map((o) => o.values!.blendedValue as number));
      const picked = d.options.find((o) => o.id === d.chosenOptionId)!;
      expect(picked.values!.blendedValue as number).toBeCloseTo(best, 12);
      if (d.chosenOptionId === "trampa") expect(picked.values!.trapEligible).toBe(true);
    }
  });

  it("la trampa ejecutada llega cuando la proyectó la decisión (misma frontera, salida al preparar la pantalla)", () => {
    let checked = 0;
    for (const d of coverage.filter((x) => x.chosenOptionId === "trampa")) {
      const projected = d.options.find((o) => o.id === "trampa")!.values!.tD5TrapArrivalSeconds as number;
      const fact = r.events.find(
        // Misma posesión y misma fase: una falta en la trampa (ME-07B v2 §2.5)
        // puede cortar la fase antes del hecho y la siguiente trampa es otra decisión.
        (e) => e.kind === "trap_committed" && e.possessionIndex === d.possessionIndex && e.phaseIndex === d.phaseIndex && e.atMs >= d.atMs,
      );
      if (!fact) continue;
      expect(fact.atMs - d.atMs).toBeCloseTo(Math.round(projected * 1000), -1);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("aprende de lo visible: la primera decisión de cada defensa es la proyección pura y después pesa lo concedido", () => {
    const byDefense = new Map<string, typeof coverage>();
    for (const d of coverage) {
      const attacking = teamOfPossession.get(d.possessionIndex!)!;
      const list = byDefense.get(attacking) ?? [];
      list.push(d);
      byDefense.set(attacking, list);
    }
    expect(byDefense.size).toBe(2);
    for (const list of byDefense.values()) {
      const first = list[0]!.options.find((o) => o.id === "drop")!.values!;
      expect(first.observedUses).toBe(0);
      expect(first.blendedValue).toBe(first.concessionValue);
      const later = list[list.length - 1]!.options.map((o) => o.values!.observedUses as number);
      expect(later.reduce((a, b) => a + b, 0)).toBeGreaterThan(20);
    }
  });

  it("el partido termina en final con acta conciliada", () => {
    expect(r.stop.cause).toBe("final");
  });
});
