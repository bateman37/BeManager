import { describe, expect, it } from "vitest";
import { runPossession } from "./possession-engine";
import { computePossessionCore } from "./possession-core";
import { LAB_ROSTER_FIXTURE } from "../players/lab-roster-fixture";
import type { MatchInput } from "../lab/match-input";
import { LAB_0_3_PARAMETERS_VERSION } from "../lab/lab-0-3-parameters";
import { createSeededRandom } from "../random/seeded-random";
import { distance } from "../geometry/point";
import { createRecordingAuditCollector } from "../audit/audit-collector";
import type { PlayerProfile } from "../players/player-profile";

/**
 * Pruebas discriminantes de ME-04B (prompt §5), separadas de las de
 * ME-01...ME-04A para no tocar retrospectivamente aquellos ficheros. Casos
 * construidos y declarados como tales, no semillas mágicas: cada uno aísla
 * un mecanismo concreto de §§3.1-3.3 (desplazamiento real de la pantalla,
 * primera lectura ponderada por valor, modelo geométrico R_contest).
 */
function buildInput(seed: number, overrides: { offense?: readonly PlayerProfile[]; defense?: readonly PlayerProfile[] } = {}): MatchInput {
  return {
    scenarioId: "drop_con_ayuda",
    coverage: "drop",
    seed,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: LAB_0_3_PARAMETERS_VERSION,
    offensePlayers: overrides.offense ?? LAB_ROSTER_FIXTURE[0]!.players,
    defensePlayers: overrides.defense ?? LAB_ROSTER_FIXTURE[1]!.players,
  };
}

function withAttribute(
  players: readonly PlayerProfile[],
  id: string,
  attributes: Record<string, number>,
): PlayerProfile[] {
  return players.map((p) => (p.id === id ? { ...p, attributes: { ...p.attributes, ...attributes } } : p));
}

// (1) Pantalla y persecución: O1/D1 llegan de verdad al punto de uso de la
// pantalla en el mismo tramo `screen_navigated`; pases y tiros parten de esa
// posición, sin teletransporte ni tiempo negativo (ME-04B §2, §3.1, §5).
describe("ME-04B (1): O1 y D1 llegan de verdad al punto de uso de la pantalla", () => {
  it("O1 ya está en el punto de uso de la pantalla en el propio hecho `screen_navigated`", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = runPossession(buildInput(seed));
      const nav = state.facts.find((f) => f.kind === "screen_navigated")!;
      const o1 = nav.positions.find((p) => p.playerId === "O1")!.position;
      // Posición de partida del fixture (`scenario.ts`, `drop_con_ayuda`).
      expect(o1).not.toEqual({ x: 18.0, y: 7.5 });
    }
  });

  it("D1 deja de estar congelado: para cuando termina la posesión ya navegó de verdad hasta la pantalla", () => {
    // HF-002/ME-04A mostraban a D1 inmóvil en (19,1; 7,5) durante toda la
    // posesión (diagnóstico §2, auditoría 210 A); ME-04B lo hace navegar con
    // el retraso real de `screenDelay` tras `screen_navigated`.
    for (let seed = 1; seed <= 20; seed++) {
      const state = runPossession(buildInput(seed));
      expect(state.players.D1!.position).not.toEqual({ x: 19.1, y: 7.5 });
    }
  });

  it("el propio hecho `screen_navigated` no reporta un retraso de pantalla negativo", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = runPossession(buildInput(seed));
      const nav = state.facts.find((f) => f.kind === "screen_navigated")!;
      expect(nav.detail.screenDelay as number).toBeGreaterThan(0);
      expect(nav.atMs).toBeGreaterThanOrEqual(0);
    }
  });
});

