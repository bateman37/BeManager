import { describe, expect, it, vi } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput } from "./game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { PlayerProfile } from "../players/player-profile";
import type { DefensiveCoverageChoice } from "../lab/match-input";

// Partidos completos repetidos: más margen que el límite por defecto bajo carga paralela.
vi.setConfig({ testTimeout: 60_000 });

/**
 * ME-07B v2 §5: cambio (switch) y show (hedge) como coberturas reales del
 * bloqueo directo, con geometría, tiempos (M01/M05, M09, T22/T23) y
 * consecuencia: el cambio deja un emparejamiento distinto que persiste el
 * resto de la posesión; el show sale y vuelve. En `auto` compiten con drop y
 * trampa por la menor concesión combinada.
 */
function play(seed: number, coverage: DefensiveCoverageChoice, away: readonly PlayerProfile[] = PUERTO_AMBAR.players) {
  // Bloqueo central (LAB-0.7: el lateral y el ICE ejecutable se prueban en `me07b-v2-lateral-ice.test.ts`).
  const common = { priority: "proteger_balance" as const, offBallDefensiveCall: "auto" as const, offensivePlan: "bloqueo_directo" as const, creationPriority: "equilibrado" as const, screenPlacement: "central" as const };
  return playFullGame(
    buildGameInput({
      seed,
      auditEnabled: true,
      home: { id: SIERRA_CLARA.id, name: SIERRA_CLARA.name, players: SIERRA_CLARA.players, coverage: "drop", ...common },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: away, coverage, ...common },
    }),
  );
}

const SC = SIERRA_CLARA.id;

