import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { playFullGame, type PlayFullGameOptions } from "./play-full-game";
import { buildGameInput, type GameResult } from "./game-model";
import { projectBoxScore, reconcileBoxScore } from "./box-score";
import {
  FIBA_2026,
  adjudicateBuzzerShot,
  adjudicateDefensiveFoul,
  adjudicateOpeningJump,
  adjudicatePeriodEnd,
  arrowAfterAlternatingThrowIn,
  attackDirectionForPeriod,
  effectiveJumpReachCm,
  gameClockStopsOnMadeBasket,
  initialArrowTeam,
  isReleasedBeforeBuzzer,
  shotClockAfterDefensiveFoulThrowIn,
  substitutionOpportunity,
  teamFoulPeriodKey,
} from "./fiba-2026-rules";
import { planSubstitutions, type RotationPlayerState } from "./substitution-policy";
import { buildRuleBoundaryCases } from "./rule-boundary-fixtures";
import { SIERRA_CLARA, PUERTO_AMBAR, LAB_ROSTER_FIXTURE } from "../players/lab-roster-fixture";
import { LAB_DECLARED_ROLES } from "../players/functional-roles";
import type { PlayerProfile } from "../players/player-profile";
import type { DefensiveCoverage } from "../lab/match-input";
import type { ReboundPriority, TramoEvent } from "../sequence/tramo-model";
import { playTramo } from "../sequence/play-tramo";
import { buildTramoInput } from "../sequence/tramo-model";
import { evaluateContainmentContact } from "../simulation/resolvers/foul-resolver";
import { computePossessionCore } from "../simulation/possession-core";
import { createResumableRandom } from "../random/seeded-random";
import { getScenario } from "../lab/scenario";

/**
 * Pruebas discriminantes de ME-04 (prompt §8, puntos 1–7), sin base de
 * datos. Las semillas naturales se eligieron barriendo el fixture real
 * (sin ajustar perfiles ni coeficientes); los mecanismos que ese fixture no
 * alcanza se prueban con geometría o perfiles construidos a mano y
 * declarados como tales.
 */
const SC = SIERRA_CLARA.id;
const PA = PUERTO_AMBAR.id;

interface Config {
  readonly coverage: readonly [DefensiveCoverage, DefensiveCoverage];
  readonly priority: readonly [ReboundPriority, ReboundPriority];
  readonly home?: readonly PlayerProfile[];
  readonly away?: readonly PlayerProfile[];
}

const BASE: Config = { coverage: ["drop", "drop"], priority: ["proteger_balance", "proteger_balance"] };
const TRAP_CRASH: Config = { coverage: ["trampa", "trampa"], priority: ["cargar_rebote", "cargar_rebote"] };

function input(seed: number, cfg: Config = BASE) {
  return buildGameInput({
    seed,
    home: { id: SC, name: SIERRA_CLARA.name, players: cfg.home ?? SIERRA_CLARA.players, priority: cfg.priority[0], coverage: cfg.coverage[0] },
    away: { id: PA, name: PUERTO_AMBAR.name, players: cfg.away ?? PUERTO_AMBAR.players, priority: cfg.priority[1], coverage: cfg.coverage[1] },
  });
}

const cache = new Map<string, GameResult>();
function game(seed: number, cfg: Config = BASE, options: PlayFullGameOptions = {}): GameResult {
  const key = JSON.stringify([seed, cfg.coverage, cfg.priority, !!cfg.home, !!cfg.away, options]);
  if (!cfg.home && !cfg.away && cache.has(key)) return cache.get(key)!;
  const r = playFullGame(input(seed, cfg), options);
  if (!cfg.home && !cfg.away) cache.set(key, r);
  return r;
}

const TEAM_OF: Readonly<Record<string, string>> = Object.fromEntries(
  LAB_ROSTER_FIXTURE.flatMap((t) => t.players.map((p) => [p.id, t.id])),
);

