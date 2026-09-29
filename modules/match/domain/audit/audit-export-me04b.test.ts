import { describe, expect, it } from "vitest";
import { buildGameInput, type GameInput } from "../game/game-model";
import { playFullGame } from "../game/play-full-game";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { DefensiveCoverage } from "../lab/match-input";
import type { ReboundPriority } from "../sequence/tramo-model";
import { buildAuditExport, AUDIT_SCHEMA_VERSION } from "./build-audit-export";

/**
 * Pruebas discriminantes de ME-04B §4 (reparación de la trazabilidad),
 * separadas de las de ME-04A para no tocar retrospectivamente aquel
 * fichero. Comprueba, sobre un partido real, que `holderId`/`participants`
 * resuelven a IDs reales de pista (incluso tras sustitución), que
 * `factLink` apunta al hecho efectivamente emitido (no al instante de la
 * decisión) y que `rejectionReasons` ya no deja `{}` cuando el motivo real
 * vive en la opción elegida.
 */
const SC = SIERRA_CLARA.id;
const PA = PUERTO_AMBAR.id;
function input(
  seed: number,
  coverage: readonly [DefensiveCoverage, DefensiveCoverage] = ["drop", "drop"],
  priority: readonly [ReboundPriority, ReboundPriority] = ["proteger_balance", "proteger_balance"],
): GameInput {
  return buildGameInput({
    seed,
    home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, priority: priority[0], coverage: coverage[0] },
    away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: priority[1], coverage: coverage[1] },
    auditEnabled: true,
  });
}

describe("ME-04B (4.1): holderId/participants resuelven a IDs reales de pista", () => {
  it("el titular de cada decisión del bloqueo estaba realmente en pista en ese instante (SC11/SC12 incluidos tras sustituir a O5)", () => {
    // Barrido pequeño y representativo (prompt §6.1), no una campaña enorme:
    // basta un partido natural con sustituciones reales de ambos banquillos.
    const result = playFullGame(input(82));
    expect(result.substitutions.length).toBeGreaterThan(0);
    const onCourtEvents = result.events.filter((e) => e.onCourtIds.length === 10);
    function onCourtAt(atMs: number): ReadonlySet<string> {
      // El quinteto vigente en o antes de `atMs` (los hechos ya vienen ordenados).
      let last = onCourtEvents[0]!;
      for (const e of onCourtEvents) {
        if (e.atMs > atMs) break;
        last = e;
      }
      return new Set(last.onCourtIds);
    }
    const blockPoints = new Set([
      "lectura_bloqueo_o1",
      "lectura_segunda_o5",
      "lectura_trampa",
      "resolucion_tiro",
      "puerta_falta_sin_tiro",
    ]);
    let checked = 0;
    for (const d of result.audit!.decisions) {
      if (!blockPoints.has(d.point) || d.holderId === null) continue;
      const onCourt = onCourtAt(d.atMs);
      expect(onCourt.has(d.holderId)).toBe(true);
      for (const p of d.participants) expect(onCourt.has(p)).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
    // Al menos una decisión del bloqueo, en algún instante del partido, la
    // protagoniza un suplente real (no uno de los diez titulares del
    // quinteto inicial): confirma que el binding se actualiza de verdad tras
    // sustituir, incluidos los continuadores SC11/SC12 si llegan a entrar
    // por O5 (prompt §4.1), y no se queda fijo en los IDs iniciales.
    const starterIds = new Set(["O1", "O2", "O3", "O4", "O5", "D1", "D2", "D3", "D4", "D5"]);
    const substituteAppeared = result.audit!.decisions.some(
      (d) => blockPoints.has(d.point) && (d.participants.some((p) => !starterIds.has(p)) || (d.holderId !== null && !starterIds.has(d.holderId))),
    );
    expect(substituteAppeared).toBe(true);
  });
});

describe("ME-04B (4.2): factLink apunta al hecho efectivamente emitido", () => {
  it("el enlace de una decisión con pase_o5/invertir_o3 coincide con el instante real de `pass_released`, no con el de la decisión", () => {
    const result = playFullGame(input(82));
    const decisions = result.audit!.decisions.filter(
      (d) => d.point === "lectura_bloqueo_o1" && d.chosenOptionId === "pase_o5" && d.factLink !== null,
    );
    expect(decisions.length).toBeGreaterThan(0);
    let foundRealDelay = false;
    for (const d of decisions) {
      const fact = result.events.find((e) => e.kind === d.factLink!.kind && e.atMs === d.factLink!.atMs);
      // El hecho enlazado existe de verdad en la línea de tiempo, en su
      // propio instante (no inventado ni igualado por casualidad al de la
      // decisión).
      expect(fact).toBeDefined();
      if (d.factLink!.atMs !== d.atMs) foundRealDelay = true;
    }
    // Al menos una decisión de la muestra realmente tarda en materializarse
    // (el pase no sale en el mismo instante en que O1 decide): si todas
    // coincidieran exactamente, no se estaría comprobando la corrección del
    // enlace, solo una coincidencia.
    expect(foundRealDelay).toBe(true);
  });

  it("un enlace ausente nunca coincide por casualidad con el instante de la decisión", () => {
    const result = playFullGame(input(82));
    for (const d of result.audit!.decisions) {
      if (d.factLink === null) continue;
      const fact = result.events.find((e) => e.kind === d.factLink!.kind && e.atMs === d.factLink!.atMs);
      expect(fact).toBeDefined();
    }
  });
});

describe("ME-04B (4.3): rejectionReasons ya no deja byReasonCode vacío cuando el motivo está en la opción elegida", () => {
  it("`entrada_fase_transicion` y `puerta_falta_sin_tiro` registran su motivo elegido, no solo alternativas descartadas", () => {
    const result = playFullGame(input(82));
    const exported = buildAuditExport(result.input, result, { exportedAt: "2026-09-29T00:00:00.000Z" });
    expect(exported.schemaVersion).toBe(AUDIT_SCHEMA_VERSION);
    const summary = exported.result.summary.rejectionReasons!;
    const transition = summary.find((r) => r.point === "entrada_fase_transicion")!;
    if (transition.total > 0) {
      expect(Object.keys(transition.chosenByReasonCode).length).toBeGreaterThan(0);
    }
    const gate = summary.find((r) => r.point === "puerta_falta_sin_tiro")!;
    if (gate.total > 0) {
      expect(Object.keys(gate.chosenByReasonCode).length).toBeGreaterThan(0);
    }
  });
});