describe("ME-07B v2 §5: cambio (switch)", () => {
  const r = play(92, "cambio");

  it("D5 canta el cambio y el manejador lee frente al pívot: atacar el cambio, triple, pase al roll o salida", () => {
    const switches = r.events.filter((e) => e.kind === "switch_committed" && e.possessionTeamId === SC);
    expect(switches.length).toBeGreaterThan(20);
    const reads = r.audit!.decisions.filter((d) => d.point === "lectura_cambio");
    expect(reads.length).toBeGreaterThan(20);
    const chosen = new Set(reads.map((d) => d.chosenOptionId));
    expect(chosen.size).toBeGreaterThanOrEqual(2);
    for (const d of reads) {
      expect(d.options.map((o) => o.id)).toEqual(["atacar_cambio", "triple_o1", "pase_o5", "salida_segura"]);
    }
    expect(r.stop.cause).toBe("final");
  });

  it("el emparejamiento cambiado persiste en la siguiente organización de la misma posesión", () => {
    const entries = r.events.filter((e) => e.kind === "organized_entry" && e.possessionTeamId === SC);
    let checked = 0;
    for (let i = 0; i + 1 < entries.length; i++) {
      const a = entries[i]!;
      const b = entries[i + 1]!;
      if (a.possessionIndex !== b.possessionIndex || a.onCourtIds.join() !== b.onCourtIds.join()) continue;
      const switched = r.events.some((x) => x.kind === "switch_committed" && x.possessionIndex === a.possessionIndex && x.atMs >= a.atMs && x.atMs <= b.atMs);
      if (!switched) continue;
      const ra = a.detail.roles as Record<string, string>;
      const rb = b.detail.roles as Record<string, string>;
      const guard = (roles: Record<string, string>, attacker: string) => {
        for (let k = 1; k <= 5; k++) if (roles[`O${k}`] === attacker) return roles[`D${k}`];
        return undefined;
      };
      // Tras el cambio, quien defendía al bloqueador (D5) defiende al manejador y viceversa.
      expect(guard(rb, ra.O1!)).toBe(ra.D5);
      expect(guard(rb, ra.O5!)).toBe(ra.D1);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("un pívot más lento lateralmente (solo F04 de Puerto) hace que se ataque más el cambio", () => {
    const slowBigs = PUERTO_AMBAR.players.map((p) => (p.template === "B" ? { ...p, attributes: { ...p.attributes, F04: 1 } } : p));
    const rate = (res: ReturnType<typeof play>) => {
      const reads = res.audit!.decisions.filter((d) => d.point === "lectura_cambio");
      return reads.filter((d) => d.chosenOptionId === "atacar_cambio").length / Math.max(1, reads.length);
    };
    const fastBigs = PUERTO_AMBAR.players.map((p) => (p.template === "B" ? { ...p, attributes: { ...p.attributes, F04: 15 } } : p));
    expect(rate(play(92, "cambio", slowBigs))).toBeGreaterThan(rate(play(92, "cambio", fastBigs)));
  });
});

describe("ME-07B v2 §5: show (hedge)", () => {
  const r = play(92, "show");

  it("D5 sale delante de la pantalla y vuelve cuando D1 la supera; el manejador lee con esa ventana", () => {
    const shows = r.events.filter((e) => e.kind === "show_committed" && e.possessionTeamId === SC);
    expect(shows.length).toBeGreaterThan(20);
    for (const e of shows) {
      expect(e.detail.recoverStart as number).toBeGreaterThanOrEqual(0);
    }
    const recoveries = r.events.filter((e) => e.kind === "show_recovery" && e.possessionTeamId === SC);
    expect(recoveries.length).toBeGreaterThan(0);
    const reads = r.audit!.decisions.filter((d) => d.point === "lectura_show");
    expect(reads.length).toBeGreaterThan(20);
    expect(new Set(reads.map((d) => d.chosenOptionId)).size).toBeGreaterThanOrEqual(2);
    expect(r.stop.cause).toBe("final");
  });
});

describe("ME-07B v2 §5: por debajo (under) e ICE", () => {
  it("por debajo, D1 no es bloqueado: niega roll y penetración, pero concede la preparación exterior (el cierre del triple llega más tarde y O1 lo elige más)", () => {
    const sierraIds = new Set(SIERRA_CLARA.players.map((p) => p.id));
    const reads = (res: ReturnType<typeof play>) =>
      res.audit!.decisions.filter((d) => d.point === "lectura_bloqueo_o1" && d.possessionIndex !== null && sierraIds.has(d.holderId!));
    const meanMargin = (res: ReturnType<typeof play>) => {
      const xs = reads(res).map((d) => d.options.find((o) => o.id === "triple_o1")!.values!.d1CloseoutMarginSeconds as number);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    const chosenTriples = (res: ReturnType<typeof play>) => reads(res).filter((d) => d.chosenOptionId === "triple_o1").length;
    const under = play(92, "por_debajo");
    const over = play(92, "drop");
    expect(under.events.some((e) => e.kind === "screen_navigated" && e.possessionTeamId === SC && e.detail.route === "por_debajo")).toBe(true);
    const underReads = reads(under);
    expect(underReads.length).toBeGreaterThan(50);
    for (const d of underReads) {
      // Sin retraso de pantalla no hay dos contra uno: el pase al roll no es viable.
      const pass = d.options.find((o) => o.id === "pase_o5")!;
      expect(pass.reasonCode === "screen_delay_insufficient" || pass.reasonCode === "roll_denied_before_decision").toBe(true);
      expect(pass.values!.screenDelaySeconds).toBe(0);
      // D1 espera entre O5 y su defensor: la entrada, si existe, queda contestada.
      expect(d.options.find((o) => o.id === "finalizar")!.values!.d1WallsDrive).toBe(true);
    }
    // El cierre del triple tiene que rodear al bloqueador: llega claramente más tarde.
    expect(meanMargin(under)).toBeGreaterThan(meanMargin(over) + 0.5);
    // Con el bloqueador aún entre los dos al soltar, el triple queda sin contestar.
    const meanOpposition = (res: ReturnType<typeof play>) => {
      const xs = reads(res).map((d) => d.options.find((o) => o.id === "triple_o1")!.values!.opposition as number);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(meanOpposition(under)).toBeLessThan(meanOpposition(over));
    expect(chosenTriples(under)).toBeGreaterThan(3 * chosenTriples(over));
    expect(under.stop.cause).toBe("final");
  });

  it("ICE ante el bloqueo central no es aplicable: se registra la orden solicitada y la aplicada (drop)", () => {
    const r = play(92, "ice");
    const notApplicable = r.events.filter((e) => e.kind === "coverage_not_applicable" && e.possessionTeamId === SC);
    expect(notApplicable.length).toBeGreaterThan(20);
    for (const e of notApplicable) {
      expect(e.detail.requested).toBe("ice");
      expect(e.detail.applied).toBe("drop");
      expect(e.detail.lateral).toBe(false);
    }
    expect(r.stop.cause).toBe("final");
  });
});

describe("ME-07B v2 §5: coberturas en competencia en auto", () => {
  it("en partidos naturales auto elige más de dos coberturas y cada una tiene su concesión auditada", () => {
    const chosen = new Set<string>();
    for (const seed of [91, 92, 93]) {
      const r = play(seed, "auto");
      for (const d of r.audit!.decisions.filter((x) => x.point === "seleccion_cobertura")) {
        chosen.add(d.chosenOptionId!);
        expect(d.options.map((o) => o.id)).toEqual(["drop", "trampa", "cambio", "show", "a_la_altura", "por_debajo", "ice"]);
        // Bloqueo central: ICE nunca es elegible y se declara con su motivo;
        // ante el lateral (LAB-0.7) compite con su concesión proyectada.
        const ice = d.options.find((o) => o.id === "ice")!;
        if (ice.values!.lateralScreen) {
          expect(ice.values!.concessionValue).not.toBeNull();
        } else {
          expect(ice.reasonCode).toBe("coverage_ice_central_not_eligible");
          expect(d.chosenOptionId).not.toBe("ice");
        }
      }
    }
    expect(chosen.size).toBeGreaterThanOrEqual(3);
  });
});