function comparable(r: GameResult) {
  return r.events.map((e) => [e.kind, e.atMs, e.period, e.actors, e.text, e.gameClockMs, e.shotClockMs, e.score, e.onCourtIds, e.positions]);
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Semilla natural publicada (drop/drop, proteger balance): ver el plan manual de ME-04. */
const PUBLISHED_SEED = 82;

// (1) Reproducibilidad, 5v5, sentido tras C3, flecha y quintetos.
describe("ME-04 (1): misma foto y semilla → mismo partido; 5v5 y sentido reglamentario", () => {
  const a = game(PUBLISHED_SEED);

  it("reproduce hechos, relojes, rotación, faltas y acta", () => {
    const b = playFullGame(input(PUBLISHED_SEED));
    expect(a.stop.cause).toBe("final");
    expect(hash(comparable(b))).toBe(hash(comparable(a)));
    expect(b.substitutions).toEqual(a.substitutions);
    expect(b.box).toEqual(a.box);
    expect(b.gameId).toBe(a.gameId);
  });

  it("editar un perfil después de construir la foto no reescribe el partido", () => {
    const editable = structuredClone(SIERRA_CLARA.players) as PlayerProfile[];
    const photo = buildGameInput({
      seed: PUBLISHED_SEED,
      home: { id: SC, name: SIERRA_CLARA.name, players: editable, priority: "proteger_balance", coverage: "drop" },
      away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: "drop" },
    });
    (editable[4]!.attributes as Record<string, number>).T01 = 1;
    expect(hash(comparable(playFullGame(photo)))).toBe(hash(comparable(a)));
  });

  it("en cada hecho hay exactamente cinco jugadores reales por equipo, sin repetidos ni excluidos", () => {
    for (const e of a.events) {
      expect(e.onCourtIds).toHaveLength(10);
      expect(new Set(e.onCourtIds).size).toBe(10);
      expect(e.onCourtIds.filter((id) => TEAM_OF[id] === SC)).toHaveLength(5);
      expect(e.positions.map((p) => p.playerId)).toEqual(e.onCourtIds);
      for (const actor of e.actors) {
        if (e.kind === "substitution") continue;
        if (TEAM_OF[actor]) expect(e.onCourtIds).toContain(actor);
      }
    }
    // Los dos banquillos entran de verdad.
    expect(new Set(a.substitutions.map((s) => s.teamId))).toEqual(new Set([SC, PA]));
  });

  it("cada equipo ataca su aro en la primera mitad y cambia de canasta en C3", () => {
    const shots = a.events.filter((e) => e.kind === "field_goal_attempt");
    for (const shot of shots) {
      const shooter = shot.actors[0]!;
      const x = shot.positions.find((p) => p.playerId === shooter)!.position.x;
      const homeRight = shot.period < 3;
      const attacksRight = TEAM_OF[shooter] === SC ? homeRight : !homeRight;
      if (attacksRight) expect(x).toBeGreaterThan(14);
      else expect(x).toBeLessThan(14);
    }
    expect(attackDirectionForPeriod(FIBA_2026, 0, 4)).toBe(attackDirectionForPeriod(FIBA_2026, 0, 5));
  });

  it("salto ME-04-JUMP-1, flecha al equipo sin primer control y alternancia en cada inicio de período", () => {
    const jump = a.events.find((e) => e.kind === "jump_ball")!;
    const jumpers = jump.detail.jumpers as { playerId: string; standingReachCm: number; f06: number; variationCm: number; reachCm: number }[];
    for (const j of jumpers) {
      expect(j.reachCm).toBeCloseTo(effectiveJumpReachCm(j.standingReachCm, j.f06, j.variationCm), 9);
      expect(Math.abs(j.variationCm)).toBeLessThanOrEqual(5);
    }
    expect(jumpers.map((j) => j.playerId)).toEqual(["O5", "D5"]);
    const firstControl = a.events.find((e) => e.kind === "jump_ball_control")!;
    const firstTeam = TEAM_OF[firstControl.actors[0]!]!;
    const arrows = a.events.filter((e) => e.kind === "alternating_arrow").map((e) => e.detail.arrowTeamId);
    expect(arrows[0]).toBe(initialArrowTeam(firstTeam, [SC, PA]));
    // C2, C3, C4: saca el equipo de la flecha y la flecha se invierte al terminar el saque.
    const starts = a.possessions.filter((p) => p.startReason.includes("de alternancia"));
    expect(starts.map((p) => p.teamId)).toEqual([arrows[0], arrows[1], arrows[2]]);
    for (let i = 1; i < arrows.length; i++) expect(arrows[i]).not.toBe(arrows[i - 1]);
  });

  it("cambiar la prioridad de Sierra Clara solo altera, desde su primer tiro, sus encargos de rebote", () => {
    const changed = game(PUBLISHED_SEED, { ...BASE, priority: ["cargar_rebote", "proteger_balance"] });
    const key = (e: TramoEvent) => JSON.stringify([e.kind, e.atMs, e.actors, e.text, e.gameClockMs, e.positions]);
    const i = a.events.findIndex((e, k) => key(e) !== key(changed.events[k]!));
    expect(i).toBeGreaterThan(0);
    expect(a.events[i]!.kind).toBe("rebound_duties_assigned");
    expect(a.events[i]!.possessionTeamId).toBe(SC);
  });

  it("cambiar la cobertura de Puerto Ámbar solo altera, desde su primera defensa del bloqueo, esa acción", () => {
    const changed = game(PUBLISHED_SEED, { ...BASE, coverage: ["drop", "trampa"] });
    const i = a.events.findIndex((e, k) => JSON.stringify([e.kind, e.text, e.atMs]) !== JSON.stringify([changed.events[k]!.kind, changed.events[k]!.text, changed.events[k]!.atMs]));
    expect(i).toBeGreaterThan(0);
    expect(changed.events[i]!.possessionTeamId).toBe(SC);
    expect(changed.events[i]!.kind).toBe("organized_entry");
    expect(changed.events[i]!.text).toContain("trampa");
  });
});

