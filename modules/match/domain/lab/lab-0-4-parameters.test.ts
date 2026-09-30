import { describe, expect, it } from "vitest";
import { shooterLandingSeconds } from "./lab-0-4-parameters";

describe("LAB-0.4: caída del tirador tras soltar el tiro", () => {
  it("respeta su intervalo documentado y el caso neutro", () => {
    expect(shooterLandingSeconds(1)).toBeGreaterThanOrEqual(0.234);
    expect(shooterLandingSeconds(15)).toBeLessThanOrEqual(0.336);
    expect(shooterLandingSeconds(8)).toBeCloseTo(0.289, 2);
  });

  it("sensibilidad: más salto (F06) significa más tiempo en el aire, de forma monótona y acotada", () => {
    let prev = 0;
    for (let f = 1; f <= 15; f++) {
      const v = shooterLandingSeconds(f as never);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    expect(shooterLandingSeconds(15) - shooterLandingSeconds(1)).toBeLessThan(0.11);
  });
});

import { blendProjectionWithObservation, OBSERVATION_PRIOR_WEIGHT_USES } from "./lab-0-4-parameters";

describe("LAB-0.4: aprendizaje por muestras visibles", () => {
  it("sin muestras devuelve la proyección pura (caso neutro)", () => {
    expect(blendProjectionWithObservation(1.1, undefined)).toBe(1.1);
    expect(blendProjectionWithObservation(1.1, { uses: 0, points: 0 })).toBe(1.1);
  });

  it("converge hacia lo observado con más usos y K grande lo ignora", () => {
    const few = blendProjectionWithObservation(0.8, { uses: 2, points: 4 });
    const many = blendProjectionWithObservation(0.8, { uses: 40, points: 80 });
    expect(few).toBeGreaterThan(0.8);
    expect(many).toBeGreaterThan(few);
    expect(many).toBeLessThan(2);
    expect(blendProjectionWithObservation(0.8, { uses: 40, points: 80 }, 1e9)).toBeCloseTo(0.8, 6);
    expect(OBSERVATION_PRIOR_WEIGHT_USES).toBeGreaterThanOrEqual(2);
    expect(OBSERVATION_PRIOR_WEIGHT_USES).toBeLessThanOrEqual(20);
  });
});
