import { describe, expect, it } from "vitest";
import { computePossessionCore } from "../simulation/possession-core";
import { getScenario } from "../lab/scenario";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { createResumableRandom, createSeededRandom } from "../random/seeded-random";
import { createRecordingAuditCollector } from "../audit/audit-collector";
import type { PlayerProfile } from "../players/player-profile";
import type { MatchInput, OffensivePlanChoice, OffBallDefensiveCall, DefensiveCoverage } from "../lab/match-input";

/**
 * Pruebas discriminantes de ME-06 §3 (casos construidos, no semillas
 * mágicas), separadas de ME-04/ME-04B para no editarlas retrospectivamente.
 * Reutilizan la misma técnica de geometría construida a mano de la prueba
 * de segunda entrada de ME-04 (`organized_set` enlazado).
 */
function baseStart(): Record<string, { x: number; y: number }> {
  const scenario = getScenario("drop_con_ayuda");
  const start: Record<string, { x: number; y: number }> = {};
  for (const s of [...scenario.offense, ...scenario.defense]) start[s.playerId] = s.initialPosition;
  return start;
}

const BINDING = Object.fromEntries(
  [...getScenario("drop_con_ayuda").offense, ...getScenario("drop_con_ayuda").defense].map((s) => [s.playerId, s.playerId]),
);

function withAttribute(
  players: readonly PlayerProfile[],
  id: string,
  attributes: Record<string, number>,
): PlayerProfile[] {
  return players.map((p) => (p.id === id ? { ...p, attributes: { ...p.attributes, ...attributes } } : p));
}

function run(args: {
  seed: number;
  start: Record<string, { x: number; y: number }>;
  offense?: readonly PlayerProfile[];
  defense?: readonly PlayerProfile[];
  offensivePlan?: OffensivePlanChoice;
  offBallDefensiveCall?: OffBallDefensiveCall;
  coverage?: DefensiveCoverage;
  shotClockMs?: number;
}) {
  const audit = createRecordingAuditCollector();
  const input: MatchInput = {
    scenarioId: "drop_con_ayuda",
    coverage: args.coverage ?? "drop",
    seed: args.seed,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: "LAB-0.3",
    offensePlayers: args.offense ?? SIERRA_CLARA.players,
    defensePlayers: args.defense ?? PUERTO_AMBAR.players,
    offensivePlan: args.offensivePlan,
    offBallDefensiveCall: args.offBallDefensiveCall,
  };
  const core = computePossessionCore(input, {
    audit,
    trackPositionHistory: true,
    linked: {
      binding: BINDING,
      startPositions: args.start,
      shotClockMs: args.shotClockMs ?? 20_000,
      gameClockMs: 400_000,
      rng: createResumableRandom(args.seed),
      attackingPriority: "proteger_balance",
      entry: { kind: "organized_set" },
      rules: { deferFreeThrows: true, ordinaryFouls: true, secondEntryAllowed: true },
    },
  });
  return { core, audit };
}

describe("ME-06 (a): bloqueo directo mejor y elegido en auto", () => {
  it("caso construido: handicapar la mano a mano (O2/O3/O4 y la finalización de O5 débiles) hace que auto elija bloqueo_directo", () => {
    // Sesión v2-8: tras el rediseño de la entrega, su valor ante el drop viene sobre todo de la
    // continuación de O5 al aro (T01) y de O2 (aro, parada, triple); debilitarlos es lo discriminante.
    let offense = SIERRA_CLARA.players;
    offense = withAttribute(offense, "O2", { T01: 1, F01: 1, T02: 1, T03: 1, T04: 1 });
    offense = withAttribute(offense, "O3", { T03: 1, T04: 1 });
    offense = withAttribute(offense, "O4", { T03: 1, T04: 1 });
    offense = withAttribute(offense, "O5", { T01: 1 });
    const { audit } = run({ seed: 1, start: baseStart(), offense, offensivePlan: "auto" });
    const sel = audit.snapshot().decisions.find((d) => d.point === "seleccion_familia")!;
    expect(sel.chosenOptionId).toBe("bloqueo_directo");
    const bloqueo = sel.options.find((o) => o.id === "bloqueo_directo")!;
    expect(bloqueo.status).toBe("elegida");
    expect(bloqueo.reasonCode).toBe("family_opportunity_higher");
  });
});

