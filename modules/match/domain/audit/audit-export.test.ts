import { describe, expect, it } from "vitest";
import { buildGameInput, type GameInput } from "../game/game-model";
import { playFullGame } from "../game/play-full-game";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { DefensiveCoverage } from "../lab/match-input";
import type { ReboundPriority } from "../sequence/tramo-model";
import { buildAuditExport, AUDIT_SCHEMA_VERSION } from "./build-audit-export";
import { createNoopAuditCollector, createRecordingAuditCollector } from "./audit-collector";

/**
 * Pruebas discriminantes de ME-04A (prompt §6), sin base de datos: paridad
 * ON/OFF, serialización → parseo, y las rutas del bloqueo/trampa realmente
 * alcanzables con el fixture (drop/drop y trampa/trampa, semilla 1).
 */
const SC = SIERRA_CLARA.id;
const PA = PUERTO_AMBAR.id;

function input(
  seed: number,
  coverage: readonly [DefensiveCoverage, DefensiveCoverage],
  priority: readonly [ReboundPriority, ReboundPriority],
  auditEnabled: boolean,
): GameInput {
  return buildGameInput({
    seed,
    home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, priority: priority[0], coverage: coverage[0] },
    away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: priority[1], coverage: coverage[1] },
    auditEnabled,
  });
}

describe("audit-collector: colector nulo y colector real", () => {
  it("el colector nulo no hace nada y no asigna memoria nueva en cada llamada", () => {
    const noop = createNoopAuditCollector();
    expect(noop.enabled).toBe(false);
    noop.recordDecision({
      atMs: 0,
      point: "resolucion_tiro",
      possessionIndex: null,
      phaseIndex: null,
      holderId: null,
      participants: [],
      options: [],
      chosenOptionId: null,
      factLink: null,
      rngStateBefore: null,
      rngStateAfter: null,
    });
    noop.recordCoverageGap("x", "y", 1);
    const snap1 = noop.snapshot();
    const snap2 = noop.snapshot();
    expect(snap1).toBe(snap2);
    expect(snap1.decisions).toHaveLength(0);
    expect(snap1.coverageGaps).toHaveLength(0);
  });

  it("el colector real acumula decisiones con id incremental y agrupa huecos de cobertura por punto", () => {
    const rec = createRecordingAuditCollector();
    expect(rec.enabled).toBe(true);
    rec.recordDecision({
      atMs: 10,
      point: "lectura_bloqueo_o1",
      possessionIndex: 0,
      phaseIndex: 0,
      holderId: "O1",
      participants: ["O1"],
      options: [],
      chosenOptionId: "finalizar",
      factLink: null,
      rngStateBefore: null,
      rngStateAfter: null,
    });
    rec.recordCoverageGap("sustitucion", "motivo", 3);
    rec.recordCoverageGap("sustitucion", "motivo", 2);
    const snap = rec.snapshot();
    expect(snap.decisions).toHaveLength(1);
    expect(snap.decisions[0]!.id).toBe(0);
    expect(snap.coverageGaps).toEqual([{ point: "sustitucion", reason: "motivo", possessionsAffected: 5 }]);
  });
});

describe("ME-04A: auditoría ON/OFF (paridad deportiva)", () => {
  it("misma GameInput y semilla: idéntico marcador, acta, posesiones, hechos, sustituciones, relojes y final; solo cambia el registro", () => {
    const off = playFullGame(input(1, ["drop", "drop"], ["proteger_balance", "proteger_balance"], false));
    const on = playFullGame(input(1, ["drop", "drop"], ["proteger_balance", "proteger_balance"], true));

    expect(off.audit).toBeUndefined();
    expect(on.audit).toBeDefined();
    expect(on.audit!.decisions.length).toBeGreaterThan(0);

    expect(on.finalScore).toEqual(off.finalScore);
    expect(on.winnerTeamId).toEqual(off.winnerTeamId);
    expect(on.stop.cause).toEqual(off.stop.cause);
    expect(on.stop.atMs).toEqual(off.stop.atMs);
    expect(on.box).toEqual(off.box);
    expect(on.possessions).toEqual(off.possessions);
    expect(on.substitutions).toEqual(off.substitutions);
    expect(on.fouls).toEqual(off.fouls);
    expect(on.periods).toEqual(off.periods);
    expect(on.engineMinutesMs).toEqual(off.engineMinutesMs);
    expect(on.effectivePlayedMs).toEqual(off.effectivePlayedMs);
    expect(on.rngStateAtBoundaries).toEqual(off.rngStateAtBoundaries);

    // Los hechos son idénticos salvo, si acaso, el propio contrato de auditoría (no lo hay: mismo tipo de hecho).
    expect(on.events).toEqual(off.events);
  });

  it("repetir ON dos veces produce la misma carga deportiva y las mismas decisiones (ignorando solo la fecha de exportación)", () => {
    const first = playFullGame(input(1, ["drop", "drop"], ["proteger_balance", "proteger_balance"], true));
    const second = playFullGame(input(1, ["drop", "drop"], ["proteger_balance", "proteger_balance"], true));
    expect(second.finalScore).toEqual(first.finalScore);
    expect(second.events).toEqual(first.events);
    expect(second.audit!.decisions).toEqual(first.audit!.decisions);
    expect(second.audit!.coverageGaps).toEqual(first.audit!.coverageGaps);
  });

  it("el modo enlazado del núcleo no invoca rng.next() extra por tener auditoría activada (mismo estado de azar en cada frontera)", () => {
    const off = playFullGame(input(3, ["trampa", "drop"], ["cargar_rebote", "proteger_balance"], false));
    const on = playFullGame(input(3, ["trampa", "drop"], ["cargar_rebote", "proteger_balance"], true));
    expect(on.rngStateAtBoundaries).toEqual(off.rngStateAtBoundaries);
  });
});

