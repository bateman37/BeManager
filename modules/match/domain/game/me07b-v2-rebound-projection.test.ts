import { describe, expect, it } from "vitest";
import { projectDirectFinishBreakdown, REBOUND_CANDIDATE_SPEED_MPS, type LinkedEntry, type ReboundPriority } from "../simulation/possession-core";
import {
  contestRebound,
  reboundLandingQuadrature,
  resolveRebound,
  seedReboundLanding,
  pickTipWinnerByT20,
  type ReboundCandidate,
} from "../simulation/resolvers/rebound-resolver";
import { getScenario } from "../lab/scenario";
import { ATTACKED_HOOP } from "../geometry/court";
import { timeToReach, type Point2D } from "../geometry/point";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { createSeededRandom } from "../random/seeded-random";
import { closeoutBrakingExtraSeconds, defenderLateralSpeedMps, movingShotPrepSeconds } from "../lab/lab-0-1-parameters";
import type { PlayerProfile } from "../players/player-profile";
import type { MatchInput } from "../lab/match-input";

/**
 * ME-07B v2 (sesión v2-9, §2.1/§2.2): el comparador proyecta lo que sigue a
 * un fallo vivo —rebote ofensivo y palmeada— con la mecánica real del rebote
 * enlazado (quién carga y quién vuelve, posiciones en el fallo, cierres
 * T19/F05, captura y palmeo T20, lectura de segunda oportunidad), sin sortear.
 *
 * Pruebas de un solo cambio sobre el mismo triple de O1 (misma oposición y
 * mismo cierre): la colocación y la capacidad de quien carga cambian el valor
 * proyectado; con nadie cargando, o con la capacidad de alguien que vuelve,
 * no cambia nada. La cuadratura de la caída reproduce la frecuencia del
 * resolvedor real.
 */
const SCENARIO = getScenario("drop_con_ayuda");
const BINDING = Object.fromEntries([...SCENARIO.offense, ...SCENARIO.defense].map((s) => [s.playerId, s.playerId]));
const withAttr = (players: readonly PlayerProfile[], id: string, a: Partial<PlayerProfile["attributes"]>) =>
  players.map((p) => (p.id === id ? { ...p, attributes: { ...p.attributes, ...a } } : p)) as PlayerProfile[];

const SHOT_SPOT: Point2D = { x: 19.2, y: 7.5 };
const BASE: Record<string, Point2D> = {
  O1: SHOT_SPOT,
  O2: { x: 15.0, y: 1.5 },
  O3: { x: 15.0, y: 13.5 },
  O4: { x: 16.5, y: 2.0 },
  O5: { x: 25.2, y: 9.3 },
  D1: { x: 18.2, y: 7.5 },
  D2: { x: 16.0, y: 2.5 },
  D3: { x: 16.0, y: 12.5 },
  D4: { x: 17.5, y: 2.5 },
  D5: { x: 22.0, y: 7.5 },
};

function project(args: { positions?: Partial<Record<string, Point2D>>; offense?: readonly PlayerProfile[]; defense?: readonly PlayerProfile[]; priority?: ReboundPriority } = {}) {
  const startPositions = { ...BASE, ...args.positions } as Record<string, Point2D>;
  const offense = args.offense ?? SIERRA_CLARA.players;
  const defense = args.defense ?? PUERTO_AMBAR.players;
  const input: MatchInput = {
    scenarioId: "drop_con_ayuda",
    coverage: "drop",
    seed: 1,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: "LAB-0.3",
    offensePlayers: offense,
    defensePlayers: defense,
  };
  const d1 = defense.find((p) => p.id === "D1")!;
  const o1 = offense.find((p) => p.id === "O1")!;
  const prep = movingShotPrepSeconds(o1.attributes.T06);
  const speed = defenderLateralSpeedMps(d1.attributes.F04);
  // D1 sale a cerrar el triple y llega antes de que O1 suelte: oposición parcial, fija en todas las variantes.
  const entry: Extract<LinkedEntry, { kind: "direct_finish" }> = {
    kind: "direct_finish",
    shooterSlot: "O1",
    finishSpot: SHOT_SPOT,
    shooterAtSpotSeconds: 0,
    shotType: "three_point",
    prepSeconds: prep,
    pass: null,
    contesterSlot: "D1",
    contesterArrivalSeconds: timeToReach(startPositions.D1!, SHOT_SPOT, speed),
    contesterGeometry: { originPos: startPositions.D1!, destinationPos: SHOT_SPOT, speedMps: speed, brakingExtraSeconds: closeoutBrakingExtraSeconds(d1.attributes.F03) },
  };
  return projectDirectFinishBreakdown(
    input,
    {
      binding: BINDING,
      startPositions,
      shotClockMs: 20_000,
      gameClockMs: 400_000,
      attackingPriority: args.priority ?? "proteger_balance",
      rules: { deferFreeThrows: true, ordinaryFouls: true, secondEntryAllowed: true },
    },
    entry,
    0.5,
  );
}

