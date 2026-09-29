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

describe("ME-06 (5): huella estable de equipo/partido y diferencias frente al fixture", () => {
  it("la misma foto produce la misma huella con distinta semilla; una edición real de atributos cambia la huella del equipo", () => {
    const seed1 = playFullGame(input(10, ["bloqueo_directo", "bloqueo_directo"]));
    const seed2 = playFullGame(input(11, ["bloqueo_directo", "bloqueo_directo"]));
    const audit1 = buildAuditExport(input(10, ["bloqueo_directo", "bloqueo_directo"]), seed1, { exportedAt: "2020-01-01T00:00:00.000Z" });
    const audit2 = buildAuditExport(input(11, ["bloqueo_directo", "bloqueo_directo"]), seed2, { exportedAt: "2099-01-01T00:00:00.000Z" });
    expect(audit1.run.matchFingerprint).toBe(audit2.run.matchFingerprint);
    expect(audit1.input.teams[0]!.fingerprint).toBe(audit2.input.teams[0]!.fingerprint);

    const editedHome = { ...SIERRA_CLARA.players[0]!, attributes: { ...SIERRA_CLARA.players[0]!.attributes, T01: 15 } };
    const editedRoster = [editedHome, ...SIERRA_CLARA.players.slice(1)];
    const editedGameInput = buildGameInput({
      seed: 10,
      home: { id: SC, name: SIERRA_CLARA.name, players: editedRoster, priority: "proteger_balance", coverage: "drop" },
      away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: "drop" },
      auditEnabled: true,
    });
    const editedResult = playFullGame(editedGameInput);
    const editedAudit = buildAuditExport(editedGameInput, editedResult, { exportedAt: "2020-01-01T00:00:00.000Z" });
    expect(editedAudit.input.teams[0]!.fingerprint).not.toBe(audit1.input.teams[0]!.fingerprint);
    expect(editedAudit.run.matchFingerprint).not.toBe(audit1.run.matchFingerprint);
  });

  it("fixtureDiff refleja la edición real frente al fixture, y es null para un jugador manual fuera del fixture", () => {
    const editedHome = { ...SIERRA_CLARA.players[0]!, attributes: { ...SIERRA_CLARA.players[0]!.attributes, T01: 15 } };
    const manualPlayer = { ...SIERRA_CLARA.players[SIERRA_CLARA.players.length - 1]!, id: "manual-01" };
    const editedRoster = [editedHome, ...SIERRA_CLARA.players.slice(1, -1), manualPlayer];
    const gameInput = buildGameInput({
      seed: 10,
      home: { id: SC, name: SIERRA_CLARA.name, players: editedRoster, priority: "proteger_balance", coverage: "drop" },
      away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: "drop" },
      auditEnabled: true,
    });
    const result = playFullGame(gameInput);
    const audit = buildAuditExport(gameInput, result, { exportedAt: "2020-01-01T00:00:00.000Z" });
    const home = audit.input.teams.find((t) => t.id === SC)!;
    const editedExport = home.roster.find((p) => p.id === editedHome.id)!;
    expect(editedExport.fixtureDiff).not.toBeNull();
    expect(editedExport.fixtureDiff!.T01).toBeGreaterThan(0);
    const manualExport = home.roster.find((p) => p.id === "manual-01")!;
    expect(manualExport.fixtureDiff).toBeNull();
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

describe("ME-06 (6.2): partido completo reproducible con la mano a mano, con sustituciones reales", () => {
  it("hechos, reloj, marcador, faltas, tiros, rebotes, quinteto y acta son válidos; IDs reales en auditoría tras sustituir, ninguna acción de quien no está en pista", () => {
    const gameInput = input(82, ["mano_a_mano_sin_balon", "mano_a_mano_sin_balon"], ["negar_primera_salida", "guardar_espacio"]);
    const result = playFullGame(gameInput);
    expect(result.substitutions.length).toBeGreaterThan(0);
    expect(["final", "guardian"]).toContain(result.stop.cause);

    const audit = buildAuditExport(gameInput, result, { exportedAt: new Date(0).toISOString() });
    // El acta reconcilia de verdad: nunca FGM>FGA, nunca puntos != marcador.
    expect(audit.result.reconciliation.every((c) => c.ok)).toBe(true);

    const onCourtEvents = result.events.filter((e) => e.onCourtIds.length === 10);
    function onCourtAt(atMs: number): ReadonlySet<string> {
      let last = onCourtEvents[0]!;
      for (const e of onCourtEvents) {
        if (e.atMs > atMs) break;
        last = e;
      }
      return new Set(last.onCourtIds);
    }
    const handoffPoints = new Set([
      "seleccion_familia",
      "entrada_mano_a_mano",
      "transferencia_mano_a_mano",
      "bloqueo_indirecto_o3",
      "lectura_mano_a_mano",
      "resolucion_tiro",
    ]);
    let checked = 0;
    for (const d of audit.decisions.records) {
      if (!handoffPoints.has(d.point) || d.holderId === null) continue;
      const onCourt = onCourtAt(d.atMs);
      expect(onCourt.has(d.holderId)).toBe(true);
      for (const p of d.participants) expect(onCourt.has(p)).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("una misma semilla y foto reproducen exactamente el mismo partido (hechos, marcador y reloj) — HF-002", () => {
    const gameInput = input(82, ["mano_a_mano_sin_balon", "bloqueo_directo"]);
    const first = playFullGame(gameInput);
    const second = playFullGame(gameInput);
    expect(second.finalScore).toEqual(first.finalScore);
    expect(second.events.length).toBe(first.events.length);
    expect(second.stop).toEqual(first.stop);
  });
});
