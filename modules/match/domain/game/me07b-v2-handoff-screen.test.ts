import { describe, expect, it } from "vitest";
import { computePossessionCore } from "../simulation/possession-core";
import { getScenario } from "../lab/scenario";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { createResumableRandom } from "../random/seeded-random";
import { createRecordingAuditCollector } from "../audit/audit-collector";
import { defenderLateralSpeedMps } from "../lab/lab-0-1-parameters";
import type { PlayerProfile } from "../players/player-profile";
import type { DefensiveCoverage, MatchInput, OffBallDefensiveCall } from "../lab/match-input";

/**
 * ME-07B v2, sesión v2-8: rediseño acotado de la mano a mano central
 * autorizado por Dennis («en la entrega de O5 a O2, el cuerpo de O5 debe poder
 * actuar como pantalla real sobre D2…»). Pruebas de mecanismo con un solo
 * cambio entre parejas, sobre la misma geometría (disposición del escenario) y
 * el motor real:
 * - la calidad del bloqueador, del receptor y del defensor cambia un
 *   intermedio pertinente (instante en que D2 se libera, oposición de la vía) y
 *   no hay bono global;
 * - las tres respuestas de D5 (hundirse, cambiar, saltar) dan entregas y
 *   lecturas distintas; D2 por delante niega la entrega; una pantalla no puesta
 *   no retiene;
 * - nadie se teletransporta: D2 nunca recorre más de lo que su velocidad permite.
 */
const SCENARIO = getScenario("drop_con_ayuda");
const BINDING = Object.fromEntries([...SCENARIO.offense, ...SCENARIO.defense].map((s) => [s.playerId, s.playerId]));
function start(): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const s of [...SCENARIO.offense, ...SCENARIO.defense]) out[s.playerId] = s.initialPosition;
  return out;
}
const withAttr = (players: readonly PlayerProfile[], id: string, a: Partial<PlayerProfile["attributes"]>) => players.map((p) => (p.id === id ? { ...p, attributes: { ...p.attributes, ...a } } : p)) as PlayerProfile[];

function run(args: { offense?: readonly PlayerProfile[]; defense?: readonly PlayerProfile[]; coverage?: DefensiveCoverage; call?: OffBallDefensiveCall; seed?: number; start?: Record<string, { x: number; y: number }> } = {}) {
  const audit = createRecordingAuditCollector();
  const seed = args.seed ?? 1;
  const input: MatchInput = {
    scenarioId: "drop_con_ayuda",
    coverage: args.coverage ?? "drop",
    seed,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: "LAB-0.3",
    offensePlayers: args.offense ?? SIERRA_CLARA.players,
    defensePlayers: args.defense ?? PUERTO_AMBAR.players,
    offensivePlan: "mano_a_mano_sin_balon",
    offBallDefensiveCall: args.call ?? "guardar_espacio",
  };
  const core = computePossessionCore(input, {
    audit,
    trackPositionHistory: true,
    linked: {
      binding: BINDING,
      startPositions: args.start ?? start(),
      shotClockMs: 20_000,
      gameClockMs: 400_000,
      rng: createResumableRandom(seed),
      attackingPriority: "proteger_balance",
      entry: { kind: "organized_set" },
      rules: { deferFreeThrows: true, ordinaryFouls: true, secondEntryAllowed: true },
    },
  });
  const decisions = audit.snapshot().decisions;
  // Un pase de entrada desviado no llega a la entrega (balón suelto): sin transferencia ni lectura.
  const transfer = decisions.find((d) => d.point === "transferencia_mano_a_mano")!;
  const read = decisions.find((d) => d.point === "lectura_mano_a_mano")!;
  const option = (id: string) => read.options.find((o) => o.id === id)!;
  return { core, decisions, transfer, t: transfer?.options[0]?.values ?? {}, read, option };
}

// Un D2 lento (F04 3): con él, lo que tarda en liberarse de la pantalla decide si llega a la parada de O2.
const SLOW_D2 = withAttr(PUERTO_AMBAR.players, "D2", { F04: 3 });

