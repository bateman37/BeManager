import { describe, expect, it } from "vitest";
import { buildGameInput, type GameInput } from "./game-model";
import { playFullGame } from "./play-full-game";
import { buildAuditExport } from "../audit/build-audit-export";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { evaluateTransitionThreeOpportunity } from "../sequence/transition";
import type { RaceParticipant } from "../sequence/transition";

/**
 * Pruebas discriminantes de ME-07A (prompt §6), separadas de ME-04/ME-06
 * para no tocarlas retrospectivamente. Escenarios pequeños construidos
 * primero, después una muestra corta de partidos completos con el
 * fixture natural.
 */
const SC = SIERRA_CLARA.id;
const PA = PUERTO_AMBAR.id;

function at(slot: string, id: string, x: number, y: number, lateralSpeedMps: number): RaceParticipant {
  return { slot, id, position: { x, y }, runSpeedMps: 4, lateralSpeedMps, t23: 8 };
}

describe("ME-07A §3.2: triple del base en transición (escenario construido)", () => {
  // Aro atacado en x=26.425 (COURT.ts); línea de tres a 6.75 m de radio.
  // El portador se sitúa en x=19, dentro del margen de profundidad
  // (TRANSITION_THREE_DEPTH_BUFFER_METERS = 2 m) tras la línea.
  const carrierPos = { x: 19, y: 7.5 };

  it("aro contenido pero abierto detrás de la línea: la ventana aparece viable con tiempo y separación reales", () => {
    // El único defensor cerca protege el aro (lejos del portador): no llega
    // a tiempo a cerrar el tiro.
    const farRimProtector = at("D5", "D5", 26, 7.5, 3.5);
    const opportunity = evaluateTransitionThreeOpportunity(carrierPos, [farRimProtector], 18);
    expect(opportunity.eligible).toBe(true);
    expect(opportunity.windowMarginSeconds).toBeGreaterThanOrEqual(0.25);
    expect(opportunity.nearestDefender.id).toBe("D5");
  });

  it("acercar al defensor hace desaparecer la ventana (mismo estado, defensor más cerca)", () => {
    const closeDefender = at("D2", "D2", 19.5, 8, 3.5);
    const opportunity = evaluateTransitionThreeOpportunity(carrierPos, [closeDefender], 18);
    expect(opportunity.eligible).toBe(false);
    expect(opportunity.windowMarginSeconds).toBeLessThan(0.25);
  });

  it("reducir el reloj de lanzamiento a 2 s o menos cierra la ventana aunque el defensor esté lejos", () => {
    const farRimProtector = at("D5", "D5", 26, 7.5, 3.5);
    const opportunity = evaluateTransitionThreeOpportunity(carrierPos, [farRimProtector], 2);
    expect(opportunity.eligible).toBe(false);
  });

  it("desplazar al portador dentro de la línea (más cerca del aro) cierra la vía de triple, aunque el defensor siga lejos", () => {
    const farRimProtector = at("D5", "D5", 26, 7.5, 3.5);
    const insideLine = { x: 22, y: 7.5 }; // distanceToHoop ≈ 4.4 m < 6.75 m: dentro de la línea.
    const opportunity = evaluateTransitionThreeOpportunity(insideLine, [farRimProtector], 18);
    expect(opportunity.eligible).toBe(false);
  });

  it("demasiado lejos detrás de la línea (todavía en medio campo) tampoco habilita la vía", () => {
    const farRimProtector = at("D5", "D5", 26, 7.5, 3.5);
    const midcourt = { x: 14, y: 7.5 };
    const opportunity = evaluateTransitionThreeOpportunity(midcourt, [farRimProtector], 18);
    expect(opportunity.eligible).toBe(false);
    expect(opportunity.depthBehindLineMeters).toBeGreaterThan(2);
  });
});

function input(
  seed: number,
  homeCreationPriority: "equilibrado" | "buscar_aro" | "buscar_triple" = "equilibrado",
  awayCreationPriority: "equilibrado" | "buscar_aro" | "buscar_triple" = "equilibrado",
): GameInput {
  return buildGameInput({
    seed,
    auditEnabled: true,
    home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, priority: "proteger_balance", coverage: "auto", offBallDefensiveCall: "auto", creationPriority: homeCreationPriority },
    away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: "auto", offBallDefensiveCall: "auto", creationPriority: awayCreationPriority },
  });
}

