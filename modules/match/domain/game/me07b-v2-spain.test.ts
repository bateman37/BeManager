import { describe, expect, it, vi } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput, type GameInput, type GameResult } from "./game-model";
import { buildAuditExport } from "../audit/build-audit-export";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { PlayerProfile } from "../players/player-profile";
import { distance } from "../geometry/point";
import { playbookCard } from "../tactics/playbook-card";
import { SPAIN_POP_SPOT, SPAIN_ROLL_SPOT } from "../lab/lab-0-9-parameters";
import type { BackScreenCallChoice, ChainedVariantChoice, DefensiveCoverageChoice } from "../lab/match-input";
import type { ScreenPlacementChoice } from "../lab/lab-0-7-parameters";

// Partidos completos repetidos con auditoría: más margen que el límite por defecto.
vi.setConfig({ testTimeout: 120_000 });

/**
 * ME-07B v2 §4, «Libro por fase: Organizado: Horns→Spain» (LAB-0.9). La ficha
 * `horns_spain` es jugable si un partido completo puede ejecutarla, negarla y
 * continuar con reloj, balón y participantes coherentes (§0.4):
 *
 * 1. Ejecución: desde la colocación Horns, el segundo cuerno pone un bloqueo
 *    ciego real a D5 (a contacto, en su retroceso), el manejador espera a que
 *    esté puesto, el bloqueador rueda profundo y el bloqueador ciego se abre
 *    al pop; cadena ficha → variante → lectura del bloqueador → respuesta
 *    defensiva → lectura del manejador → tiro en ME-07B-AUDIT-1.
 * 2. Discriminante (§7.1): misma defensa (drop) ante Horns→bloqueo y
 *    Horns→Spain → otra primera decisión y otra responsabilidad de ayuda.
 * 3. Contrafactual: misma ficha Spain ante «seguir» y «cambiar» en el bloqueo
 *    ciego → concesiones y tiros distintos; el cambio persiste.
 * 4. Negación: ante cambio o trampa no hay a quién bloquear (D5 está arriba):
 *    el bloqueador se queda en el codo y se juega el árbol de Horns; un D3 que
 *    reconoce tarde no puede cambiar.
 */
const SC = SIERRA_CLARA.id;

interface Cfg {
  readonly placement?: ScreenPlacementChoice;
  readonly variant?: ChainedVariantChoice;
  readonly coverage: DefensiveCoverageChoice;
  readonly backScreen?: BackScreenCallChoice;
  readonly away?: readonly PlayerProfile[];
}

function input(seed: number, cfg: Cfg): GameInput {
  const common = { priority: "proteger_balance" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const };
  return buildGameInput({
    seed,
    auditEnabled: true,
    home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...common, coverage: "auto", screenPlacement: cfg.placement ?? "horns", chainedVariant: cfg.variant ?? "spain" },
    away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: cfg.away ?? PUERTO_AMBAR.players, ...common, coverage: cfg.coverage, screenPlacement: "auto", backScreenCall: cfg.backScreen ?? "auto" },
  });
}

const cache = new Map<string, { gi: GameInput; r: GameResult }>();
function play(seed: number, cfg: Cfg) {
  const key = `${seed}:${JSON.stringify({ ...cfg, away: cfg.away ? "custom" : null })}`;
  if (!cache.has(key)) {
    const gi = input(seed, cfg);
    cache.set(key, { gi, r: playFullGame(gi) });
  }
  return cache.get(key)!;
}

function sierra(r: GameResult, point: string) {
  const team = new Map(r.possessions.map((p) => [p.index, p.teamId]));
  return r.audit!.decisions.filter((d) => d.point === point && d.possessionIndex !== null && team.get(d.possessionIndex) === SC);
}

function counts(values: readonly (string | null | undefined)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v ?? "null"] = (out[v ?? "null"] ?? 0) + 1;
  return out;
}

function sierraShots(g: { gi: GameInput; r: GameResult }) {
  return buildAuditExport(g.gi, g.r, { exportedAt: "test" }).result.summary.shots!.filter((s) => s.teamId === SC && s.category === "familia");
}

function assertFinalAndReconciled(g: { gi: GameInput; r: GameResult }): void {
  expect(g.r.stop.cause).toBe("final");
  expect(buildAuditExport(g.gi, g.r, { exportedAt: "test" }).result.reconciliation.filter((c) => !c.ok)).toEqual([]);
}

