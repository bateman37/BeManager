import { describe, expect, it } from "vitest";
import { buildGameInput, type GameInput } from "../game/game-model";
import { playFullGame } from "../game/play-full-game";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { buildAuditExport } from "./build-audit-export";

/**
 * Regresión de ME-07A §5.1: corrige el desfase confirmado entre el
 * `phaseIndex` que usan las decisiones (`seleccion_familia`,
 * `organizacion_creador`, ...) y el que llevan los hechos reales
 * (`field_goal_attempt`). Antes de esta corrección, `linked-run.ts` emitía
 * las decisiones con `possession.phases.length - 1` (0-based) y los hechos
 * con `possession.phases.length` (1-based, igual que `phase.index`), así que
 * `buildFamilySummary` nunca casaba un tiro con la decisión de familia de su
 * propia fase.
 */
const SC = SIERRA_CLARA.id;
const PA = PUERTO_AMBAR.id;

function input(seed: number): GameInput {
  return buildGameInput({
    seed,
    home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, priority: "proteger_balance", coverage: "drop", offensivePlan: "bloqueo_directo" },
    away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: "drop", offensivePlan: "mano_a_mano_sin_balon" },
    auditEnabled: true,
  });
}

describe("ME-07A (§5.1): phaseIndex coherente entre decisiones y hechos", () => {
  it("ninguna decisión de familia comparte clave posesión:fase con un hecho de otro equipo", () => {
    const gameInput = input(2);
    const result = playFullGame(gameInput);
    const decisions = result.audit!.decisions;
    const familyDecisions = decisions.filter((d) => d.point === "seleccion_familia" && d.possessionIndex !== null && d.phaseIndex !== null);
    expect(familyDecisions.length).toBeGreaterThan(0);

    const teamOfPlayer = new Map<string, string>();
    for (const team of gameInput.teams) for (const p of team.roster) teamOfPlayer.set(p.id, team.id);

    const decisionTeamByKey = new Map<string, string>();
    for (const d of familyDecisions) {
      const key = `${d.possessionIndex}:${d.phaseIndex}`;
      const team = d.holderId ? teamOfPlayer.get(d.holderId) : undefined;
      if (team) decisionTeamByKey.set(key, team);
    }

    let crossTeamMatches = 0;
    for (const ev of result.events) {
      if (ev.kind !== "field_goal_attempt") continue;
      const key = `${ev.possessionIndex}:${ev.phaseIndex}`;
      const decisionTeam = decisionTeamByKey.get(key);
      if (decisionTeam && decisionTeam !== ev.possessionTeamId) crossTeamMatches += 1;
    }
    expect(crossTeamMatches).toBe(0);
  });

  it("por equipo, FGA atribuidos (byFamily) + FGA sin atribuir (byFamilyUnattributed) = FGA del acta, separando dos y tres puntos", () => {
    const gameInput = input(2);
    const result = playFullGame(gameInput);
    const audit = buildAuditExport(gameInput, result, { exportedAt: new Date(0).toISOString() });
    const byFamily = audit.result.summary.byFamily!;
    const unattributed = audit.result.summary.byFamilyUnattributed!;

    for (const teamId of [SC, PA]) {
      const attributedFga2 = byFamily.filter((r) => r.teamId === teamId).reduce((n, r) => n + r.fga2, 0);
      const attributedFga3 = byFamily.filter((r) => r.teamId === teamId).reduce((n, r) => n + r.fga3, 0);
      const gapRow = unattributed.find((r) => r.teamId === teamId) ?? { fga2: 0, fga3: 0 };
      const teamBox = audit.result.summary.byTeam.find((t) => t.teamId === teamId)!;
      expect(attributedFga2 + gapRow.fga2).toBe(teamBox.fga2);
      expect(attributedFga3 + gapRow.fga3).toBe(teamBox.fga3);
    }
  });

  it("cada equipo forzado a una familia distinta atribuye sus propios FGA reales solo a esa familia (bloqueo_directo vs mano_a_mano_sin_balon)", () => {
    const gameInput = input(2);
    const result = playFullGame(gameInput);
    const audit = buildAuditExport(gameInput, result, { exportedAt: new Date(0).toISOString() });
    const rows = audit.result.summary.byFamily!;
    expect(rows.filter((r) => r.teamId === SC).every((r) => r.family === "bloqueo_directo")).toBe(true);
    expect(rows.filter((r) => r.teamId === PA).every((r) => r.family === "mano_a_mano_sin_balon")).toBe(true);
    expect(rows.some((r) => r.teamId === SC && r.fga2 + r.fga3 > 0)).toBe(true);
    expect(rows.some((r) => r.teamId === PA && r.fga2 + r.fga3 > 0)).toBe(true);
  });
});