// (2) Bocina, reset 24/14 y reloj de partido.
describe("ME-04 (2): bocina, tiro en el aire, reset del reloj de lanzamiento y reloj de partido", () => {
  it("tiro soltado antes, en o después de la bocina", () => {
    expect(isReleasedBeforeBuzzer(599, 600)).toBe(true);
    expect(isReleasedBeforeBuzzer(600, 600)).toBe(false);
    expect(isReleasedBeforeBuzzer(601, 600)).toBe(false);
    expect(adjudicateBuzzerShot({ releaseMs: 599, buzzerMs: 600, made: true, shotPoints: 3 }).pointsAwarded).toBe(3);
    expect(adjudicateBuzzerShot({ releaseMs: 600, buzzerMs: 600, made: true, shotPoints: 3 })).toMatchObject({ countsAsFieldGoalAttempt: false, pointsAwarded: 0 });
  });

  it("partido natural: un tiro soltado antes de la bocina final entra y cuenta; después solo se resuelve ese tiro", () => {
    // Semilla recalculada en ME-07A (§3.2, organize() cambia qué
    // posesiones llegan a la bocina final) y otra vez en ME-07B v2 §2.1
    // (el cierre de rebote y la caída del tirador cambian qué posesiones
    // llegan a la bocina) y en §2.2 (el selector de familia proyecta cada
    // familia hasta su primera lectura): la semilla 151 conserva un tiro
    // (ahora de dos, antes un triple) soltado antes de la bocina final del
    // partido que entra y solo se resuelve ese tiro. §2.3 (trampa desde la
    // preparación y defensa que aprende) lo lleva a la semilla 309, y §2.4
    // (asignación de creador/bloqueador por proyección) a la 179 y la lectura
    // del receptor del roll a la 316; §2.5 (faltas por contacto real) a la 110;
    // el bloqueo lateral, el ICE y «a la altura» (LAB-0.7) a la 325; la ficha
    // Horns (LAB-0.8) y la proyección frente a la defensa observada (v2-4) a la 787.
    const r = game(787);
    const i = r.events.findIndex((e) => e.kind === "buzzer" && e.detail.shotInFlight === true);
    expect(i).toBeGreaterThan(0);
    const buzzer = r.events[i]!;
    expect(buzzer.detail.shotReleaseMs as number).toBeLessThan(buzzer.atMs);
    const after = r.events.slice(i + 1, r.events.findIndex((e, k) => k > i && e.kind === "period_ended"));
    expect(after.map((e) => e.kind)).toEqual(["field_goal_attempt", "shot_result", "possession_ended"]);
    expect(after[0]!.atMs).toBeGreaterThan(buzzer.atMs);
    expect(after[0]!.detail.made).toBe(true);
    const shooter = after[0]!.actors[0]!;
    expect(r.box.players[shooter]!.points).toBeGreaterThan(0);
    expect(r.finalScore[TEAM_OF[shooter]!]).toBe(after[1]!.score[TEAM_OF[shooter]!]);
  });

  it("partido natural: un fallo soltado a tiempo no inventa rebote tras la bocina", () => {
    // Semilla recalculada en ME-07A (§3.2, organize() cambia qué posesiones
    // llegan a la bocina): PUBLISHED_SEED sigue produciendo un fallo
    // soltado a tiempo sin rebote inventado tras la bocina final.
    // ME-07B v2 §2.1 (cierre de rebote y caída del tirador) desplaza ese
    // caso a la semilla 53, y §2.3 (defensa auto con trampa en competencia)
    // a la 14, y §2.4 (asignación de creador/bloqueador y lectura del receptor) a la 60; §2.5 (faltas por contacto) a la 49; LAB-0.7 (bloqueo lateral, ICE) a la 69; la ficha Horns (LAB-0.8) y la proyección frente a la defensa observada (v2-4) a la 86.
    const r = game(86);
    const i = r.events.findIndex((e) => e.kind === "buzzer" && e.detail.shotInFlight === true);
    const next = r.events.slice(i + 1, i + 4).map((e) => e.kind);
    expect(next).toEqual(["field_goal_attempt", "possession_ended", "period_ended"]);
    expect(r.events[i + 1]!.detail.made).toBe(false);
  });

  it("después de cada bocina no empieza ninguna acción: solo se resuelve el tiro ya soltado o sus libres", () => {
    for (const seed of [PUBLISHED_SEED, 121, 3]) {
      const r = game(seed);
      r.events.forEach((e, i) => {
        if (e.kind !== "buzzer") return;
        const end = r.events.findIndex((x, k) => k > i && x.kind === "period_ended");
        for (const x of r.events.slice(i + 1, end)) {
          expect(["field_goal_attempt", "shot_result", "shot_blocked", "shooting_foul", "personal_foul", "free_throws_result", "substitution", "possession_ended"]).toContain(x.kind);
        }
      });
    }
  });

  it("saque tras falta sin tiro: 24 s en pista trasera; en delantera se conserva con ≥14 s y pasa a 14 s con 13 s o menos", () => {
    expect(shotClockAfterDefensiveFoulThrowIn({ inThrowingTeamFrontcourt: false, remainingMs: 3_000 })).toBe(24_000);
    expect(shotClockAfterDefensiveFoulThrowIn({ inThrowingTeamFrontcourt: true, remainingMs: 13_999 })).toBe(14_000);
    expect(shotClockAfterDefensiveFoulThrowIn({ inThrowingTeamFrontcourt: true, remainingMs: 14_000 })).toBe(14_000);
    expect(shotClockAfterDefensiveFoulThrowIn({ inThrowingTeamFrontcourt: true, remainingMs: 14_001 })).toBe(14_001);
    expect(shotClockAfterDefensiveFoulThrowIn({ inThrowingTeamFrontcourt: true, remainingMs: 21_300 })).toBe(21_300);
  });

  it("la canasta solo detiene el reloj de partido desde 2:00 en C4 y prórroga", () => {
    expect(gameClockStopsOnMadeBasket(FIBA_2026, 3, 30_000)).toBe(false);
    expect(gameClockStopsOnMadeBasket(FIBA_2026, 4, 120_001)).toBe(false);
    expect(gameClockStopsOnMadeBasket(FIBA_2026, 4, 120_000)).toBe(true);
    expect(gameClockStopsOnMadeBasket(FIBA_2026, 6, 250_000)).toBe(false);
    expect(gameClockStopsOnMadeBasket(FIBA_2026, 6, 90_000)).toBe(true);
    // En el partido: tras cada canasta, ¿corre el reloj hasta el toque del saque?
    const r = game(PUBLISHED_SEED);
    let checked = 0;
    r.events.forEach((e, i) => {
      if (e.kind !== "shot_result") return;
      const touch = r.events.slice(i + 1).find((x) => x.kind === "throw_in_completed" || x.kind === "period_ended")!;
      if (touch.kind !== "throw_in_completed" || touch.period !== e.period) return;
      const stops = gameClockStopsOnMadeBasket(FIBA_2026, e.period, e.gameClockMs);
      if (stops) expect(touch.gameClockMs).toBe(e.gameClockMs);
      else expect(touch.gameClockMs).toBeLessThan(e.gameClockMs);
      checked++;
    });
    expect(checked).toBeGreaterThan(50);
  });
});

// Perfiles construidos a mano (no el fixture): aleros defensivos muy rápidos y
// continuadores muy lentos para que la ayuda llegue mientras el continuador
// todavía rueda. Solo para alcanzar la vía sin tiro, el bonus y la exclusión.
function handBuilt(players: readonly PlayerProfile[]): PlayerProfile[] {
  return players.map((p) => {
    const roles = LAB_DECLARED_ROLES[p.id] ?? [];
    const extra: Record<string, number> = {};
    if (roles.includes(3)) Object.assign(extra, { F04: 15, M01: 15, M05: 15, T23: 15, F03: 1 });
    if (roles.includes(4) || roles.includes(5)) Object.assign(extra, { F01: 1, M04: 1 });
    return { ...p, attributes: { ...p.attributes, ...extra } } as PlayerProfile;
  });
}
const HAND_BUILT: Config = { ...BASE, home: handBuilt(SIERRA_CLARA.players), away: handBuilt(PUERTO_AMBAR.players) };