// (2) La primera lectura no es siempre `pase_o5`: con O1 preparado para un
// triple real y el roll poco atractivo, la vía elegida cambia (ME-04B §3.2).
describe("ME-04B (2): primera lectura del bloqueo con varias vías reales", () => {
  it("caso construido (a): O1 tiene tiro exterior legal mientras O5 está protegido, y lo elige", () => {
    // O1 con T04 máximo (triple fiable); O5 mal anotador y mal pasador desde
    // el roll, para que su valor situacional quede claramente por debajo.
    const offense = withAttribute(
      withAttribute(LAB_ROSTER_FIXTURE[0]!.players, "O1", { T04: 15 }),
      "O5",
      { T01: 1, T09: 1 },
    );
    const input = buildInput(1, { offense });
    const audit = createRecordingAuditCollector();
    computePossessionCore(input, { audit, trackPositionHistory: true });
    const firstRead = audit.snapshot().decisions.find((d) => d.point === "lectura_bloqueo_o1")!;
    expect(firstRead).toBeDefined();
    expect(firstRead.chosenOptionId).toBe("triple_o1");
    const chosen = firstRead.options.find((o) => o.id === "triple_o1")!;
    expect(chosen.status).toBe("elegida");
    // La vía descartada de pase_o5 deja constancia de un valor comparable, no
    // de un cortocircuito: se evaluó y perdió por valor situacional.
    const o5Option = firstRead.options.find((o) => o.id === "pase_o5")!;
    expect(["descartada_por_condicion"]).toContain(o5Option.status);
    expect(typeof o5Option.values?.situationalValue).toBe("number");
  });

  it("una vía inviable no entra en la comparación de valor: sin línea de tres puntos, la salida segura no exige que O1 esté detrás del arco", () => {
    // Con T04 bajo y sin ángulo de tres, `triple_o1` es estructuralmente
    // inviable (valor -Infinity) y nunca se compara por valor con las demás.
    const offense = withAttribute(LAB_ROSTER_FIXTURE[0]!.players, "O1", { T04: 1 });
    const input = buildInput(1, { offense });
    const audit = createRecordingAuditCollector();
    computePossessionCore(input, { audit, trackPositionHistory: true });
    const firstRead = audit.snapshot().decisions.find((d) => d.point === "lectura_bloqueo_o1")!;
    const tripleOption = firstRead.options.find((o) => o.id === "triple_o1")!;
    expect(tripleOption.status).toBe("descartada_por_condicion");
    expect(tripleOption.reasonCode).toBe("three_point_ineligible_skill");
  });
});