describe("ME-07B v2 §4: ficha Horns→Spain — ejecución y cadena auditada", () => {
  const g = play(92, { coverage: "drop" });

  it("la variante se pide por orden y la ficha en vigor es horns_spain; el bloqueador ciego encuentra a quién bloquear", () => {
    const variants = sierra(g.r, "seleccion_variante");
    expect(variants.length).toBeGreaterThan(80);
    for (const d of variants) {
      expect(d.chosenOptionId).toBe("horns_spain");
      expect(d.options.find((o) => o.id === "horns_spain")!.reasonCode).toBe("variant_forced_by_plan");
    }
    const placed = new Set(variants.map((d) => `${d.possessionIndex}:${d.phaseIndex}`));
    const fams = sierra(g.r, "seleccion_familia").filter((d) => placed.has(`${d.possessionIndex}:${d.phaseIndex}`));
    expect(fams.length).toBe(variants.length);
    for (const d of fams) expect(d.options.find((o) => o.id === "bloqueo_directo")!.values!.cardId).toBe("horns_spain");
    const reads = sierra(g.r, "lectura_spain_bloqueador");
    expect(reads.length).toBe(variants.length);
    for (const d of reads) {
      expect(d.chosenOptionId).toBe("bloqueo_ciego");
      expect(d.options[0]!.reasonCode).toBe("back_screen_target_present");
    }
  });

  it("el bloqueo ciego es físico: el bloqueador llega a contacto de D5 en su retroceso, el manejador espera, el roll es profundo y el pop sale detrás del arco", () => {
    const team = new Map(g.r.possessions.map((p) => [p.index, p.teamId]));
    const sets = g.r.events.filter((e) => e.kind === "back_screen_set" && e.possessionIndex !== null && team.get(e.possessionIndex) === SC);
    expect(sets.length).toBeGreaterThan(80);
    for (const e of sets) {
      const [screener, screened] = e.actors as [string, string];
      const at = (id: string) => e.positions.find((p) => p.playerId === id)!.position;
      expect(distance(at(screener), at(screened))).toBeCloseTo(0.7, 1);
      expect(e.detail.handlerWaitSeconds as number).toBeGreaterThanOrEqual(0);
      expect(e.detail.backScreenDelay as number).toBeGreaterThan(0);
    }
    // Roll profundo y pop: misma distancia relativa (no depende del sentido de ataque).
    const rolls = g.r.events.filter((e) => e.kind === "roll_continuation" && e.detail.deep === true && team.get(e.possessionIndex!) === SC);
    const pops = g.r.events.filter((e) => e.kind === "back_screen_pop" && team.get(e.possessionIndex!) === SC);
    expect(rolls.length).toBeGreaterThan(60);
    expect(pops.length).toBeGreaterThan(60);
    let paired = 0;
    for (const pop of pops) {
      const roll = rolls.find((x) => x.possessionIndex === pop.possessionIndex && x.phaseIndex === pop.phaseIndex);
      if (!roll) continue;
      paired += 1;
      // Puntos de destino (en coordenadas globales) y salida: el roll arranca antes de que O3 suelte el bloqueo.
      expect(distance(roll.detail.rollSpot as never, pop.detail.popSpot as never)).toBeCloseTo(distance(SPAIN_ROLL_SPOT, SPAIN_POP_SPOT), 6);
      expect(roll.atMs).toBeLessThanOrEqual(pop.atMs);
    }
    expect(paired).toBeGreaterThan(60);
  });

  it("cada tiro de la ficha apunta a horns_spain, a una lectura de su ficha y al tirador real; el partido termina conciliado", () => {
    const reads = new Set(playbookCard("horns_spain").reads);
    const shots = sierraShots(g);
    expect(shots.length).toBeGreaterThan(60);
    for (const s of shots) {
      expect(s.cardId).toBe("horns_spain");
      expect(s.causingDecision).not.toBeNull();
      expect(reads.has(s.causingDecision!.point as never)).toBe(true);
      expect(s.causingDecision!.atMs).toBeLessThanOrEqual(s.atMs);
    }
    expect(counts(shots.map((s) => s.causingDecision!.point)).lectura_spain!).toBeGreaterThan(20);
    assertFinalAndReconciled(g);
  });

  it("en auto la variante compite con la ficha base por proyección frente a la defensa observada", () => {
    const auto = play(92, { variant: "auto", coverage: "drop" });
    const variants = sierra(auto.r, "seleccion_variante");
    expect(variants.length).toBeGreaterThan(80);
    for (const d of variants) {
      for (const o of d.options) expect(typeof o.values!.expectedValueOverShownCoverages).toBe("number");
      expect(["variant_projected_value_higher", "variant_projected_value_lower"]).toContain(d.options[0]!.reasonCode);
    }
    const chosen = counts(variants.map((d) => d.chosenOptionId));
    expect(chosen.horns_spain!).toBeGreaterThan(10);
    expect(chosen.horns_bloqueo!).toBeGreaterThan(5);
    assertFinalAndReconciled(auto);
  });
});