// (3) Faltas de equipo, bonus, exclusión, libres y saque.
describe("ME-04 (3): faltas personales y de equipo, bonus y quinta personal", () => {
  it("4.ª y 5.ª falta de equipo en C1 y en C4/prórroga; la de tiro no depende del bonus", () => {
    const fourth = adjudicateDefensiveFoul(FIBA_2026, { type: "sin_tiro", teamFoulsInPeriodBefore: 3, foulerPersonalFoulsBefore: 0 });
    const fifth = adjudicateDefensiveFoul(FIBA_2026, { type: "sin_tiro", teamFoulsInPeriodBefore: 4, foulerPersonalFoulsBefore: 0 });
    expect(fourth).toMatchObject({ teamFoulsAfter: 4, teamInPenalty: false, sanction: { kind: "saque" } });
    expect(fifth).toMatchObject({ teamFoulsAfter: 5, teamInPenalty: true, sanction: { kind: "libres", count: 2, byBonus: true } });
    const shootingInBonus = adjudicateDefensiveFoul(FIBA_2026, { type: "tiro", shotType: "three_point", madeShot: false, teamFoulsInPeriodBefore: 7, foulerPersonalFoulsBefore: 1 });
    expect(shootingInBonus.sanction).toEqual({ kind: "libres", count: 3, byBonus: false });
    expect([1, 2, 3, 4, 5, 6, 7].map((p) => teamFoulPeriodKey(FIBA_2026, p))).toEqual([1, 2, 3, 4, 4, 4, 4]);
  });

  it("la contención solo es falta si el continuador aún corre y el defensor no había llegado y frenado", () => {
    expect(evaluateContainmentContact({ contactSeconds: null, attackerMoving: false, defenderArrivalSeconds: 1, brakingExtraSeconds: 0.1 })).toBe("sin_contacto");
    expect(evaluateContainmentContact({ contactSeconds: 1.25, attackerMoving: false, defenderArrivalSeconds: 1.5, brakingExtraSeconds: 0.125 })).toBe("contencion_legal");
    // Frontera exacta: llegada + frenada = instante de contacto → posición legal establecida.
    expect(evaluateContainmentContact({ contactSeconds: 1.25, attackerMoving: true, defenderArrivalSeconds: 1.125, brakingExtraSeconds: 0.125 })).toBe("contencion_legal");
    expect(evaluateContainmentContact({ contactSeconds: 1.25, attackerMoving: true, defenderArrivalSeconds: 1.126, brakingExtraSeconds: 0.125 })).toBe("contacto_ilegal");
  });

  it("perfiles construidos a mano: contacto ilegal verificable, bonus, libres, saque, exclusión y ningún sexto personal", () => {
    const r = game(1, HAND_BUILT);
    const nonShooting = r.events.filter((e) => e.kind === "non_shooting_foul");
    expect(nonShooting.length).toBeGreaterThan(0);
    for (const e of nonShooting) {
      // ME-07B v2 §2.5: las faltas de contacto real en trampa o rebote llevan
      // su situación y la probabilidad adjudicada (LAB-0.6); las de la
      // puerta de contención conservan todo su detalle geométrico.
      if (e.detail.situation !== undefined) {
        expect(["trampa", "rebote_sobre_espalda"]).toContain(e.detail.situation);
        expect(e.detail.foulProbability as number).toBeGreaterThan(0);
        expect(e.actors.length).toBe(2);
        continue;
      }
      // El hecho lleva actor, posiciones, tiempo, contacto y legalidad.
      expect(e.detail.legality).toBe("contacto_ilegal");
      expect(e.detail.distanceMeters as number).toBeLessThanOrEqual(0.7);
      expect(e.detail.defenderSetMs as number).toBeGreaterThan(e.detail.contactMs as number);
      expect(e.detail.attackerArrivalMs as number).toBeGreaterThan(e.detail.contactMs as number);
    }
    const bonus = r.fouls.filter((f) => f.type === "sin_tiro" && f.sanction.kind === "libres");
    const beforeBonus = r.fouls.filter((f) => f.type === "sin_tiro" && f.sanction.kind === "saque");
    expect(bonus.length).toBeGreaterThan(0);
    expect(beforeBonus.length).toBeGreaterThan(0);
    for (const f of bonus) expect(f.teamFoulsAfter).toBeGreaterThanOrEqual(5);
    for (const f of beforeBonus) expect(f.teamFoulsAfter).toBeLessThanOrEqual(4);
    // Cada falta con libres por bonus: dos libres del jugador objeto de la falta, en su orden.
    // (Salvo la última falta si el guardián detuvo el partido en esa misma ventana.)
    for (const f of bonus.filter((x) => r.stop.cause === "final" || x.atMs < r.stop.atMs)) {
      const k = r.events.findIndex((e) => e.kind === "personal_foul" && e.atMs === f.atMs && e.actors[0] === f.foulerId);
      const fts = r.events.slice(k).filter((e) => e.kind === "free_throws_result").slice(0, 2);
      expect(fts.map((e) => [e.actors[0], e.detail.index, e.detail.of])).toEqual([[f.fouledId, 1, 2], [f.fouledId, 2, 2]]);
    }
    // Saque antes del bonus: el mismo equipo conserva el balón, con la regla 24/14 aplicada.
    const throwIns = r.events.flatMap((e, k) => {
      if (e.kind !== "personal_foul" || (e.detail.sanction as { kind: string }).kind !== "saque") return [];
      const next = r.events.slice(k + 1).find((x) => x.kind === "throw_in_awarded" || x.kind === "free_throws_result" || x.kind === "game_ended");
      return next && next.kind === "throw_in_awarded" ? [[e, next] as const] : [];
    });
    expect(throwIns.length).toBeGreaterThan(0);
    for (const [foul, throwIn] of throwIns) {
      expect(TEAM_OF[throwIn.actors[0]!]).toBe(TEAM_OF[foul.actors[1]!]);
      expect(throwIn.possessionIndex).toBe(foul.possessionIndex);
      const touch = r.events.slice(r.events.indexOf(throwIn)).find((x) => x.kind === "throw_in_completed")!;
      const frontcourt = TEAM_OF[throwIn.actors[0]!] === SC ? (throwIn.period < 3 ? (throwIn.detail.spot as { x: number }).x > 14 : (throwIn.detail.spot as { x: number }).x < 14) : throwIn.period < 3 ? (throwIn.detail.spot as { x: number }).x < 14 : (throwIn.detail.spot as { x: number }).x > 14;
      const expected = shotClockAfterDefensiveFoulThrowIn({ inThrowingTeamFrontcourt: frontcourt, remainingMs: foul.shotClockMs ?? 24_000 });
      expect(touch.shotClockMs).toBe(expected);
    }
    // Exclusión: nunca más de cinco personales ni un excluido en pista después.
    const personals = new Map<string, number>();
    for (const e of r.events) {
      if (e.kind === "personal_foul") personals.set(e.actors[0]!, (personals.get(e.actors[0]!) ?? 0) + 1);
    }
    for (const n of personals.values()) expect(n).toBeLessThanOrEqual(5);
    const dq = r.events.filter((e) => e.kind === "player_disqualified");
    expect(dq.length).toBeGreaterThan(0);
    for (const d of dq) {
      const id = d.actors[0]!;
      const i = r.events.indexOf(d);
      const sub = r.events.slice(i).find((e) => e.kind === "substitution" && e.actors[1] === id);
      if (!sub) {
        // Sin relevo compatible: el guardián para en ese mismo instante; el excluido no vuelve a actuar.
        expect(r.stop.cause).toBe("guardian");
        expect(r.stop.atMs).toBe(d.atMs);
        expect(r.events.slice(i + 1).every((e) => ["substitution", "game_ended"].includes(e.kind))).toBe(true);
        continue;
      }
      expect(sub.detail.reason).toBe("exclusion");
      expect(sub.atMs).toBe(d.atMs);
      for (const e of r.events.slice(r.events.indexOf(sub) + 1)) expect(e.onCourtIds).not.toContain(id);
    }
  });

  it("sin suplente compatible para un excluido, el guardián lo explica y no hay ganador", () => {
    const r = game(1, HAND_BUILT);
    if (r.stop.cause === "guardian") {
      expect(r.winnerTeamId).toBeNull();
      expect(r.stop.explanation).toMatch(/no tiene suplente elegible para el rol/);
    } else {
      expect(r.winnerTeamId).not.toBeNull();
    }
  });
});