describe("ME-07B v2 (v2-8): el cuerpo de O5 es una pantalla real sobre D2", () => {
  it("solo cambia el bloqueador: con mejor pantalla D2 se libera más tarde y la parada de O2 pasa de contestada a libre", () => {
    const weak = run({ offense: withAttr(SIERRA_CLARA.players, "O5", { T13: 1, F05: 1 }), defense: SLOW_D2 });
    const strong = run({ offense: withAttr(SIERRA_CLARA.players, "O5", { T13: 15, F05: 15 }), defense: SLOW_D2 });
    // Misma geometría y llegadas: O2 y D2 llegan igual; solo cambia el retraso de contacto.
    expect(strong.t.o2ArrivalSeconds).toBe(weak.t.o2ArrivalSeconds);
    expect(strong.t.d2ContactSeconds).toBe(weak.t.d2ContactSeconds);
    expect(strong.t.screenSet).toBe(true);
    expect(strong.t.screenDelaySeconds as number).toBeGreaterThan(weak.t.screenDelaySeconds as number);
    expect(strong.t.d2ReleaseSeconds as number).toBeGreaterThan(weak.t.d2ReleaseSeconds as number);
    expect(weak.option("parada_o2").values!.opposition).toBe(0.5);
    expect(strong.option("parada_o2").values!.opposition).toBe(0);
    expect(strong.option("parada_o2").values!.situationalValue as number).toBeGreaterThan(weak.option("parada_o2").values!.situationalValue as number);
    // Sin bono global: el aro (D5 en el drop) y el triple al recibir (D2 ya en el hombro de O5) no cambian.
    expect(strong.option("finalizar_portador").values!.situationalValue).toBe(weak.option("finalizar_portador").values!.situationalValue);
    expect(strong.option("triple_o2").values!.situationalValue).toBe(weak.option("triple_o2").values!.situationalValue);
  });

  it("solo cambia el defensor: un D2 rápido y que navega bien llega antes al hombro y se libera antes; uno torpe deja la parada libre", () => {
    const good = run({ defense: withAttr(PUERTO_AMBAR.players, "D2", { F04: 15, T16: 15 }) });
    const bad = run({ defense: withAttr(PUERTO_AMBAR.players, "D2", { F04: 1, T16: 1 }) });
    expect(good.t.d2ContactSeconds as number).toBeLessThan(bad.t.d2ContactSeconds as number);
    expect(good.t.screenDelaySeconds as number).toBeLessThan(bad.t.screenDelaySeconds as number);
    expect(good.t.d2ReleaseSeconds as number).toBeLessThan(bad.t.d2ReleaseSeconds as number);
    expect(good.option("parada_o2").values!.opposition).toBe(0.5);
    expect(bad.option("parada_o2").values!.opposition).toBe(0);
  });

  it("solo cambia el receptor: un O2 rápido llega antes a la entrega y ataca el aro antes que la retirada de D5; uno lento no", () => {
    const fast = run({ offense: withAttr(SIERRA_CLARA.players, "O2", { F01: 15 }) });
    const slow = run({ offense: withAttr(SIERRA_CLARA.players, "O2", { F01: 1 }) });
    expect(fast.t.o2ArrivalSeconds as number).toBeLessThan(slow.t.o2ArrivalSeconds as number);
    expect(fast.option("finalizar_portador").values!.opposition).toBe(0.5);
    expect(slow.option("finalizar_portador").values!.opposition).toBe(1);
    expect(fast.read.chosenOptionId).toBe("finalizar_portador");
    expect(slow.read.chosenOptionId).not.toBe("finalizar_portador");
  });

  it("solo cambia la respuesta de D5: hundirse, cambiar y saltar la entrega dan entregas, responsables y lecturas distintas", () => {
    const sink = run({ coverage: "drop" });
    const sw = run({ coverage: "cambio" });
    const jump = run({ coverage: "show" });
    expect([sink.t.response, sw.t.response, jump.t.response]).toEqual(["hundirse", "cambiar_entrega", "saltar_entrega"]);
    // Hundirse: D5 protege el aro (contesta la penetración); concede la continuación de O5 a medias y la parada.
    expect(sink.transfer.chosenOptionId).toBe("entrega_completada");
    expect(sink.option("finalizar_portador").values!.opposition).toBe(1);
    expect(sink.option("continuacion_o5").values!.guardId).toBe("D5");
    // Cambiar: D5 sale a O2 por el hombro de salida y D2 se queda con O5 (cambio de responsables que persiste).
    expect(sw.transfer.chosenOptionId).toBe("entrega_completada");
    expect(sw.core.timeline.some((e) => e.kind === "switch_committed")).toBe(true);
    expect(sw.core.defensiveSwap).toEqual(["D2", "D5"]);
    expect(sw.option("continuacion_o5").values!.guardId).toBe("D2");
    expect(sw.option("finalizar_portador").values!.contesterId).toBe("D5");
    // Saltar: D5 tapa la salida antes que O2 → entrega negada; O5 se la queda y lee aro, puerta de atrás, indirecto o salida.
    expect(jump.transfer.chosenOptionId).toBe("entrega_negada");
    expect(jump.t.d5Jumps).toBe(true);
    expect(jump.read.holderId).toBe("O5");
    expect(jump.read.options.map((o) => o.id)).toEqual(["finalizar_o5", "puerta_atras_o2", "pase_o3", "continuar_o4", "pase_o1"]);
    // Las tres primeras decisiones son distintas.
    expect(new Set([sink.read.chosenOptionId, sw.read.chosenOptionId, jump.read.chosenOptionId]).size).toBe(3);
  });

  it("D2 por delante de O2 ocupa el punto de la entrega: entrega negada sin teletransporte y O2 puede cortar por la puerta de atrás", () => {
    const s = start();
    s.D2 = { x: 21.0, y: 5.6 };
    const denied = run({ start: s });
    expect(denied.transfer.chosenOptionId).toBe("entrega_negada");
    expect(denied.t.d2Denies).toBe(true);
    expect(denied.t.d2ArrivalSeconds as number).toBeLessThan(denied.t.o2ArrivalSeconds as number);
    expect(denied.read.holderId).toBe("O5");
    expect(Number.isFinite(denied.option("puerta_atras_o2").values!.situationalValue as number)).toBe(true);
  });

  it("una pantalla no puesta no retiene: si O5 llega a la vez que la entrega, D2 sigue a O2 sin retraso de contacto", () => {
    const s = start();
    // O5 sale lejos del codo: llega tarde y entrega en cuanto recibe.
    s.O5 = { x: 12.0, y: 12.0 };
    let unset = 0;
    let set = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = run({ start: s, seed });
      if (!r.transfer) continue;
      const ready = r.t.tHandoffReady as number;
      const contact = r.t.d2ContactSeconds as number;
      if (r.t.screenSet === false) {
        unset += 1;
        expect(r.t.screenDelaySeconds).toBe(0);
        expect(r.t.d2ReleaseSeconds).toBeCloseTo(Math.max(contact, ready), 9);
      } else {
        set += 1;
        expect(r.t.d2ReleaseSeconds as number).toBeGreaterThan(Math.max(contact, ready) + 0.15);
      }
    }
    // Con recepción limpia la pantalla no está puesta; con control incómodo O5 tiene tiempo de asentarse.
    expect(unset).toBeGreaterThan(0);
    expect(set).toBeGreaterThan(0);
  });

  it("nadie se teletransporta: cada tramo de D2 cabe en su velocidad real", () => {
    for (const coverage of ["drop", "cambio", "show"] as const) {
      const r = run({ coverage, defense: SLOW_D2 });
      const history = r.core.positionHistory!.D2!;
      const speed = defenderLateralSpeedMps(3);
      for (let i = 1; i < history.length; i++) {
        const a = history[i - 1]!;
        const b = history[i]!;
        const dt = (b.atMs - a.atMs) / 1000;
        const dist = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
        // El ajuste perimetral T22 adelanta como mucho 0,1 s una llegada.
        expect(dist).toBeLessThanOrEqual(speed * (dt + 0.1) + 1e-6);
      }
    }
  });
});
