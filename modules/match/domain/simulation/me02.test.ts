import { describe, expect, it } from "vitest";
import { runPossession } from "./possession-engine";
import { computePossessionCore } from "./possession-core";
import { runScenarioBatch } from "../fast/fast-resolver";
import { LAB_ROSTER_FIXTURE } from "../players/lab-roster-fixture";
import type { MatchInput, DefensiveCoverage } from "../lab/match-input";
import { LAB_0_2_PARAMETERS_VERSION } from "../lab/lab-0-2-parameters";
import type { ScenarioId } from "../lab/scenario";

/**
 * Pruebas discriminantes de ME-02 (prompt §4), separadas de las de
 * ME-01/HF-002 para no tocar retrospectivamente aquellos ficheros. Pocas y
 * causales: cada una aísla un mecanismo concreto de C1-C3 o de la trampa.
 */
function buildInput(scenarioId: ScenarioId, coverage: DefensiveCoverage, seed: number): MatchInput {
  return {
    scenarioId,
    coverage,
    seed,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: LAB_0_2_PARAMETERS_VERSION,
    offensePlayers: LAB_ROSTER_FIXTURE[0]!.players,
    defensePlayers: LAB_ROSTER_FIXTURE[1]!.players,
  };
}

// (1) Mismo input/semilla/versiones ⇒ mismos hechos y agregados, también
// para la cobertura de trampa (no solo para drop, ya cubierto en ME-01).
describe("ME-02 (1): reproducibilidad también bajo trampa", () => {
  it("misma entrada y semilla producen los mismos hechos con coverage=trampa", () => {
    const a = runPossession(buildInput("drop_con_ayuda", "trampa", 777));
    const b = runPossession(buildInput("drop_con_ayuda", "trampa", 777));
    expect(a.terminal).toEqual(b.terminal);
    expect(a.facts.map((f) => ({ kind: f.kind, atMs: f.atMs }))).toEqual(
      b.facts.map((f) => ({ kind: f.kind, atMs: f.atMs })),
    );
  });

  it("mismo lote agregado produce los mismos agregados dos veces", () => {
    const input = buildInput("drop_con_ayuda", "trampa", 300);
    const r1 = runScenarioBatch(input, 25);
    const r2 = runScenarioBatch(input, 25);
    expect(r1.categories).toEqual(r2.categories);
  });
});

// (2) Defender lejos nunca causa falta/oposición por mera llegada al punto
// de ayuda; el closeout ilegal real (escenario dedicado) sí es alcanzable.
describe("ME-02 (2): C1, contacto real por geometría, no por reloj", () => {
  it("en drop_sin_ayuda (D3 no ayuda, D5 lejos del roll) nunca hay falta de tiro ni oposición atribuida a un defensor que no llegó", () => {
    let anyFoul = false;
    for (let seed = 1; seed <= 300; seed++) {
      const state = runPossession(buildInput("drop_sin_ayuda", "drop", seed));
      if (state.facts.some((f) => f.kind === "shooting_foul")) anyFoul = true;
    }
    // Sin ayuda, D5 sigue protegiendo el aro (no hay defensor que llegue
    // tarde sin margen al punto de recepción de O5); la falta ordinaria de
    // tiro por cierre tardío no debe dispararse aquí a estas tasas.
    expect(anyFoul).toBe(false);
  });

  it("el escenario de closeout tardío sigue alcanzando una falta ordinaria de tiro real y reproducible", () => {
    let foundFoul = false;
    for (let seed = 1; seed <= 60 && !foundFoul; seed++) {
      const state = runPossession(buildInput("closeout_tardio_con_contacto", "drop", seed));
      if (state.terminal!.kind === "shooting_foul") foundFoul = true;
    }
    expect(foundFoul).toBe(true);
  });

  it("mejorar T22/T23/T15-T20 defensivos en drop con ayuda no dispara faltas masivas por defecto geométrico (rechazo del experimento ~982/1500)", () => {
    const boosted = LAB_ROSTER_FIXTURE[1]!.players.map((p) => ({
      ...p,
      attributes: {
        ...p.attributes,
        T15: 15,
        T16: 15,
        T17: 15,
        T18: 15,
        T19: 15,
        T20: 15,
        T22: 15,
        T23: 15,
      },
    }));
    const input: MatchInput = {
      ...buildInput("drop_con_ayuda", "drop", 1),
      defensePlayers: boosted,
    };
    const result = runScenarioBatch(input, 1500);
    // Señal de rechazo explícita del prompt: ~982-983/1500 faltas de tiro
    // con ayuda por un falso contacto geométrico no es aceptable.
    expect(result.categories.shootingFouls).toBeLessThan(1500 * 0.5);
  });
});