// (4) Sustituciones legales, reentrada y minutos.
describe("ME-04 (4): sustituciones en oportunidad legal, reentrada, minutos 5× y DNP", () => {
  const r = game(PUBLISHED_SEED);

  it("ninguna sustitución con balón vivo ni con el reloj en marcha", () => {
    expect(r.substitutions.length).toBeGreaterThan(20);
    for (const e of r.events.filter((x) => x.kind === "substitution")) {
      expect(e.detail.gameClockStopped).toBe(true);
      expect(e.ball.status).toBe("dead");
    }
  });

  it("canasta tardía en C4: solo sustituye el equipo que la recibe; también tras último libre y entre períodos", () => {
    // LAB-0.7 (bloqueo lateral, ICE): la semilla publicada ya no tiene una
    // canasta recibida en los dos últimos minutos con relevo; la 1 sí.
    const r = game(1);
    const late = r.substitutions.filter((s) => s.window === "canasta");
    expect(late.length).toBeGreaterThan(0);
    for (const s of late) {
      expect(s.period).toBeGreaterThanOrEqual(4);
      expect(s.gameClockMs).toBeLessThanOrEqual(120_000);
      const basket = [...r.events].reverse().find((e) => e.kind === "shot_result" && e.atMs <= s.atMs)!;
      expect(TEAM_OF[basket.actors[0]!]).not.toBe(s.teamId);
    }
    expect(r.substitutions.some((s) => s.window === "inicio_periodo")).toBe(true);
    const anyFreeThrowWindow = [PUBLISHED_SEED, 3, 46, 57, 145].some((seed) => game(seed).substitutions.some((s) => s.window === "libre_anotado"));
    expect(anyFreeThrowWindow).toBe(true);
    expect(substitutionOpportunity({ cause: "canasta", gameClockStopped: false, receivingTeamId: PA, teamIds: [SC, PA] })).toEqual([]);
  });

  it("quien entra o sale no invierte el cambio sin que haya corrido el reloj; como máximo dos voluntarias por parada", () => {
    for (const s of r.substitutions) {
      const back = r.substitutions.find((x) => x.atMs > s.atMs || (x.atMs === s.atMs && r.substitutions.indexOf(x) > r.substitutions.indexOf(s)));
      void back;
      const reentry = r.substitutions.find((x) => r.substitutions.indexOf(x) > r.substitutions.indexOf(s) && x.inId === s.outId);
      if (reentry) expect(reentry.period > s.period || reentry.gameClockMs < s.gameClockMs).toBe(true);
    }
    const byStop = new Map<string, number>();
    for (const s of r.substitutions.filter((x) => x.reason === "voluntaria" && x.window !== "inicio_periodo")) {
      const k = `${s.atMs}/${s.teamId}`;
      byStop.set(k, (byStop.get(k) ?? 0) + 1);
    }
    for (const n of byStop.values()) expect(n).toBeLessThanOrEqual(2);
  });

  it("minutos: suma exacta por equipo = 5 × tiempo disputado, acta = motor, y DNP solo para quien nunca entra", () => {
    const checks = reconcileBoxScore({ box: r.box, finalScore: r.finalScore, effectivePlayedMs: r.effectivePlayedMs, engineMinutesMs: r.engineMinutesMs, teamIds: [SC, PA] });
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    expect(r.effectivePlayedMs).toBe(4 * 600_000);
    for (const line of Object.values(r.box.players)) expect(line.dnp).toBe(line.minutesMs === 0 && !r.events.some((e) => e.onCourtIds.includes(line.playerId)));
    // Una política con un banquillo sin roles declarados deja DNP al suplente sin rol.
    const undeclared = { ...structuredClone(SIERRA_CLARA.players[11]!), id: "SC99", name: "Sin rol" } as PlayerProfile;
    const withDnp = playFullGame(
      buildGameInput({
        seed: 5,
        home: { id: SC, name: SIERRA_CLARA.name, players: [...SIERRA_CLARA.players.slice(0, 11), undeclared], priority: "proteger_balance", coverage: "drop" },
        away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "proteger_balance", coverage: "drop" },
      }),
    );
    expect(withDnp.box.players.SC99!.dnp).toBe(true);
    expect(withDnp.box.players.SC99!.minutesMs).toBe(0);
  });

  it("la política pura: excluido obligatorio sin consumir cupo, candidatos con 5:00, menos minutos entra y nada de bucles", () => {
    const p = (id: string, roles: number[], onCourt: boolean, continuousMs: number, totalMs: number, extra: Partial<RotationPlayerState> = {}): RotationPlayerState => ({
      id,
      declaredRoles: roles as RotationPlayerState["declaredRoles"],
      onCourt,
      continuousMs,
      totalMs,
      disqualified: false,
      locked: false,
      ...extra,
    });
    const players = [
      p("A1", [1], true, 400_000, 400_000),
      p("A2", [2], true, 310_000, 310_000, { disqualified: true }),
      p("A3", [3], true, 320_000, 320_000),
      p("A4", [4], true, 299_999, 299_999),
      p("A5", [5], true, 330_000, 330_000),
      p("B1", [1, 2], false, 0, 100_000),
      p("B2", [2], false, 0, 50_000),
      p("B3", [3, 4], false, 0, 0),
      p("B5", [5], false, 0, 0, { locked: true }),
    ];
    const plan = planSubstitutions({ lineup: ["A1", "A2", "A3", "A4", "A5"], players, voluntaryCap: 2, continuousThresholdMs: 300_000, protectedIds: [] });
    expect(plan.changes).toEqual([
      expect.objectContaining({ outId: "A2", inId: "B2", reason: "exclusion" }),
      expect.objectContaining({ outId: "A1", inId: "B1", reason: "voluntaria" }),
      expect.objectContaining({ outId: "A3", inId: "B3", reason: "voluntaria" }),
    ]);
    // A5 tenía 5:00 pero su único relevo acaba de salir (bloqueado); A4 no llega a 5:00.
    const again = planSubstitutions({
      lineup: ["B1", "B2", "B3", "A4", "A5"],
      players: players.map((x) => ({ ...x, onCourt: ["B1", "B2", "B3", "A4", "A5"].includes(x.id), locked: ["A1", "A2", "A3", "B1", "B2", "B3", "B5"].includes(x.id) })),
      voluntaryCap: 2,
      continuousThresholdMs: 300_000,
      protectedIds: [],
    });
    expect(again.changes).toEqual([]);
  });

  it("ME-04-ROT-2: sin suplente del rol del excluido, un compañero que lo declara se reajusta y entra el relevo de su rol; sin reajuste posible, pasa al relevo de emergencia ME-04-ROT-3", () => {
    const p = (id: string, roles: number[], onCourt: boolean, extra: Partial<RotationPlayerState> = {}): RotationPlayerState => ({
      id,
      declaredRoles: roles as RotationPlayerState["declaredRoles"],
      onCourt,
      continuousMs: 100_000,
      totalMs: 100_000,
      disqualified: false,
      locked: false,
      ...extra,
    });
    // Caso real de la semilla 91 (Puerto): excluido el único alero en pista, el
    // escolta en pista declara 2 y 3 y en el banquillo solo hay escoltas.
    const players = [
      p("A1", [1], true),
      p("A2", [2, 3], true),
      p("A3", [3], true, { disqualified: true }),
      p("A4", [4], true),
      p("A5", [5], true),
      p("B2", [2], false, { totalMs: 50_000 }),
      p("B2b", [2], false, { totalMs: 80_000 }),
      p("B4", [4], false),
    ];
    const plan = planSubstitutions({ lineup: ["A1", "A2", "A3", "A4", "A5"], players, voluntaryCap: 2, continuousThresholdMs: 300_000, protectedIds: [] });
    expect(plan.unresolved).toEqual([]);
    expect(plan.changes).toEqual([
      expect.objectContaining({ outId: "A3", inId: "B2", role: 2, reason: "exclusion", reassigned: { playerId: "A2", fromRole: 2, toRole: 3 } }),
    ]);
    // Nadie en pista ni en el banquillo declara 3: ya no hay guardián, sino
    // relevo de emergencia ME-04-ROT-3 (detalle en `me04-rot3.test.ts`).
    const none = planSubstitutions({
      lineup: ["A1", "A2", "A3", "A4", "A5"],
      players: players.map((x) => (x.id === "A2" ? { ...x, declaredRoles: [2] as RotationPlayerState["declaredRoles"] } : x)),
      voluntaryCap: 2,
      continuousThresholdMs: 300_000,
      protectedIds: [],
    });
    expect(none.unresolved).toEqual([]);
    expect(none.changes).toEqual([expect.objectContaining({ outId: "A3", inId: "B2", role: 3, reason: "exclusion", emergency: expect.objectContaining({ declaredKept: 4, decidedBy: "menos_minutos" }) })]);
    expect(none.changes[0]!.reassigned).toBeUndefined();
  });
});

