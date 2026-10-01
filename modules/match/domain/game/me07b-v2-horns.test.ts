import { describe, expect, it, vi } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput, type GameInput, type GameResult } from "./game-model";
import { buildAuditExport } from "../audit/build-audit-export";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { distance } from "../geometry/point";
import { HORNS_PNR_TARGETS } from "../lab/lab-0-8-parameters";
import { playbookCard } from "../tactics/playbook-card";
import type { DefensiveCoverageChoice } from "../lab/match-input";
import type { ScreenPlacementChoice } from "../lab/lab-0-7-parameters";

// Partidos completos repetidos con auditoría: más margen que el límite por defecto.
vi.setConfig({ testTimeout: 120_000 });

/**
 * ME-07B v2 §4, «Libro por fase: Organizado: Horns→bloqueo» (LAB-0.8). La
 * ficha `horns_bloqueo` es jugable si un partido completo puede ejecutarla,
 * negarla y continuar con reloj, balón y participantes coherentes (§0.4):
 *
 * 1. Ejecución: colocación Horns real de los cinco (dos interiores en los
 *    codos, esquinas llenas), entrada auditada (por orden del entrenador o
 *    por proyección en `auto`) y cadena causal ficha → entrada → lectura →
 *    tiro en ME-07B-AUDIT-1.
 * 2. Contrafactual (§7.2): la misma ficha ante drop, cambio y trampa produce
 *    tres primeras decisiones, receptores y tiros distintos.
 * 3. Responsabilidad propia frente a la central (misma cobertura): ayuda el
 *    defensor del segundo cuerno y queda libre un tiro medio en el codo, no un
 *    triple de esquina.
 * 4. Negación y continuidad: la ayuda contiene al continuador y la lectura
 *    del receptor reevalúa con alternativas y motivos; la trampa puede robar;
 *    el partido termina `final` con acta conciliada.
 */
const SC = SIERRA_CLARA.id;

function input(seed: number, placement: ScreenPlacementChoice, puertoCoverage: DefensiveCoverageChoice): GameInput {
  const common = { priority: "proteger_balance" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const };
  return buildGameInput({
    seed,
    auditEnabled: true,
    // Ficha base Horns→bloqueo: sin la variante Spain (LAB-0.9), que tiene su propia prueba (`me07b-v2-spain.test.ts`).
    home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...common, coverage: "auto", screenPlacement: placement, chainedVariant: "ninguna" },
    away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common, coverage: puertoCoverage, screenPlacement: "auto" },
  });
}

const cache = new Map<string, { gi: GameInput; r: GameResult }>();
function play(seed: number, placement: ScreenPlacementChoice, puertoCoverage: DefensiveCoverageChoice) {
  const key = `${seed}:${placement}:${puertoCoverage}`;
  if (!cache.has(key)) {
    const gi = input(seed, placement, puertoCoverage);
    cache.set(key, { gi, r: playFullGame(gi) });
  }
  return cache.get(key)!;
}

function sierraDecisions(r: GameResult, point: string) {
  const team = new Map(r.possessions.map((p) => [p.index, p.teamId]));
  return r.audit!.decisions.filter((d) => d.point === point && d.possessionIndex !== null && team.get(d.possessionIndex) === SC);
}

function counts(values: readonly (string | null)[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v ?? "null"] = (out[v ?? "null"] ?? 0) + 1;
  return out;
}

function assertFinalAndReconciled(gi: GameInput, r: GameResult): void {
  expect(r.stop.cause).toBe("final");
  const exp = buildAuditExport(gi, r, { exportedAt: "test" });
  expect(exp.result.reconciliation.filter((c) => !c.ok)).toEqual([]);
}

