import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { playTramo } from "./play-tramo";
import { buildTramoInput, type ReboundPriority, type TramoEvent, type TramoResult } from "./tramo-model";
import {
  evaluateBackcourtCount,
  evaluateThrowInCount,
  isReleasedBeforeShotClock,
  shotClockAfterLiveControl,
  shotClockForThrowIn,
  backcourtElapsedAfterThrowIn,
} from "./fiba-clock-rules";
import { readTransition, readSecondChance, type RaceParticipant } from "./transition";
import { SIERRA_CLARA, PUERTO_AMBAR, LAB_ROSTER_FIXTURE } from "../players/lab-roster-fixture";
import { runPossession } from "../simulation/possession-engine";
import { computePossessionCore } from "../simulation/possession-core";
import { compareHelpToggle, compareCoverageBatch } from "../fast/fast-resolver";
import { createResumableRandom } from "../random/seeded-random";
import { getScenario } from "../lab/scenario";
import { ATTACKED_HOOP } from "../geometry/court";
import type { DefensiveCoverage } from "../lab/match-input";
import type { PlayerProfile } from "../players/player-profile";

/**
 * Pruebas discriminantes de ME-03 (prompt §5, puntos 1–7). Pocas y
 * causales, sin base de datos: cada una aísla una frontera del tramo.
 */
function tramo(
  seed: number,
  priorities: readonly [ReboundPriority, ReboundPriority] = ["proteger_balance", "proteger_balance"],
  coverage: DefensiveCoverage = "drop",
  offensePlayers: readonly PlayerProfile[] = SIERRA_CLARA.players,
): TramoResult {
  return playTramo(
    buildTramoInput({
      seed,
      coverage,
      offenseTeam: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: offensePlayers, priority: priorities[0] },
      defenseTeam: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: priorities[1] },
    }),
  );
}

function findTramo(predicate: (r: TramoResult) => boolean, maxSeed = 400): TramoResult {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const r = tramo(seed);
    if (predicate(r)) return r;
  }
  throw new Error("Ninguna semilla del rango alcanza el caso buscado");
}

const TEAM_OF: Readonly<Record<string, string>> = Object.fromEntries(
  LAB_ROSTER_FIXTURE.flatMap((t) => t.players.map((p) => [p.id, t.id])),
);

function comparable(r: TramoResult) {
  return r.events.map((e) => [e.kind, e.atMs, e.actors, e.gameClockMs, e.shotClockMs, e.score, e.positions]);
}

// (1) Reproducibilidad y snapshot único del tramo.
describe("ME-03 (1): misma entrada y semilla → mismo tramo", () => {
  it("reproduce cierres, hechos, relojes y posiciones", () => {
    const a = tramo(77);
    const b = tramo(77);
    expect(a.closedPossessions).toBe(4);
    expect(a.possessions.map((p) => [p.teamId, p.startMs, p.endMs, p.endReason])).toEqual(
      b.possessions.map((p) => [p.teamId, p.startMs, p.endMs, p.endReason]),
    );
    expect(comparable(a)).toEqual(comparable(b));
    expect(a.rngStateAtBoundaries).toEqual(b.rngStateAtBoundaries);
  });

  it("editar un perfil después de construir la entrada no altera el tramo", () => {
    const editable = structuredClone(SIERRA_CLARA.players) as PlayerProfile[];
    const input = buildTramoInput({
      seed: 77,
      coverage: "drop",
      offenseTeam: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: editable, priority: "proteger_balance" },
      defenseTeam: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance" },
    });
    const before = playTramo(input);
    (editable[4]!.attributes as Record<string, number>).T01 = 1;
    expect(comparable(playTramo(input))).toEqual(comparable(before));
  });
});