// (5) Acta conciliada desde hechos.
describe("ME-04 (5): acta calculada de los hechos, sin dobles conteos ni estadística por relato", () => {
  it("en varios partidos naturales todas las comprobaciones de conciliación se cumplen", () => {
    for (const [seed, cfg] of [[PUBLISHED_SEED, BASE], [3, BASE], [13, TRAP_CRASH]] as const) {
      const r = game(seed, cfg);
      const checks = reconcileBoxScore({ box: r.box, finalScore: r.finalScore, effectivePlayedMs: r.effectivePlayedMs, engineMinutesMs: r.engineMinutesMs, teamIds: [SC, PA] });
      expect(checks.filter((c) => !c.ok)).toEqual([]);
      const fga = r.events.filter((e) => e.kind === "field_goal_attempt").length;
      const fta = r.events.filter((e) => e.kind === "free_throws_result").length;
      const reb = r.events.filter((e) => e.kind === "rebound_secured" || e.kind === "rebound_contested").length;
      const blockedRecovered = r.events.filter((e, i) => e.kind === "loose_ball_recovered" && r.events.slice(0, i).reverse().find((x) => x.kind === "shot_blocked" || x.kind === "pass_control_lost")?.kind === "shot_blocked").length;
      const teams = [r.box.teams[SC]!, r.box.teams[PA]!];
      expect(teams.reduce((a, t) => a + t.fga2 + t.fga3, 0)).toBe(fga);
      expect(teams.reduce((a, t) => a + t.fta, 0)).toBe(fta);
      expect(teams.reduce((a, t) => a + t.oreb + t.dreb, 0)).toBe(reb + blockedRecovered);
      expect(teams.reduce((a, t) => a + t.pf, 0)).toBe(r.fouls.length);
      expect(r.periods.reduce((a, p) => a + (p.points[SC] ?? 0), 0)).toBe(r.finalScore[SC]);
    }
  });

  it("asistencia solo con pase directo; and-one sin duplicar; falta con fallo sin FGA (hechos explícitos)", () => {
    const cases = buildRuleBoundaryCases().find((c) => c.id === "falta_tiro_and_one")!;
    const [andOne, missedThree] = cases.steps;
    expect(andOne!.output.shooterLine).toEqual({ fga: 1, fgm: 1, fta: 1, ftm: 1, points: 3 });
    expect(andOne!.output.passerAssists).toBe(1);
    expect(missedThree!.output.shooterLine).toEqual({ fga: 0, fgm: 0, fta: 3, ftm: 1, points: 1 });
    expect(missedThree!.output.passerAssists).toBe(1);
    // El manejador que recibe, organiza y anota tras el bloqueo no da ni recibe asistencia; un tiro solo preparado no es FGA.
    const base = (kind: TramoEvent["kind"], actors: string[], detail: Record<string, unknown> = {}, possessionTeamId = SC): TramoEvent => ({
      sequence: 0, atMs: 0, possessionIndex: 1, phaseIndex: 1, possessionTeamId, phase: "concedido", kind, actors, text: "", detail,
      positions: [], ball: { status: "dead", holderId: null, position: { x: 0, y: 0 } }, control: { status: "balon_muerto", controlTeamId: null, throwInTeamId: null },
      gameClockMs: 1000, shotClockMs: null, score: {}, period: 1, onCourtIds: ["O1", "O2", "O3", "O4", "O5", "D1", "D2", "D3", "D4", "D5"],
    });
    const box = projectBoxScore(
      [
        base("pass_released", ["O2", "O1"]),
        base("pass_received", ["O1"]),
        base("organized_entry", ["O1", "O5"]),
        base("shot_prepared", ["O1"]),
        base("field_goal_attempt", ["O1"], { shotType: "close_finish", made: true, points: 2 }),
        base("pass_released", ["O1", "O5"]),
        base("pass_received", ["O5"]),
        base("shot_prepared", ["O5"]),
        base("pass_released", ["O5", "O3"]),
        base("pass_received", ["O3"]),
        base("shot_prepared", ["O3"]),
        base("shooting_foul", ["O3"], { madeShot: false }),
        base("personal_foul", ["D4", "O3"]),
        base("free_throws_result", ["O3"], { made: false, index: 1, of: 2 }),
        base("free_throws_result", ["O3"], { made: false, index: 2, of: 2 }),
        base("rebound_secured", ["D5"]),
      ],
      [
        { teamId: SC, playerIds: ["O1", "O2", "O3", "O4", "O5"] },
        { teamId: PA, playerIds: ["D1", "D2", "D3", "D4", "D5"] },
      ],
    );
    expect(box.players.O2!.ast).toBe(0);
    expect(box.players.O5!.ast).toBe(0);
    expect(box.players.O5!.fga2).toBe(0);
    expect(box.players.O3!.fta).toBe(2);
    expect(box.players.D5!.dreb).toBe(1);
    expect(box.players.D4!.pf).toBe(1);
    expect(box.players.O3!.pfd).toBe(1);
  });
});

