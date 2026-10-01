import { describe, expect, it, vi } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput, type GameInput, type GameResult } from "./game-model";
import { buildAuditExport } from "../audit/build-audit-export";
import { projectOrganizedOpportunity } from "../simulation/possession-core";
import { DELAY_TARGETS } from "../lab/lab-0-10-parameters";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { ACTIVE_ATTRIBUTE_IDS, RATING_MAX, type Rating } from "../players/attribute";
import type { PlayerProfile } from "../players/player-profile";
import type { ObservedOutcome } from "../lab/lab-0-4-parameters";
import type { DefensiveCoverage } from "../lab/match-input";

// Partidos completos con auditoría: más margen que el límite por defecto bajo carga paralela.
vi.setConfig({ testTimeout: 120_000 });

/**
 * ME-07B v2 §2.2, sesión v2-6: comparación de fichas en `auto` sobre la misma
 * base. (1) La colocación (ficha) se elige por su valor proyectado; la banda de
 * empate de LAB-0.3 solo desempata asignaciones de creador/bloqueador dentro
 * de una ficha, por la primera lectura real y sin bajar del mejor valor de
 * otra ficha. (2) Delay compite en `auto` y se valora frente a lo que la
 * defensa ha hecho ante la entrega, no ante pantallas. (3) Estados que la
 * nueva variedad alcanza: el receptor del roll sin reloj.
 */
const AUTO = {
  priority: "proteger_balance" as const,
  coverage: "auto" as const,
  offBallDefensiveCall: "auto" as const,
  offensivePlan: "auto" as const,
  creationPriority: "equilibrado" as const,
};

function plus(players: readonly PlayerProfile[], amount: number): PlayerProfile[] {
  return players.map((p) => {
    const attributes = { ...p.attributes };
    for (const id of ACTIVE_ATTRIBUTE_IDS) attributes[id] = Math.min(RATING_MAX, attributes[id] + amount) as Rating;
    return { ...p, attributes };
  });
}

function natural(seed: number, sierra: readonly PlayerProfile[]): { gi: GameInput; r: GameResult } {
  const gi = buildGameInput({
    seed,
    auditEnabled: true,
    home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: sierra, ...AUTO },
    away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...AUTO },
  });
  return { gi, r: playFullGame(gi) };
}

describe("ME-07B v2 §2.2 (v2-6): la ficha se elige por valor y Delay compite en auto", () => {
  // Foto Sierra +5, semilla 103 (de las 20): Puerto ataca contra una defensa
  // mejorada que concede menos al bloqueo y Delay llega a valer más que las tres
  // colocaciones del bloqueo (32 veces en ese partido; ninguna en la foto seed).
  const { gi, r } = natural(103, plus(SIERRA_CLARA.players, 5));
  const team = new Map(r.possessions.map((p) => [p.index, p.teamId]));
  const placements = r.audit!.decisions.filter((d) => d.point === "colocacion_bloqueo" && d.options.length > 1);

  it("en cada organización la ficha elegida es la de mayor valor proyectado, con su primera lectura auditada", () => {
    expect(placements.length).toBeGreaterThan(150);
    for (const d of placements) {
      expect(d.options.map((o) => o.id)).toEqual(["central", "lateral", "horns", "delay"]);
      const chosen = d.options.find((o) => o.status === "elegida")!;
      for (const o of d.options) {
        expect(chosen.values!.projectedValue as number).toBeGreaterThanOrEqual(o.values!.projectedValue as number);
        expect(o.values!.firstReadSeconds as number).toBeGreaterThan(o.values!.readySeconds as number);
        if (o !== chosen) expect(["placement_projected_value_lower", "placement_tied_first_read_later"]).toContain(o.reasonCode);
      }
      expect(chosen.reasonCode).toBe("placement_projected_value_higher");
    }
  });

  it("Delay se elige solo cuando vale más, y entonces se juega su ficha con sus lecturas", () => {
    const delay = placements.filter((d) => d.chosenOptionId === "delay");
    expect(delay.length).toBeGreaterThan(0);
    for (const d of delay) {
      expect(team.get(d.possessionIndex!)).toBe(PUERTO_AMBAR.id);
      const v = (id: string) => d.options.find((o) => o.id === id)!.values!.projectedValue as number;
      expect(v("delay")).toBeGreaterThan(Math.max(v("central"), v("lateral"), v("horns")));
      // Su primera lectura llega más de 1 s después de situarse: pase de entrada y entrega antes de leer.
      const delayValues = d.options.find((o) => o.id === "delay")!.values!;
      expect((delayValues.firstReadSeconds as number) - (delayValues.readySeconds as number)).toBeGreaterThan(1);
    }
    const delayPhases = new Set(delay.map((d) => `${d.possessionIndex}:${d.phaseIndex}`));
    const fams = r.audit!.decisions.filter((d) => d.point === "seleccion_familia" && delayPhases.has(`${d.possessionIndex}:${d.phaseIndex}`));
    expect(fams.length).toBeGreaterThan(0);
    for (const f of fams) expect(f.options.find((o) => o.id === f.chosenOptionId)!.values!.cardId).toBe("delay_mano_a_mano");
    const reads = r.audit!.decisions.filter((d) => (d.point === "lectura_delay" || d.point === "lectura_delay_pivote") && delayPhases.has(`${d.possessionIndex}:${d.phaseIndex}`));
    expect(reads.length).toBeGreaterThan(0);
    expect(r.stop.cause).toBe("final");
    expect(buildAuditExport(gi, r, { exportedAt: "test" }).result.reconciliation.filter((c) => !c.ok)).toEqual([]);
  });

  it("auditoría ON/OFF deja idéntica la secuencia deportiva", () => {
    const off = playFullGame({ ...gi, auditEnabled: false });
    expect(off.finalScore).toEqual(r.finalScore);
    expect(off.events.length).toBe(r.events.length);
  });
});

