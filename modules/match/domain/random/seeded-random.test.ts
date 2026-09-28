import { describe, expect, it } from "vitest";
import { createSeededRandom } from "./seeded-random";

describe("createSeededRandom", () => {
  it("produce la misma secuencia para la misma semilla", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);

    const sequenceA = Array.from({ length: 10 }, () => a.next());
    const sequenceB = Array.from({ length: 10 }, () => b.next());

    expect(sequenceA).toEqual(sequenceB);
  });

  it("produce secuencias distintas para semillas distintas", () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);

    expect(a.next()).not.toBe(b.next());
  });

  it("nextInRange respeta los límites", () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 50; i++) {
      const value = rng.nextInRange(2, 5);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThan(5);
    }
  });

  it("nextInt respeta los límites inclusive", () => {
    const rng = createSeededRandom(9);
    for (let i = 0; i < 50; i++) {
      const value = rng.nextInt(1, 3);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(3);
    }
  });
});