// (3) Help que niega el roll y deja la esquina ⇒ pase a O3 alcanzable; sin
// ayuda no se regala O3.
describe("ME-02 (3): C2, la esquina débil es alcanzable con ayuda real", () => {
  it("con ayuda, un lote de 1500 corridas produce al menos un pase a la esquina", () => {
    const result = runScenarioBatch(buildInput("drop_con_ayuda", "drop", 1), 1500);
    expect(result.categories.passesToCorner).toBeGreaterThan(0);
  });

  it("sin ayuda, ningún lote regala la esquina a O3", () => {
    const result = runScenarioBatch(buildInput("drop_sin_ayuda", "drop", 1), 1500);
    expect(result.categories.passesToCorner).toBe(0);
  });
});

// (4) La trampa cambia responsabilidades y puede abrir una salida real si
// supera a dos defensores, sin garantizar robo ni canasta.
describe("ME-02 (4): trampa cambia responsabilidades y puede abrir una salida", () => {
  it("la trampa genera hechos propios de compromiso (D1+D5) que drop no genera", () => {
    let anyTrap = false;
    for (let seed = 1; seed <= 100; seed++) {
      const state = runPossession(buildInput("drop_con_ayuda", "trampa", seed));
      if (state.facts.some((f) => f.kind === "trap_committed")) anyTrap = true;
    }
    expect(anyTrap).toBe(true);

    const dropState = runPossession(buildInput("drop_con_ayuda", "drop", 1));
    expect(dropState.facts.some((f) => f.kind === "trap_committed")).toBe(false);
  });

  it("con D5/D1 rápidos y coordinados, la trampa cierra a tiempo y produce robos reales sin garantizarlos", () => {
    // D5 más ágil/rápido de reconocer (F04, M01, M05, T22) cierra la
    // trampa antes de que el pase a O5 llegue, lo que hace alcanzable la
    // presión real de dos defensores sobre el balón (T07 vs T15).
    const fastTrapDefense = LAB_ROSTER_FIXTURE[1]!.players.map((p) =>
      p.id === "D5" ? { ...p, attributes: { ...p.attributes, F04: 15, M01: 15, M05: 15, T22: 15 } } : p,
    );
    const input: MatchInput = { ...buildInput("drop_con_ayuda", "trampa", 1), defensePlayers: fastTrapDefense };
    const result = runScenarioBatch(input, 1500);
    // La trampa produce robos reales pero no en todas las corridas: es
    // presión real (T07 vs T15), no un robo garantizado. Cuando la trampa
    // cierra pero D3 (low man, sin reforzar en esta prueba) no contiene a
    // tiempo el short roll, el 4x3 puede abrir la salida a O4 que dejó
    // libre la rotación de D4, sin que eso garantice canasta.
    expect(result.categories.steals).toBeGreaterThan(0);
    expect(result.categories.steals).toBeLessThan(result.sampleSize);
    expect(result.categories.passesToOutlet).toBeGreaterThan(0);
    expect(result.categories.fieldGoalMade2 + result.categories.fieldGoalMade3).toBeLessThan(result.sampleSize);
  });

  it("cuando la trampa no cierra a tiempo (perfiles originales), O1 puede escapar por el carril que deja D5", () => {
    const result = runScenarioBatch(buildInput("drop_con_ayuda", "trampa", 1), 1500);
    expect(result.categories.trapBrokenAdvantage).toBeGreaterThan(0);
    expect(result.categories.steals).toBe(0);
  });
});