// (2) Cambio de equipo atacante: IDs y coordenadas globales continuas.
describe("ME-03 (2): el mismo equipo de diez atraviesa el cambio de lado", () => {
  const r = tramo(3);
  const firstRival = r.possessions.find((p) => p.teamId === PUERTO_AMBAR.id)!;

  it("conserva los diez IDs y nunca mueve a nadie más rápido de lo modelado entre dos hechos", () => {
    expect(firstRival).toBeDefined();
    const ids = r.events[0]!.positions.map((p) => p.playerId);
    expect(new Set(ids).size).toBe(10);
    for (let i = 1; i < r.events.length; i++) {
      const prev = r.events[i - 1]!;
      const cur = r.events[i]!;
      expect(cur.positions.map((p) => p.playerId)).toEqual(ids);
      expect(cur.atMs).toBeGreaterThanOrEqual(prev.atMs);
      const dt = (cur.atMs - prev.atMs) / 1000;
      for (const snap of cur.positions) {
        const before = prev.positions.find((p) => p.playerId === snap.playerId)!.position;
        const moved = Math.hypot(snap.position.x - before.x, snap.position.y - before.y);
        // Velocidad máxima modelada: F01 = 15 → 4,1 m/s.
        expect(moved).toBeLessThanOrEqual(4.1 * dt + 1e-6);
      }
    }
  });

  it("cambian el aro y los roles, no la identidad: Puerto Ámbar ataca el aro izquierdo con sus jugadores", () => {
    const shots = r.events.filter((e) => e.kind === "field_goal_attempt");
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) {
      const shooter = shot.actors[0]!;
      expect(TEAM_OF[shooter]).toBe(shot.possessionTeamId);
      const pos = shot.positions.find((p) => p.playerId === shooter)!.position;
      if (TEAM_OF[shooter] === PUERTO_AMBAR.id) expect(pos.x).toBeLessThan(14);
      else expect(pos.x).toBeGreaterThan(14);
    }
    const entries = r.events.filter((e) => e.kind === "organized_entry");
    // ME-07B v2 §2.4: creador y bloqueador se asignan por proyección entre
    // jugadores reales (no siempre O1/O5 del orden del quinteto), así que se
    // exige que cada equipo inicie acciones con sus propios jugadores.
    expect(entries.some((e) => e.actors.every((a) => TEAM_OF[a] === SIERRA_CLARA.id))).toBe(true);
    expect(entries.some((e) => e.actors.every((a) => TEAM_OF[a] === PUERTO_AMBAR.id))).toBe(true);
  });

  it("ninguna posesión posterior reinicia el fixture: ni 7:12/18 s ni la disposición de scenario.ts", () => {
    const scenario = getScenario("drop_con_ayuda");
    const fixture = [...scenario.offense, ...scenario.defense].map((s) => [s.playerId, s.initialPosition]);
    const later = r.events.filter((e) => e.kind === "possession_started" && e.possessionIndex > 1);
    expect(later.length).toBe(3);
    for (const e of later) {
      expect(e.gameClockMs).toBeLessThan(scenario.initialGameClockMs);
      const snapshot = e.positions.map((p) => [p.playerId, p.position]);
      expect(snapshot).not.toEqual(expect.arrayContaining(fixture));
      // La foto de inicio de posesión es la misma que la del cierre anterior (sin salto).
      const previous = r.events[r.events.indexOf(e) - 1]!;
      expect(e.positions).toEqual(previous.positions);
    }
    // Tampoco se renombra: al atacar Puerto Ámbar, su base no ocupa el puesto del O1 del fixture.
    const rivalStart = later.find((e) => e.possessionTeamId === PUERTO_AMBAR.id)!;
    const d1 = rivalStart.positions.find((p) => p.playerId === "D1")!.position;
    expect(d1).not.toEqual(scenario.offense[0]!.initialPosition);
  });
});