describe("ME-07B v2 §4: ficha Horns→bloqueo — ejecución y cadena auditada", () => {
  const { gi, r } = play(92, "horns", "drop");

  it("la entrada se pide por orden (colocación Horns) y la ficha en vigor es horns_bloqueo", () => {
    const placements = sierraDecisions(r, "colocacion_bloqueo");
    expect(placements.length).toBeGreaterThan(80);
    for (const d of placements) {
      expect(d.chosenOptionId).toBe("horns");
      expect(d.options.map((o) => o.id)).toEqual(["horns"]);
      expect(d.options[0]!.reasonCode).toBe("placement_forced_by_plan");
    }
    // Cada organización con colocación Horns elige la ficha horns_bloqueo (la segunda entrada, variante de
    // la ficha, se juega desde el nuevo ángulo sin nueva colocación).
    const placed = new Set(placements.map((d) => `${d.possessionIndex}:${d.phaseIndex}`));
    const fams = sierraDecisions(r, "seleccion_familia").filter((d) => placed.has(`${d.possessionIndex}:${d.phaseIndex}`));
    expect(fams.length).toBe(placements.length);
    for (const d of fams) {
      expect(d.chosenOptionId).toBe("bloqueo_directo");
      expect(d.options.find((o) => o.id === "bloqueo_directo")!.values!.cardId).toBe("horns_bloqueo");
      expect(d.options.find((o) => o.id === "mano_a_mano_sin_balon")!.reasonCode).toBe("family_not_in_card_placement");
    }
  });

  it("los cinco se colocan en Horns: los dos interiores en los codos y las dos esquinas llenas", () => {
    const declared = gi.teams[0].declaredRoles;
    const isInterior = (id: string) => (declared[id] ?? []).some((role) => role === 4 || role === 5);
    const entries = r.events.filter((e) => e.kind === "organized_entry" && e.possessionTeamId === SC);
    expect(entries.length).toBeGreaterThan(80);
    const t = HORNS_PNR_TARGETS;
    for (const e of entries) {
      expect(e.detail.placement).toBe("horns");
      expect(e.text).toContain("en Horns");
      const roles = e.detail.roles as Record<string, string>;
      // El bloqueador y el segundo cuerno son los dos interiores; el manejador no.
      expect(isInterior(roles.O5!)).toBe(true);
      expect(isInterior(roles.O3!)).toBe(true);
      const at = (slot: string) => e.positions.find((p) => p.playerId === roles[slot])!.position;
      // Distancias entre atacantes (no dependen del sentido de ataque): las de la disposición LAB-0.8.
      for (const [a, b] of [["O1", "O5"], ["O3", "O5"], ["O2", "O4"], ["O3", "O4"], ["O1", "O3"]] as const) {
        expect(distance(at(a), at(b))).toBeCloseTo(distance(t[a]!, t[b]!), 1);
      }
    }
  });

  it("cada tiro de la ficha apunta a horns_bloqueo, a su lectura causante y al tirador real", () => {
    const exp = buildAuditExport(gi, r, { exportedAt: "test" });
    const reads = new Set(playbookCard("horns_bloqueo").reads);
    const shots = exp.result.summary.shots!.filter((s) => s.teamId === SC && s.category === "familia");
    expect(shots.length).toBeGreaterThan(60);
    for (const s of shots) {
      expect(s.cardId).toBe("horns_bloqueo");
      expect(s.causingDecision).not.toBeNull();
      expect(reads.has(s.causingDecision!.point as never)).toBe(true);
      expect(s.causingDecision!.atMs).toBeLessThanOrEqual(s.atMs);
    }
    assertFinalAndReconciled(gi, r);
  });

  it("en auto la ficha compite por proyección con las demás colocaciones y se audita su valor", () => {
    const auto = play(92, "auto", "auto").r;
    const placements = sierraDecisions(auto, "colocacion_bloqueo");
    expect(placements.length).toBeGreaterThan(80);
    for (const d of placements) {
      const horns = d.options.find((o) => o.id === "horns")!;
      expect(typeof horns.values!.projectedValue).toBe("number");
      expect(["placement_projected_value_higher", "placement_projected_value_lower", "creator_ready_later_in_band"]).toContain(horns.reasonCode);
    }
  });
});

