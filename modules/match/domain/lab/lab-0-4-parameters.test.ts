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