// (3) Fronteras de rebote y balón suelto.
describe("ME-03 (3): rebote ofensivo, rebote defensivo, tapón y balón suelto", () => {
  it("rebote ofensivo tras tocar aro: misma posesión, fase nueva, 14 s", () => {
    const r = findTramo((t) => t.events.some((e) => e.kind === "phase_started" && e.detail.phaseKind === "rebote_ofensivo"));
    const idx = r.events.findIndex((e) => e.kind === "phase_started" && e.detail.phaseKind === "rebote_ofensivo");
    const phase = r.events[idx]!;
    const rebound = r.events[idx - 1]!;
    expect(["rebound_secured", "rebound_contested"]).toContain(rebound.kind);
    expect(TEAM_OF[rebound.actors[0]!]).toBe(rebound.possessionTeamId);
    expect(phase.possessionIndex).toBe(rebound.possessionIndex);
    expect(phase.phaseIndex).toBe(rebound.phaseIndex + 1);
    expect(phase.shotClockMs).toBe(14_000);
  });

  it("rebote defensivo: nueva posesión del rival, 24 s", () => {
    // ME-04B (§3.2): el árbol de decisión ya no fuerza siempre la misma vía,
    // así que un rebote defensivo puede caer en la última posesión
    // estadística del tramo (sin frontera siguiente que observar); el caso
    // que esta prueba necesita exige además que exista un `possession_started`
    // real después del rebote.
    const r = findTramo((t) => {
      const idx = t.events.findIndex((e) => e.kind === "rebound_secured" && TEAM_OF[e.actors[0]!] !== e.possessionTeamId);
      if (idx === -1) return false;
      return t.events.slice(idx).some((e) => e.kind === "possession_started");
    });
    const idx = r.events.findIndex((e) => e.kind === "rebound_secured" && TEAM_OF[e.actors[0]!] !== e.possessionTeamId);
    const rebound = r.events[idx]!;
    const started = r.events.slice(idx).find((e) => e.kind === "possession_started")!;
    expect(started.atMs).toBe(rebound.atMs);
    expect(started.possessionIndex).toBe(rebound.possessionIndex + 1);
    expect(started.possessionTeamId).toBe(TEAM_OF[rebound.actors[0]!]);
    expect(started.shotClockMs).toBe(24_000);
  });

  it("tapón sin toque de aro recuperado por el mismo equipo: fase nueva sin reinicio ficticio del reloj", () => {
    const r = findTramo((t) =>
      t.events.some(
        (e, i) => e.kind === "shot_blocked" && t.events.slice(i).find((x) => x.kind === "loose_ball_recovered")?.detail.sameTeam === true,
      ),
    );
    const blockIdx = r.events.findIndex((e) => e.kind === "shot_blocked");
    const recovery = r.events.slice(blockIdx).find((e) => e.kind === "loose_ball_recovered")!;
    const phase = r.events.slice(blockIdx).find((e) => e.kind === "phase_started")!;
    const block = r.events[blockIdx]!;
    expect(phase.detail.phaseKind).toBe("recuperacion_propia");
    expect(phase.possessionIndex).toBe(block.possessionIndex);
    // El reloj siguió corriendo desde el tapón: ni 14 ni 24.
    expect(phase.shotClockMs).toBe(block.shotClockMs! - (recovery.atMs - block.atMs));
    expect(phase.shotClockMs).not.toBe(14_000);
    expect(phase.shotClockMs).not.toBe(24_000);
  });

  it("balón suelto recuperado por el rival: nueva posesión sin robo inventado", () => {
    const r = findTramo((t) => t.events.some((e) => e.kind === "loose_ball_recovered" && e.detail.sameTeam === false));
    const idx = r.events.findIndex((e) => e.kind === "loose_ball_recovered" && e.detail.sameTeam === false);
    const recovery = r.events[idx]!;
    const lost = r.events.slice(0, idx).reverse().find((e) => e.kind === "pass_control_lost" || e.kind === "shot_blocked")!;
    const between = r.events.slice(r.events.indexOf(lost), idx);
    expect(between.some((e) => e.kind === "turnover")).toBe(false);
    expect(between.every((e) => e.control.status !== "control" || e === lost)).toBe(true);
    const ended = r.events.slice(idx).find((e) => e.kind === "possession_ended")!;
    expect(ended.text).not.toMatch(/robo/);
    const started = r.events.slice(idx).find((e) => e.kind === "possession_started")!;
    expect(TEAM_OF[recovery.actors[0]!]).not.toBe(recovery.possessionTeamId);
    expect(started.possessionTeamId).toBe(TEAM_OF[recovery.actors[0]!]);
    expect(started.shotClockMs).toBe(24_000);
  });
});

