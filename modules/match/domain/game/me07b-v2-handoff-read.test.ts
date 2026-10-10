import { describe, expect, it } from "vitest";
import { computePossessionCore } from "../simulation/possession-core";
import { getScenario } from "../lab/scenario";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { createResumableRandom } from "../random/seeded-random";
import { createRecordingAuditCollector } from "../audit/audit-collector";
import { CATCH_AND_SHOOT_PREP_SECONDS, CLOSE_FINISH_PREP_SECONDS } from "../lab/lab-0-1-parameters";
import type { DefensiveCoverage, MatchInput, OffBallDefensiveCall } from "../lab/match-input";

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

function run(seed: number, offBallDefensiveCall: OffBallDefensiveCall, coverage: DefensiveCoverage = "drop") {
  const audit = createRecordingAuditCollector();
  const input: MatchInput = {
    scenarioId: "drop_con_ayuda",
    coverage,
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

/**
 * Sesión v2-8 (rediseño de la entrega): las vías son otras (aro y parada de O2,
 * triple al recibir, continuación de O5, indirecto con el tipo de tiro de su
 * zona real, y con la entrega negada aro de O5 y puerta de atrás), pero la regla
 * es la misma: el valor de la vía elegida es puntos × la probabilidad que usa
 * el tiro, salvo un control incómodo tras un pase (LAB-0.1), que retrasa la
 * preparación. Se comprueba con las tres respuestas de D5.
 */
const PASS_PREP: Record<string, { receiver: string; prep: number }> = {
  pase_o3: { receiver: "O3", prep: CATCH_AND_SHOOT_PREP_SECONDS },
  continuar_o4: { receiver: "O4", prep: CATCH_AND_SHOOT_PREP_SECONDS },
  continuacion_o5: { receiver: "O5", prep: CLOSE_FINISH_PREP_SECONDS },
  puerta_atras_o2: { receiver: "O2", prep: CLOSE_FINISH_PREP_SECONDS },
};
const SHOTS = new Set(["finalizar_portador", "parada_o2", "triple_o2", "finalizar_o5", ...Object.keys(PASS_PREP)]);

describe("ME-07B v2 (v2-7, v2-8): la lectura de la mano a mano valora el tiro con la regla que lo resuelve", () => {
  it("con recepción limpia, el valor de la vía elegida es puntos × la probabilidad que usa el tiro (oposición geométrica real)", () => {
    const checked: string[] = [];
    for (const coverage of ["drop", "cambio", "show"] as const) {
      for (const call of ["guardar_espacio", "negar_primera_salida"] as const) {
        for (let seed = 1; seed <= 25; seed++) {
          const { core, decisions } = run(seed, call, coverage);
          const read = decisions.find((d) => d.point === "lectura_mano_a_mano");
          const shot = decisions.find((d) => d.point === "resolucion_tiro");
          if (!read || !shot || !read.chosenOptionId || !SHOTS.has(read.chosenOptionId)) continue;
          const prepared = core.timeline.find((e) => e.kind === "shot_prepared")!;
          const pass = PASS_PREP[read.chosenOptionId];
          if (pass) {
            const received = core.timeline.find((e) => e.kind === "pass_received" && e.actors[0] === pass.receiver && e.atMs <= prepared.atMs)!;
            if (Math.abs((prepared.atMs - received.atMs) / 1000 - pass.prep) > 0.002) continue;
          }
          const points = /lanzamiento de tres/.test(prepared.text) ? 3 : 2;
          const p = Number(/Probabilidad de conversión usada: ([0-9]+\.[0-9]+)/.exec(shot.note ?? "")![1]);
          const chosen = read.options.find((o) => o.id === read.chosenOptionId)!;
          expect(chosen.values?.situationalValue as number, `${coverage} ${call} semilla ${seed} ${read.chosenOptionId}`).toBeCloseTo(points * p, 2);
          checked.push(read.chosenOptionId);
        }
      }
    }
    // La muestra cubre vías de las tres respuestas: aro de O2, continuación de O5 y entrega negada.
    expect(new Set(checked).size).toBeGreaterThanOrEqual(3);
    expect(checked.length).toBeGreaterThanOrEqual(100);
  });
});
