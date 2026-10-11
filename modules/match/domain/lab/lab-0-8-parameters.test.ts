import { describe, expect, it } from "vitest";
import { distance, pointShortOfTarget } from "../geometry/point";
import { ATTACKED_HOOP, isBehindThreePointLine, isLateralScreenSpot } from "../geometry/court";
import { COMBINED_CONTACT_RADIUS_METERS, SHORT_ROLL_SPOT } from "./lab-0-2-parameters";
import { isMidRangeZone } from "./lab-0-5-parameters";
import { getScenario } from "./scenario";
import { HORNS_PNR_TARGETS, HORNS_SECOND_HORN_SPOT, WEAK_CORNER_HELP_LEFT_SPOT } from "./lab-0-8-parameters";
import { pnrSetGeometry } from "./lab-0-7-parameters";

describe("LAB-0.8: geometría de Horns (ME-07B v2 §4)", () => {
  const horns = HORNS_PNR_TARGETS;
  const central = Object.fromEntries(getScenario("drop_con_ayuda").offense.concat(getScenario("drop_con_ayuda").defense).map((s) => [s.playerId, s.initialPosition]));

  it("caso neutro: la central no cambia y su jugador libre tras la ayuda sigue en la esquina débil", () => {
    expect(WEAK_CORNER_HELP_LEFT_SPOT).toEqual(central.O3);
    expect(pnrSetGeometry("central").helpLeftSpot).toEqual(central.O3);
    expect(pnrSetGeometry("horns").helpLeftSpot).toEqual(HORNS_SECOND_HORN_SPOT);
  });

  it("misma pantalla que la central (manejador, bloqueador, uso detrás del arco, no lateral) y mismo short roll", () => {
    expect(horns.O1).toEqual(central.O1);
    expect(horns.O5).toEqual(central.O5);
    expect(isLateralScreenSpot(horns.O5!)).toBe(false);
    expect(isBehindThreePointLine(pointShortOfTarget(horns.O1!, horns.O5!, COMBINED_CONTACT_RADIUS_METERS))).toBe(true);
    expect(pnrSetGeometry("horns").shortRoll).toEqual(SHORT_ROLL_SPOT);
  });

  it("el segundo cuerno está en el codo contrario, en zona de tiro medio, y las dos esquinas están ocupadas", () => {
    expect(isMidRangeZone(HORNS_SECOND_HORN_SPOT)).toBe(true);
    expect(Math.sign(HORNS_SECOND_HORN_SPOT.y - ATTACKED_HOOP.y)).not.toBe(Math.sign(horns.O5!.y - ATTACKED_HOOP.y));
    expect(isBehindThreePointLine(horns.O2!)).toBe(true);
    expect(isBehindThreePointLine(horns.O4!)).toBe(true);
    expect(Math.abs(horns.O2!.y - horns.O4!.y)).toBeGreaterThan(12);
    // Cada defensor entre su marca y el aro.
    for (const k of [1, 2, 3, 4]) expect(distance(horns[`D${k}`]!, ATTACKED_HOOP)).toBeLessThan(distance(horns[`O${k}`]!, ATTACKED_HOOP));
  });

  it("responsabilidad: el defensor del segundo cuerno está más cerca del short roll que el de la esquina débil central", () => {
    expect(distance(horns.D3!, SHORT_ROLL_SPOT)).toBeLessThan(distance(central.D3!, SHORT_ROLL_SPOT) - 1.5);
    // Y quien repara desde la esquina débil tiene más camino hasta el codo que el ala débil central hasta la esquina.
    expect(distance(horns.D4!, HORNS_SECOND_HORN_SPOT)).toBeGreaterThan(distance(central.D4!, WEAK_CORNER_HELP_LEFT_SPOT));
  });
});