// (4) Saques y relojes; fronteras exactas de 8/24/5 s.
describe("ME-03 (4): saques, reloj de partido y violaciones en frontera", () => {
  it("tras canasta en el primer cuarto el reloj de partido sigue corriendo y el de tiro arranca con el toque legal", () => {
    const r = findTramo((t) => t.events.some((e) => e.kind === "throw_in_completed" && e.possessionIndex > 1));
    const made = r.events.find((e) => e.kind === "shot_result")!;
    const touch = r.events.slice(r.events.indexOf(made)).find((e) => e.kind === "throw_in_completed")!;
    const awarded = r.events.slice(r.events.indexOf(made)).find((e) => e.kind === "throw_in_awarded")!;
    expect(awarded.possessionTeamId).not.toBe(TEAM_OF[made.actors[0]!]);
    expect(made.gameClockMs - touch.gameClockMs).toBe(touch.atMs - made.atMs);
    expect(awarded.shotClockMs).toBeNull();
    expect(touch.shotClockMs).toBe(24_000);
  });

  it("tras balón fuera el reloj de partido se detiene hasta el toque legal del saque", () => {
    const r = findTramo((t) => t.events.some((e, i) => e.kind === "out_of_bounds" && t.events.slice(i).some((x) => x.kind === "throw_in_completed")));
    const out = r.events.find((e) => e.kind === "out_of_bounds")!;
    const touch = r.events.slice(r.events.indexOf(out)).find((e) => e.kind === "throw_in_completed")!;
    expect(touch.atMs).toBeGreaterThan(out.atMs);
    expect(touch.gameClockMs).toBe(out.gameClockMs);
    expect(touch.possessionTeamId).not.toBe(out.possessionTeamId);
    expect(touch.shotClockMs).toBe(24_000);
  });

  it("fronteras exactas: 8 s, 5 s y 24 s se agotan en el milisegundo N·1000", () => {
    expect(evaluateBackcourtCount(1_000, 8_999).violation).toBe(false);
    expect(evaluateBackcourtCount(1_000, 9_000)).toEqual({ violation: true, violationAtMs: 9_000 });
    // Art. 28: el mismo equipo que saca otra vez en su pista trasera conserva lo consumido.
    expect(backcourtElapsedAfterThrowIn(true, 3_000)).toBe(3_000);
    expect(backcourtElapsedAfterThrowIn(false, 3_000)).toBe(0);
    expect(evaluateBackcourtCount(0, 4_999, 3_000).violation).toBe(false);
    expect(evaluateBackcourtCount(0, 5_000, 3_000).violationAtMs).toBe(5_000);
    expect(evaluateThrowInCount(2_000, 6_999).violation).toBe(false);
    expect(evaluateThrowInCount(2_000, 7_000)).toEqual({ violation: true, violationAtMs: 7_000 });
    expect(isReleasedBeforeShotClock(23_999, 24_000)).toBe(true);
    expect(isReleasedBeforeShotClock(24_000, 24_000)).toBe(false);
    expect(shotClockForThrowIn({ sameTeamKeepsBall: true, remainingMs: 9_300, inThrowingTeamFrontcourt: true })).toBe(9_300);
    expect(shotClockForThrowIn({ sameTeamKeepsBall: false, remainingMs: 9_300, inThrowingTeamFrontcourt: true })).toBe(14_000);
    expect(shotClockForThrowIn({ sameTeamKeepsBall: false, remainingMs: 9_300, inThrowingTeamFrontcourt: false })).toBe(24_000);
    expect(shotClockAfterLiveControl("recuperacion_propia_sin_aro", 9_300)).toBe(9_300);
  });

  it("violación de 24 s en el núcleo enlazado: balón muerto justo al agotarse, sin hechos posteriores ni tiempo negativo", () => {
    const scenario = getScenario("drop_con_ayuda");
    const startPositions = Object.fromEntries([...scenario.offense, ...scenario.defense].map((s) => [s.playerId, s.initialPosition]));
    const binding = Object.fromEntries(Object.keys(startPositions).map((slot) => [slot, slot]));
    const core = computePossessionCore(
      {
        scenarioId: "drop_con_ayuda",
        coverage: "drop",
        seed: 5,
        rulesetVersion: "FIBA-2026",
        labParametersVersion: "LAB-0.2",
        offensePlayers: SIERRA_CLARA.players,
        defensePlayers: PUERTO_AMBAR.players,
      },
      {
        linked: {
          binding,
          startPositions,
          shotClockMs: 1_200,
          gameClockMs: 400_000,
          rng: createResumableRandom(5),
          attackingPriority: "proteger_balance",
          entry: { kind: "organized_set" },
        },
      },
    );
    expect(core.terminal.kind).toBe("shot_clock_violation");
    const last = core.timeline[core.timeline.length - 1]!;
    expect(last.kind).toBe("shot_clock_violation");
    expect(last.atMs).toBe(1_200);
    expect(core.timeline.every((e) => e.atMs <= 1_200)).toBe(true);
    expect(core.ball.status).toBe("dead");
  });

  it("si se agota el reloj de partido, el tramo se detiene en ese instante sin adjudicar el final de cuarto", () => {
    const r = playTramo(
      buildTramoInput({
        seed: 3,
        coverage: "drop",
        offenseTeam: { ...SIERRA_CLARA, priority: "proteger_balance" },
        defenseTeam: { ...PUERTO_AMBAR, priority: "proteger_balance" },
      }),
      { initialGameClockMs: 20_000 },
    );
    expect(r.stop.cause).toBe("tiempo_agotado");
    expect(r.stop.atMs).toBe(20_000);
    expect(r.events.every((e) => e.atMs <= 20_000 && e.gameClockMs >= 0)).toBe(true);
    expect(r.events[r.events.length - 1]!.kind).toBe("tramo_stopped");
  });
});

