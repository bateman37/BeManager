import { describe, expect, it } from "vitest";
import { buildGameInput, type GameInput } from "../game/game-model";
import { playFullGame } from "../game/play-full-game";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { DefensiveCoverage, OffensivePlanChoice, OffBallDefensiveCall } from "../lab/match-input";
import { buildAuditExport, AUDIT_SCHEMA_VERSION } from "./build-audit-export";

/**
 * Pruebas discriminantes de ME-06 §5 (auditoría ampliada), separadas de
 * ME-04A/ME-04B para no tocarlas retrospectivamente. Verifica la foto por
 * equipo (plan ofensivo/orden sin balón) y el resumen por familia/equipo,
 * sin reinterpretar los archivos ME-04B-AUDIT-1 existentes.
 */
const SC = SIERRA_CLARA.id;
const PA = PUERTO_AMBAR.id;

function input(
  seed: number,
  plans: readonly [OffensivePlanChoice, OffensivePlanChoice],
  offBallCalls: readonly [OffBallDefensiveCall, OffBallDefensiveCall] = ["guardar_espacio", "guardar_espacio"],
  coverage: readonly [DefensiveCoverage, DefensiveCoverage] = ["drop", "drop"],
): GameInput {
  return buildGameInput({
    seed,
    home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, priority: "proteger_balance", coverage: coverage[0], offensivePlan: plans[0], offBallDefensiveCall: offBallCalls[0] },
    away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: coverage[1], offensivePlan: plans[1], offBallDefensiveCall: offBallCalls[1] },
    auditEnabled: true,
  });
}

describe("ME-06 (5): esquema versionado y foto por equipo", () => {
  it("bump de AUDIT_SCHEMA_VERSION a ME-06-AUDIT-1", () => {
    expect(AUDIT_SCHEMA_VERSION).toBe("ME-06-AUDIT-1");
  });

  it("cada equipo exporta su plan ofensivo y su orden de defensa sin balón reales, no inferidos", () => {
    const result = playFullGame(input(1, ["mano_a_mano_sin_balon", "bloqueo_directo"], ["negar_primera_salida", "guardar_espacio"]));
    const audit = buildAuditExport(input(1, ["mano_a_mano_sin_balon", "bloqueo_directo"], ["negar_primera_salida", "guardar_espacio"]), result);
    const home = audit.input.teams.find((t) => t.id === SC)!;
    const away = audit.input.teams.find((t) => t.id === PA)!;
    expect(home.offensivePlan).toBe("mano_a_mano_sin_balon");
    expect(home.offBallDefensiveCall).toBe("negar_primera_salida");
    expect(away.offensivePlan).toBe("bloqueo_directo");
    expect(away.offBallDefensiveCall).toBe("guardar_espacio");
  });
});

describe("ME-06 (5): result.summary.byFamily agrega entradas y tiros reales por familia y equipo", () => {
  it("con un equipo forzado a cada familia, byFamily solo atribuye a la familia realmente jugada por ese equipo", () => {
    const gameInput = input(2, ["bloqueo_directo", "mano_a_mano_sin_balon"]);
    const result = playFullGame(gameInput);
    const audit = buildAuditExport(gameInput, result, { exportedAt: new Date(0).toISOString() });
    expect(audit.result.summary.byFamily).not.toBeNull();
    const rows = audit.result.summary.byFamily!;
    const scRows = rows.filter((r) => r.teamId === SC);
    const paRows = rows.filter((r) => r.teamId === PA);
    expect(scRows.every((r) => r.family === "bloqueo_directo")).toBe(true);
    expect(paRows.every((r) => r.family === "mano_a_mano_sin_balon")).toBe(true);
    // Al menos algunas entradas reales de cada equipo en su propia familia.
    expect(scRows.reduce((n, r) => n + r.entries, 0)).toBeGreaterThan(0);
    expect(paRows.reduce((n, r) => n + r.entries, 0)).toBeGreaterThan(0);
    // FGA/FGM nunca negativos ni FGM > FGA en ninguna fila real.
    for (const r of rows) {
      expect(r.fgm2).toBeLessThanOrEqual(r.fga2);
      expect(r.fgm3).toBeLessThanOrEqual(r.fga3);
    }
  });

  it("sin auditoría activada, byFamily es null (coste cero, mismo comportamiento que antes de ME-06)", () => {
    const gameInput = buildGameInput({
      seed: 2,
      home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, priority: "proteger_balance", coverage: "drop" },
      away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: "drop" },
      auditEnabled: false,
    });
    const result = playFullGame(gameInput);
    const audit = buildAuditExport(gameInput, result, { exportedAt: new Date(0).toISOString() });
    expect(audit.result.summary.byFamily).toBeNull();
  });

  it("declara el hueco de cobertura de los FGA fuera de ataque organizado (transición/segunda oportunidad/segunda entrada)", () => {
    const gameInput = input(2, ["bloqueo_directo", "mano_a_mano_sin_balon"]);
    const result = playFullGame(gameInput);
    const audit = buildAuditExport(gameInput, result, { exportedAt: new Date(0).toISOString() });
    const gap = audit.decisions.coverageGaps.find((g) => g.point === "seleccion_familia");
    expect(gap).toBeDefined();
    expect(gap!.possessionsAffected).toBeGreaterThan(0);
  });
});

describe("ME-06: la observación ON/OFF de auditoría no cambia hechos, marcador ni RNG", () => {
  it("mismo partido con y sin auditoría produce el mismo marcador final", () => {
    const withAudit = playFullGame(input(3, ["auto", "mano_a_mano_sin_balon"]));
    const withoutAudit = playFullGame({ ...input(3, ["auto", "mano_a_mano_sin_balon"]), auditEnabled: false });
    expect(withAudit.finalScore).toEqual(withoutAudit.finalScore);
    expect(withAudit.stop.cause).toBe(withoutAudit.stop.cause);
  });
});
