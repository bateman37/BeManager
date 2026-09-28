import { describe, expect, it } from "vitest";
import { distance, moveToward, timeToReach } from "./point";

describe("distance", () => {
  it("calcula la distancia euclídea", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("moveToward", () => {
  it("no sobrepasa el objetivo (sin teletransporte)", () => {
    const result = moveToward({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, 10);
    expect(result).toEqual({ x: 1, y: 0 });
  });

  it("avanza proporcionalmente a velocidad y tiempo", () => {
    const result = moveToward({ x: 0, y: 0 }, { x: 10, y: 0 }, 2, 1);
    expect(result.x).toBeCloseTo(2);
    expect(result.y).toBeCloseTo(0);
  });
});

describe("timeToReach", () => {
  it("calcula el tiempo como distancia/velocidad", () => {
    expect(timeToReach({ x: 0, y: 0 }, { x: 10, y: 0 }, 5)).toBe(2);
  });

  it("es 0 si ya está en el objetivo", () => {
    expect(timeToReach({ x: 1, y: 1 }, { x: 1, y: 1 }, 5)).toBe(0);
  });
});