// (5) Carga frente a balance: responsabilidades y desplazamientos antes del tiro.
describe("ME-03 (5): la prioridad de un equipo cambia encargos y desplazamientos antes de disputar el tiro", () => {
  const seed = 11;
  const balance = tramo(seed, ["proteger_balance", "proteger_balance"]);
  const crash = tramo(seed, ["cargar_rebote", "proteger_balance"]);

  it("el primer tiro es el mismo, pero uno carga con 1 y el otro con 2, antes de conocer el resultado", () => {
    const dutyA = balance.events.find((e) => e.kind === "rebound_duties_assigned")!;
    const dutyB = crash.events.find((e) => e.kind === "rebound_duties_assigned")!;
    expect(dutyA.atMs).toBe(dutyB.atMs);
    expect((dutyA.detail.crashers as unknown[]).length).toBe(1);
    expect((dutyB.detail.crashers as unknown[]).length).toBe(2);
    // Todo lo anterior al encargo es idéntico: la diferencia nace ahí.
    const before = (r: TramoResult) => comparable(r).slice(0, r.events.indexOf(r.events.find((e) => e.kind === "rebound_duties_assigned")!));
    expect(before(balance)).toEqual(before(crash));
    // En el instante del tiro oficial (antes de sembrar el rebote) ya hay posiciones distintas.
    const shotA = balance.events.find((e) => e.kind === "field_goal_attempt")!;
    const shotB = crash.events.find((e) => e.kind === "field_goal_attempt")!;
    expect(shotA.atMs).toBe(shotB.atMs);
    expect(shotA.positions).not.toEqual(shotB.positions);
    const moved = (e: TramoEvent) => e.positions.find((p) => p.playerId === (dutyB.detail.crashers as { playerId: string }[])[1]!.playerId)!.position;
    expect(moved(shotB).x).toBeGreaterThan(moved(shotA).x);
  });

  it("el cambio de plan puede alterar de verdad quién gana un rebote, sin prometer tasas", () => {
    const winners = (r: TramoResult) =>
      r.events.filter((e) => e.kind === "rebound_secured" || e.kind === "rebound_contested").map((e) => e.actors[0]);
    let differs = false;
    for (let s = 1; s <= 100 && !differs; s++) {
      const a = tramo(s, ["proteger_balance", "proteger_balance"]);
      const b = tramo(s, ["cargar_rebote", "proteger_balance"]);
      differs = JSON.stringify(winners(a)) !== JSON.stringify(winners(b));
    }
    expect(differs).toBe(true);
  });

  it("la lectura de transición depende de llegadas reales: con el portador por delante hay ventaja, sin él se organiza", () => {
    const at = (slot: string, id: string, x: number, y = 7.5): RaceParticipant => ({
      slot,
      id,
      position: { x, y },
      runSpeedMps: 4,
      lateralSpeedMps: 3,
      t23: 8,
    });
    const carrier = at("O1", "D1", 20);
    const late = [at("D1", "O1", 10), at("D2", "O2", 8)];
    expect(readTransition(carrier, [], late, 20).kind).toBe("penetracion");
    const back = [at("D1", "O1", 24), at("D2", "O2", 23)];
    expect(readTransition(carrier, [], back, 20).kind).toBe("sin_ventaja");
    // 2×1: el primer defensor para al portador; el segundo ya está situado
    // (por delante del portador, x=20) pero llega tarde al compañero.
    const oneBack = [at("D1", "O1", 25), at("D2", "O2", 20, 0)];
    expect(readTransition(carrier, [at("O2", "D2", 21, 4)], oneBack, 20).kind).toBe("superioridad");
    // El mismo segundo defensor, pero todavía por detrás del portador
    // (x=5 < 20): no cuenta como protector todavía, aunque su carrera
    // completa lo haría llegar (ME-03, opción B) — sin ese defensor de
    // verdad situado, la ventaja resuelta es la penetración/pase directo,
    // no un 2×1 con alguien que ni siquiera ha cruzado la mitad de la pista.
    const oneTrailing = [at("D1", "O1", 25), at("D2", "O2", 5)];
    expect(readTransition(carrier, [at("O2", "D2", 21, 4)], oneTrailing, 20).kind).not.toBe("superioridad");
    // Con 2 s o menos de reloj no se habilita finalizar en carrera.
    expect(readTransition(carrier, [], late, 2).kind).toBe("sin_ventaja");
    // Segunda oportunidad: criterio de la opción 1 (carril al aro antes que el protector).
    expect(readSecondChance(at("O5", "O5", ATTACKED_HOOP.x - 0.5), [at("D5", "D5", 20)]).putback).toBe(true);
    expect(readSecondChance(at("O5", "O5", 22), [at("D5", "D5", ATTACKED_HOOP.x - 0.2)]).putback).toBe(false);
  });
});

