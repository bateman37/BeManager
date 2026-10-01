import { describe, expect, it, vi } from "vitest";

// Cuatro partidos completos con auditoría: más margen que el límite por defecto bajo carga paralela.
vi.setConfig({ testTimeout: 60_000 });
import { ORGANIZED_PLAYBOOK, cardFor, eligiblePlacements, playbookCard, type PlaybookCardId } from "./playbook-card";
import { playFullGame } from "../game/play-full-game";
import { buildGameInput, type GameResult } from "../game/game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { AuditDecisionPoint } from "../audit/audit-types";

/**
 * ME-07B v2 §3: la ficha de libro es un contrato que el motor respeta, no
 * una etiqueta. (1) Las colocaciones ofrecidas al organizar salen de las
 * fichas cuya condición admite el plan y la orden de colocación. (2) En un
 * partido completo, cada lectura ocurre dentro de la ficha en vigor de su
 * fase y pertenece a sus lecturas permitidas (el ICE solo en la lateral, las
 * lecturas de la mano a mano solo en su ficha).
 */
const READ_POINTS = new Set<AuditDecisionPoint>(ORGANIZED_PLAYBOOK.flatMap((c) => c.reads));

function play(seed: number, sierra: { coverage: "auto" | "ice"; screenPlacement: "auto" | "lateral" | "horns" }, puertoCoverage: "auto" | "ice"): GameResult {
  const common = { priority: "proteger_balance" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const };
  return playFullGame(
    buildGameInput({
      seed,
      auditEnabled: true,
      home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...common, ...sierra },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common, coverage: puertoCoverage, screenPlacement: "auto" },
    }),
  );
}

describe("ME-07B v2 §3: ficha de libro", () => {
  it("cada ficha declara fase, condición, colocación, roles y sustitutos, primera acción, variantes, lecturas, seguridad y prioridad; ninguna duplica a otra", () => {
    const ids = ORGANIZED_PLAYBOOK.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of ORGANIZED_PLAYBOOK) {
      expect(c.phase).toBe("ataque_organizado");
      expect(c.allowedPlans.length).toBeGreaterThan(0);
      expect(c.roles.creator.substitutes).toContain("poseedor_real");
      expect(c.roles.screener.substitutes).toContain("O4");
      expect(c.reads.length).toBeGreaterThan(0);
      expect(c.safety).toBe("salida_segura_y_reorganizar");
      expect(Object.keys(c.structure).sort()).toEqual(["O1", "O2", "O3", "O4", "O5"]);
    }
    // Horns y la central: misma primera acción y lecturas, distinto espacio y responsabilidad (quién queda libre si ayudan).
    const horns = playbookCard("horns_bloqueo");
    const base = playbookCard("bloqueo_directo_central");
    expect(horns.firstAction).toBe(base.firstAction);
    expect(horns.placement).not.toBe(base.placement);
    expect(horns.structure.O3).not.toBe(base.structure.O3);
    expect(horns.reads).not.toContain("lectura_ice");
    expect(cardFor("bloqueo_directo", "horns").id).toBe("horns_bloqueo");
    // Horns→Spain (LAB-0.9): misma colocación y primera acción; otra variante, otro orden y otras lecturas.
    const spain = playbookCard("horns_spain");
    expect(cardFor("bloqueo_directo", "horns", "spain").id).toBe("horns_spain");
    expect(spain.placement).toBe(horns.placement);
    expect(spain.chainedVariant).toBe("spain");
    expect(horns.chainedVariant).toBeNull();
    expect(spain.structure.O3).not.toBe(horns.structure.O3);
    expect(spain.reads).toContain("lectura_spain");
    expect(horns.reads).not.toContain("lectura_spain");
    // Dos fichas con la misma primera acción difieren en espacio (colocación) y lectura (ICE).
    const central = playbookCard("bloqueo_directo_central");
    const lateral = playbookCard("bloqueo_directo_lateral");
    expect(central.firstAction).toBe(lateral.firstAction);
    expect(central.placement).not.toBe(lateral.placement);
    expect(lateral.reads).toContain("lectura_ice");
    expect(central.reads).not.toContain("lectura_ice");
    expect(cardFor("mano_a_mano_sin_balon", "central").id).toBe("mano_a_mano_central");
    expect(() => cardFor("mano_a_mano_sin_balon", "lateral")).toThrow();
  });

  it("las colocaciones que se ofrecen al organizar salen de las fichas compatibles con el plan y la orden", () => {
    expect(eligiblePlacements("auto", "auto")).toEqual(["central", "lateral", "horns"]);
    expect(eligiblePlacements("bloqueo_directo", "auto")).toEqual(["central", "lateral", "horns"]);
    expect(eligiblePlacements("auto", "horns")).toEqual(["horns"]);
    expect(eligiblePlacements("mano_a_mano_sin_balon", "auto")).toEqual(["central"]);
    expect(eligiblePlacements("bloqueo_directo", "lateral")).toEqual(["lateral"]);
    expect(eligiblePlacements("auto", "central")).toEqual(["central"]);
    // Sin ficha compatible (mano a mano obligada con colocación lateral): la central.
    expect(eligiblePlacements("mano_a_mano_sin_balon", "lateral")).toEqual(["central"]);
  });

  it("en partidos completos cada lectura pertenece a la ficha en vigor de su fase", () => {
    const seen = new Set<PlaybookCardId>();
    for (const r of [play(92, { coverage: "auto", screenPlacement: "auto" }, "auto"), play(92, { coverage: "auto", screenPlacement: "lateral" }, "ice"), play(93, { coverage: "auto", screenPlacement: "auto" }, "auto"), play(92, { coverage: "auto", screenPlacement: "horns" }, "auto")]) {
      const decisions = r.audit!.decisions;
      const cardOfPhase = new Map<string, PlaybookCardId>();
      for (const d of decisions.filter((x) => x.point === "seleccion_familia")) {
        const chosen = d.options.find((o) => o.id === d.chosenOptionId)!;
        cardOfPhase.set(`${d.possessionIndex}:${d.phaseIndex}`, chosen.values!.cardId as PlaybookCardId);
      }
      let checked = 0;
      for (const d of decisions.filter((x) => READ_POINTS.has(x.point))) {
        const card = cardOfPhase.get(`${d.possessionIndex}:${d.phaseIndex}`);
        if (!card) continue; // lecturas fuera de una acción organizada (p. ej. segunda entrada en su propia fase)
        seen.add(card);
        expect(playbookCard(card).reads, `${d.point} en ${card}`).toContain(d.point);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(100);
      expect(r.stop.cause).toBe("final");
    }
    // Con la colocación Horns y la variante en `auto`, la ficha Spain también se juega (LAB-0.9).
    expect(seen).toEqual(new Set(["bloqueo_directo_central", "mano_a_mano_central", "bloqueo_directo_lateral", "horns_bloqueo", "horns_spain"]));
  });
});