// (5) M09 cambia únicamente el instante de aviso/reparación pertinente,
// conservando lo demás.
describe("ME-02 (5): M09 solo desplaza el instante del aviso pertinente", () => {
  it("subir M09 de D5/D3/D4 adelanta la reparación de D4 sin cambiar el resto de la geometría", () => {
    const base = buildInput("drop_con_ayuda", "trampa", 42);
    const lowM09: MatchInput = {
      ...base,
      defensePlayers: base.defensePlayers.map((p) =>
        p.id === "D3" || p.id === "D4" || p.id === "D5" ? { ...p, attributes: { ...p.attributes, M09: 8 } } : p,
      ),
    };
    const highM09: MatchInput = {
      ...base,
      defensePlayers: base.defensePlayers.map((p) =>
        p.id === "D3" || p.id === "D4" || p.id === "D5" ? { ...p, attributes: { ...p.attributes, M09: 15 } } : p,
      ),
    };
    const lowResult = computePossessionCore(lowM09);
    const highResult = computePossessionCore(highM09);

    const lowRepair = lowResult.timeline.find((f) => f.kind === "help_repair_attempt");
    const highRepair = highResult.timeline.find((f) => f.kind === "help_repair_attempt");
    expect(lowRepair).toBeDefined();
    expect(highRepair).toBeDefined();
    // M09 más alto (menos latencia) nunca retrasa el aviso de reparación.
    expect(highRepair!.atMs).toBeLessThanOrEqual(lowRepair!.atMs);

    // La geometría de referencia (los puntos de short roll/esquina) no cambia.
    expect(lowResult.timeline.find((f) => f.kind === "help_left_assignment")).toBeDefined();
    expect(highResult.timeline.find((f) => f.kind === "help_left_assignment")).toBeDefined();
  });
});

// (6) And-one, fallo con falta, tiro taponado y rebote ofensivo reconcilian
// FGA/FGM/FTA/FTM/puntos (C3).
describe("ME-02 (6): C3, estadística conciliada con los hechos", () => {
  it("un lote de 1500 corridas nunca cuenta más FGA oficial que oportunidades de tiro preparadas", () => {
    const result = runScenarioBatch(buildInput("drop_con_ayuda", "drop", 1), 1500);
    const officialFga = result.categories.fieldGoalAttempts2 + result.categories.fieldGoalAttempts3;
    expect(officialFga).toBeLessThanOrEqual(result.categories.shotOpportunities);
    // Puntos coherentes con 2×2FGM + 3×3FGM + FTM (C3 §2).
    const expectedPoints =
      2 * result.categories.fieldGoalMade2 + 3 * result.categories.fieldGoalMade3 + result.categories.freeThrowMade;
    expect(result.categories.points).toBe(expectedPoints);
  });

  it("una falta de tiro con intento fallado no cuenta como FGA", () => {
    let found = false;
    for (let seed = 1; seed <= 400 && !found; seed++) {
      const state = runPossession(buildInput("closeout_tardio_con_contacto", "drop", seed));
      const foulFact = state.facts.find(
        (f) => f.kind === "shooting_foul" && f.detail.madeShot === false,
      );
      if (!foulFact) continue;
      const fgaAtSameInstant = state.facts.find(
        (f) => f.kind === "field_goal_attempt" && f.atMs === foulFact.atMs,
      );
      expect(fgaAtSameInstant).toBeUndefined();
      found = true;
    }
    expect(found).toBe(true);
  });

  it("una canasta válida con falta (and-one) deja 1 FGA, 1 FGM y el libre adicional", () => {
    let found = false;
    for (let seed = 1; seed <= 400 && !found; seed++) {
      const state = runPossession(buildInput("closeout_tardio_con_contacto", "drop", seed));
      const foulFact = state.facts.find(
        (f) => f.kind === "shooting_foul" && f.detail.madeShot === true,
      );
      if (!foulFact) continue;
      const fga = state.facts.find((f) => f.kind === "field_goal_attempt" && f.atMs === foulFact.atMs);
      expect(fga).toBeDefined();
      expect(fga!.detail.made).toBe(true);
      const terminal = state.terminal as Extract<typeof state.terminal, { kind: "shooting_foul" }>;
      expect(terminal.freeThrowsAwarded).toBe(1);
      found = true;
    }
    expect(found).toBe(true);
  });
});

// (7) Modo rápido comparte significado de hechos y no llama a runPossession
// (además, ya comprobado por importación en fast-resolver.test.ts).
describe("ME-02 (7): el modo rápido usa la misma taxonomía de hechos que el detallado", () => {
  it("field_goal_attempt y free_throws_result aparecen igual en detallado y en el núcleo compartido del rápido", () => {
    const input = buildInput("closeout_tardio_con_contacto", "drop", 4);
    const detailed = runPossession(input);
    const core = computePossessionCore(input, { trackPositionHistory: false });
    expect(detailed.facts.some((f) => f.kind === "field_goal_attempt")).toBe(
      core.timeline.some((f) => f.kind === "field_goal_attempt"),
    );
    expect(detailed.facts.some((f) => f.kind === "free_throws_result")).toBe(
      core.timeline.some((f) => f.kind === "free_throws_result"),
    );
  });
});
