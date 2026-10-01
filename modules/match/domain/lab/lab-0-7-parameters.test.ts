import { describe, expect, it } from "vitest";
import { distance, moveToward, pointShortOfTarget } from "../geometry/point";
import { ATTACKED_HOOP, isBehindThreePointLine, isLateralScreenSpot } from "../geometry/court";
import { COMBINED_CONTACT_RADIUS_METERS, SHORT_ROLL_SPOT, DEEP_CONTINUATION_SPOT } from "./lab-0-2-parameters";
import { isMidRangeZone } from "./lab-0-5-parameters";
import { getScenario } from "./scenario";
import {
  ICE_BASELINE_PULL_UP_SPOT,
  ICE_LOW_HELP_SPOT,
  ICE_BASELINE_DRIVE_SPOT,
  LATERAL_PNR_TARGETS,
  LATERAL_SHORT_ROLL_SPOT,
  pnrSetGeometry,
} from "./lab-0-7-parameters";

describe("LAB-0.7: geometría del bloqueo lateral, ICE y profundidad del pívot (ME-07B v2 §4–§5)", () => {
  const lateral = LATERAL_PNR_TARGETS;
  const central = Object.fromEntries(getScenario("drop_con_ayuda").offense.concat(getScenario("drop_con_ayuda").defense).map((s) => [s.playerId, s.initialPosition]));

  it("caso neutro: la colocación central conserva los puntos de ME-02", () => {
    expect(pnrSetGeometry("central")).toEqual({ placement: "central", shortRoll: SHORT_ROLL_SPOT, deepContinuation: DEEP_CONTINUATION_SPOT });
    expect(isLateralScreenSpot(central.O5!)).toBe(false);
  });

  it("la pantalla lateral queda fuera de la franja de la zona y el punto de uso detrás del arco", () => {
    expect(isLateralScreenSpot(lateral.O5!)).toBe(true);
    const use = pointShortOfTarget(lateral.O1!, lateral.O5!, COMBINED_CONTACT_RADIUS_METERS);
    expect(isBehindThreePointLine(use)).toBe(true);
    // Misma distancia manejador–bloqueador que la central.
    expect(distance(lateral.O1!, lateral.O5!)).toBeCloseTo(distance(central.O1!, central.O5!), 1);
    // El lado débil y la esquina fuerte no se mueven.
    for (const slot of ["O2", "O3", "O4", "D2", "D3", "D4"]) expect(lateral[slot]).toEqual(central[slot]);
    // La continuación sale hacia el aro, más cerca de él que la pantalla.
    expect(distance(LATERAL_SHORT_ROLL_SPOT, ATTACKED_HOOP)).toBeLessThan(distance(lateral.O5!, ATTACKED_HOOP));
  });

  it("ICE: el punto de D1 corta la línea del manejador hacia la pantalla; la ayuda baja queda entre el paso por fondo y el aro", () => {
    const icePoint = moveToward(lateral.O1!, lateral.O5!, 1, COMBINED_CONTACT_RADIUS_METERS);
    const use = pointShortOfTarget(lateral.O1!, lateral.O5!, COMBINED_CONTACT_RADIUS_METERS);
    expect(distance(lateral.O1!, icePoint) + distance(icePoint, use)).toBeCloseTo(distance(lateral.O1!, use), 9);
    expect(distance(ICE_LOW_HELP_SPOT, ATTACKED_HOOP)).toBeLessThan(distance(ICE_BASELINE_DRIVE_SPOT, ATTACKED_HOOP));
    // Empujado hacia fondo: el paso por fondo está más lejos del centro (y = 7,5) que el manejador.
    expect(Math.abs(ICE_BASELINE_DRIVE_SPOT.y - 7.5)).toBeGreaterThan(Math.abs(ICE_LOW_HELP_SPOT.y - 7.5));
    expect(isMidRangeZone(ICE_BASELINE_PULL_UP_SPOT)).toBe(true);
  });

  it("show sale más arriba que «a la altura» con la misma pantalla (central y lateral)", () => {
    for (const set of [central, lateral]) {
      const use = pointShortOfTarget(set.O1!, set.O5!, COMBINED_CONTACT_RADIUS_METERS);
      const show = moveToward(use, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS);
      const atLevel = moveToward(set.O5!, ATTACKED_HOOP, 1, COMBINED_CONTACT_RADIUS_METERS);
      expect(distance(show, ATTACKED_HOOP)).toBeGreaterThan(distance(atLevel, ATTACKED_HOOP) + 0.3);
      // El show queda a contacto del punto de uso (la línea del manejador); «a la altura», a contacto del bloqueador.
      expect(distance(show, use)).toBeCloseTo(COMBINED_CONTACT_RADIUS_METERS, 9);
      expect(distance(atLevel, set.O5!)).toBeCloseTo(COMBINED_CONTACT_RADIUS_METERS, 9);
    }
  });
});
