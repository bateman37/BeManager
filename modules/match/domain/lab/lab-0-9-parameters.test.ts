import { describe, expect, it } from "vitest";
import { distance } from "../geometry/point";
import { ATTACKED_HOOP, isBehindThreePointLine } from "../geometry/court";
import { COMBINED_CONTACT_RADIUS_METERS, SHORT_ROLL_SPOT } from "./lab-0-2-parameters";
import { isFloaterZone } from "./lab-0-5-parameters";
import { HORNS_PNR_TARGETS } from "./lab-0-8-parameters";
import { SPAIN_POP_SPOT, SPAIN_ROLL_SPOT, isBackScreenTarget, spainBackScreenPoint } from "./lab-0-9-parameters";

/** Distancia de un punto al segmento a→b. */
function distanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
  return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
}

describe("LAB-0.9: geometría de Horns→Spain (ME-07B v2 §4)", () => {
  const horns = HORNS_PNR_TARGETS;
  const bs = spainBackScreenPoint(horns.D5!);

  it("el bloqueo ciego queda a contacto de D5, en su línea de retroceso al aro", () => {
    expect(distance(bs, horns.D5!)).toBeCloseTo(COMBINED_CONTACT_RADIUS_METERS, 6);
    expect(distance(bs, ATTACKED_HOOP)).toBeCloseTo(distance(horns.D5!, ATTACKED_HOOP) - COMBINED_CONTACT_RADIUS_METERS, 6);
    expect(isBackScreenTarget(horns.D5!)).toBe(true);
    // Un D5 ya en el aro no tiene retroceso que cortar.
    expect(isBackScreenTarget({ x: ATTACKED_HOOP.x - 2.5, y: ATTACKED_HOOP.y })).toBe(false);
  });

  it("el pop queda detrás del arco y el roll profundo es zona de floater más cerca del aro que el short roll", () => {
    expect(isBehindThreePointLine(SPAIN_POP_SPOT)).toBe(true);
    expect(isFloaterZone(SPAIN_ROLL_SPOT)).toBe(true);
    expect(distance(SPAIN_ROLL_SPOT, ATTACKED_HOOP)).toBeLessThan(distance(SHORT_ROLL_SPOT, ATTACKED_HOOP));
  });

  it("el camino del roll profundo no atraviesa a D5 ni al bloqueador ciego", () => {
    expect(distanceToSegment(horns.D5!, horns.O5!, SPAIN_ROLL_SPOT)).toBeGreaterThan(COMBINED_CONTACT_RADIUS_METERS);
    expect(distanceToSegment(bs, horns.O5!, SPAIN_ROLL_SPOT)).toBeGreaterThan(COMBINED_CONTACT_RADIUS_METERS);
    // En cambio, el short roll de Horns→bloqueo está en la misma línea por la que retrocede D5.
    expect(distanceToSegment(SHORT_ROLL_SPOT, horns.D5!, ATTACKED_HOOP)).toBeLessThan(COMBINED_CONTACT_RADIUS_METERS);
  });
});