describe("ME-07B v2 (v2-9): la proyección valora el rebote ofensivo tras un fallo vivo", () => {
  it("el tiro y su acierto no cambian; la palmeada proyectada sí, según dónde está quien carga", () => {
    const near = project();
    // Solo cambia la posición de O5 (el más rápido al aro, el que carga): lejos, carga otro desde el perímetro.
    const far = project({ positions: { O5: { x: 16.0, y: 10.5 } } });
    expect(far.makeProbability).toBe(near.makeProbability);
    expect(far.blockProbability).toBe(near.blockProbability);
    expect(far.foulProbability).toBe(near.foulProbability);
    expect(near.putbackValue).toBeGreaterThan(0.05);
    expect(far.putbackValue).toBeLessThan(near.putbackValue);
    expect(near.value - far.value).toBeCloseTo((1 - near.foulProbability) * (1 - near.blockProbability) * (1 - near.makeProbability) * (near.putbackValue - far.putbackValue), 10);
  });

  it("un defensor entre el que carga y el aro le cierra y le quita la palmeada", () => {
    const open = project();
    const boxed = project({ positions: { D5: { x: 25.6, y: 8.4 } } });
    expect(boxed.putbackValue).toBeLessThan(open.putbackValue);
  });

  it("cargar con dos (prioridad «cargar rebote») proyecta más rebote que proteger el balance", () => {
    const balance = project({ positions: { O4: { x: 22.5, y: 4.0 } } });
    const crash = project({ positions: { O4: { x: 22.5, y: 4.0 } }, priority: "cargar_rebote" });
    expect(crash.putbackValue).toBeGreaterThan(balance.putbackValue);
  });

  it("T20 de quien carga cambia la captura proyectada; el de quien vuelve al balance no cambia nada", () => {
    const base = project();
    const crasherSure = project({ offense: withAttr(SIERRA_CLARA.players, "O5", { T20: 15 }) });
    const crasherPoor = project({ offense: withAttr(SIERRA_CLARA.players, "O5", { T20: 1 }) });
    expect(crasherSure.putbackValue).toBeGreaterThan(crasherPoor.putbackValue);
    // O3, lejos y sin encargo de carga, vuelve al balance: su T20 no entra en el rebote.
    const balancer = project({ offense: withAttr(SIERRA_CLARA.players, "O3", { T20: 15 }) });
    expect(balancer.putbackValue).toBe(base.putbackValue);
    expect(balancer.value).toBe(base.value);
  });

  it("sin nadie que cargue cerca y con la defensa en el aro no hay palmeada que proyectar", () => {
    const positions = { O5: { x: 15.5, y: 11.0 }, D5: { x: 26.0, y: 7.5 }, D3: { x: 25.5, y: 9.0 }, D4: { x: 25.5, y: 6.0 } };
    const none = project({ positions });
    expect(none.putbackValue).toBe(0);
    // Ni la capacidad de rebote de quien carga ni la del resto mueven el valor: solo queda el tiro.
    const sure = project({ positions, offense: SIERRA_CLARA.players.map((p) => (p.id.startsWith("O") ? { ...p, attributes: { ...p.attributes, T20: 15 } } : p)) as PlayerProfile[] });
    expect(sure.value).toBe(none.value);
  });

  it("la cuadratura de la caída reproduce la frecuencia de control ofensivo del resolvedor real", () => {
    const candidates: ReboundCandidate[] = Object.entries(BASE)
      .filter(([id]) => id !== "O2" && id !== "O3" && id !== "O4")
      .map(([id, position]) => ({
        playerId: id,
        teamId: id.startsWith("O") ? "ataque" : "defensa",
        position,
        arrivalTimeSeconds: 0,
        t19: 8,
        f05: 8,
        t20: id === "O5" ? 12 : 8,
        canBoxOut: id !== "O1",
      }));
    const geometry = { hoop: ATTACKED_HOOP, speedMps: REBOUND_CANDIDATE_SPEED_MPS };
    const withArrivals = (landing: Point2D) => candidates.map((c) => ({ ...c, arrivalTimeSeconds: timeToReach(c.position, landing, REBOUND_CANDIDATE_SPEED_MPS) }));
    const t20 = (id: string) => candidates.find((c) => c.playerId === id)!.t20;
    let projected = 0;
    for (const { seed, weight } of reboundLandingQuadrature(ATTACKED_HOOP, SHOT_SPOT, "three_point")) {
      const contest = contestRebound(seed, withArrivals(seed.landingPoint), geometry);
      if (!contest) continue;
      const first = contest.pool[0]!.playerId;
      const tip = pickTipWinnerByT20({ kind: "loose_ball_tip", nearestPlayerId: first, contestPoolPlayerIds: contest.pool.map((c) => c.playerId), trace: contest.trace }, t20);
      projected += weight * ((first.startsWith("O") ? contest.captureProbability : 0) + (tip.startsWith("O") ? 1 - contest.captureProbability : 0));
    }
    const rng = createSeededRandom(7);
    const n = 6000;
    let offensive = 0;
    for (let i = 0; i < n; i++) {
      const seed = seedReboundLanding(ATTACKED_HOOP, SHOT_SPOT, "three_point", rng);
      const out = resolveRebound(seed, withArrivals(seed.landingPoint), rng, geometry);
      if (out.kind === "secured" && out.playerId.startsWith("O")) offensive++;
      if (out.kind === "loose_ball_tip" && pickTipWinnerByT20(out, t20).startsWith("O")) offensive++;
    }
    expect(Math.abs(projected - offensive / n)).toBeLessThan(0.06);
  });
});