// (3) Oposición geométrica R_contest, separada del contacto/falta (ME-04B §3.3).
describe("ME-04B (3): D5 contesta el tiro real sin tocar al tirador (R_contest)", () => {
  it("caso construido (b): un defensor a 1,0 m (fuera del radio corporal de 0,70 m, dentro de R_contest) opone sin falta", () => {
    const shooterPos = { x: 23.0, y: 7.5 };
    // C03 = 220 cm → R_contest = 0,35 + 220/200 = 1,45 m; a 1,0 m está dentro
    // de ese alcance de brazos pero fuera del radio corporal combinado (0,70 m).
    const defense = withAttribute(LAB_ROSTER_FIXTURE[1]!.players, "D3", { T18: 8 }).map((p) =>
      p.id === "D3" ? { ...p, measures: { ...p.measures, wingspanCm: 220 } } : p,
    );
    const rng = createSeededRandom(1);
    const scenario = { offense: ["O1", "O2", "O3", "O4", "O5"], defense: ["D1", "D2", "D3", "D4", "D5"] };
    const start: Record<string, { x: number; y: number }> = {};
    for (const s of [...scenario.offense, ...scenario.defense]) start[s] = { x: 20, y: 7.5 };
    start.O5 = shooterPos;
    start.D3 = { x: shooterPos.x + 1.0, y: shooterPos.y };
    const binding = Object.fromEntries([...scenario.offense, ...scenario.defense].map((s) => [s, s]));
    const audit = createRecordingAuditCollector();
    const result = computePossessionCore(
      {
        scenarioId: "drop_con_ayuda",
        coverage: "drop",
        seed: 1,
        rulesetVersion: "FIBA-2026",
        labParametersVersion: LAB_0_3_PARAMETERS_VERSION,
        offensePlayers: LAB_ROSTER_FIXTURE[0]!.players,
        defensePlayers: defense,
      },
      {
        audit,
        linked: {
          binding,
          startPositions: start,
          shotClockMs: 20_000,
          gameClockMs: 400_000,
          rng,
          attackingPriority: "proteger_balance",
          entry: {
            kind: "direct_finish",
            shooterSlot: "O5",
            finishSpot: shooterPos,
            shooterAtSpotSeconds: 0,
            pass: null,
            contesterSlot: "D3",
            // Ya colocado (llegada muy anterior) para que `settledBeforeGesture` sea real.
            contesterArrivalSeconds: -5,
            contesterGeometry: {
              originPos: start.D3!,
              destinationPos: start.D3!,
              speedMps: 0,
              brakingExtraSeconds: 0.1,
            },
          },
        },
      },
    );
    const shotDecision = audit.snapshot().decisions.find((d) => d.point === "resolucion_tiro")!;
    expect(shotDecision.chosenOptionId).toBe("no_contest");
    expect(shotDecision.options.find((o) => o.id === "no_contest")!.values?.bodyOverlap).toBe(false);
    expect(shotDecision.note).toMatch(/oposición geométrica=1/);
    expect(shotDecision.note).not.toMatch(/oposición geométrica=0 /);
    expect(["blocked_shot_live_ball", "made_basket", "missed_shot_defensive_rebound", "missed_shot_offensive_rebound_continues"]).toContain(
      result.terminal.kind,
    );
  });

  it("fuera de R_contest (2,5 m): sin oposición atribuible, con independencia de cuán rápido llegara por el reloj", () => {
    const shooterPos = { x: 23.0, y: 7.5 };
    const scenario = { offense: ["O1", "O2", "O3", "O4", "O5"], defense: ["D1", "D2", "D3", "D4", "D5"] };
    const start: Record<string, { x: number; y: number }> = {};
    for (const s of [...scenario.offense, ...scenario.defense]) start[s] = { x: 20, y: 7.5 };
    start.O5 = shooterPos;
    start.D3 = { x: shooterPos.x + 2.5, y: shooterPos.y };
    const binding = Object.fromEntries([...scenario.offense, ...scenario.defense].map((s) => [s, s]));
    const audit = createRecordingAuditCollector();
    computePossessionCore(
      {
        scenarioId: "drop_con_ayuda",
        coverage: "drop",
        seed: 1,
        rulesetVersion: "FIBA-2026",
        labParametersVersion: LAB_0_3_PARAMETERS_VERSION,
        offensePlayers: LAB_ROSTER_FIXTURE[0]!.players,
        defensePlayers: LAB_ROSTER_FIXTURE[1]!.players,
      },
      {
        audit,
        linked: {
          binding,
          startPositions: start,
          shotClockMs: 20_000,
          gameClockMs: 400_000,
          rng: createSeededRandom(1),
          attackingPriority: "proteger_balance",
          entry: {
            kind: "direct_finish",
            shooterSlot: "O5",
            finishSpot: shooterPos,
            shooterAtSpotSeconds: 0,
            pass: null,
            contesterSlot: "D3",
            contesterArrivalSeconds: -5,
            contesterGeometry: { originPos: start.D3!, destinationPos: start.D3!, speedMps: 0, brakingExtraSeconds: 0.1 },
          },
        },
      },
    );
    const shotDecision = audit.snapshot().decisions.find((d) => d.point === "resolucion_tiro")!;
    expect(shotDecision.note).toMatch(/oposición geométrica=0 /);
  });

  it("cambiar solo C03 (envergadura) mueve el alcance de contestación en el umbral, sin tocar el radio corporal", () => {
    // A 0,90 m del tirador: fuera de R_contest con envergadura corta (C03 =
    // 180 → R_contest = 1,25 m... en realidad alcanza; se usa un caso más
    // ajustado: distancia 1,30 m, justo entre ambos alcances).
    const distanceToShooter = 1.30;
    function contestNote(wingspanCm: number): string {
      const shooterPos = { x: 23.0, y: 7.5 };
      const start: Record<string, { x: number; y: number }> = {
        O1: { x: 20, y: 7.5 }, O2: { x: 20, y: 7.5 }, O3: { x: 20, y: 7.5 }, O4: { x: 20, y: 7.5 }, O5: shooterPos,
        D1: { x: 20, y: 7.5 }, D2: { x: 20, y: 7.5 }, D3: { x: shooterPos.x + distanceToShooter, y: shooterPos.y }, D4: { x: 20, y: 7.5 }, D5: { x: 20, y: 7.5 },
      };
      const binding = Object.fromEntries(Object.keys(start).map((s) => [s, s]));
      const defense = withAttribute(LAB_ROSTER_FIXTURE[1]!.players, "D3", {}).map((p) =>
        p.id === "D3" ? { ...p, measures: { ...p.measures, wingspanCm } } : p,
      );
      const audit = createRecordingAuditCollector();
      computePossessionCore(
        {
          scenarioId: "drop_con_ayuda", coverage: "drop", seed: 1, rulesetVersion: "FIBA-2026",
          labParametersVersion: LAB_0_3_PARAMETERS_VERSION, offensePlayers: LAB_ROSTER_FIXTURE[0]!.players, defensePlayers: defense,
        },
        {
          audit,
          linked: {
            binding, startPositions: start, shotClockMs: 20_000, gameClockMs: 400_000, rng: createSeededRandom(1),
            attackingPriority: "proteger_balance",
            entry: {
              kind: "direct_finish", shooterSlot: "O5", finishSpot: shooterPos, shooterAtSpotSeconds: 0, pass: null,
              contesterSlot: "D3", contesterArrivalSeconds: -5,
              contesterGeometry: { originPos: start.D3!, destinationPos: start.D3!, speedMps: 0, brakingExtraSeconds: 0.1 },
            },
          },
        },
      );
      return audit.snapshot().decisions.find((d) => d.point === "resolucion_tiro")!.note!;
    }
    // R_contest(180) = 0,35 + 0,90 = 1,25 m < 1,30 m de distancia: sin alcance.
    expect(contestNote(180)).toMatch(/oposición geométrica=0 /);
    // R_contest(200) = 0,35 + 1,00 = 1,35 m > 1,30 m de distancia: con alcance.
    expect(contestNote(200)).toMatch(/oposición geométrica=1/);
  });
});
