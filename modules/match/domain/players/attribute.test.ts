import { describe, expect, it } from "vitest";
import { ACTIVE_ATTRIBUTE_IDS, d, ratingToLetterGrade, isValidRating } from "./attribute";

describe("escala 1-15 y 15 letras exactas", () => {
  it("tiene exactamente 30 capacidades activas (M09 en ME-02; T02/T03/M07 en ME-07B v2)", () => {
    expect(ACTIVE_ATTRIBUTE_IDS.length).toBe(30);
    expect(new Set(ACTIVE_ATTRIBUTE_IDS).size).toBe(30);
  });

  it("convierte cada entero 1-15 a una letra distinta", () => {
    const letters = new Set<string>();
    for (let rating = 1; rating <= 15; rating++) {
      letters.add(ratingToLetterGrade(rating));
    }
    expect(letters.size).toBe(15);
  });

  it("produce exactamente E- .. A+ en orden", () => {
    const expected = [
      "E-",
      "E",
      "E+",
      "D-",
      "D",
      "D+",
      "C-",
      "C",
      "C+",
      "B-",
      "B",
      "B+",
      "A-",
      "A",
      "A+",
    ];
    const actual = Array.from({ length: 15 }, (_, i) => ratingToLetterGrade(i + 1));
    expect(actual).toEqual(expected);
  });

  it("rechaza valores fuera de rango", () => {
    expect(() => ratingToLetterGrade(0)).toThrow();
    expect(() => ratingToLetterGrade(16)).toThrow();
    expect(() => ratingToLetterGrade(7.5)).toThrow();
  });

  it("isValidRating valida enteros 1-15", () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(15)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(16)).toBe(false);
    expect(isValidRating(8.5)).toBe(false);
  });
});

describe("d(rating)", () => {
  it("centra la escala en 8 con rango -7..+7", () => {
    expect(d(1)).toBe(-7);
    expect(d(8)).toBe(0);
    expect(d(15)).toBe(7);
  });
});
