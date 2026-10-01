import { describe, expect, it } from "vitest";
import { computePossessionCore } from "./possession-core";
import { LAB_ROSTER_FIXTURE } from "../players/lab-roster-fixture";
import { getScenario } from "../lab/scenario";
import type { MatchInput } from "../lab/match-input";
import { LAB_0_3_PARAMETERS_VERSION } from "../lab/lab-0-3-parameters";
import { createSeededRandom } from "../random/seeded-random";
import { createRecordingAuditCollector } from "../audit/audit-collector";
import { shotProbability, CLOSE_FINISH_BASE_PROBABILITY } from "../lab/lab-0-1-parameters";
import type { PlayerProfile } from "../players/player-profile";
import type { Point2D } from "../geometry/point";

/**
 * Pruebas discriminantes del diagnóstico y ajuste acotado de ME-04B que pide
 * ME-06 §2, separadas de las de ME-04B para no editarlas retrospectivamente
 * (`DOCUMENTATION_STANDARD.md`). Cada caso aísla el mecanismo concreto que
 * cambió: (1) "finalizar" ya no se descarta por una carrera de reloj cruda,
 * sino por la misma comprobación geométrica de contención real que ya usan
 * D3/O5 (solape de radios corporales sobre la posición reconstruida en el
 * instante real de liberación); (2) "pase_o5", cuando la contención de D3 es
 * estimada, ya no puntúa con el valor de una inversión a O3 todavía
 * dependiente de una segunda decisión y una segunda proyección defensiva.
 */
function withAttribute(
  players: readonly PlayerProfile[],
  id: string,
  attributes: Record<string, number>,
): PlayerProfile[] {
  return players.map((p) => (p.id === id ? { ...p, attributes: { ...p.attributes, ...attributes } } : p));
}

describe("ME-06 (2a): «finalizar» se descarta por contención geométrica real, no por una carrera de reloj cruda", () => {
  it("caso construido: D5 arranca lejos del aro y no llega a tiempo de contener el remate real de O1 — la vía es viable y se elige sin oposición", () => {
    const scenario = getScenario("drop_con_ayuda");
    const startPositions: Record<string, Point2D> = {};
    for (const slot of [...scenario.offense, ...scenario.defense]) {
      startPositions[slot.playerId] = slot.initialPosition;
    }
    // O1 se deja junto al bloqueo (cerca del aro) y D5 se aleja al lado
    // débil: un caso de frontera construido (ME-06 §2), no una de las ocho
    // semillas naturales, para demostrar que la vía puede ganar cuando la
    // geometría real lo permite.
    startPositions.O1 = { x: 23.0, y: 7.5 };
    startPositions.O5 = { x: 24.0, y: 7.5 };
    startPositions.D5 = { x: 10.0, y: 7.5 };

    const binding = Object.fromEntries(
      [...scenario.offense, ...scenario.defense].map((s) => [s.playerId, s.playerId]),
    );
    let offense = LAB_ROSTER_FIXTURE[0]!.players;
    offense = withAttribute(offense, "O1", { T01: 15, F01: 15 });
    offense = withAttribute(offense, "O5", { T01: 1, T09: 1 });
    offense = withAttribute(offense, "O3", { T04: 1 });
    let defense = LAB_ROSTER_FIXTURE[1]!.players;
    defense = withAttribute(defense, "D5", { F04: 8, T23: 8 });

    const input: MatchInput = {
      scenarioId: "drop_con_ayuda",
      coverage: "drop",
      seed: 1,
      rulesetVersion: "FIBA-2026",
      labParametersVersion: LAB_0_3_PARAMETERS_VERSION,
      offensePlayers: offense,
      defensePlayers: defense,
    };
    const audit = createRecordingAuditCollector();
    computePossessionCore(input, {
      audit,
      linked: {
        binding,
        startPositions,
        shotClockMs: scenario.initialShotClockMs,
        gameClockMs: scenario.initialGameClockMs,
        rng: createSeededRandom(1),
        attackingPriority: "proteger_balance",
        entry: { kind: "organized_set" },
      },
    });

    const firstRead = audit.snapshot().decisions.find((d) => d.point === "lectura_bloqueo_o1")!;
    expect(firstRead.chosenOptionId).toBe("finalizar");
    const finalizar = firstRead.options.find((o) => o.id === "finalizar")!;
    expect(finalizar.status).toBe("elegida");
    expect(finalizar.values?.d5TrulyBlockingFinish).toBe(false);
    expect((finalizar.values?.finishMarginSeconds as number) >= 0.25).toBe(true);
    expect(finalizar.values?.situationalValue).toBeCloseTo(
      2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, 15, 0),
      6,
    );
  });

  it("caso construido: D5 llega apretado (gana la carrera pero por menos de 0,25 s) — sigue viable, pero contestada, no descartada por defecto", () => {
    const scenario = getScenario("drop_con_ayuda");
    const startPositions: Record<string, Point2D> = {};
    for (const slot of [...scenario.offense, ...scenario.defense]) {
      startPositions[slot.playerId] = slot.initialPosition;
    }
    startPositions.O1 = { x: 23.0, y: 7.5 };
    startPositions.O5 = { x: 24.0, y: 7.5 };
    // A esta distancia y con estos atributos, D5 llega unas pocas décimas
    // después del instante real de liberación de O1: ni lo bloquea (no hay
    // solape de radios corporales) ni deja margen abierto (>=0,25 s).
    startPositions.D5 = { x: 21.7, y: 7.5 };

    const binding = Object.fromEntries(
      [...scenario.offense, ...scenario.defense].map((s) => [s.playerId, s.playerId]),
    );
    let offense = LAB_ROSTER_FIXTURE[0]!.players;
    offense = withAttribute(offense, "O1", { T01: 15, F01: 15 });
    offense = withAttribute(offense, "O5", { T01: 1, T09: 1 });
    offense = withAttribute(offense, "O3", { T04: 1 });
    let defense = LAB_ROSTER_FIXTURE[1]!.players;
    defense = withAttribute(defense, "D5", { F04: 15, T23: 8 });

    const input: MatchInput = {
      scenarioId: "drop_con_ayuda",
      coverage: "drop",
      seed: 1,
      rulesetVersion: "FIBA-2026",
      labParametersVersion: LAB_0_3_PARAMETERS_VERSION,
      offensePlayers: offense,
      defensePlayers: defense,
    };
    const audit = createRecordingAuditCollector();
    computePossessionCore(input, {
      audit,
      linked: {
        binding,
        startPositions,
        shotClockMs: scenario.initialShotClockMs,
        gameClockMs: scenario.initialGameClockMs,
        rng: createSeededRandom(1),
        attackingPriority: "proteger_balance",
        entry: { kind: "organized_set" },
      },
    });

    const firstRead = audit.snapshot().decisions.find((d) => d.point === "lectura_bloqueo_o1")!;
    const finalizar = firstRead.options.find((o) => o.id === "finalizar")!;
    expect(finalizar.values?.d5TrulyBlockingFinish).toBe(false);
    const margin = finalizar.values?.finishMarginSeconds as number;
    expect(margin).toBeGreaterThanOrEqual(0);
    expect(margin).toBeLessThan(0.25);
    expect(finalizar.values?.situationalValue).toBeCloseTo(
      2 * shotProbability(CLOSE_FINISH_BASE_PROBABILITY, 15, 1),
      6,
    );
  });
});