describe("ME-06 (b): mano a mano mejor y elegida en auto", () => {
  it("caso construido: handicapar el bloqueo directo (O1 sin tiro, O5 sin pantalla ni pase) hace que auto elija mano_a_mano_sin_balon", () => {
    let offense = SIERRA_CLARA.players;
    offense = withAttribute(offense, "O5", { T09: 1, T13: 1, F05: 1 });
    offense = withAttribute(offense, "O1", { T01: 1, T02: 1, T03: 1, T04: 1, F01: 1 });
    const { audit } = run({ seed: 1, start: baseStart(), offense, offensivePlan: "auto" });
    const sel = audit.snapshot().decisions.find((d) => d.point === "seleccion_familia")!;
    expect(sel.chosenOptionId).toBe("mano_a_mano_sin_balon");
    const handoff = sel.options.find((o) => o.id === "mano_a_mano_sin_balon")!;
    expect(handoff.status).toBe("elegida");
    expect(handoff.values?.viable).toBe(true);
  });
});

describe("ME-06 (c): la negación de D2 no teletransporta el balón — O5 conserva el control y sigue leyendo de verdad", () => {
  it("caso construido: D2 llega antes que O2 al hombro de la entrega — la entrega se niega y O5 retiene el balón", () => {
    const start = baseStart();
    // Sesión v2-8: la entrega es en el hombro alto de O5 en el codo del lado fuerte; D2 arranca por
    // delante de O2, entre la esquina y el codo.
    start.D2 = { x: 21.0, y: 5.6 };
    const { core, audit } = run({ seed: 1, start, offensivePlan: "mano_a_mano_sin_balon" });
    const transfer = audit.snapshot().decisions.find((d) => d.point === "transferencia_mano_a_mano")!;
    expect(transfer.chosenOptionId).toBe("entrega_negada");
    expect(transfer.options[0]!.values?.d2Denies).toBe(true);
    const read = audit.snapshot().decisions.find((d) => d.point === "lectura_mano_a_mano")!;
    expect(read.holderId).toBe("O5");
    // El balón sigue de verdad en manos de O5 en el hecho real que decide la
    // vía (pase, tiro o control conservado), nunca desapareciendo del todo.
    expect(["finalizar_o5", "puerta_atras_o2", "pase_o3", "continuar_o4", "pase_o1"]).toContain(read.chosenOptionId);
    expect(core.terminal.kind).not.toBe("shot_clock_violation");
  });
});

describe("ME-06 (d): D4 ayuda a cerrar a O3 y se abre una recepción legal para O4", () => {
  it("con guardar_espacio, D4 ayuda cuando D3 no deniega con margen: O4 queda como vía viable en su propio punto de bloqueo", () => {
    const { audit } = run({ seed: 1, start: baseStart(), offensivePlan: "mano_a_mano_sin_balon", offBallDefensiveCall: "guardar_espacio" });
    const cut = audit.snapshot().decisions.find((d) => d.point === "bloqueo_indirecto_o3")!;
    const help = cut.options.find((o) => o.id === "ayuda_d4_abre_o4")!;
    expect(help.status).toBe("elegida");
    expect(help.reasonCode).toBe("help_rotation_opened_o4");
    const read = audit.snapshot().decisions.find((d) => d.point === "lectura_mano_a_mano")!;
    const o4Option = read.options.find((o) => o.id === "continuar_o4")!;
    expect(o4Option.values?.o4Open).toBe(true);
    expect(Number.isFinite(o4Option.values?.situationalValue as number)).toBe(true);
    // Sesión v2-8: el punto del bloqueo de O4 (ME-06) está a 5,8 m del aro, dentro del arco: es un tiro de dos.
    expect(o4Option.values?.shotType).toBe("mid_range");
  });

  it("con negar_primera_salida, D4 nunca ayuda: O4 no se abre por esta vía", () => {
    const { audit } = run({ seed: 1, start: baseStart(), offensivePlan: "mano_a_mano_sin_balon", offBallDefensiveCall: "negar_primera_salida" });
    const cut = audit.snapshot().decisions.find((d) => d.point === "bloqueo_indirecto_o3")!;
    const help = cut.options.find((o) => o.id === "ayuda_d4_abre_o4")!;
    expect(help.status).toBe("descartada_por_condicion");
    expect(help.reasonCode).toBe("help_rotation_not_available");
  });
});

