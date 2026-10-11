import { describe, expect, it } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput, type GameResult } from "./game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { PlayerProfile } from "../players/player-profile";
import { RATING_MAX, type Rating } from "../players/attribute";
import { closeoutReboundDelaySeconds } from "../lab/lab-0-1-parameters";

/**
 * ME-07B v2 §2.1 en el partido completo: el cierre de rebote ya llega al
 * resolvedor (antes el retraso era siempre cero), queda en el hecho y en la
 * auditoría `disputa_rebote`, y cambiar **solo** T19 de un equipo cambia
 * primero una disputa de rebote, sin reescribir nada anterior.
 */
const AUTO = {
  priority: "proteger_balance" as const,
  coverage: "auto" as const,
  offBallDefensiveCall: "auto" as const,
  offensivePlan: "auto" as const,
  creationPriority: "equilibrado" as const,
};

function play(seed: number, puerto: readonly PlayerProfile[] = PUERTO_AMBAR.players, auditEnabled = true): GameResult {
  return playFullGame(
    buildGameInput({
      seed,
      auditEnabled,
      home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...AUTO },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: puerto, ...AUTO },
    }),
  );
}

describe("ME-07B v2 §2.1: cierre de rebote en un partido completo", () => {
  const r = play(91);

  it("termina en final, registra disputas con cierres reales y el retraso sale del cerrador", () => {
    expect(r.stop.cause).toBe("final");
    const contests = r.audit!.decisions.filter((d) => d.point === "disputa_rebote");
    expect(contests.length).toBeGreaterThan(50);
    let boxed = 0;
    for (const d of contests) {
      for (const o of d.options) {
        const v = o.values!;
        expect(v.effectiveArrivalSeconds as number).toBeGreaterThanOrEqual(v.rawArrivalSeconds as number);
        if (v.boxedOutBy) {
          boxed += 1;
          const delay = closeoutReboundDelaySeconds(v.closerT19 as Rating, v.closerF05 as Rating);
          expect((v.effectiveArrivalSeconds as number) - (v.rawArrivalSeconds as number)).toBeCloseTo(delay, 9);
          expect(v.boxOutDelaySeconds).toBeCloseTo(delay, 9);
        } else {
          expect(v.effectiveArrivalSeconds).toBe(v.rawArrivalSeconds);
        }
      }
    }
    expect(boxed).toBeGreaterThan(0);
    // El hecho del rebote lleva los mismos cierres.
    const withBoxOuts = r.events.filter(
      (e) => (e.kind === "rebound_secured" || e.kind === "rebound_contested") && Array.isArray(e.detail.boxOuts) && (e.detail.boxOuts as unknown[]).length > 0,
    );
    expect(withBoxOuts.length).toBeGreaterThan(0);
  });

  it("cambiar solo T19 de Puerto: todo es idéntico hasta la primera disputa de rebote con un cierre de Puerto", () => {
    const stronger = PUERTO_AMBAR.players.map((p) => ({
      ...p,
      attributes: { ...p.attributes, T19: Math.min(RATING_MAX, p.attributes.T19 + 3) as Rating },
    }));
    const b = play(91, stronger);
    const first = r.events.findIndex((e, i) => {
      const o = b.events[i];
      return !o || o.kind !== e.kind || o.atMs !== e.atMs || o.text !== e.text;
    });
    expect(first).toBeGreaterThan(0);
    const diverging = r.events[first]!;
    expect(["rebound_secured", "rebound_contested"]).toContain(diverging.kind);
    const puertoIds = new Set(PUERTO_AMBAR.players.map((p) => p.id));
    const closers = (diverging.detail.boxOuts as { closer: string }[]).map((x) => x.closer);
    expect(closers.some((id) => puertoIds.has(id))).toBe(true);
  });

  it("auditoría ON/OFF: mismos hechos, marcador y reloj con el nuevo punto `disputa_rebote`", () => {
    const off = play(91, PUERTO_AMBAR.players, false);
    expect(off.finalScore).toEqual(r.finalScore);
    expect(off.events.map((e) => [e.kind, e.atMs, e.text, e.gameClockMs])).toEqual(r.events.map((e) => [e.kind, e.atMs, e.text, e.gameClockMs]));
  });
});