describe("ME-06 (2b): «pase_o5» ya no puntúa una inversión futura a O3 cuando D3 contendría de verdad la recepción", () => {
  it("caso construido: D3 llega rápido a proteger el roll (estimación de contención real) — el valor coincide con el tiro contenido de O5, no con un triple asumido de O3", () => {
    // D3 con velocidad/reconocimiento/protección interior máximos: llega a
    // tiempo de contener de verdad la recepción de O5 en el roll, según la
    // propia estimación pura de la primera lectura (mismo mecanismo que
    // reevalúa la segunda lectura más abajo, ME-04B §3.2).
    const defense = withAttribute(
      withAttribute(withAttribute(LAB_ROSTER_FIXTURE[1]!.players, "D3", { F04: 15 }), "D3", { M01: 15 }),
      "D3",
      { M05: 15, T23: 15 },
    );
    const input: MatchInput = {
      scenarioId: "drop_con_ayuda",
      coverage: "drop",
      seed: 1,
      rulesetVersion: "FIBA-2026",
      labParametersVersion: LAB_0_3_PARAMETERS_VERSION,
      offensePlayers: LAB_ROSTER_FIXTURE[0]!.players,
      defensePlayers: defense,
    };
    const audit = createRecordingAuditCollector();
    computePossessionCore(input, { audit, trackPositionHistory: true });
    const firstRead = audit.snapshot().decisions.find((d) => d.point === "lectura_bloqueo_o1")!;
    const pase_o5 = firstRead.options.find((o) => o.id === "pase_o5")!;
    expect(pase_o5.values?.estimatedD3TrulyContaining).toBe(true);
    // ME-07B v2 §2.4 sustituye la regla de ME-06 (2b) («contenido ⇒ valor
    // del tiro contenido»): O1 proyecta la **misma lectura del receptor**
    // que O5 hará al recibir (aro, floater o inversión, cada una frente a su
    // mejor cierre real y con el riesgo del pase de inversión), así que el
    // valor de la vía es exactamente el máximo de esa lectura en la misma
    // frontera, no un triple futuro asumido sin riesgo.
    const secondRead = audit.snapshot().decisions.find((d) => d.point === "lectura_segunda_o5");
    if (pase_o5.status === "elegida" && secondRead) {
      const best = Math.max(
        ...secondRead.options.map((o) => (typeof o.values?.situationalValue === "number" ? (o.values.situationalValue as number) : -Infinity)),
      );
      expect(pase_o5.values?.situationalValue).toBeCloseTo(best, 6);
    }
    // La opción ya no puede llevar el campo retirado de la proyección de una
    // segunda inversión a O3 (ME-06 §2): esa cadena de dos pases ya no forma
    // parte del valor de esta vía.
    expect(pase_o5.values?.estimatedCornerMarginSeconds).toBeUndefined();
  });
});
