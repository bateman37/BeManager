import { describe, expect, it, vi } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput, type GameResult } from "./game-model";
import { reconcileBoxScore } from "./box-score";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { PlayerProfile } from "../players/player-profile";
import type { DefensiveCoverageChoice } from "../lab/match-input";
import type { ScreenPlacementChoice } from "../lab/lab-0-7-parameters";

vi.setConfig({ testTimeout: 60_000 });

/**
 * ME-07B v2 §4–§5 (LAB-0.7): bloqueo directo **lateral** como segunda
 * colocación real (otra disposición, otra continuación), **ICE** ejecutable
 * ante él (D1 del lado de la pantalla, D5 en la ayuda baja, el manejador
 * empujado a fondo) y **«a la altura»** distinto del **show** (profundidad,
 * pausa del manejador y a quién vuelve el pívot). Sierra ataca, Puerto
 * defiende con la cobertura pedida; mismas semillas y quintetos en cada par.
 */
const SC = SIERRA_CLARA.id;
const PA = PUERTO_AMBAR.id;

function play(seed: number, coverage: DefensiveCoverageChoice, placement: ScreenPlacementChoice, away: readonly PlayerProfile[] = PUERTO_AMBAR.players): GameResult {
  const common = { priority: "proteger_balance" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "bloqueo_directo" as const, creationPriority: "equilibrado" as const };
  return playFullGame(
    buildGameInput({
      seed,
      auditEnabled: true,
      home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, coverage: "drop", screenPlacement: placement, ...common },
      away: { id: PA, name: PUERTO_AMBAR.name, players: away, coverage, screenPlacement: "central", ...common },
    }),
  );
}

const reconciled = (r: GameResult) =>
  reconcileBoxScore({ box: r.box, finalScore: r.finalScore, effectivePlayedMs: r.effectivePlayedMs, engineMinutesMs: r.engineMinutesMs, teamIds: [SC, PA] }).every((c) => c.ok);
const sierraEntries = (r: GameResult) => r.events.filter((e) => e.kind === "organized_entry" && e.possessionTeamId === SC);
/** Decisiones cuyo equipo atacante es Sierra (los atacantes del núcleo son jugadores de Sierra). */
const sierraIds = new Set(SIERRA_CLARA.players.map((p) => p.id));
const bySierra = (r: GameResult, point: string) => r.audit!.decisions.filter((d) => d.point === point && sierraIds.has(d.participants[0]!));

describe("ME-07B v2 §4: bloqueo directo lateral", () => {
  const lateral = play(92, "drop", "lateral");
  const central = play(92, "drop", "central");

  it("la colocación lateral cambia la disposición y la continuación del bloqueador; la central no", () => {
    const lat = sierraEntries(lateral);
    expect(lat.length).toBeGreaterThan(50);
    expect(lat.every((e) => e.detail.placement === "lateral")).toBe(true);
    expect(sierraEntries(central).every((e) => e.detail.placement === "central")).toBe(true);
    const latSets = lateral.events.filter((e) => e.kind === "screen_set" && e.possessionTeamId === SC);
    expect(latSets.length).toBeGreaterThan(50);
    expect(latSets.every((e) => e.detail.placement === "lateral")).toBe(true);
    // La continuación va al short roll lateral (otro punto) y no al central.
    const rollY = (r: GameResult) => r.events.filter((e) => e.kind === "roll_continuation" && e.possessionTeamId === SC).map((e) => e.detail.rollSpot as { x: number; y: number });
    const half = (p: { y: number }) => Math.abs(p.y - 7.5);
    expect(rollY(lateral).every((p) => half(p) > 1)).toBe(true);
    expect(rollY(central).every((p) => half(p) < 0.01)).toBe(true);
    for (const r of [lateral, central]) {
      expect(r.stop.cause).toBe("final");
      expect(reconciled(r)).toBe(true);
    }
  });

  it("la colocación se audita como decisión (pedida por el entrenador o elegida por proyección) y la lateral es del bloqueo directo", () => {
    for (const d of bySierra(lateral, "colocacion_bloqueo")) {
      expect(d.chosenOptionId).toBe("lateral");
      expect(d.options).toEqual([expect.objectContaining({ id: "lateral", status: "elegida", reasonCode: "placement_forced_by_plan" })]);
    }
    const fam = bySierra(lateral, "seleccion_familia");
    expect(fam.length).toBeGreaterThan(50);
    for (const d of fam) {
      expect(d.chosenOptionId).toBe("bloqueo_directo");
      expect(d.options.find((o) => o.id === "mano_a_mano_sin_balon")!.reasonCode).toBe("family_not_in_lateral_placement");
    }
    // En auto, el poseedor real compara las colocaciones de las fichas (central, lateral y Horns, LAB-0.8)
    // con su valor proyectado y elige la central y la lateral en el partido.
    const auto = play(92, "drop", "auto");
    const placements = bySierra(auto, "colocacion_bloqueo");
    expect(placements.length).toBeGreaterThan(50);
    for (const d of placements) {
      expect(d.options.map((o) => o.id)).toEqual(["central", "lateral", "horns"]);
      for (const o of d.options) expect(typeof o.values!.projectedValue).toBe("number");
    }
    const chosen = new Set(placements.map((d) => d.chosenOptionId));
    expect(chosen.has("central")).toBe(true);
    expect(chosen.has("lateral")).toBe(true);
  });
});

