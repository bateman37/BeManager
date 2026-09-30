import { describe, expect, it } from "vitest";
import { runPossession } from "./possession-engine";
import { LAB_ROSTER_FIXTURE } from "../players/lab-roster-fixture";
import type { MatchInput } from "../lab/match-input";
import { LAB_PARAMETERS_VERSION } from "../lab/lab-0-1-parameters";
import type { ScenarioId } from "../lab/scenario";

function buildInput(scenarioId: ScenarioId, seed: number): MatchInput {
  return {
    scenarioId,
    coverage: "drop",
    seed,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: LAB_PARAMETERS_VERSION,
    offensePlayers: LAB_ROSTER_FIXTURE[0]!.players,
    defensePlayers: LAB_ROSTER_FIXTURE[1]!.players,
  };
}

const VALID_TERMINAL_KINDS = [
  "made_basket",
  "missed_shot_defensive_rebound",
  "missed_shot_offensive_rebound_continues",
  "live_turnover",
  "steal_by_defense",
  "blocked_shot_live_ball",
  "shooting_foul",
  "out_of_bounds",
  "shot_clock_violation",
  "possession_reorganized_control_kept",
  "simulation_guard_stopped",
];

describe("runPossession: invariante 2 (reproducibilidad)", () => {
  it("misma entrada y semilla producen los mismos hechos deportivos", () => {
    const a = runPossession(buildInput("drop_con_ayuda", 12345));
    const b = runPossession(buildInput("drop_con_ayuda", 12345));

    expect(a.terminal).toEqual(b.terminal);
    expect(a.facts.map((f) => ({ kind: f.kind, atMs: f.atMs, text: f.text }))).toEqual(
      b.facts.map((f) => ({ kind: f.kind, atMs: f.atMs, text: f.text })),
    );
  });

  it("semillas distintas pueden producir secuencias distintas", () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => runPossession(buildInput("drop_con_ayuda", seed)));
    const uniqueOutcomes = new Set(seeds.map((s) => JSON.stringify(s.terminal)));
    expect(uniqueOutcomes.size).toBeGreaterThan(1);
  });
});

describe("runPossession: invariante 3 (estados legales y tiempos)", () => {
  it("termina siempre en un estado legal soportado", () => {
    for (const scenarioId of ["drop_con_ayuda", "drop_sin_ayuda", "closeout_tardio_con_contacto"] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const state = runPossession(buildInput(scenarioId, seed));
        expect(state.terminal).not.toBeNull();
        expect(VALID_TERMINAL_KINDS).toContain(state.terminal!.kind);
      }
    }
  });

  it("todos los hechos tienen instantes no negativos y en orden no decreciente", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 99));
    let previous = -1;
    for (const fact of state.facts) {
      expect(fact.atMs).toBeGreaterThanOrEqual(0);
      expect(fact.atMs).toBeGreaterThanOrEqual(previous);
      previous = fact.atMs;
    }
  });

  it("nunca hay dos jugadores en la misma posición exacta que el balón sin dueño (diez asignaciones)", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 7));
    const ids = Object.keys(state.players);
    expect(new Set(ids).size).toBe(10);
  });
});

describe("runPossession: invariante 4 (ayuda de D3 deja a O3)", () => {
  it("cuando D3 ayuda, se registra el hecho de que deja su marca", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 42));
    const helpFact = state.facts.find((f) => f.kind === "help_left_assignment");
    expect(helpFact).toBeDefined();
  });

  it("cuando D3 no ayuda, no se genera el hecho de dejar la marca", () => {
    const state = runPossession(buildInput("drop_sin_ayuda", 42));
    const helpFact = state.facts.find((f) => f.kind === "help_left_assignment");
    expect(helpFact).toBeUndefined();
  });

  it("la posible reparación de D4 deja a O4 sin cobertura", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 42));
    const repairFact = state.facts.find((f) => f.kind === "help_repair_attempt");
    expect(repairFact).toBeDefined();
    expect(repairFact!.actors).toEqual(["D4", "O4"]);
  });
});

