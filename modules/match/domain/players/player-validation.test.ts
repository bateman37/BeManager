import { describe, expect, it } from "vitest";
import { checkPlayerCoherence } from "./player-validation";
import { LAB_ROSTER_FIXTURE } from "./lab-roster-fixture";
import { buildAttributeRatings } from "./player-profile";
import type { PlayerProfile } from "./player-profile";

describe("checkPlayerCoherence", () => {
  it("no genera avisos para los diez perfiles preparados del prompt", () => {
    for (const team of LAB_ROSTER_FIXTURE) {
      for (const player of team.players) {
        const warnings = checkPlayerCoherence(player);
        expect(warnings, `${player.name} no debería generar avisos`).toEqual([]);
      }
    }
  });

  it("avisa de un pívot nominal bajo 195 cm sin bloquear", () => {
    const shortCenter: PlayerProfile = {
      id: "test-1",
      name: "Test Pívot Bajo",
      age: 24,
      positionLabel: "Pívot / B",
      template: "B",
      measures: { heightCm: 190, weightKg: 90, wingspanCm: 195, standingReachCm: 240 },
      attributes: buildAttributeRatings("B", {}),
      pnrTendency: "priorizar_primera_opcion",
    };

    const warnings = checkPlayerCoherence(shortCenter);
    expect(warnings.some((w) => w.code === "pivot_bajo")).toBe(true);
  });

  it("avisa de un peso fuera del rango adulto típico", () => {
    const light: PlayerProfile = {
      id: "test-2",
      name: "Test Peso Atípico",
      age: 24,
      positionLabel: "Escolta / W",
      template: "W",
      measures: { heightCm: 195, weightKg: 55, wingspanCm: 200, standingReachCm: 250 },
      attributes: buildAttributeRatings("W", {}),
      pnrTendency: "priorizar_primera_opcion",
    };

    const warnings = checkPlayerCoherence(light);
    expect(warnings.some((w) => w.code === "peso_atipico")).toBe(true);
  });
});