describe("ME-07B v2 §5: ICE ante el bloqueo lateral", () => {
  const ice = play(92, "ice", "lateral");
  const drop = play(92, "drop", "lateral");

  it("D1 se pone del lado de la pantalla y D5 baja a la ayuda; el manejador lee contra el ICE, no contra el bloqueo", () => {
    const committed = ice.events.filter((e) => e.kind === "ice_committed" && e.possessionTeamId === SC);
    expect(committed.length).toBeGreaterThan(50);
    for (const e of committed) {
      expect(e.detail.d1IceAt as number).toBeLessThanOrEqual(e.detail.screenUsedAt as number);
      expect(e.actors.length).toBe(2);
    }
    expect(ice.events.some((e) => e.kind === "coverage_not_applicable" && e.possessionTeamId === SC)).toBe(false);
    const reads = bySierra(ice, "lectura_ice");
    expect(reads.length).toBe(committed.length);
    for (const d of reads) {
      expect(d.options.map((o) => o.id)).toEqual(["penetrar_fondo", "parada_fondo", "pase_o5", "pase_esquina_o2", "salida_segura"]);
      // El pase al bloqueador abierto pasa por D1 (quien puede desviarlo), el jugador real de Puerto en el rol 1.
      const pass = d.options.find((o) => o.id === "pase_o5")!;
      expect(PUERTO_AMBAR.players.some((p) => p.id === pass.values!.deflectorId)).toBe(true);
    }
    // Con el ICE puesto no se usa la pantalla: ni navegación de D1 ni lectura del bloqueo en esas posesiones.
    for (const e of committed) {
      const sameAction = ice.events.filter((x) => x.possessionIndex === e.possessionIndex && x.atMs >= e.atMs - 2000 && x.atMs <= e.atMs + 50);
      expect(sameAction.some((x) => x.kind === "screen_navigated")).toBe(false);
    }
    expect(ice.stop.cause).toBe("final");
    expect(reconciled(ice)).toBe(true);
  });

  it("par ICE/drop con la misma semilla y disposición lateral: cambia la primera lectura y su concesión", () => {
    // Primera acción organizada de Sierra: mismos diez y misma geometría antes de la cobertura.
    const firstIce = bySierra(ice, "lectura_ice")[0]!;
    const firstDrop = bySierra(drop, "lectura_bloqueo_o1")[0]!;
    expect(firstIce.possessionIndex).toBe(firstDrop.possessionIndex);
    // Drop concede la salida por encima de la pantalla (triple tras el uso y el roll); ICE la niega y concede fondo y el bloqueador abierto.
    expect(firstDrop.options.map((o) => o.id)).toContain("triple_o1");
    expect(firstIce.options.map((o) => o.id)).not.toContain("triple_o1");
    // En el partido, el ICE cambia el reparto de lecturas: el bloqueador abierto en el codo es la concesión habitual.
    const chosen = (r: GameResult, point: string) => bySierra(r, point).map((d) => d.chosenOptionId);
    expect(chosen(ice, "lectura_ice").filter((c) => c === "pase_o5").length).toBeGreaterThan(chosen(ice, "lectura_ice").length / 2);
    const popReceipts = ice.events.filter((e) => e.kind === "roll_continuation" && e.possessionTeamId === SC && e.text.includes("se abre al centro"));
    // Una lectura a la que la bocina del período corta antes de que el bloqueador se abra no tiene apertura.
    const cutByBuzzer = (d: ReturnType<typeof bySierra>[number]) => ice.events.some((e) => e.kind === "buzzer" && e.possessionIndex === d.possessionIndex && e.atMs >= d.atMs);
    expect(popReceipts.length).toBe(bySierra(ice, "lectura_ice").filter((d) => !cutByBuzzer(d)).length);
  });

  it("un ICE tardío (D1 lento en leer y desplazarse) no niega la pantalla: se registra y se juega drop", () => {
    const slow = PUERTO_AMBAR.players.map((p) => ({ ...p, attributes: { ...p.attributes, M01: 1, M05: 1, F04: 1 } }));
    const r = play(92, "ice", "lateral", slow);
    const late = r.events.filter((e) => e.kind === "ice_late" && e.possessionTeamId === SC);
    expect(late.length).toBeGreaterThan(20);
    for (const e of late) {
      expect(e.detail.d1IceAt as number).toBeGreaterThan(e.detail.screenUsedAt as number);
      expect(e.detail.applied).toBe("drop");
    }
    expect(r.events.filter((e) => e.kind === "ice_committed" && e.possessionTeamId === SC).length).toBeLessThan(late.length);
    expect(r.stop.cause).toBe("final");
  });

  it("en auto, ICE solo compite ante el bloqueo lateral, con su concesión proyectada", () => {
    const home = { priority: "proteger_balance" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "auto" as const, creationPriority: "equilibrado" as const, coverage: "auto" as const, screenPlacement: "auto" as const };
    let iceChosen = 0;
    let lateralSeen = 0;
    for (const seed of [91, 92, 93]) {
      const r = playFullGame(buildGameInput({ seed, auditEnabled: true, home: { id: SC, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, ...home }, away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...home } }));
      for (const d of r.audit!.decisions.filter((x) => x.point === "seleccion_cobertura")) {
        const iceOption = d.options.find((o) => o.id === "ice")!;
        if (iceOption.values!.lateralScreen) {
          lateralSeen += 1;
          expect(iceOption.values!.concessionValue).not.toBeNull();
        } else {
          expect(iceOption.reasonCode).toBe("coverage_ice_central_not_eligible");
          expect(d.chosenOptionId).not.toBe("ice");
        }
        if (d.chosenOptionId === "ice") iceChosen += 1;
      }
      expect(r.stop.cause).toBe("final");
    }
    expect(lateralSeen).toBeGreaterThan(5);
    expect(iceChosen).toBeGreaterThan(0);
  });
});