describe("ME-07B v2 §7.2: misma ficha Horns ante drop, cambio y trampa → tres desenlaces físicos distintos", () => {
  const drop = play(92, "horns", "drop");
  const cambio = play(92, "horns", "cambio");
  const trampa = play(92, "horns", "trampa");

  it("cambia la primera decisión, quién recibe y qué tiro se concede", () => {
    // Drop: O1 lee la pantalla y casi siempre encuentra al continuador; O5 remata.
    const dropFirst = counts(sierraDecisions(drop.r, "lectura_bloqueo_o1").map((d) => d.chosenOptionId));
    expect(dropFirst.pase_o5!).toBeGreaterThan(80);
    expect(sierraDecisions(drop.r, "lectura_cambio")).toHaveLength(0);
    expect(sierraDecisions(drop.r, "lectura_trampa")).toHaveLength(0);
    // Cambio: O1 lee frente al pívot que le ha tomado y lo ataca él mismo una parte de las veces.
    const switchFirst = counts(sierraDecisions(cambio.r, "lectura_cambio").map((d) => d.chosenOptionId));
    expect(switchFirst.atacar_cambio!).toBeGreaterThan(20);
    expect(sierraDecisions(cambio.r, "lectura_bloqueo_o1")).toHaveLength(0);
    // Trampa: dos sobre el balón; el pase sale al continuador y de él al jugador que deja la rotación.
    const trapReads = counts(sierraDecisions(trampa.r, "lectura_trampa").map((d) => d.chosenOptionId));
    expect(trapReads.trap_broken_o4!).toBeGreaterThan(30);
    expect(trapReads.invertir_o3!).toBeGreaterThan(5);
    expect(trapReads.perdida_bajo_presion!).toBeGreaterThan(0);

    const profile = (g: { gi: GameInput; r: GameResult }) =>
      counts(buildAuditExport(g.gi, g.r, { exportedAt: "test" }).result.summary.shots!.filter((s) => s.teamId === SC && s.cardId === "horns_bloqueo").map((s) => s.shotType));
    const pd = profile(drop);
    const pc = profile(cambio);
    const pt = profile(trampa);
    // Drop y cambio conceden sobre todo finalizaciones; la trampa no concede ni una: triples de esquina y tiros medios del codo.
    expect(pd.close_finish!).toBeGreaterThan(60);
    expect(pc.close_finish!).toBeGreaterThan(60);
    expect(pt.close_finish ?? 0).toBe(0);
    expect(pt.three_point!).toBeGreaterThan(30);
    expect(pt.mid_range!).toBeGreaterThan(5);
    // Cambio: el manejador remata contra el pívot; en drop remata sobre todo el continuador.
    const handlerShare = (g: { r: GameResult }, point: string, option: string) => sierraDecisions(g.r, point).filter((d) => d.chosenOptionId === option).length;
    expect(handlerShare(cambio, "lectura_cambio", "atacar_cambio")).toBeGreaterThan(handlerShare(drop, "lectura_bloqueo_o1", "finalizar"));
    for (const g of [drop, cambio, trampa]) assertFinalAndReconciled(g.gi, g.r);
  });
});