describe("ME-07B v2 §2.2 (v2-6): Delay se valora frente a lo visto ante la entrega, no ante pantallas", () => {
  const binding = Object.fromEntries(Object.keys(DELAY_TARGETS).map((k) => [k, k]));
  const project = (screens: Partial<Record<DefensiveCoverage, ObservedOutcome>>, handoffs?: Partial<Record<DefensiveCoverage, ObservedOutcome>>) =>
    projectOrganizedOpportunity(
      { scenarioId: "drop_con_ayuda", coverage: "auto", seed: 1, rulesetVersion: "FIBA-2026", labParametersVersion: "LAB-0.2", offensePlayers: SIERRA_CLARA.players, defensePlayers: PUERTO_AMBAR.players, offensivePlan: "auto", screenPlacement: "delay" },
      { binding, startPositions: { ...DELAY_TARGETS }, shotClockMs: 20_000, gameClockMs: 400_000, attackingPriority: "proteger_balance", observations: { offenseByFamily: {}, defenseByCoverage: screens, ...(handoffs ? { defenseByHandoffResponse: handoffs } : {}) } },
    );

  it("las coberturas vistas ante pantallas no cambian Delay; las respuestas vistas ante la entrega sí", () => {
    const none = project({});
    expect(none.plan).toBe("mano_a_mano_sin_balon");
    expect(none.breakdown.coverageWeight_drop).toBe(1);
    // Antes de la sesión v2-6, 20 cambios ante pantallas pesaban como «cambiar la entrega».
    expect(project({ cambio: { uses: 20, points: 20 }, show: { uses: 20, points: 20 } })).toEqual(none);
    // 20 entregas saltadas (registradas como `show`): pesa «saltar la entrega», que aquí concede más que hundirse.
    const jumped = project({}, { show: { uses: 20, points: 20 } });
    expect(jumped.breakdown.coverageWeight_show as number).toBeGreaterThan(0.7);
    expect(jumped.breakdown.valueAgainst_saltar_entrega as number).toBeGreaterThan(none.breakdown.valueAgainst_hundirse as number);
    expect(jumped.value).toBeGreaterThan(none.value);
    // La primera lectura de Delay (pase de entrada y entrega) llega después de situarse.
    expect(none.decisionSeconds).toBeGreaterThan(1);
  });
});

describe("ME-07B v2 §2.4 (v2-6): receptor del roll sin reloj", () => {
  // Estado raro (1 de 1.200 partidos drop/drop, semillas 1–1200): la primera es la 1134.
  it("si el reloj de lanzamiento expira antes de cualquier vía del receptor, se audita su lectura sin opción y hay violación (semilla 1134, drop/drop)", () => {
    const gi = buildGameInput({
      seed: 1134,
      auditEnabled: true,
      home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, priority: "proteger_balance", coverage: "drop" },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: "drop" },
    });
    const r = playFullGame(gi);
    expect(r.stop.cause).toBe("final");
    const d = r.audit!.decisions.find((x) => x.point === "lectura_segunda_o5" && x.chosenOptionId === null)!;
    expect(d).toBeDefined();
    for (const o of d.options) {
      expect(o.reasonCode).toBe("receiver_option_not_viable");
      if (typeof o.values!.readySeconds === "number") expect(o.values!.readySeconds).toBeGreaterThan(o.values!.shotClockSeconds as number);
    }
    const after = r.events.filter((e) => e.possessionIndex === d.possessionIndex && e.atMs >= d.atMs);
    const violation = after.find((e) => e.kind === "shot_clock_violation")!;
    expect(violation).toBeDefined();
    expect(after.some((e) => e.kind === "field_goal_attempt" && e.atMs <= violation.atMs)).toBe(false);
    expect(buildAuditExport(gi, r, { exportedAt: "test" }).result.reconciliation.filter((c) => !c.ok)).toEqual([]);
  });
});