// (5b) Aclaración ME-03 opción B: superioridad numérica al cruzar el medio
// campo, con al menos un tercer atacante ("el exterior") además del
// corredor. Posiciones y velocidades construidas a mano, no del fixture:
// el fixture real nunca abre esta ventana (ver informe de barrido en el
// prompt archivado y en docs/match/ACTIONS.md), así que este mecanismo se
// demuestra con geometría controlada, igual que el 2×1 de (5).
describe("ME-03 (5b): 3×2 real — opción B de la ventaja temprana", () => {
  const at = (slot: string, id: string, x: number, y: number, runSpeedMps: number): RaceParticipant => ({
    slot,
    id,
    position: { x, y },
    runSpeedMps,
    lateralSpeedMps: 3,
    t23: 8,
  });

  it("3×2 ejecutable: el portador y el corredor quedan contenidos, pero el exterior recibe y tira sin un tercer defensor", () => {
    const carrier = at("O1", "D1", 10, 7.5, 5); // 3,285 s al aro
    const firstDefender = at("D1", "O1", 25, 7.5, 4); // 0,356 s: contiene al portador
    const secondDefender = at("D2", "O2", 15, 7.5, 1); // 11,425 s: muy lento, pero ya situado
    const corredor = at("O2", "D2", 20, 7.5, 5); // 1,285 s: bate al segundo defensor
    const exterior = at("O3", "D3", 18, 7.5, 4); // 2,106 s: el receptor abierto

    const read = readTransition(carrier, [corredor, exterior], [firstDefender, secondDefender], 20);

    expect(read.kind).toBe("superioridad_3x2");
    if (read.kind !== "superioridad_3x2") return;
    expect(read.contained.id).toBe(corredor.id);
    expect(read.receiver.id).toBe(exterior.id);
    expect(read.thirdDefender).toBeNull();
    // Ejecutable de verdad: el pase llega y el tiro puede prepararse cuando
    // el receptor ya está esperando, sin que ningún defensor lo impida.
    expect(read.passArrivalSeconds).toBeGreaterThanOrEqual(read.passReleaseSeconds);
  });

  it("un tercer defensor ya situado cierra también al exterior: el ataque se organiza, no forcejea un tiro imposible", () => {
    // El pase corto del 2×1 sale cuando el portador llega al aro (3,285 s)
    // más la liberación (0,18 s): ningún receptor puede recibir antes de
    // 3,465 s en este mecanismo. Para que el segundo defensor sea real
    // (batido por el corredor) tiene que llegar después de esa liberación;
    // para que el tercero cierre de verdad al exterior, el exterior debe
    // llegar por su propia carrera (más lento que la liberación), no por el
    // suelo del pase corto.
    const carrier = at("O1", "D1", 10, 7.5, 5); // 3,285 s
    const firstDefender = at("D1", "O1", 25, 7.5, 4); // 0,356 s: contiene al portador
    const secondDefender = at("D2", "O2", 12.025, 7.5, 4); // 3,60 s: el corredor sí lo bate
    const thirdDefender = at("D3", "O3", 11.225, 7.5, 4); // 3,80 s: cierra al exterior
    const corredor = at("O2", "D2", 20, 7.5, 5); // 1,285 s de carrera; recibe a los 3,465 s
    const exterior = at("O3", "D3", 14, 7.5, 3); // 4,14 s de carrera propia: llega después del tercer defensor

    const read = readTransition(carrier, [corredor, exterior], [firstDefender, secondDefender, thirdDefender], 20);

    // El tercer defensor ya situado cierra al exterior: se resuelve como el
    // 2×1 ordinario (pase al corredor bajo contención), no como 3×2 libre.
    expect(read.kind).toBe("superioridad");
  });

  it("ambos defensores cierran ambas opciones: sin ventaja, ataque organizado", () => {
    const carrier = at("O1", "D1", 10, 7.5, 5); // 3,285 s
    const firstDefender = at("D1", "O1", 25, 7.5, 4); // 0,356 s: contiene al portador
    const secondDefender = at("D2", "O2", 15, 7.5, 3); // 3,808 s: más lento que el portador, pero...
    const corredor = at("O2", "D2", 16, 7.5, 1); // 10,425 s: mucho más lento que el segundo defensor

    const read = readTransition(carrier, [corredor], [firstDefender, secondDefender], 20);

    expect(read.kind).toBe("sin_ventaja");
  });

  it("cambiar la prioridad de rebote altera de verdad cuántos defensores ya están situados al cruzar, sin resultados por cuota", () => {
    // Mismo bloque de defensores; solo cambia qué tan atrás queda el
    // segundo defensor (equivalente a "Cargar rebote" dejando a alguien
    // más atrasado en el retorno). No hay ninguna probabilidad ni cuota
    // involucrada: es geometría real de llegada.
    const carrier = at("O1", "D1", 14, 7.5, 4);
    const firstDefender = at("D1", "O1", 25, 7.5, 4);
    const readWithBothBack = readTransition(
      carrier,
      [],
      [firstDefender, at("D2", "O2", 19, 7.5, 4)], // ya situado (x=19 ≥ 14)
      20,
    );
    const readWithOneTrailing = readTransition(
      carrier,
      [],
      [firstDefender, at("D2", "O2", 12, 7.5, 4)], // todavía por detrás (x=12 < 14)
      20,
    );
    // Misma decisión final en este caso concreto (el primer defensor ya
    // contiene al portador en ambos), pero el número de protectores
    // disponibles y sus tiempos de llegada difieren de verdad: no es un
    // efecto de cuota o probabilidad, es la geometría real del cruce.
    expect(readWithBothBack.kind).toBe("sin_ventaja");
    expect(readWithOneTrailing.kind).toBe("sin_ventaja");
    if (readWithBothBack.kind === "sin_ventaja" && readWithOneTrailing.kind === "sin_ventaja") {
      expect(readWithBothBack.reason).not.toBe(readWithOneTrailing.reason);
    }
  });
});