describe("ME-07B v2 §4: Horns no es la central con otro nombre (misma cobertura, otra responsabilidad)", () => {
  it("ante la trampa queda libre el segundo cuerno en el codo (tiro medio); en la central nunca se invierte", () => {
    const horns = play(92, "horns", "trampa");
    const central = play(92, "central", "trampa");
    const invert = (r: GameResult) => sierraDecisions(r, "lectura_trampa").filter((d) => d.chosenOptionId === "invertir_o3");
    expect(invert(horns.r).length).toBeGreaterThan(5);
    expect(invert(central.r)).toHaveLength(0);
    // El tiro tras la inversión de Horns es un tiro medio del interior del codo.
    const exp = buildAuditExport(horns.gi, horns.r, { exportedAt: "test" });
    const afterInvert = exp.result.summary.shots!.filter((s) => s.teamId === SC && s.causingDecision?.point === "lectura_trampa" && s.causingDecision.chosenOptionId === "invertir_o3");
    expect(afterInvert.length).toBeGreaterThan(5);
    for (const s of afterInvert) expect(s.shotType).toBe("mid_range");
    const left = horns.r.events.filter((e) => e.kind === "help_left_assignment" && e.possessionTeamId === SC);
    expect(left.length).toBeGreaterThan(30);
    for (const e of left) expect(e.text).toContain("en el codo");
    for (const e of central.r.events.filter((x) => x.kind === "help_left_assignment" && x.possessionTeamId === SC)) expect(e.text).toContain("en la esquina débil");
  });

  it("ante drop, el receptor del roll ya no invierte a un triple de esquina sino que valora un tiro medio del codo", () => {
    const horns = play(93, "horns", "drop");
    const central = play(93, "central", "drop");
    const invertShot = (r: GameResult) => sierraDecisions(r, "lectura_segunda_o5").map((d) => d.options.find((o) => o.id === "invertir_o3")!.values!.shotType);
    expect(new Set(invertShot(horns.r))).toEqual(new Set(["mid_range"]));
    expect(new Set(invertShot(central.r))).toEqual(new Set(["three_point"]));
    const chosen = (r: GameResult) => counts(sierraDecisions(r, "lectura_segunda_o5").map((d) => d.chosenOptionId));
    // La central invierte a la esquina a menudo; Horns casi nunca (el tiro medio del codo vale menos que el aro).
    expect(chosen(central.r).invertir_o3!).toBeGreaterThan(10);
    expect(chosen(horns.r).invertir_o3 ?? 0).toBeLessThan(chosen(central.r).invertir_o3!);
  });
});

describe("ME-07B v2 §4: negación de Horns y continuidad del partido", () => {
  it("la ayuda del segundo cuerno contiene al continuador; el receptor reevalúa con alternativas y motivos y el partido sigue", () => {
    const { gi, r } = play(91, "horns", "drop");
    const helps = r.events.filter((e) => e.kind === "help_decision" && e.possessionTeamId === SC && e.detail.helps === true);
    expect(helps.length).toBeGreaterThan(30);
    // Contención real: el receptor del roll queda contenido y se evalúa la segunda entrada con su motivo.
    const contained = sierraDecisions(r, "lectura_segunda_o5").filter((d) => d.options.some((o) => o.id === "segunda_entrada" && o.status === "descartada_por_condicion"));
    expect(contained.length).toBeGreaterThan(20);
    const kickOuts = sierraDecisions(r, "segunda_entrada");
    expect(kickOuts.length).toBeGreaterThan(20);
    for (const d of kickOuts) for (const o of d.options) expect(o.reasonNote ?? "").not.toBe("");
    // Ninguna ayuda choca en carrera con el continuador (sin faltas de contención por llegar al mismo punto).
    expect(r.events.filter((e) => e.kind === "non_shooting_foul" && e.possessionTeamId === SC && e.detail.legality === "contacto_ilegal").length).toBeLessThan(3);
    assertFinalAndReconciled(gi, r);
  });

  it("la trampa puede robar el balón: la posesión cambia de equipo y el partido continúa", () => {
    const { gi, r } = play(92, "horns", "trampa");
    const steals = sierraDecisions(r, "lectura_trampa").filter((d) => d.chosenOptionId === "perdida_bajo_presion");
    expect(steals.length).toBeGreaterThan(0);
    for (const d of steals) {
      const poss = r.possessions.find((p) => p.index === d.possessionIndex)!;
      expect(poss.teamId).toBe(SC);
      const next = r.possessions.find((p) => p.index === d.possessionIndex! + 1)!;
      expect(next.teamId).toBe(PUERTO_AMBAR.id);
    }
    assertFinalAndReconciled(gi, r);
  });
});
