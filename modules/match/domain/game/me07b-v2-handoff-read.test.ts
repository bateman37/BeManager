import { describe, expect, it } from "vitest";
import { computePossessionCore } from "../simulation/possession-core";
import { getScenario } from "../lab/scenario";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { createResumableRandom } from "../random/seeded-random";
import { createRecordingAuditCollector } from "../audit/audit-collector";
import { CATCH_AND_SHOOT_PREP_SECONDS, CLOSE_FINISH_PREP_SECONDS } from "../lab/lab-0-1-parameters";
import type { MatchInput, OffBallDefensiveCall } from "../lab/match-input";

/**
 * ME-07B v2 §2.2/§2.4, sesión v2-7: la lectura de la mano a mano central
 * valora cada tiro con la oposición que resultará de la misma geometría que
 * después lo resuelve (`resolveShotAttempt`), no con un umbral aparte. Antes,
 * `pase_o3` y `continuar_o4` se valoraban como triples sin oposición (o con
 * oposición 1 solo si D4 ayudaba) y se ejecutaban siempre con el defensor ya
 * colocado en el punto de tiro (la lectura espera a que D3 llegue al corte y
 * el punto del bloqueo de O4 está a 0,8 m de donde ayuda D4): 199 de 200
 * primeros tiros de la foto de las 20 con oposición 1 frente a 1,17 puntos
 * prometidos por la lectura. Como la proyección de la familia es esa misma
 * lectura en seco, el error pasaba al comparador.
 */
const SCENARIO = getScenario("drop_con_ayuda");
const BINDING = Object.fromEntries([...SCENARIO.offense, ...SCENARIO.defense].map((s) => [s.playerId, s.playerId]));
function start(): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const s of [...SCENARIO.offense, ...SCENARIO.defense]) out[s.playerId] = s.initialPosition;
  return out;
}

function run(seed: number, offBallDefensiveCall: OffBallDefensiveCall) {
  const audit = createRecordingAuditCollector();
  const input: MatchInput = {
    scenarioId: "drop_con_ayuda",
    coverage: "drop",
    seed,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: "LAB-0.3",
    offensePlayers: SIERRA_CLARA.players,
    defensePlayers: PUERTO_AMBAR.players,
    offensivePlan: "mano_a_mano_sin_balon",
    offBallDefensiveCall,
  };
  const core = computePossessionCore(input, {
    audit,
    trackPositionHistory: true,
    linked: {
      binding: BINDING,
      startPositions: start(),
      shotClockMs: 20_000,
      gameClockMs: 400_000,
      rng: createResumableRandom(seed),
      attackingPriority: "proteger_balance",
      entry: { kind: "organized_set" },
      rules: { deferFreeThrows: true, ordinaryFouls: true, secondEntryAllowed: true },
    },
  });
  return { core, decisions: audit.snapshot().decisions };
}

const SHOT_OF: Record<string, { receiver: string | null; points: 2 | 3; prep: number }> = {
  pase_o3: { receiver: "O3", points: 3, prep: CATCH_AND_SHOOT_PREP_SECONDS },
  continuar_o4: { receiver: "O4", points: 3, prep: CATCH_AND_SHOOT_PREP_SECONDS },
  finalizar_portador: { receiver: null, points: 2, prep: CLOSE_FINISH_PREP_SECONDS },
};

describe("ME-07B v2 (v2-7): la lectura de la mano a mano valora el tiro con la regla que lo resuelve", () => {
  it("con recepción limpia, el valor de la vía elegida es puntos × la probabilidad que usa el tiro (oposición geométrica real)", () => {
    const checked: string[] = [];
    for (const call of ["guardar_espacio", "negar_primera_salida"] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const { core, decisions } = run(seed, call);
        const read = decisions.find((d) => d.point === "lectura_mano_a_mano");
        const shot = decisions.find((d) => d.point === "resolucion_tiro");
        if (!read || !shot || !read.chosenOptionId || !(read.chosenOptionId in SHOT_OF)) continue;
        const spec = SHOT_OF[read.chosenOptionId]!;
        // Control incómodo (LAB-0.1) retrasa la preparación: entonces el cierre puede cambiar y no se compara.
        const prepared = core.timeline.find((e) => e.kind === "shot_prepared")!;
        if (spec.receiver) {
          const received = core.timeline.find((e) => e.kind === "pass_received" && e.actors[0] === spec.receiver)!;
          if (Math.abs((prepared.atMs - received.atMs) / 1000 - spec.prep) > 0.002) continue;
        }
        const p = Number(/Probabilidad de conversión usada: ([0-9]+\.[0-9]+)/.exec(shot.note ?? "")![1]);
        const chosen = read.options.find((o) => o.id === read.chosenOptionId)!;
        expect(chosen.values?.situationalValue as number, `${call} semilla ${seed} ${read.chosenOptionId}`).toBeCloseTo(spec.points * p, 2);
        checked.push(read.chosenOptionId);
      }
    }
    // La muestra incluye las dos vías exteriores de la entrega, no solo una.
    expect(checked.filter((id) => id === "pase_o3" || id === "continuar_o4").length).toBeGreaterThanOrEqual(10);
  });
});
