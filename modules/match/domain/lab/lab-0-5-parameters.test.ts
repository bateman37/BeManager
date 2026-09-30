import { describe, expect, it } from "vitest";
import {
  FLOATER_BASE_PROBABILITY,
  MID_RANGE_BASE_PROBABILITY,
  CLOSE_FINISH_MAX_DISTANCE_METERS,
  FLOATER_MAX_DISTANCE_METERS,
  isFloaterZone,
  isMidRangeZone,
} from "./lab-0-5-parameters";
import { shotProbability, CLOSE_FINISH_BASE_PROBABILITY, THREE_POINT_BASE_PROBABILITY } from "./lab-0-1-parameters";
import { ATTACKED_HOOP } from "../geometry/court";

const at = (d: number) => ({ x: ATTACKED_HOOP.x - d, y: ATTACKED_HOOP.y });

describe("LAB-0.5: floater y tiro medio (ME-07B v2 §2.4/§6)", () => {
  it("caso neutro y orden por distancia: aro > floater > tiro medio > triple", () => {
    expect(shotProbability(FLOATER_BASE_PROBABILITY, 8, 0)).toBeCloseTo(0.48, 12);
    expect(shotProbability(MID_RANGE_BASE_PROBABILITY, 8, 0)).toBeCloseTo(0.42, 12);
    expect(CLOSE_FINISH_BASE_PROBABILITY).toBeGreaterThan(FLOATER_BASE_PROBABILITY);
    expect(FLOATER_BASE_PROBABILITY).toBeGreaterThan(MID_RANGE_BASE_PROBABILITY);
    expect(MID_RANGE_BASE_PROBABILITY).toBeGreaterThan(THREE_POINT_BASE_PROBABILITY);
  });

  it("sensibilidad: la misma pendiente por rating y la misma penalización por oposición que los otros tipos", () => {
    for (const base of [FLOATER_BASE_PROBABILITY, MID_RANGE_BASE_PROBABILITY]) {
      expect(shotProbability(base, 15, 0) - shotProbability(base, 8, 0)).toBeCloseTo(0.017 * 7, 12);
      expect(shotProbability(base, 8, 0) - shotProbability(base, 8, 1)).toBeCloseTo(0.18, 12);
    }
  });

  it("las zonas se reparten sin solaparse por la distancia real al aro", () => {
    expect(isFloaterZone(at(CLOSE_FINISH_MAX_DISTANCE_METERS))).toBe(false);
    expect(isFloaterZone(at(3.4))).toBe(true);
    expect(isFloaterZone(at(FLOATER_MAX_DISTANCE_METERS))).toBe(true);
    expect(isMidRangeZone(at(FLOATER_MAX_DISTANCE_METERS))).toBe(false);
    expect(isMidRangeZone(at(5.5))).toBe(true);
    expect(isMidRangeZone(at(6.8))).toBe(false);
  });
});
