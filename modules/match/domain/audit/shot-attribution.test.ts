import { describe, expect, it } from "vitest";
import { attributeShots, buildAuditExport } from "./build-audit-export";
import type { AuditDecisionRecord } from "./audit-types";
import type { GameResult } from "../game/game-model";
import { buildGameInput } from "../game/game-model";
import { playFullGame } from "../game/play-full-game";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";

/**
 * ME-07B v2 §2.6: cada FGA apunta a su acción efectiva anterior (misma
 * posesión y fase, instante ≤ al del tiro) y a la familia elegida antes que
 * él, no a la última etiqueta de su fase.
 */
function decision(id: number, atMs: number, point: AuditDecisionRecord["point"], chosen: string): AuditDecisionRecord {
  return {
    id,
    atMs,
    point,
    possessionIndex: 1,
    phaseIndex: 1,
    holderId: "O1",
    participants: [],
    options: [],
    chosenOptionId: chosen,
    factLink: null,
    rngStateBefore: null,
    rngStateAfter: null,
  };
}

describe("ME-07B v2 §2.6: atribución causal de cada tiro", () => {
  it("con dos familias en la misma fase, cada tiro va a la familia y lectura anteriores a él", () => {
    const fga = (atMs: number, shooter: string) => ({
      kind: "field_goal_attempt",
      atMs,
      possessionIndex: 1,
      phaseIndex: 1,
      possessionTeamId: "A",
      actors: [shooter],
      positions: [{ playerId: shooter, position: { x: 25, y: 7.5 } }],
      detail: { shotType: "close_finish", made: false },
    });
    const result = {
      events: [fga(3000, "P5"), fga(9000, "P3")],
      possessions: [{ index: 1, teamId: "A", phases: [{ index: 1, entry: "ataque_organizado" }] }],
    } as unknown as GameResult;
    const decisions = [
      decision(1, 0, "seleccion_familia", "bloqueo_directo"),
      decision(2, 1500, "lectura_bloqueo_o1", "pase_o5"),
      decision(3, 5000, "seleccion_familia", "mano_a_mano_sin_balon"),
      decision(4, 7000, "lectura_mano_a_mano", "pase_o3"),
    ];
    const shots = attributeShots(result, decisions);
    expect(shots.map((s) => [s.shooterId, s.family, s.causingDecision?.chosenOptionId])).toEqual([
      ["P5", "bloqueo_directo", "pase_o5"],
      ["P3", "mano_a_mano_sin_balon", "pase_o3"],
    ]);
  });

  it("en un partido real todo FGA tiene registro, tirador real y causas anteriores al tiro; transición sin familia", () => {
    const common = { priority: "proteger_balance" as const, coverage: "auto" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const };
    const input = buildGameInput({
      seed: 93,
      auditEnabled: true,
      home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...common },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common },
    });
    const result = playFullGame(input);
    const exp = buildAuditExport(input, result, { exportedAt: "test" });
    const shots = exp.result.summary.shots!;
    const fgas = result.events.filter((e) => e.kind === "field_goal_attempt");
    expect(shots).toHaveLength(fgas.length);
    shots.forEach((s, i) => {
      expect(s.shooterId).toBe(fgas[i]!.actors[0]);
      if (s.causingDecision) expect(s.causingDecision.atMs).toBeLessThanOrEqual(s.atMs);
      if (s.category !== "familia") expect(s.family).toBeNull();
    });
    expect(shots.some((s) => s.category === "familia")).toBe(true);
    expect(shots.some((s) => s.category === "segunda_oportunidad")).toBe(true);
    // Invariante de conciliación: atribuidos + sin atribuir = FGA por equipo.
    for (const teamId of [SIERRA_CLARA.id, PUERTO_AMBAR.id]) {
      const attributed = exp.result.summary.byFamily!.filter((r) => r.teamId === teamId).reduce((a, r) => a + r.fga2 + r.fga3, 0);
      const un = exp.result.summary.byFamilyUnattributed!.find((r) => r.teamId === teamId);
      const box = result.box.teams[teamId]!;
      expect(attributed + (un ? un.fga2 + un.fga3 : 0)).toBe(box.fga2 + box.fga3);
    }
  });
});
