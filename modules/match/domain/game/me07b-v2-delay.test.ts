import { describe, expect, it, vi } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput, type GameInput, type GameResult } from "./game-model";
import { buildAuditExport } from "../audit/build-audit-export";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { PlayerProfile } from "../players/player-profile";
import { distance } from "../geometry/point";
import { playbookCard } from "../tactics/playbook-card";
import { DELAY_TARGETS } from "../lab/lab-0-10-parameters";
import type { DefensiveCoverageChoice } from "../lab/match-input";
import type { ScreenPlacementChoice } from "../lab/lab-0-7-parameters";

// Partidos completos repetidos con auditoría: más margen que el límite por defecto.
vi.setConfig({ testTimeout: 120_000 });

/**
 * ME-07B v2 §4, «Libro por fase: Organizado: Delay→DHO/corte y entrada a poste
 * con salidas» (LAB-0.10). La ficha `delay_mano_a_mano` es jugable si un
 * partido completo puede ejecutarla, negarla y continuar (§0.4):
 *
 * 1. Ejecución: colocación Delay real (pívot arriba, poste bajo, esquina
 *    fuerte, ala débil), pase de entrada, entrega en mano con el cuerpo del
 *    pívot como pantalla y cadena ficha → entrega → lectura → tiro auditada.
 * 2. Discriminante: no es un bloqueo directo con otro nombre (no hay pantalla
 *    ni lectura del bloqueo; decide quien recibe la entrega, el pívot o el poste).
 * 3. Contrafactual: misma ficha ante «hundirse», «cambiar» y «saltar la
 *    entrega» → primera decisión, decisor y tiro distintos (la entrega negada
 *    da la puerta de atrás y el alto-bajo).
 * 4. Salidas del poste: la ayuda («dig») de la esquina solo llega a tiempo con
 *    un defensor rápido; entonces el poste sale a la esquina; si el tirador de
 *    la esquina es malo, la ayuda no le deja nada.
 */
const SC = SIERRA_CLARA.id;

interface Cfg {
  readonly placement?: ScreenPlacementChoice;
  readonly coverage: DefensiveCoverageChoice;
  readonly home?: readonly PlayerProfile[];
  readonly away?: readonly PlayerProfile[];
  readonly tag?: string;
}

function input(seed: number, cfg: Cfg): GameInput {
  const common = { priority: "proteger_balance" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const };
  return buildGameInput({
    seed,
    auditEnabled: true,
    home: { id: SC, name: SIERRA_CLARA.name, players: cfg.home ?? SIERRA_CLARA.players, ...common, coverage: "auto", screenPlacement: cfg.placement ?? "delay" },
    away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: cfg.away ?? PUERTO_AMBAR.players, ...common, coverage: cfg.coverage, screenPlacement: "auto" },
  });
}