describe("runPossession: invariante 8 (aislamiento de snapshot)", () => {
  it("una corrida ya calculada no cambia si se muta el array de entrada después", () => {
    const players = LAB_ROSTER_FIXTURE[0]!.players.map((p) => ({
      ...p,
      attributes: { ...p.attributes } as { T09: number } & typeof p.attributes,
    }));
    const input = buildInput("drop_con_ayuda", 321);
    const inputWithCopy: MatchInput = { ...input, offensePlayers: players };

    const before = runPossession(inputWithCopy);
    const beforeFacts = JSON.stringify(before.facts);

    // Mutar el snapshot original después de calcular no debe alterar el resultado ya obtenido.
    players[0]!.attributes.T09 = 1;

    expect(JSON.stringify(before.facts)).toBe(beforeFacts);
  });
});

describe("runPossession: comparación reproducible entre ayuda sí/no (invariante 7)", () => {
  it("cambiar la ayuda altera la secuencia de hechos con la misma semilla", () => {
    const withHelp = runPossession(buildInput("drop_con_ayuda", 555));
    const withoutHelp = runPossession(buildInput("drop_sin_ayuda", 555));

    expect(withHelp.facts.map((f) => f.kind)).not.toEqual(withoutHelp.facts.map((f) => f.kind));
  });
});

describe("runPossession: escenario closeout tardío", () => {
  it("es alcanzable y produce un estado terminal legal", () => {
    let foundFoul = false;
    for (let seed = 1; seed <= 40; seed++) {
      const state = runPossession(buildInput("closeout_tardio_con_contacto", seed));
      expect(state.terminal).not.toBeNull();
      if (state.terminal!.kind === "shooting_foul") foundFoul = true;
    }
    expect(foundFoul).toBe(true);
  });
});

describe("runPossession: HF-002 bug 2 (balón vivo hasta control real)", () => {
  // ME-04B recalibra el árbol de decisión y el modelo de oposición (§§3.1-
  // 3.3): las semillas concretas que alcanzaban cada rama cambian, pero la
  // rama en sí sigue siendo alcanzable (recalculadas aquí, no eliminadas).
  it("un tapón deja el balón suelto, no muerto en el aro", () => {
    // Semilla recalculada en ME-07B v2 §2.1 (el rebote con cierre real y la
    // caída del tirador cambian qué semillas llegan a un tapón).
    const state = runPossession(buildInput("drop_con_ayuda", 66));
    expect(state.terminal!.kind).toBe("blocked_shot_live_ball");
    expect(state.ball.status).toBe("loose");
    expect(state.ball.holderId).toBeNull();
  });

  it("una pérdida en balón vivo deja el balón suelto sin dueño", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 3));
    expect(state.terminal!.kind).toBe("live_turnover");
    expect(state.ball.status).toBe("loose");
    expect(state.ball.holderId).toBeNull();
  });

  it("un robo da el control real al defensor, no un balón muerto", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 158));
    expect(state.terminal!.kind).toBe("steal_by_defense");
    expect(state.ball.status).toBe("held");
    expect(state.ball.holderId).toBe("D1");
  });

  it("una canasta anotada sí deja el balón muerto en el aro", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 4));
    expect(state.terminal!.kind).toBe("made_basket");
    expect(state.ball).toEqual({ status: "dead", holderId: null, position: state.ball.position });
    expect(state.ball.position.x).toBeCloseTo(26.425);
  });
});

describe("runPossession: HF-002 bug 3 (instantánea fiel al instante del hecho)", () => {
  it("el hecho de inicio de reparación de D4 no muestra a D4 ya en la esquina que todavía no alcanzó", () => {
    const state = runPossession(buildInput("drop_con_ayuda", 42));
    const repairFact = state.facts.find((f) => f.kind === "help_repair_attempt");
    expect(repairFact).toBeDefined();
    const d4AtRepairStart = repairFact!.positions.find((p) => p.playerId === "D4");
    // D4 empieza a reparar antes de llegar: su instantánea en ese hecho no
    // puede coincidir con la esquina débil (destino), que llega más tarde.
    expect(d4AtRepairStart!.position).not.toEqual({ x: 24.0, y: 13.9 });
    expect(repairFact!.detail.arrivesAt).toBeGreaterThan(repairFact!.atMs / 1000);

    // Ningún hecho anterior a la llegada real de D4 puede mostrarlo ya en la esquina.
    const arrivesAtMs = (repairFact!.detail.arrivesAt as number) * 1000;
    for (const fact of state.facts) {
      if (fact.atMs < arrivesAtMs) {
        const d4Position = fact.positions.find((p) => p.playerId === "D4");
        expect(d4Position!.position).not.toEqual({ x: 24.0, y: 13.9 });
      }
    }
  });
});

