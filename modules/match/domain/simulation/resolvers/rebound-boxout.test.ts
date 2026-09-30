import { describe, expect, it } from "vitest";
import {
  computeReboundBoxOuts,
  resolveRebound,
  type ReboundBoxOutGeometry,
  type ReboundCandidate,
  type ReboundSeed,
} from "./rebound-resolver";
import { closeoutReboundDelaySeconds } from "../../lab/lab-0-1-parameters";
import { createSeededRandom } from "../../random/seeded-random";

/**
 * ME-07B v2 §2.1 — defecto verificable de ME-01 en el rebote: el retraso del
 * cierre solo se calculaba para el defensor que cerró el tiro y solo se
 * sumaba a quien no lo había hecho, así que valía siempre cero, y la ventana
 * de vuelo usaba la llegada sin ajustar. Cada pareja cambia **una sola**
 * intervención (posición interior del cerrador, sus T19/F05, o el vuelo).
 */
const HOOP = { x: 26.425, y: 7.5 };
const GEOMETRY: ReboundBoxOutGeometry = { hoop: HOOP, speedMps: 3.2 };
const SEED: ReboundSeed = { landingPoint: { x: 24.5, y: 7.5 }, flightTimeSeconds: 0.8 };

function c(o: Partial<ReboundCandidate> & Pick<ReboundCandidate, "playerId" | "position" | "arrivalTimeSeconds">): ReboundCandidate {
  return { teamId: o.playerId.startsWith("O") ? "ataque" : "defensa", t19: 8, f05: 8, t20: 8, ...o };
}

// O5 llega primero al balón por carrera libre; D5 está entre O5 y el aro, a
// 0,9 m (contacto en 0,06 s).
const O5 = c({ playerId: "O5", position: { x: 23.0, y: 7.5 }, arrivalTimeSeconds: 0.3 });
const D5_INSIDE = c({ playerId: "D5", position: { x: 23.9, y: 7.5 }, arrivalTimeSeconds: 0.4, t19: 12, f05: 11 });
// Misma distancia al balón, pero por fuera (más lejos del aro que O5): no hay cierre legal.
const D5_OUTSIDE = c({ playerId: "D5", position: { x: 22.1, y: 7.5 }, arrivalTimeSeconds: 0.4, t19: 12, f05: 11 });

