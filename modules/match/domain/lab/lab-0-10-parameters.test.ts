import { describe, expect, it } from "vitest";
import { distance, pointShortOfTarget, timeToReach } from "../geometry/point";
import { ATTACKED_HOOP, isBehindThreePointLine } from "../geometry/court";
import { COMBINED_CONTACT_RADIUS_METERS } from "./lab-0-2-parameters";
import { isFloaterZone } from "./lab-0-5-parameters";
import { attackerMoveSpeedMps, defenderLateralSpeedMps } from "./lab-0-1-parameters";
import { DELAY_HUB_SPOT, DELAY_POST_SPOT, DELAY_STRONG_CORNER_SPOT, DELAY_TARGETS, DELAY_WEAK_CUT_SPOT } from "./lab-0-10-parameters";
import type { Rating } from "../players/attribute";

describe("LAB-0.10: geometría de Delay (ME-07B v2 §4)", () => {
  const t = DELAY_TARGETS;
  const handoff = pointShortOfTarget(t.O1!, t.O5!, COMBINED_CONTACT_RADIUS_METERS);

  it("el pívot de arriba y el punto de la entrega quedan detrás del arco; el poste en zona de floater; la esquina fuerte detrás del arco", () => {
    expect(t.O5).toEqual(DELAY_HUB_SPOT);
    expect(isBehindThreePointLine(DELAY_HUB_SPOT)).toBe(true);
    expect(isBehindThreePointLine(handoff)).toBe(true);
    expect(isFloaterZone(DELAY_POST_SPOT)).toBe(true);
    expect(isBehindThreePointLine(DELAY_STRONG_CORNER_SPOT)).toBe(true);
    // El corte del ala débil termina junto al aro (finalización cercana).
    expect(distance(DELAY_WEAK_CUT_SPOT, ATTACKED_HOOP)).toBeLessThan(2.0);
  });

  it("cada defensor está entre su marca y el aro; D4 a contacto por detrás del poste", () => {
    for (const k of [1, 2, 3, 4, 5]) expect(distance(t[`D${k}`]!, ATTACKED_HOOP)).toBeLessThan(distance(t[`O${k}`]!, ATTACKED_HOOP));
    expect(distance(t.D4!, t.O4!)).toBeCloseTo(COMBINED_CONTACT_RADIUS_METERS, 1);
  });

  it("con velocidades típicas, el defensor del pívot llega antes que el manejador al punto de la entrega (puede saltarla) y el del manejador no", () => {
    const f = 10 as Rating;
    const tO1 = timeToReach(t.O1!, handoff, attackerMoveSpeedMps(f));
    expect(timeToReach(t.D5!, handoff, defenderLateralSpeedMps(6 as Rating))).toBeLessThan(tO1);
    expect(timeToReach(t.D1!, handoff, defenderLateralSpeedMps(f))).toBeGreaterThan(tO1);
  });
});