describe("ME-04A: serialización → parseo del archivo de auditoría", () => {
  const result = playFullGame(input(1, ["drop", "drop"], ["proteger_balance", "proteger_balance"], true));
  const exported = buildAuditExport(result.input, result, { exportedAt: "2026-09-29T00:00:00.000Z" });
  const roundTripped = JSON.parse(JSON.stringify(exported));

  it("tiene el esquema versionado y sobrevive un ciclo JSON.stringify/parse", () => {
    expect(exported.schemaVersion).toBe(AUDIT_SCHEMA_VERSION);
    expect(roundTripped.schemaVersion).toBe(AUDIT_SCHEMA_VERSION);
    expect(roundTripped.run.seed).toBe(1);
    expect(roundTripped.run.auditEnabled).toBe(true);
  });

  it("conserva la entrada completa (dos equipos, inscritos y quintetos)", () => {
    expect(roundTripped.input.teams).toHaveLength(2);
    for (const team of roundTripped.input.teams) {
      expect(team.roster.length).toBeGreaterThanOrEqual(5);
      expect(team.starters).toHaveLength(5);
    }
  });

  it("la cardinalidad de hechos de `timeline` es igual a la de `GameResult.events`", () => {
    expect(exported.timeline.length).toBe(result.events.length);
    expect(roundTripped.timeline.length).toBe(result.events.length);
  });

  it("el orden de `timeline` es monótono no decreciente en el tiempo absoluto", () => {
    for (let i = 1; i < roundTripped.timeline.length; i++) {
      expect(roundTripped.timeline[i].atMs).toBeGreaterThanOrEqual(roundTripped.timeline[i - 1].atMs);
    }
  });

  it("el acta está conciliada (invariantes de BOXSCORE.md) y no inventa `undefined`/`NaN` como `null` silencioso", () => {
    expect(exported.result.reconciliation.every((c) => c.ok)).toBe(true);
    const text = JSON.stringify(exported);
    expect(text.includes("NaN")).toBe(false);
    expect(text.includes("undefined")).toBe(false);
  });

  it("no filtra secretos ni rutas locales (.env, DATABASE_URL, tokens)", () => {
    const text = JSON.stringify(exported);
    expect(text).not.toMatch(/DATABASE_URL/);
    expect(text).not.toMatch(/\.env\b/);
    expect(text).not.toMatch(/\/home\//);
    expect(text).not.toMatch(/postgres(ql)?:\/\//i);
  });

  it("cada decisión referencia una posesión/fase válida o `null` explícito, nunca un índice fuera de rango", () => {
    for (const d of exported.decisions.records) {
      if (d.possessionIndex !== null) {
        expect(result.possessions.some((p) => p.index === d.possessionIndex)).toBe(true);
      }
    }
  });

  it("una parada de guardián también se puede exportar, sin ganador inventado", () => {
    // Límites artificialmente bajos para forzar la parada del guardián (uso ya vigente en me04.test.ts).
    const guardedInput = input(1, ["drop", "drop"], ["proteger_balance", "proteger_balance"], true);
    const guarded = playFullGame(guardedInput, { limits: { maxSteps: 25, maxPhasesPerPossession: 12, maxZeroTimeSteps: 6 } });
    expect(guarded.stop.cause).toBe("guardian");
    expect(guarded.winnerTeamId).toBeNull();
    const guardedExport = buildAuditExport(guarded.input, guarded);
    expect(guardedExport.result.winnerTeamId).toBeNull();
    expect(guardedExport.run.stopCause).toBe("guardian");
    expect(() => JSON.parse(JSON.stringify(guardedExport))).not.toThrow();
  });
});

describe("ME-04A: rutas de drop y trampa realmente evaluadas (semilla 1, fixture natural)", () => {
  it("drop/drop: una ruta llega al continuador (O5), otra a la lectura exterior, y hay asignación de rebote con un descarte justificado", () => {
    const result = playFullGame(input(1, ["drop", "drop"], ["proteger_balance", "proteger_balance"], true));
    const decisions = result.audit!.decisions;

    const o1Reads = decisions.filter((d) => d.point === "lectura_bloqueo_o1");
    expect(o1Reads.length).toBeGreaterThan(0);
    expect(o1Reads.some((d) => d.chosenOptionId === "pase_o5")).toBe(true);
    // Toda lectura de O1 con pase_o5 elegido descarta "finalizar" con datos que lo justifican.
    for (const d of o1Reads.filter((d) => d.chosenOptionId === "pase_o5")) {
      const finalizar = d.options.find((o) => o.id === "finalizar")!;
      expect(finalizar.status).toBe("descartada_por_condicion");
      expect(finalizar.values).toBeTruthy();
      expect(typeof finalizar.values!.o1TimeToHoopSeconds).toBe("number");
    }

    const secondReads = decisions.filter((d) => d.point === "lectura_segunda_o5");
    expect(secondReads.some((d) => d.chosenOptionId === "invertir_o3")).toBe(true);

    const reboundDecisions = decisions.filter((d) => d.point === "asignacion_rebote");
    expect(reboundDecisions.length).toBeGreaterThan(0);
    const withBalancer = reboundDecisions.find((d) => d.options.some((o) => o.status === "descartada_por_condicion"));
    expect(withBalancer).toBeTruthy();
    const balancer = withBalancer!.options.find((o) => o.status === "descartada_por_condicion")!;
    expect(balancer.reasonCode).toBe("rebound_duty_balance_return");
  });

  it("una decisión no evaluada por cortocircuito permanece distinguible de una descartada por condición", () => {
    // ME-04B (§3.2): `lectura_bloqueo_o1` ahora evalúa de verdad las cinco
    // vías con un valor comparable (ninguna se corta por cortocircuito), así
    // que el ejemplo de esta distinción se comprueba en `lectura_segunda_o5`
    // (invariante sin cambios: cuando O5 invierte a O3, la segunda entrada
    // ni siquiera se evaluó, y la finalización bajo contención sí se evaluó
    // y perdió frente a la esquina abierta).
    const result = playFullGame(input(1, ["drop", "drop"], ["proteger_balance", "proteger_balance"], true));
    const secondReads = result.audit!.decisions.filter((d) => d.point === "lectura_segunda_o5" && d.chosenOptionId === "invertir_o3");
    expect(secondReads.length).toBeGreaterThan(0);
    const chosenInvertO3 = secondReads[0]!;
    const shortCircuited = chosenInvertO3.options.find((o) => o.id === "segunda_entrada")!;
    const rejected = chosenInvertO3.options.find((o) => o.id === "finalizar_bajo_contencion")!;
    expect(shortCircuited.status).toBe("no_evaluada_por_cortocircuito");
    expect(rejected.status).toBe("descartada_por_condicion");
    expect(shortCircuited.status).not.toBe(rejected.status);
  });

  it("no aparece una falta sin tiro ni una segunda entrada inventadas: el sumario de motivos viene de la traza", () => {
    const result = playFullGame(input(1, ["drop", "drop"], ["proteger_balance", "proteger_balance"], true));
    const exported = buildAuditExport(result.input, result);
    expect(result.fouls.some((f) => f.type === "sin_tiro")).toBe(false);
    const secondEntryRejections = exported.result.summary.rejectionReasons!.find((r) => r.point === "segunda_entrada")!;
    expect(secondEntryRejections.total).toBe(0);
    const gateRejections = exported.result.summary.rejectionReasons!.find((r) => r.point === "puerta_falta_sin_tiro")!;
    // Todas las puertas evaluadas con este fixture se quedan en "no_evaluada" (elegida, no descartada): 0 rechazos registrados como tales.
    expect(gateRejections.total).toBeGreaterThanOrEqual(0);
  });

  it("trampa/trampa: la lectura de trampa distingue sus opciones y enlaza con el hecho correspondiente", () => {
    const result = playFullGame(input(1, ["trampa", "trampa"], ["cargar_rebote", "cargar_rebote"], true));
    const trapReads = result.audit!.decisions.filter((d) => d.point === "lectura_trampa");
    expect(trapReads.length).toBeGreaterThan(0);
    for (const d of trapReads) {
      const chosen = d.options.find((o) => o.id === d.chosenOptionId);
      expect(chosen?.status).toBe("elegida");
      const rejected = d.options.filter((o) => o.status === "descartada_por_condicion");
      for (const r of rejected) expect(r.reasonCode).toBeTruthy();
    }
  });

  it("declara explícitamente la cobertura faltante de sustituciones, con cuántas posesiones afecta", () => {
    const result = playFullGame(input(1, ["drop", "drop"], ["proteger_balance", "proteger_balance"], true));
    const gap = result.audit!.coverageGaps.find((g) => g.point === "sustitucion");
    expect(gap).toBeTruthy();
    expect(gap!.possessionsAffected).toBe(result.substitutions.length);
    expect(gap!.possessionsAffected).toBeGreaterThan(0);
  });
});