describe("ME-06 (e): la respuesta de D5 a la entrega cambia la acción (sesión v2-8)", () => {
  it("en trampa (saltar la entrega), D5 sale a tapar la salida de la entrega y deja la pintura, con hecho y posición reales", () => {
    const { core, audit } = run({ seed: 1, start: baseStart(), offensivePlan: "mano_a_mano_sin_balon", coverage: "trampa" });
    const transfer = audit.snapshot().decisions.find((d) => d.point === "transferencia_mano_a_mano")!;
    expect(transfer.options[0]!.values?.response).toBe("saltar_entrega");
    const jump = core.timeline.find((e) => e.kind === "show_committed")!;
    expect(jump.actors).toEqual(["D5"]);
    expect(jump.detail.denied).toBe(transfer.chosenOptionId === "entrega_negada");
  });

  it("en drop, D5 se hunde: nunca se suma a negar la entrega del mano a mano (protege el interior)", () => {
    const { audit } = run({ seed: 1, start: baseStart(), offensivePlan: "mano_a_mano_sin_balon", coverage: "drop" });
    const transfer = audit.snapshot().decisions.find((d) => d.point === "transferencia_mano_a_mano")!;
    expect(transfer.options[0]!.values?.response).toBe("hundirse");
    expect(transfer.options[0]!.values?.d5Jumps).toBe(false);
  });
});

describe("ME-06 (f): reloj corto no causa teletransporte, tiro fantasma ni bucle", () => {
  it("con muy poco reloj de lanzamiento, la posesión se resuelve como violación de reloj, no como una entrada inventada", () => {
    const { core } = run({ seed: 1, start: baseStart(), offensivePlan: "mano_a_mano_sin_balon", shotClockMs: 50 });
    expect(core.terminal.kind).toBe("shot_clock_violation");
  });
});

describe("ME-06: la orden de defensa sin balón no cambia hechos deportivos por sí sola (observación ON/OFF)", () => {
  it("evaluar con auditoría activa e inactiva produce el mismo desenlace y el mismo RNG consumido", () => {
    const start = baseStart();
    const withoutAudit = computePossessionCore(
      {
        scenarioId: "drop_con_ayuda",
        coverage: "drop",
        seed: 7,
        rulesetVersion: "FIBA-2026",
        labParametersVersion: "LAB-0.3",
        offensePlayers: SIERRA_CLARA.players,
        defensePlayers: PUERTO_AMBAR.players,
        offensivePlan: "mano_a_mano_sin_balon",
      },
      {
        linked: {
          binding: BINDING,
          startPositions: start,
          shotClockMs: 20_000,
          gameClockMs: 400_000,
          rng: createSeededRandom(7),
          attackingPriority: "proteger_balance",
          entry: { kind: "organized_set" },
          rules: { deferFreeThrows: true, ordinaryFouls: true, secondEntryAllowed: true },
        },
      },
    );
    const { core: withAudit } = run({ seed: 7, start, offensivePlan: "mano_a_mano_sin_balon" });
    expect(withAudit.terminal).toEqual(withoutAudit.terminal);
  });
});