describe("ME-07B v2 §2.1: el cierre de rebote retrasa al rival, con los T19/F05 del cerrador", () => {
  it("el retraso ya no es cero: se suma al rival cerrado y lo calcula el cerrador", () => {
    const boxOuts = computeReboundBoxOuts([O5, D5_INSIDE], GEOMETRY, SEED.flightTimeSeconds);
    expect(boxOuts).toHaveLength(1);
    expect(boxOuts[0]).toMatchObject({ closerId: "D5", rivalId: "O5", closerT19: 12, closerF05: 11 });
    expect(boxOuts[0]!.delaySeconds).toBeCloseTo(closeoutReboundDelaySeconds(12, 11), 10);
    expect(boxOuts[0]!.delaySeconds).toBeGreaterThan(0);

    const outcome = resolveRebound(SEED, [O5, D5_INSIDE], createSeededRandom(1), GEOMETRY);
    if (outcome.kind === "out_of_bounds") throw new Error("inesperado");
    const o5 = outcome.trace.arrivals.find((a) => a.playerId === "O5")!;
    const d5 = outcome.trace.arrivals.find((a) => a.playerId === "D5")!;
    expect(o5.effectiveArrivalSeconds).toBeCloseTo(0.3 + closeoutReboundDelaySeconds(12, 11), 10);
    // El cerrador no sufre su propio cierre.
    expect(d5.effectiveArrivalSeconds).toBe(d5.rawArrivalSeconds);
  });

  it("misma escena cambiando solo la posición interior: el primer optante pasa de O5 a D5", () => {
    const withBoxOut = resolveRebound(SEED, [O5, D5_INSIDE], createSeededRandom(7), GEOMETRY);
    const without = resolveRebound(SEED, [O5, D5_OUTSIDE], createSeededRandom(7), GEOMETRY);
    if (withBoxOut.kind === "out_of_bounds" || without.kind === "out_of_bounds") throw new Error("inesperado");
    const firstOf = (o: typeof withBoxOut) => [...o.trace.arrivals].sort((a, b) => a.effectiveArrivalSeconds - b.effectiveArrivalSeconds)[0]!.playerId;
    // Con D5 por fuera es O5 quien gana la posición interior y le cierra (regla simétrica).
    expect(without.trace.boxOuts.map((b) => [b.closerId, b.rivalId])).toEqual([["O5", "D5"]]);
    expect(withBoxOut.trace.boxOuts.map((b) => [b.closerId, b.rivalId])).toEqual([["D5", "O5"]]);
    expect(firstOf(without)).toBe("O5");
    expect(firstOf(withBoxOut)).toBe("D5");
  });

  it("subir T19/F05 del rival cerrado no cambia el retraso; subir los del cerrador sí", () => {
    const base = computeReboundBoxOuts([O5, D5_INSIDE], GEOMETRY, 0.8)[0]!.delaySeconds;
    const rivalStronger = computeReboundBoxOuts([{ ...O5, t19: 15, f05: 15 }, D5_INSIDE], GEOMETRY, 0.8)[0]!.delaySeconds;
    const closerStronger = computeReboundBoxOuts([O5, { ...D5_INSIDE, t19: 15, f05: 15 }], GEOMETRY, 0.8)[0]!.delaySeconds;
    expect(rivalStronger).toBe(base);
    expect(closerStronger).toBeGreaterThan(base);
  });

  it("la ventana de vuelo usa la llegada efectiva: un rival cerrado puede quedar fuera del primer grupo", () => {
    // O4 llegaría justo dentro de la ventana (0,8 + 0,5 s) sin cierre; D4 le cierra y lo saca.
    const o4 = c({ playerId: "O4", position: { x: 21.0, y: 7.5 }, arrivalTimeSeconds: 1.25 });
    const d4 = c({ playerId: "D4", position: { x: 21.8, y: 7.5 }, arrivalTimeSeconds: 1.0 });
    const outcome = resolveRebound(SEED, [o4, d4], createSeededRandom(3), GEOMETRY);
    if (outcome.kind === "out_of_bounds") throw new Error("inesperado");
    expect(outcome.trace.boxOuts.map((b) => b.rivalId)).toEqual(["O4"]);
    expect(outcome.trace.arrivals.find((a) => a.playerId === "O4")!.inPool).toBe(false);
    const noBox = resolveRebound(SEED, [o4, { ...d4, position: { x: 20.0, y: 7.5 } }], createSeededRandom(3), GEOMETRY);
    if (noBox.kind === "out_of_bounds") throw new Error("inesperado");
    expect(noBox.trace.arrivals.find((a) => a.playerId === "O4")!.inPool).toBe(true);
  });

  it("no hay cierre sin vuelo, fuera de alcance durante el vuelo, ni un cerrador para dos rivales", () => {
    expect(computeReboundBoxOuts([O5, D5_INSIDE], GEOMETRY, 0)).toEqual([]);
    const far = c({ playerId: "D5", position: { x: 26.0, y: 7.5 }, arrivalTimeSeconds: 0.5 });
    // 3,0 m − 0,7 m de radios = 2,3 m a 3,2 m/s = 0,72 s: dentro de 0,8 s de vuelo pero después de que O5 llegue (0,3 s).
    expect(computeReboundBoxOuts([O5, far], GEOMETRY, 0.8)).toEqual([]);
    const o4 = c({ playerId: "O4", position: { x: 23.0, y: 8.3 }, arrivalTimeSeconds: 0.35 });
    const boxOuts = computeReboundBoxOuts([O5, o4, D5_INSIDE], GEOMETRY, 0.8);
    expect(boxOuts).toHaveLength(1);
    expect(boxOuts[0]!.rivalId).toBe("O5");
  });

  it("sin geometría de cierre (balón suelto en el suelo) el resultado no cambia respecto a la carrera libre", () => {
    const a = resolveRebound(SEED, [O5, D5_INSIDE], createSeededRandom(11));
    if (a.kind === "out_of_bounds") throw new Error("inesperado");
    expect(a.trace.boxOuts).toEqual([]);
    expect(a.trace.arrivals.every((x) => x.effectiveArrivalSeconds === x.rawArrivalSeconds)).toBe(true);
  });
});