const cache = new Map<string, { gi: GameInput; r: GameResult }>();
function play(seed: number, cfg: Cfg) {
  const key = `${seed}:${cfg.placement ?? "delay"}:${cfg.coverage}:${cfg.tag ?? ""}`;
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

function sierraEvents(r: GameResult, kind: string) {
  const team = new Map(r.possessions.map((p) => [p.index, p.teamId]));
  return r.events.filter((e) => e.kind === kind && e.possessionIndex !== null && team.get(e.possessionIndex) === SC);
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

const fastHelp = (players: readonly PlayerProfile[]) => players.map((p) => ({ ...p, attributes: { ...p.attributes, F04: 15, M01: 15, M05: 15 } })) as PlayerProfile[];
const noShooters = (players: readonly PlayerProfile[]) => players.map((p) => ({ ...p, attributes: { ...p.attributes, T04: 1 } })) as PlayerProfile[];

describe("ME-07B v2 §4: ficha Delay→DHO con poste — ejecución y cadena auditada", () => {
  const g = play(92, { coverage: "drop" });

  it("la colocación se pide por orden y la ficha en vigor es delay_mano_a_mano (familia de la entrega en mano)", () => {
    const placements = sierra(g.r, "colocacion_bloqueo");
    expect(placements.length).toBeGreaterThan(80);
    for (const d of placements) expect(d.chosenOptionId).toBe("delay");
    const placed = new Set(placements.map((d) => `${d.possessionIndex}:${d.phaseIndex}`));
    const fams = sierra(g.r, "seleccion_familia").filter((d) => placed.has(`${d.possessionIndex}:${d.phaseIndex}`));
    // Una organización puede acabar por reloj antes de la acción (sin selección de familia).
    expect(fams.length).toBeLessThanOrEqual(placements.length);
    expect(fams.length).toBeGreaterThan(placements.length - 5);
    for (const d of fams) {
      expect(d.chosenOptionId).toBe("mano_a_mano_sin_balon");
      expect(d.options.find((o) => o.id === "mano_a_mano_sin_balon")!.values!.cardId).toBe("delay_mano_a_mano");
      expect(d.options.find((o) => o.id === "bloqueo_directo")!.reasonCode).toBe("family_not_in_card_placement");
    }
  });

  it("los cinco se colocan en Delay (pívot arriba, poste bajo, esquina fuerte, ala débil) y el pívot de arriba y el poste son los dos interiores", () => {
    const declared = g.gi.teams[0].declaredRoles;
    const isInterior = (id: string) => (declared[id] ?? []).some((role) => role === 4 || role === 5);
    const entries = sierraEvents(g.r, "organized_entry");
    expect(entries.length).toBeGreaterThan(80);
    for (const e of entries) {
      expect(e.detail.placement).toBe("delay");
      expect(e.text).toContain("en Delay");
      const roles = e.detail.roles as Record<string, string>;
      expect(isInterior(roles.O5!)).toBe(true);
      expect(isInterior(roles.O4!)).toBe(true);
      const at = (slot: string) => e.positions.find((p) => p.playerId === roles[slot])!.position;
      for (const [a, b] of [["O1", "O5"], ["O4", "O5"], ["O2", "O4"], ["O3", "O5"], ["O1", "O4"]] as const) {
        expect(distance(at(a), at(b))).toBeCloseTo(distance(DELAY_TARGETS[a]!, DELAY_TARGETS[b]!), 1);
      }
    }
  });

  it("la entrega en mano es real (el cuerpo del pívot retrasa a D1) y cada tiro apunta a la ficha, a una lectura suya y al tirador real", () => {
    const handoffs = sierra(g.r, "entrega_delay");
    expect(handoffs.length).toBeGreaterThan(80);
    const done = handoffs.filter((d) => d.chosenOptionId === "entrega_completada");
    expect(done.length).toBeGreaterThan(70);
    for (const d of done) {
      const v = d.options[0]!.values!;
      expect(v.handoffScreenDelay as number).toBeGreaterThan(0);
      expect(v.d1BackSeconds as number).toBeGreaterThan(v.handoffReadySeconds as number);
    }
    expect(sierraEvents(g.r, "dho_completed").length).toBe(done.length);
    const reads = new Set(playbookCard("delay_mano_a_mano").reads);
    const shots = sierraShots(g);
    expect(shots.length).toBeGreaterThan(60);
    for (const s of shots) {
      expect(s.cardId).toBe("delay_mano_a_mano");
      expect(s.causingDecision).not.toBeNull();
      expect(reads.has(s.causingDecision!.point as never)).toBe(true);
      expect(s.causingDecision!.atMs).toBeLessThanOrEqual(s.atMs);
    }
    // Se tira tras la entrega y desde el poste (incluido el corte del ala débil).
    const by = counts(shots.map((s) => s.causingDecision!.point));
    expect(by.lectura_delay!).toBeGreaterThan(10);
    expect(by.lectura_poste!).toBeGreaterThan(10);
    assertFinalAndReconciled(g);
  });

  it("no es un bloqueo directo con otro nombre: no hay pantalla ni lectura del bloqueo, y decide quien recibe la entrega o el poste", () => {
    const horns = play(92, { placement: "horns", coverage: "drop" });
    expect(sierra(g.r, "lectura_bloqueo_o1")).toHaveLength(0);
    expect(sierraEvents(g.r, "screen_set")).toHaveLength(0);
    expect(sierra(horns.r, "lectura_bloqueo_o1").length + sierra(horns.r, "lectura_spain").length).toBeGreaterThan(80);
    expect(sierra(horns.r, "lectura_poste")).toHaveLength(0);
    const holders = counts(sierra(g.r, "lectura_poste").map((d) => d.holderId));
    // El poste que decide es el interior del poste bajo (un jugador real), no el manejador.
    for (const id of Object.keys(holders)) expect(id).not.toBe(sierra(g.r, "lectura_delay")[0]!.holderId);
  });
});

describe("ME-07B v2 §4: misma ficha Delay ante hundirse, cambiar y saltar la entrega → tres desenlaces distintos", () => {
  const drop = play(92, { coverage: "drop" });
  const cambio = play(92, { coverage: "cambio" });
  const show = play(92, { coverage: "show" });

  it("hundirse deja salir la entrega; saltarla la niega y decide el pívot (puerta de atrás, aro o alto-bajo); cambiar empareja al pívot defensor con el manejador", () => {
    const outcome = (g: { r: GameResult }) => counts(sierra(g.r, "entrega_delay").map((d) => d.chosenOptionId));
    expect(outcome(drop).entrega_completada!).toBeGreaterThan(70);
    expect(outcome(drop).entrega_negada ?? 0).toBe(0);
    expect(outcome(show).entrega_negada!).toBeGreaterThan(70);
    expect(sierra(show.r, "lectura_delay").length).toBeLessThan(10);
    const keeper = counts(sierra(show.r, "lectura_delay_pivote").map((d) => d.chosenOptionId));
    expect((keeper.entrada_poste_o4 ?? 0) + (keeper.finalizar_o5 ?? 0) + (keeper.puerta_atras_o1 ?? 0)).toBeGreaterThan(60);
    // La puerta de atrás es una vía evaluada con su corte real (aunque el pívot elija otra).
    for (const d of sierra(show.r, "lectura_delay_pivote")) expect(d.options.some((o) => o.id === "puerta_atras_o1")).toBe(true);
    expect(sierraEvents(cambio.r, "switch_committed").length).toBeGreaterThan(70);
    expect(sierraEvents(drop.r, "switch_committed")).toHaveLength(0);
    // El triple tras la entrega vale menos con el pívot defensor encima (cambio) que con D1 persiguiendo (hundirse).
    const tripleValue = (g: { r: GameResult }) => {
      const v = sierra(g.r, "lectura_delay").map((d) => d.options.find((o) => o.id === "triple_o1")!.values!.situationalValue as number | null).filter((x): x is number => x !== null);
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    expect(tripleValue(cambio)).toBeLessThan(tripleValue(drop));
    for (const g of [drop, cambio, show]) assertFinalAndReconciled(g);
  });

  it("en auto la defensa compara las tres respuestas a la entrega y declara las coberturas de pantalla como no aplicables a la ficha", () => {
    const auto = play(92, { coverage: "auto" });
    const choices = sierra(auto.r, "seleccion_cobertura");
    expect(choices.length).toBeGreaterThan(80);
    for (const d of choices) {
      expect(["drop", "cambio", "show"]).toContain(d.chosenOptionId);
      for (const id of ["trampa", "a_la_altura", "por_debajo", "ice"]) expect(d.options.find((o) => o.id === id)!.reasonCode).toBe("coverage_not_in_card");
      for (const id of ["drop", "cambio", "show"]) expect(typeof d.options.find((o) => o.id === id)!.values!.concessionValue).toBe("number");
    }
    assertFinalAndReconciled(auto);
  });
});

describe("ME-07B v2 §4: salidas del poste (ayuda de la esquina, corte, repostear)", () => {
  it("con el defensor de la esquina rápido, la ayuda llega antes del giro y el poste sale a la esquina; con el del fixture llega tarde o no compensa", () => {
    const normal = play(92, { coverage: "drop" });
    const fast = play(92, { coverage: "drop", away: fastHelp(PUERTO_AMBAR.players), tag: "fast" });
    const inTime = (g: { r: GameResult }) => sierra(g.r, "respuesta_poste").filter((d) => d.options[0]!.values!.digInTime === true).length / sierra(g.r, "respuesta_poste").length;
    expect(inTime(fast)).toBeGreaterThan(0.9);
    const fastResp = counts(sierra(fast.r, "respuesta_poste").map((d) => d.chosenOptionId));
    expect(fastResp.ayudar_poste!).toBeGreaterThan(20);
    // El hecho de la ayuda se relata si ocurre antes del desenlace (una ayuda que llega tras el tiro no se cuenta).
    expect(sierraEvents(fast.r, "post_dig").length).toBeLessThanOrEqual(fastResp.ayudar_poste!);
    expect(sierraEvents(fast.r, "post_dig").length).toBeGreaterThan(10);
    const fastPost = counts(sierra(fast.r, "lectura_poste").map((d) => d.chosenOptionId));
    expect(fastPost.salida_esquina_o2!).toBeGreaterThan(10);
    const normalPost = counts(sierra(normal.r, "lectura_poste").map((d) => d.chosenOptionId));
    expect(normalPost.salida_esquina_o2 ?? 0).toBeLessThan(fastPost.salida_esquina_o2!);
    // Todas las lecturas del poste evalúan el corte del ala débil y el reposte con su motivo.
    for (const d of sierra(normal.r, "lectura_poste")) {
      expect(d.options.map((o) => o.id)).toEqual(["finalizar_poste", "gancho_poste", "salida_esquina_o2", "corte_o3", "repostear"]);
    }
    expect(normalPost.corte_o3!).toBeGreaterThan(10);
    assertFinalAndReconciled(fast);
  });

  it("si el tirador de la esquina no tira, la ayuda se hunde igual y el poste no tiene esa salida (no dejar tirador de esquina, al revés)", () => {
    const fast = play(92, { coverage: "drop", away: fastHelp(PUERTO_AMBAR.players), tag: "fast" });
    const both = play(92, { coverage: "drop", away: fastHelp(PUERTO_AMBAR.players), home: noShooters(SIERRA_CLARA.players), tag: "fast+noShooters" });
    const kick = (g: { r: GameResult }) => sierra(g.r, "lectura_poste").filter((d) => d.chosenOptionId === "salida_esquina_o2").length;
    expect(kick(both)).toBeLessThan(kick(fast));
    expect(counts(sierra(both.r, "respuesta_poste").map((d) => d.chosenOptionId)).ayudar_poste!).toBeGreaterThan(10);
    assertFinalAndReconciled(both);
  });
});
