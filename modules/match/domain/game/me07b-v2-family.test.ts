import { describe, expect, it } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput } from "./game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";

/**
 * ME-07B v2 §2.2: el selector `auto` compara las familias proyectando cada
 * una, en seco, hasta su primera lectura real. Prueba discriminante: la vía
 * que el selector valoró para el bloqueo directo tiene exactamente el mismo
 * valor situacional y el mismo instante que la primera lectura que luego se
 * ejecuta en esa misma posesión y fase (misma frontera, mismos costes), y la
 * proyección no consume azar (auditoría ON/OFF idéntica).
 */
const AUTO = {
  priority: "proteger_balance" as const,
  coverage: "auto" as const,
  offBallDefensiveCall: "auto" as const,
  offensivePlan: "auto" as const,
  creationPriority: "equilibrado" as const,
};

function play(seed: number, auditEnabled = true) {
  return playFullGame(
    buildGameInput({
      seed,
      auditEnabled,
      home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...AUTO },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...AUTO },
    }),
  );
}

describe("ME-07B v2 §2.2: selección de familia sobre la misma frontera que su ejecución", () => {
  const r = play(92);
  const decisions = r.audit!.decisions;

  it("el valor proyectado del bloqueo directo coincide con su primera lectura real", () => {
    let matched = 0;
    for (const fam of decisions.filter((d) => d.point === "seleccion_familia" && d.chosenOptionId === "bloqueo_directo")) {
      const read = decisions.find(
        (d) => d.point === "lectura_bloqueo_o1" && d.possessionIndex === fam.possessionIndex && d.phaseIndex === fam.phaseIndex,
      );
      if (!read) continue;
      const v = fam.options.find((o) => o.id === "bloqueo_directo")!.values!;
      const best = read.options.find((o) => o.id === v.bestReadOption)!;
      expect(best.values!.situationalValue).toBeCloseTo(v.bestReadRawValue as number, 12);
      expect(read.atMs - fam.atMs).toBeCloseTo(Math.round((v.projectedDecisionSeconds as number) * 1000), -1);
      expect(v.situationalValue as number).toBeCloseTo((v.bestReadRawValue as number) * (v.bestReadCompletion as number), 12);
      matched += 1;
    }
    expect(matched).toBeGreaterThan(100);
  });

  it("la mano a mano también se proyecta hasta su lectura, con el riesgo del pase de entrada", () => {
    const fams = decisions.filter((d) => d.point === "seleccion_familia");
    const dho = fams.map((d) => d.options.find((o) => o.id === "mano_a_mano_sin_balon")!.values!);
    expect(dho.every((v) => v.bestReadOption === null || (v.bestReadCompletion as number) < 1)).toBe(true);
  });

  it("proyectar no consume azar ni añade hechos: auditoría ON/OFF produce la misma secuencia", () => {
    const off = play(92, false);
    expect(off.finalScore).toEqual(r.finalScore);
    expect(off.events.map((e) => [e.kind, e.atMs, e.text])).toEqual(r.events.map((e) => [e.kind, e.atMs, e.text]));
  });
});