describe("ME-07B v2 §4: misma defensa (drop) ante Horns→bloqueo y Horns→Spain → otra primera decisión y otra ayuda", () => {
  const base = play(92, { variant: "ninguna", coverage: "drop" });
  const spain = play(92, { coverage: "drop" });

  it("cambia la primera decisión del manejador y quién remata", () => {
    const baseFirst = counts(sierra(base.r, "lectura_bloqueo_o1").map((d) => d.chosenOptionId));
    const spainFirst = counts(sierra(spain.r, "lectura_spain").map((d) => d.chosenOptionId));
    // Horns→bloqueo ante drop: casi siempre al continuador, que queda en la línea de retroceso de D5.
    expect(baseFirst.pase_o5!).toBeGreaterThan(80);
    expect(baseFirst.finalizar ?? 0).toBeLessThan(5);
    // Spain: con D5 retenido el manejador ataca el aro él mismo o encuentra el roll profundo o el pop.
    expect(spainFirst.finalizar!).toBeGreaterThan(20);
    expect(spainFirst.pase_o5!).toBeGreaterThan(20);
    expect(sierra(spain.r, "lectura_bloqueo_o1")).toHaveLength(0);
    // Horns→bloqueo remata sobre todo tras la segunda entrada (continuador contenido); Spain no la necesita.
    const after = (g: { gi: GameInput; r: GameResult }) => counts(sierraShots(g).map((s) => s.causingDecision!.point));
    expect(after(base).segunda_entrada!).toBeGreaterThan(40);
    expect(after(spain).segunda_entrada ?? 0).toBeLessThan(10);
  });

  it("cambia la responsabilidad de ayuda: el defensor del segundo cuerno desde el codo (deja tiro medio) frente al defensor del bloqueador ciego desde la pintura (deja el pop) o D5 si cambian", () => {
    const left = (r: GameResult) => {
      const team = new Map(r.possessions.map((p) => [p.index, p.teamId]));
      return r.events.filter((e) => e.kind === "help_left_assignment" && e.possessionIndex !== null && team.get(e.possessionIndex) === SC);
    };
    for (const e of left(base.r)) expect(e.text).toContain("en el codo");
    expect(left(spain.r).length).toBeGreaterThan(10);
    for (const e of left(spain.r)) expect(e.text).toContain("en el pop");
    const responses = counts(sierra(spain.r, "respuesta_bloqueo_ciego").map((d) => d.chosenOptionId));
    // En auto la defensa usa más de una respuesta, cada una por su concesión proyectada.
    expect(Object.keys(responses).length).toBeGreaterThan(1);
    for (const d of sierra(spain.r, "respuesta_bloqueo_ciego")) {
      for (const o of d.options) expect(typeof o.values!.concessionValue).toBe("number");
    }
  });
});