// (6) Prórrogas y guardián.
describe("ME-04 (6): empate → prórroga, empate en prórroga → otra; guardián sin ganador falso", () => {
  it("regla pura: empate al final de C4 y de una prórroga siguen; sin empate, final", () => {
    expect(adjudicatePeriodEnd(FIBA_2026, 3, [{ teamId: SC, points: 60 }, { teamId: PA, points: 60 }])).toMatchObject({ kind: "siguiente_periodo", nextPeriod: 4, overtime: false });
    expect(adjudicatePeriodEnd(FIBA_2026, 4, [{ teamId: SC, points: 80 }, { teamId: PA, points: 80 }])).toMatchObject({ kind: "siguiente_periodo", nextPeriod: 5, overtime: true });
    expect(adjudicatePeriodEnd(FIBA_2026, 5, [{ teamId: SC, points: 85 }, { teamId: PA, points: 85 }])).toMatchObject({ kind: "siguiente_periodo", nextPeriod: 6, overtime: true });
    expect(adjudicatePeriodEnd(FIBA_2026, 6, [{ teamId: SC, points: 90 }, { teamId: PA, points: 91 }])).toEqual({ kind: "final", winnerTeamId: PA, reason: expect.any(String) });
  });

  it("partido natural con dos prórrogas: 5:00 cada una, faltas contadas en C4, canastas de C4 y final sin empate", () => {
    // Semilla recalculada en ME-04B (§§3.1-3.3) y en ME-07B v2 §2.1. Desde
    // §2.3 (la trampa se decide al preparar la pantalla) ninguna semilla
    // 1–3000 da dos prórrogas con trampa/trampa y «cargar rebote»; la
    // semilla 225 con drop/drop y «proteger balance» sí es un partido
    // natural con dos prórrogas. §2.4 (asignación de creador/bloqueador por
    // proyección y lectura del receptor) la desplaza a la semilla 667, §2.5
    // (faltas por contacto real) a la 232, LAB-0.7 (bloqueo lateral, ICE) a la 246 y
    // la ficha Horns (LAB-0.8) con la proyección frente a la defensa observada (v2-4) a la 984.
    const r = game(984);
    expect(r.periods.map((p) => p.label)).toEqual(["C1", "C2", "C3", "C4", "Prórroga 1", "Prórroga 2"]);
    const endOf = (period: number) => r.events.find((e) => e.kind === "period_ended" && e.period === period)!;
    expect(endOf(4).score[SC]).toBe(endOf(4).score[PA]);
    expect(endOf(5).score[SC]).toBe(endOf(5).score[PA]);
    expect(r.finalScore[SC]).not.toBe(r.finalScore[PA]);
    expect(r.winnerTeamId).toBe(r.finalScore[SC]! > r.finalScore[PA]! ? SC : PA);
    expect(r.effectivePlayedMs).toBe(4 * 600_000 + 2 * 300_000);
    for (const e of r.events.filter((x) => x.kind === "period_started" && x.period >= 5)) expect(e.detail.teamFoulKey).toBe(4);
    const shotsOT = r.events.filter((e) => e.kind === "field_goal_attempt" && e.period >= 5);
    for (const shot of shotsOT) {
      const x = shot.positions.find((p) => p.playerId === shot.actors[0])!.position.x;
      if (TEAM_OF[shot.actors[0]!] === SC) expect(x).toBeLessThan(14);
      else expect(x).toBeGreaterThan(14);
    }
  });

  it("el guardián de prórrogas señala la anomalía sin cerrar el empate ni inventar ganador", () => {
    const r = game(984, BASE, { maxOvertimes: 1 });
    expect(r.stop.cause).toBe("guardian");
    expect(r.winnerTeamId).toBeNull();
    expect(r.finalScore[SC]).toBe(r.finalScore[PA]);
    expect(r.events.some((e) => e.kind === "game_ended" && e.detail.cause === "final")).toBe(false);
  });

  it("un límite de pasos agotado detiene con diagnóstico, sin canasta ni ganador falsos", () => {
    const r = game(PUBLISHED_SEED, BASE, { limits: { maxSteps: 40 } });
    expect(r.stop.cause).toBe("guardian");
    expect(r.winnerTeamId).toBeNull();
    expect(r.stop.explanation).toMatch(/el partido supera 40 pasos/);
    const checks = reconcileBoxScore({ box: r.box, finalScore: r.finalScore, effectivePlayedMs: r.effectivePlayedMs, engineMinutesMs: r.engineMinutesMs, teamIds: [SC, PA] });
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("salto y alternancia (reglas puras)", () => {
    const jump = adjudicateOpeningJump(
      [
        { teamId: SC, playerId: "O5", standingReachCm: 282, f06: 10, variationCm: 0 },
        { teamId: PA, playerId: "D5", standingReachCm: 280, f06: 11, variationCm: 0 },
      ],
      0.9,
    );
    // 282 + 4 = 286 frente a 280 + 6 = 286: empate exacto, decide el sorteo sembrado.
    expect(jump).toEqual({ reachCm: [286, 286], winnerIndex: 1, tiedBySeed: true });
    expect(arrowAfterAlternatingThrowIn(SC, [SC, PA])).toBe(PA);
  });
});

// (7) Regresión de ME-01/02/03 y segunda entrada con geometría construida a mano.
describe("ME-04 (7): regresión de ME-01/02/03 y segunda entrada del bloqueo", () => {
  it("el tramo de ME-03 conserva exactamente su huella tras extraer el motor compartido", () => {
    const out: unknown[] = [];
    for (const coverage of ["drop", "trampa"] as const)
      for (let seed = 1; seed <= 30; seed++) {
        const t = playTramo(
          buildTramoInput({
            seed,
            coverage,
            offenseTeam: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, priority: "proteger_balance" },
            defenseTeam: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, priority: "cargar_rebote" },
          }),
        );
        out.push([t.events.map((e) => [e.kind, e.atMs, e.actors, e.text, e.positions, e.gameClockMs, e.shotClockMs, e.score]), t.stop, t.box]);
      }
    // Huella recalculada en ME-07B v2 sesión v2-4: el ataque proyecta el
    // bloqueo frente a la cobertura que ha visto (la trampa fija del tramo
    // pesa en la asignación de creador y bloqueador; LAB-0.4). Antes:
    // recalculada en ME-07B v2 §2.4 (creador y bloqueador se asignan
    // por proyección al organizar, con los defensores siguiendo a su marca;
    // lectura real del receptor del roll, ayuda de D3 leída, tiro parado de
    // O1 y tipos floater/tiro medio; §2.5: faltas por contacto real).
    // Antes: recalculada en ME-07B (§2: elimina el veto absoluto T04>=9 del
    // triple de O1 en la primera lectura del bloqueo — ahora compite por
    // valor situacional con oposición geométrica en vez de excluirse por
    // capacidad; el tramo pasa por esa misma lectura). Antes: recalculada
    // en ME-07A (§3.2, `organize()` conserva al poseedor real). Antes de
    // eso: recalculada en ME-04B (desplazamiento real de O1/D1, primera
    // lectura ponderada por valor y R_contest, §§3.1-3.3).
    expect(hash(out)).toBe(TRAMO_FINGERPRINT);
  });

  it("segunda entrada: con el continuador contenido y la esquina cerrada, sale un pase real al exterior y se recoloca el bloqueo", () => {
    const scenario = getScenario("drop_con_ayuda");
    const start: Record<string, { x: number; y: number }> = {};
    for (const s of [...scenario.offense, ...scenario.defense]) start[s.playerId] = s.initialPosition;
    // Geometría construida a mano (no el fixture): D3 a 3 m del short roll
    // (llega justo después de que O5 se detenga, sin cerrarle el paso), D4
    // junto a la esquina débil (inversión cerrada) y el pívot de drop más
    // hondo que en la disposición aprobada, donde siempre está a 0,73 m del
    // short roll y alcanza cualquier línea de pase desde allí.
    start.D3 = { x: 23.3, y: 10.5 };
    start.D4 = { x: 23.6, y: 13.2 };
    start.D5 = { x: 25.2, y: 6.4 };
    // ME-04B (§3.1): O1 ya no permanece congelado en su posición de partida,
    // así que D1 también navega de verdad hasta el punto de uso de la
    // pantalla y se queda ahí — con la posición de O4 aprobada en
    // `scenario.ts`, D1 termina sobre la línea de pase de la segunda
    // entrada y la vuelve inviable por una interferencia que antes no
    // existía por el propio error que corrige esta entrega. Se abre algo
    // más la posición de O4 (sigue detrás de línea, en pista delantera)
    // para que la línea de pase vuelva a quedar limpia.
    start.O4 = { x: 19.0, y: 14.5 };
    const binding = Object.fromEntries([...scenario.offense, ...scenario.defense].map((s) => [s.playerId, s.playerId]));
    let seen = 0;
    for (let seed = 1; seed <= 10 && seen === 0; seed++) {
      const core = computePossessionCore(
        { scenarioId: "drop_con_ayuda", coverage: "drop", seed, rulesetVersion: "FIBA-2026", labParametersVersion: "LAB-0.2", offensePlayers: SIERRA_CLARA.players, defensePlayers: PUERTO_AMBAR.players, rollHelpCall: "siempre" },
        {
          linked: {
            binding,
            startPositions: start,
            shotClockMs: 20_000,
            gameClockMs: 400_000,
            rng: createResumableRandom(seed),
            attackingPriority: "proteger_balance",
            entry: { kind: "organized_set" },
            rules: { deferFreeThrows: true, ordinaryFouls: true, secondEntryAllowed: true },
          },
        },
      );
      if (core.terminal.kind !== "second_entry_kick_out") continue;
      seen++;
      const last = core.timeline[core.timeline.length - 1]!;
      expect(last.kind).toBe("second_entry");
      expect(last.detail.viable).toBe(true);
      const pass = [...core.timeline].reverse().find((e) => e.kind === "pass_released")!;
      const reception = [...core.timeline].reverse().find((e) => e.kind === "pass_received")!;
      expect(pass.actors).toEqual(["O5", core.terminal.creatorId]);
      expect(reception.actors).toEqual([core.terminal.creatorId]);
      expect(reception.atMs).toBeGreaterThan(pass.atMs);
      expect(["O2", "O4"]).toContain(core.terminal.creatorId);
      expect(core.terminal.slotSwap.O1).toBe(core.terminal.creatorId);
      expect(core.terminal.targets.O1).toEqual(core.positionHistory![core.terminal.creatorId]!.at(-1)!.position);
      expect(core.ball).toMatchObject({ status: "held", holderId: core.terminal.creatorId });
      // Sin reglas de partido, la misma geometría conserva el tiro forzado de ME-01.
      const legacy = computePossessionCore(
        { scenarioId: "drop_con_ayuda", coverage: "drop", seed, rulesetVersion: "FIBA-2026", labParametersVersion: "LAB-0.2", offensePlayers: SIERRA_CLARA.players, defensePlayers: PUERTO_AMBAR.players, rollHelpCall: "siempre" },
        { linked: { binding, startPositions: start, shotClockMs: 20_000, gameClockMs: 400_000, rng: createResumableRandom(seed), attackingPriority: "proteger_balance", entry: { kind: "organized_set" } } },
      );
      expect(legacy.terminal.kind).not.toBe("second_entry_kick_out");
      expect(legacy.timeline.some((e) => e.kind === "shot_prepared" && e.actors[0] === "O5")).toBe(true);
    }
    expect(seen).toBe(1);
  });

  it("los seis casos de frontera se construyen con las funciones del partido y se etiquetan como tales", () => {
    const cases = buildRuleBoundaryCases();
    expect(cases.map((c) => c.id)).toEqual(["bocina", "reset_falta_sin_tiro", "falta_tiro_and_one", "bonus_y_quinta", "prorrogas", "canasta_c4_dos_minutos"]);
    const bonus = cases.find((c) => c.id === "bonus_y_quinta")!;
    expect(bonus.steps.map((s) => (s.output.sanction as { kind: string }).kind)).toEqual(["saque", "saque", "saque", "saque", "libres", "libres", "libres"]);
    expect(bonus.steps[4]!.output.disqualified).toBe(true);
    const ot = cases.find((c) => c.id === "prorrogas")!;
    expect(ot.steps.map((s) => s.output.kind)).toEqual(["siguiente_periodo", "siguiente_periodo", "final"]);
  });
});

// Recalculada en ME-07B v2 §2.1: el rebote aplica de verdad el retraso del
// cierre (antes siempre cero), el tirador no cierra mientras completa su
// gesto y cae de su salto antes de ir al rebote (LAB-0.4). Cambio
// intencional de la mecánica deportiva del rebote, no una regresión. Otra
// vez en §2.3: la trampa sale al preparar la pantalla (el tramo incluye
// posesiones con trampa).
const TRAMO_FINGERPRINT = "2ff2398c8307dc33ebf6014459475fc9517ebf4515633aa8f066c0a9d187fe37";
