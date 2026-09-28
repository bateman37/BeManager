import { describe, expect, it } from "vitest";
import {
  clamp,
  attackerMoveSpeedMps,
  closeoutBrakingExtraSeconds,
  recognitionLatencySeconds,
  secondOptionProbability,
  screenInterceptDelaySeconds,
  screenContactAdjustmentSeconds,
  turnoverUnderPressureProbability,
  deflectionProbability,
  passTrajectoryErrorProbability,
  cleanReceptionProbability,
  jumpCeilingMeters,
  shotReleaseHeightMeters,
  maxTouchHeightMeters,
  blockDeflectionProbability,
  shotProbability,
  freeThrowProbability,
  closeoutReboundDelaySeconds,
  reboundCaptureProbability,
  CLOSE_FINISH_BASE_PROBABILITY,
  THREE_POINT_BASE_PROBABILITY,
} from "./lab-0-1-parameters";

describe("clamp", () => {
  it("recorta por encima y por debajo", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe("fórmulas acotadas: los extremos de rating nunca salen de su rango", () => {
  it("recognitionLatencySeconds se mantiene en [0.10, 0.40] en los extremos", () => {
    expect(recognitionLatencySeconds(1, 1)).toBeLessThanOrEqual(0.4);
    expect(recognitionLatencySeconds(15, 15)).toBeGreaterThanOrEqual(0.1);
  });

  it("secondOptionProbability se mantiene en [0.03, 0.20]", () => {
    expect(secondOptionProbability(1)).toBeLessThanOrEqual(0.2);
    expect(secondOptionProbability(15)).toBeGreaterThanOrEqual(0.03);
  });

  it("screenInterceptDelaySeconds se mantiene en [0.04, 0.55]", () => {
    const worst = screenInterceptDelaySeconds(1, 1, 15);
    const best = screenInterceptDelaySeconds(15, 15, 1);
    expect(worst).toBeGreaterThanOrEqual(0.04);
    expect(worst).toBeLessThanOrEqual(0.55);
    expect(best).toBeGreaterThanOrEqual(0.04);
    expect(best).toBeLessThanOrEqual(0.55);
  });

  it("screenContactAdjustmentSeconds se mantiene en ±0.03 s", () => {
    expect(screenContactAdjustmentSeconds(1000)).toBe(0.03);
    expect(screenContactAdjustmentSeconds(-1000)).toBe(-0.03);
  });

  it("turnoverUnderPressureProbability se mantiene en [0.01, 0.16]", () => {
    expect(turnoverUnderPressureProbability(1, 15)).toBeLessThanOrEqual(0.16);
    expect(turnoverUnderPressureProbability(15, 1)).toBeGreaterThanOrEqual(0.01);
  });

  it("deflectionProbability se mantiene en [0.01, 0.30]", () => {
    expect(deflectionProbability(15, 1)).toBeLessThanOrEqual(0.3);
    expect(deflectionProbability(1, 15)).toBeGreaterThanOrEqual(0.01);
  });

  it("passTrajectoryErrorProbability y cleanReceptionProbability respetan sus rangos", () => {
    expect(passTrajectoryErrorProbability(1, 1)).toBeLessThanOrEqual(0.14);
    expect(passTrajectoryErrorProbability(15, 0)).toBeGreaterThanOrEqual(0.01);
    expect(cleanReceptionProbability(1, 1)).toBeGreaterThanOrEqual(0.6);
    expect(cleanReceptionProbability(15, 0)).toBeLessThanOrEqual(0.99);
  });

  it("blockDeflectionProbability se mantiene en [0.02, 0.30]", () => {
    expect(blockDeflectionProbability(1)).toBeGreaterThanOrEqual(0.02);
    expect(blockDeflectionProbability(15)).toBeLessThanOrEqual(0.3);
  });

  it("shotProbability y freeThrowProbability respetan sus rangos", () => {
    expect(shotProbability(CLOSE_FINISH_BASE_PROBABILITY, 1, 1)).toBeGreaterThanOrEqual(0.04);
    expect(shotProbability(THREE_POINT_BASE_PROBABILITY, 15, 0)).toBeLessThanOrEqual(0.82);
    expect(freeThrowProbability(1)).toBeGreaterThanOrEqual(0.4);
    expect(freeThrowProbability(15)).toBeLessThanOrEqual(0.94);
  });

  it("closeoutReboundDelaySeconds y reboundCaptureProbability respetan sus rangos", () => {
    expect(closeoutReboundDelaySeconds(1, 1)).toBeGreaterThanOrEqual(0.02);
    expect(closeoutReboundDelaySeconds(15, 15)).toBeLessThanOrEqual(0.35);
    expect(reboundCaptureProbability(15, 0)).toBeLessThanOrEqual(0.96);
    expect(reboundCaptureProbability(1, 1)).toBeGreaterThanOrEqual(0.45);
  });
});

describe("velocidad y movimiento crecen con el rating (d positivo = más rápido)", () => {
  it("attackerMoveSpeedMps aumenta con F01", () => {
    expect(attackerMoveSpeedMps(15)).toBeGreaterThan(attackerMoveSpeedMps(1));
  });

  it("closeoutBrakingExtraSeconds nunca baja de 0.06 s", () => {
    expect(closeoutBrakingExtraSeconds(15)).toBeGreaterThanOrEqual(0.06);
  });
});

describe("geometría vertical: sin doble premio por C01 y C04 (invariante 5)", () => {
  it("shotReleaseHeightMeters nunca supera alcance + salto ejecutado", () => {
    const height = shotReleaseHeightMeters(230, 300, 0.5);
    expect(height).toBeLessThanOrEqual(300 / 100 + 0.5 + 1e-9);
  });

  it("maxTouchHeightMeters depende solo de alcance de pie y salto, no de C01", () => {
    const withSameReachAndJump = maxTouchHeightMeters(280, 0.4);
    expect(withSameReachAndJump).toBeCloseTo(280 / 100 + 0.4);
  });

  it("jumpCeilingMeters usa el rating bruto de F06, no d(F06)", () => {
    expect(jumpCeilingMeters(8)).toBeCloseTo(0.25 + 0.02 * 8);
  });
});