describe("ME-07B v2 §4: misma ficha Spain ante «seguir» y «cambiar» el bloqueo ciego → concesiones distintas", () => {
  const seguir = play(92, { coverage: "drop", backScreen: "seguir" });
  const cambiar = play(92, { coverage: "drop", backScreen: "cambiar" });

  it("seguir deja el pop (D3 lee entre roll y pop); cambiar lo cierra con D5 y concede el aro al manejador", () => {
    const rs = counts(sierra(seguir.r, "respuesta_bloqueo_ciego").map((d) => d.chosenOptionId));
    const rc = counts(sierra(cambiar.r, "respuesta_bloqueo_ciego").map((d) => d.chosenOptionId));
    expect(rs.cambiar ?? 0).toBe(0);
    expect((rs.seguir ?? 0) + (rs.ayudar ?? 0)).toBeGreaterThan(80);
    expect(rc.cambiar!).toBeGreaterThan(80);
    const fs = counts(sierra(seguir.r, "lectura_spain").map((d) => d.chosenOptionId));
    const fc = counts(sierra(cambiar.r, "lectura_spain").map((d) => d.chosenOptionId));
    expect(fs.pase_pop_o3!).toBeGreaterThan(20);
    expect(fc.pase_pop_o3 ?? 0).toBeLessThan(10);
    expect(fc.finalizar!).toBeGreaterThan(fs.finalizar!);
    const threes = (g: { gi: GameInput; r: GameResult }) => sierraShots(g).filter((s) => s.shotType === "three_point").length;
    expect(threes(seguir)).toBeGreaterThan(threes(cambiar) + 15);
    for (const g of [seguir, cambiar]) assertFinalAndReconciled(g);
  });

  it("el cambio en el bloqueo ciego se canta (hecho propio) y el emparejamiento cambiado persiste en la posesión", () => {
    const team = new Map(cambiar.r.possessions.map((p) => [p.index, p.teamId]));
    const switches = cambiar.r.events.filter((e) => e.kind === "back_screen_switch" && team.get(e.possessionIndex!) === SC);
    expect(switches.length).toBeGreaterThan(80);
    expect(seguir.r.events.some((e) => e.kind === "back_screen_switch")).toBe(false);
  });
});

describe("ME-07B v2 §4: negación de Spain y continuidad", () => {
  it("ante cambio o trampa no hay a quién bloquear: el bloqueador se queda en el codo y se juega el árbol de Horns con la ficha Spain", () => {
    for (const coverage of ["cambio", "trampa"] as const) {
      const g = play(92, { coverage });
      const reads = sierra(g.r, "lectura_spain_bloqueador");
      expect(reads.length).toBeGreaterThan(80);
      for (const d of reads) {
        expect(d.chosenOptionId).toBe("quedarse_en_codo");
        expect(d.options.find((o) => o.id === "bloqueo_ciego")!.reasonCode).toBe("back_screen_target_absent");
      }
      const team = new Map(g.r.possessions.map((p) => [p.index, p.teamId]));
      expect(g.r.events.some((e) => e.kind === "back_screen_set" && team.get(e.possessionIndex!) === SC)).toBe(false);
      expect(sierra(g.r, coverage === "cambio" ? "lectura_cambio" : "lectura_trampa").length).toBeGreaterThan(50);
      for (const s of sierraShots(g)) expect(s.cardId).toBe("horns_spain");
      assertFinalAndReconciled(g);
    }
  });

  it("el cambio se ejecuta peor con defensores lentos (F04): el que toma al continuador llega más tarde y el manejador encuentra más el roll", () => {
    // La sincronización del manejador con el bloqueo ciego da tiempo a cantar el cambio
    // (reconocer M01/M05 + aviso M09 ≤ 0,52 s frente a ≥ 0,65 s del corte): con el fixture
    // la puerta de «cambio tardío» no llega a cerrarse; lo que cambia con la capacidad es la llegada.
    const slow = PUERTO_AMBAR.players.map((p) => ({ ...p, attributes: { ...p.attributes, F04: 1 } })) as PlayerProfile[];
    const normal = play(92, { coverage: "drop", backScreen: "cambiar" });
    const late = play(92, { coverage: "drop", backScreen: "cambiar", away: slow });
    for (const d of sierra(late.r, "respuesta_bloqueo_ciego")) {
      expect(d.chosenOptionId).toBe("cambiar");
      expect(d.options.find((o) => o.id === "cambiar")!.values!.switchCallSeconds as number).toBeLessThanOrEqual(d.options.find((o) => o.id === "cambiar")!.values!.rollStartSeconds as number);
    }
    const toRoll = (g: { r: GameResult }) => sierra(g.r, "lectura_spain").filter((d) => d.chosenOptionId === "pase_o5").length / sierra(g.r, "lectura_spain").length;
    expect(toRoll(late)).toBeGreaterThan(toRoll(normal));
    assertFinalAndReconciled(late);
  });
});