describe("ME-07B v2 §5: «a la altura» frente a show", () => {
  const show = play(92, "show", "central");
  const atLevel = play(92, "a_la_altura", "central");

  it("misma pantalla: el show sale más arriba y vuelve al aro; «a la altura» se queda junto al bloqueador y vuelve con el continuador", () => {
    const s = show.events.filter((e) => e.kind === "show_committed" && e.possessionTeamId === SC);
    const a = atLevel.events.filter((e) => e.kind === "at_level_committed" && e.possessionTeamId === SC);
    expect(s.length).toBeGreaterThan(30);
    expect(a.length).toBeGreaterThan(30);
    expect(s[0]!.possessionIndex).toBe(a[0]!.possessionIndex);
    expect(s[0]!.detail.depthToHoop as number).toBeGreaterThan((a[0]!.detail.depthToHoop as number) + 0.3);
    expect(atLevel.events.some((e) => e.kind === "show_committed")).toBe(false);
    expect(show.events.some((e) => e.kind === "at_level_committed")).toBe(false);
    const recoverTo = (r: GameResult, point: string) => new Set(bySierra(r, point).map((d) => d.options.find((o) => o.id === "pase_o5")!.values!.d5RecoversTo));
    expect(recoverTo(show, "lectura_show")).toEqual(new Set(["aro"]));
    expect(recoverTo(atLevel, "lectura_a_la_altura")).toEqual(new Set(["continuador"]));
  });

  it("el show frena al manejador cuando llega a su línea a tiempo; «a la altura» nunca lo frena", () => {
    const halted = (r: GameResult, point: string) => bySierra(r, point).map((d) => d.options.find((o) => o.id === "finalizar")!.values!);
    const s = halted(show, "lectura_show");
    const a = halted(atLevel, "lectura_a_la_altura");
    expect(s.some((v) => v.halted === true)).toBe(true);
    expect(a.every((v) => v.halted === false)).toBe(true);
    // Primera lectura de cada una (mismo instante de decisión): frenado, el show retrasa la penetración.
    const first = bySierra(show, "lectura_show").find((d) => d.options.find((o) => o.id === "finalizar")!.values!.halted === true)!;
    const twin = bySierra(atLevel, "lectura_a_la_altura").find((d) => d.possessionIndex === first.possessionIndex && d.atMs === first.atMs);
    expect(twin).toBeDefined();
    expect(first.options.find((o) => o.id === "finalizar")!.values!.readySeconds as number).toBeGreaterThan(twin!.options.find((o) => o.id === "finalizar")!.values!.readySeconds as number);
    for (const r of [show, atLevel]) {
      expect(r.stop.cause).toBe("final");
      expect(reconciled(r)).toBe(true);
    }
  });
});