// (6) Guardián.
describe("ME-03 (6): el guardián detiene y explica un ciclo inválido", () => {
  it("una posesión que encadena más fases que el límite se detiene con diagnóstico visible", () => {
    let stopped: TramoResult | null = null;
    for (let seed = 1; seed <= 60 && !stopped; seed++) {
      const r = playTramo(
        buildTramoInput({
          seed,
          coverage: "drop",
          offenseTeam: { ...SIERRA_CLARA, priority: "cargar_rebote" },
          defenseTeam: { ...PUERTO_AMBAR, priority: "cargar_rebote" },
        }),
        { limits: { maxPhasesPerPossession: 1 } },
      );
      if (r.stop.cause === "guardian") stopped = r;
    }
    expect(stopped).not.toBeNull();
    const last = stopped!.events[stopped!.events.length - 1]!;
    expect(last.kind).toBe("tramo_stopped");
    expect(stopped!.stop.explanation).toMatch(/fases/);
    // No se inventa desenlace: la posesión detenida queda abierta.
    expect(stopped!.possessions[stopped!.possessions.length - 1]!.endMs).toBeNull();
  });
});

// (7) ME-01/ME-02 intactos; estadística del tramo derivada de hechos.
describe("ME-03 (7): posesión individual y lotes rápidos conservan su recorrido; estadística sin dobles conteos", () => {
  it("runPossession y los dos lotes rápidos producen exactamente la misma huella que antes de ME-03", () => {
    const out: unknown[] = [];
    for (const scenarioId of ["drop_con_ayuda", "drop_sin_ayuda", "closeout_tardio_con_contacto"] as const)
      for (const coverage of ["drop", "trampa"] as const)
        for (let seed = 1; seed <= 40; seed++) {
          const s = runPossession({
            scenarioId,
            coverage,
            seed,
            rulesetVersion: "FIBA-2026",
            labParametersVersion: "LAB-0.3",
            offensePlayers: LAB_ROSTER_FIXTURE[0]!.players,
            defensePlayers: LAB_ROSTER_FIXTURE[1]!.players,
          });
          out.push([s.terminal, s.ball, s.facts.map((f) => [f.kind, f.atMs, f.actors, f.text, f.positions])]);
        }
    const base = {
      seed: 1,
      rulesetVersion: "FIBA-2026" as const,
      labParametersVersion: "LAB-0.3" as const,
      offensePlayers: LAB_ROSTER_FIXTURE[0]!.players,
      defensePlayers: LAB_ROSTER_FIXTURE[1]!.players,
    };
    out.push(compareHelpToggle(base, 200), compareCoverageBatch(base, 200));
    // Huella de regresión del núcleo detallado y del resolvedor rápido,
    // recalculada en ME-04B (desplazamiento real de O1/D1, primera lectura
    // ponderada por valor y modelo R_contest de oposición, §§3.1-3.3): un
    // cambio intencional de la mecánica deportiva, no una regresión. Si un
    // futuro bloque cambia de nuevo el árbol de decisión o las fórmulas de
    // contacto/oposición, esta huella debe recalcularse otra vez aquí mismo.
    // Recalculada otra vez en ME-07B v2 §2.1 (retraso real del cierre de
    // rebote, tirador sin cierre durante su gesto y caída LAB-0.4) y en §2.3
    // (el lote de trampa: D5 sale al preparar la pantalla).
    expect(createHash("sha256").update(JSON.stringify(out)).digest("hex")).toBe(
      "00632ae575f48625c7b7c9787ad9f6d28528543469762ce6c616bc3cd49bf365",
    );
  });

  it("FGA/FGM/FTA/FTM y puntos del tramo salen de hechos, también con rebote y segundo tiro", () => {
    let withSecondShot = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const r = tramo(seed, ["cargar_rebote", "cargar_rebote"]);
      for (const team of [SIERRA_CLARA.id, PUERTO_AMBAR.id]) {
        const box = r.box[team]!;
        const fga = r.events.filter((e) => e.kind === "field_goal_attempt" && TEAM_OF[e.actors[0]!] === team);
        const fts = r.events.filter((e) => e.kind === "free_throws_result" && TEAM_OF[e.actors[0]!] === team);
        expect(box.fieldGoalAttempts2 + box.fieldGoalAttempts3).toBe(fga.length);
        expect(box.freeThrowAttempts).toBe(fts.length);
        expect(box.points).toBe(2 * box.fieldGoalMade2 + 3 * box.fieldGoalMade3 + box.freeThrowMade);
        expect(r.finalScore[team]).toBe(box.points);
      }
      for (const p of r.possessions) {
        const shots = r.events.filter((e) => e.possessionIndex === p.index && e.kind === "shot_prepared");
        const fga = r.events.filter((e) => e.possessionIndex === p.index && e.kind === "field_goal_attempt");
        expect(fga.length).toBeLessThanOrEqual(shots.length);
        if (p.phases.some((ph) => ph.kind === "rebote_ofensivo") && shots.length >= 2) withSecondShot++;
      }
    }
    expect(withSecondShot).toBeGreaterThan(0);
  });
});