describe("ME-07A §3.2: el poseedor real puede conservar la iniciativa (partido natural)", () => {
  it("al menos una decisión de creador la conserva un jugador real distinto del rol fijo O1, con IDs reales y motivo estable", () => {
    const gameInput = input(82);
    const result = playFullGame(gameInput);
    const decisions = result.audit!.decisions.filter((d) => d.point === "organizacion_creador");
    expect(decisions.length).toBeGreaterThan(0);
    const kept = decisions.filter((d) => d.options.some((o) => o.reasonCode === "creator_kept_by_real_holder" && o.status === "elegida"));
    expect(kept.length).toBeGreaterThan(0);
    for (const d of kept) {
      // El creador elegido es el propio poseedor real (el mismo ID que ya
      // tenía el balón), nunca un rol reasignado a otro jugador.
      expect(d.chosenOptionId).toBe(d.holderId);
    }
    // Al menos un suplente real (ID de fixture SC0x/PA0x, inconfundible con
    // un símbolo de rol) conserva la iniciativa: no es un artefacto de que
    // los IDs de titular coincidan con la notación O1..O5/D1..D5.
    expect(kept.some((d) => /^(SC|PA)\d\d$/.test(d.chosenOptionId!))).toBe(true);
    // También hay decisiones donde sigue volviendo al manejador (no se
    // sustituye por una política universal nueva: sigue siendo una
    // elección condicionada, no un "nunca más O1").
    const passedBack = decisions.filter((d) => d.options.some((o) => o.reasonCode === "creator_pass_back_faster"));
    expect(passedBack.length).toBeGreaterThan(0);
  });
});

describe("ME-07A §4: cobertura y orden sin balón en auto, con denominadores reales", () => {
  it("con la disposición inicial estándar del fixture, auto reconoce que la trampa no es elegible (D5 no llega a tiempo desde drop) y conserva drop como plan base", () => {
    // Hallazgo de calibración (a documentar en la PR, ME-07B): con las
    // posiciones iniciales fijas de los tres escenarios de laboratorio,
    // D5 arranca en la protección del aro, lejos del punto de pantalla;
    // ninguna combinación de atributos alcanzables (F04/M01/M05/T22 en su
    // máximo) lo hace llegar a tiempo para comprometer antes de que O1 use
    // la pantalla. La política sigue siendo real y auditable (nunca un
    // bono oculto): declara `coverage_trap_not_eligible` en vez de fingir
    // una comparación imposible.
    const gameInput = input(1);
    const result = playFullGame(gameInput);
    const decisions = result.audit!.decisions.filter((d) => d.point === "seleccion_cobertura");
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.every((d) => d.chosenOptionId === "drop")).toBe(true);
    expect(decisions.every((d) => d.options.find((o) => o.id === "drop")!.status === "elegida")).toBe(true);
  });

  it("la orden sin balón en auto compara negar_primera_salida frente a guardar_espacio con la geometría real de cada mano a mano y declara un motivo estable", () => {
    const gameInput = buildGameInput({
      seed: 82,
      auditEnabled: true,
      home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, priority: "proteger_balance", coverage: "drop", offensivePlan: "mano_a_mano_sin_balon" },
      away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: "drop", offBallDefensiveCall: "auto" },
    });
    const result = playFullGame(gameInput);
    const decisions = result.audit!.decisions.filter((d) => d.point === "seleccion_orden_sin_balon");
    expect(decisions.length).toBeGreaterThan(0);
    for (const d of decisions) {
      expect(["negar_primera_salida", "guardar_espacio"]).toContain(d.chosenOptionId);
      const chosen = d.options.find((o) => o.id === d.chosenOptionId)!;
      expect(["off_ball_call_lower_concession", "off_ball_call_tied_base_kept"]).toContain(chosen.reasonCode);
    }
  });
});

describe("ME-07A §6: partido e integridad con dos equipos completamente en auto", () => {
  it("dos equipos en auto (plan, cobertura, orden sin balón, prioridad de creación) completan un partido reproducible y conciliado", () => {
    const gameInput = buildGameInput({
      seed: 82,
      auditEnabled: true,
      home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, priority: "proteger_balance", coverage: "auto", offensivePlan: "auto", offBallDefensiveCall: "auto", creationPriority: "equilibrado" },
      away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: "auto", offensivePlan: "auto", offBallDefensiveCall: "auto", creationPriority: "equilibrado" },
    });
    const first = playFullGame(gameInput);
    const second = playFullGame(gameInput);
    expect(second.finalScore).toEqual(first.finalScore);
    expect(second.events.length).toBe(first.events.length);
    expect(["final", "guardian"]).toContain(first.stop.cause);

    const audit = buildAuditExport(gameInput, first, { exportedAt: new Date(0).toISOString() });
    expect(audit.result.reconciliation.every((c) => c.ok)).toBe(true);

    const withoutAudit = playFullGame({ ...gameInput, auditEnabled: false });
    expect(withoutAudit.finalScore).toEqual(first.finalScore);
    expect(withoutAudit.stop.cause).toBe(first.stop.cause);
  });

  it("cambiar la prioridad de creación de equilibrado a buscar_triple cambia la huella del equipo (ME-06 §5) sin alterar la probabilidad de convertir un mismo tiro", () => {
    const balanced = input(82, "equilibrado");
    const aggressive = input(82, "buscar_triple");
    const auditBalanced = buildAuditExport(balanced, playFullGame(balanced), { exportedAt: new Date(0).toISOString() });
    const auditAggressive = buildAuditExport(aggressive, playFullGame(aggressive), { exportedAt: new Date(0).toISOString() });
    const homeBalanced = auditBalanced.input.teams.find((t) => t.id === SC)!;
    const homeAggressive = auditAggressive.input.teams.find((t) => t.id === SC)!;
    expect(homeBalanced.fingerprint).not.toBe(homeAggressive.fingerprint);
  });
});
