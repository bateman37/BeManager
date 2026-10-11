import { describe, expect, it } from "vitest";
import { resolveRebound, type ReboundCandidate, type ReboundSeed } from "./rebound-resolver";
import { createSeededRandom } from "../../random/seeded-random";

function candidate(overrides: Partial<ReboundCandidate> & { playerId: string }): ReboundCandidate {
  return {
    teamId: overrides.playerId.startsWith("O") ? "ataque" : "defensa",
    position: { x: 20, y: 7.5 },
    arrivalTimeSeconds: 5,
    t19: 8,
    f05: 8,
    t20: 8,
    ...overrides,
  };
}

describe("resolveRebound: invariante HF-002 (dentro de la cancha no es fuera)", () => {
  it("no declara fuera un balón dentro de la cancha solo porque nadie llega en la ventana de vuelo", () => {
    const seed: ReboundSeed = { landingPoint: { x: 25, y: 7.5 }, flightTimeSeconds: 0.8 };
    const candidates = [
      candidate({ playerId: "O5", arrivalTimeSeconds: 5, t20: 6 }),
      candidate({ playerId: "D5", arrivalTimeSeconds: 6, t20: 9 }),
    ];
    const rng = createSeededRandom(1);

    const outcome = resolveRebound(seed, candidates, rng);

    expect(outcome.kind).not.toBe("out_of_bounds");
  });

  it("sigue declarando fuera un balón cuya trayectoria cae fuera de la cancha", () => {
    const seed: ReboundSeed = { landingPoint: { x: -1, y: 7.5 }, flightTimeSeconds: 0.8 };
    const candidates = [candidate({ playerId: "O5" })];
    const outcome = resolveRebound(seed, candidates, createSeededRandom(1));
    expect(outcome).toEqual({ kind: "out_of_bounds" });
  });
});

describe("resolveRebound: invariante HF-002 (palmeo solo entre quienes llegan)", () => {
  it("el conjunto de disputa de un palmeo solo incluye a quienes llegan dentro de la ventana de vuelo", () => {
    const seed: ReboundSeed = { landingPoint: { x: 25, y: 7.5 }, flightTimeSeconds: 0.8 };
    const candidates = [
      candidate({ playerId: "O5", arrivalTimeSeconds: 0.3, t20: 6 }),
      candidate({ playerId: "D5", arrivalTimeSeconds: 0.5, t20: 15 }),
      // D1 tiene el T20 más alto de todos, pero llega demasiado tarde para disputar este palmeo.
      candidate({ playerId: "D1", arrivalTimeSeconds: 30, t20: 15 }),
    ];

    // Fuerza la rama de palmeo (captureProbability < 1 con disputa) probando varias semillas.
    let found = false;
    for (let s = 1; s <= 200 && !found; s++) {
      const outcome = resolveRebound(seed, candidates, createSeededRandom(s));
      if (outcome.kind === "loose_ball_tip") {
        expect(outcome.contestPoolPlayerIds).not.toContain("D1");
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