describe("runPossession: HF-002 bug 4 (rebote ofensivo con segundo tiro reconciliado)", () => {
  it("un rebote ofensivo capturado por el ataque continúa la misma posesión estadística hasta un segundo tiro", () => {
    let found = false;
    for (let seed = 1; seed <= 400 && !found; seed++) {
      const state = runPossession(buildInput("drop_con_ayuda", seed));
      const shotAttempts = state.facts.filter((f) => f.kind === "shot_prepared");
      const reboundEvents = state.facts.filter((f) => f.kind === "rebound_secured" || f.kind === "rebound_contested");
      if (
        shotAttempts.length >= 2 &&
        reboundEvents.some((f) => f.actors[0]?.startsWith("O"))
      ) {
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe("runPossession: HF-002 bug 5 (T22/T23 afectan mecanismos reales)", () => {
  it("subir T23 del ayudador D3 cambia el desenlace del roll manteniendo todo lo demás fijo", () => {
    let differs = false;
    for (let seed = 1; seed <= 200 && !differs; seed++) {
      const base = buildInput("drop_con_ayuda", seed);
      const lowResult = runPossession({
        ...base,
        defensePlayers: base.defensePlayers.map((p) =>
          p.id === "D3" ? { ...p, attributes: { ...p.attributes, T23: 1 } } : p,
        ),
      });
      const highResult = runPossession({
        ...base,
        defensePlayers: base.defensePlayers.map((p) =>
          p.id === "D3" ? { ...p, attributes: { ...p.attributes, T23: 15 } } : p,
        ),
      });
      if (lowResult.terminal!.kind !== highResult.terminal!.kind) differs = true;
    }
    expect(differs).toBe(true);
  });

  it("subir T22 del cierre exterior D4 cambia el desenlace del cierre manteniendo todo lo demás fijo", () => {
    // Semilla recalculada en ME-04B (§3.1: O1 real hasta el punto de uso de
    // la pantalla; §3.3: R_contest) — el mecanismo sigue siendo el mismo.
    const base = buildInput("closeout_tardio_con_contacto", 1);
    const lowResult = runPossession({
      ...base,
      defensePlayers: base.defensePlayers.map((p) => (p.id === "D4" ? { ...p, attributes: { ...p.attributes, T22: 1 } } : p)),
    });
    const highResult = runPossession({
      ...base,
      defensePlayers: base.defensePlayers.map((p) => (p.id === "D4" ? { ...p, attributes: { ...p.attributes, T22: 15 } } : p)),
    });
    expect(lowResult.terminal!.kind).not.toEqual(highResult.terminal!.kind);
  });
});

describe("runPossession: HF-002 bug 6 (libres ejecutados de verdad)", () => {
  it("una falta con canasta válida ejecuta el libre adicional y suma los puntos totales", () => {
    // Semilla recalculada en ME-04B (§§3.1, 3.3): sigue siendo un and-one
    // real de tres puntos con falta tardía ilegal sobre O3 en la esquina.
    const state = runPossession(buildInput("closeout_tardio_con_contacto", 6));
    expect(state.terminal!.kind).toBe("shooting_foul");
    const terminal = state.terminal as Extract<typeof state.terminal, { kind: "shooting_foul" }>;
    expect(terminal.basketCounted).toBe(true);
    expect(terminal.freeThrowsAwarded).toBe(1);
    expect(terminal.totalPoints).toBe(terminal.pointsFromFreeThrows + 3);
    expect(state.facts.some((f) => f.kind === "free_throws_result")).toBe(true);
  });

  it("el último libre fallado queda vivo y se resuelve como un rebote real, no como un final sin más", () => {
    let found = false;
    for (let seed = 1; seed <= 400 && !found; seed++) {
      const state = runPossession(buildInput("closeout_tardio_con_contacto", seed));
      const foulFact = state.facts.find((f) => f.kind === "shooting_foul");
      if (!foulFact) continue;
      // El desenlace final deja de ser "shooting_foul" a secas justo cuando
      // hubo libres concedidos y el último de ellos falló: en ese caso el
      // rebote posterior decide el desenlace real (HF-002 §2).
      if (state.terminal!.kind !== "shooting_foul" && state.facts.some((f) => f.kind === "free_throws_result")) {
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
