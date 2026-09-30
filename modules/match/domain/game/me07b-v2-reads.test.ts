import { describe, expect, it } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput } from "./game-model";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import type { PlayerProfile } from "../players/player-profile";
import { buildAuditExport } from "../audit/build-audit-export";

/**
 * ME-07B v2 §2.4: lecturas reales del receptor y del manejador del bloqueo.
 * Cada vía se valora frente al mejor cierre real (D5 en drop con una sola
 * trayectoria, D1 que sale de la pantalla, D3 si ayuda) y D3 decide si
 * ayuda al continuador comparando concesiones. Pruebas discriminantes: se
 * cambia una sola capacidad/tendencia y cambia la elección pertinente, nunca
 * la probabilidad de un tiro idéntico.
 */
const AUTO = {
  priority: "proteger_balance" as const,
  coverage: "drop" as const,
  offBallDefensiveCall: "auto" as const,
  offensivePlan: "bloqueo_directo" as const,
  creationPriority: "equilibrado" as const,
};
const SC = SIERRA_CLARA.id;

function play(seed: number, home: readonly PlayerProfile[] = SIERRA_CLARA.players, away: readonly PlayerProfile[] = PUERTO_AMBAR.players) {
  return playFullGame(
    buildGameInput({
      seed,
      auditEnabled: true,
      home: { id: SC, name: SIERRA_CLARA.name, players: home, ...AUTO },
      away: { id: PUERTO_AMBAR.id, name: PUERTO_AMBAR.name, players: away, ...AUTO },
    }),
  );
}

const withAll = (players: readonly PlayerProfile[], patch: Partial<PlayerProfile["attributes"]>) =>
  players.map((p) => ({ ...p, attributes: { ...p.attributes, ...patch } }));

function sierraChoices(r: ReturnType<typeof play>, point: string): Record<string, number> {
  const ids = new Set(SIERRA_CLARA.players.map((p) => p.id));
  const out: Record<string, number> = {};
  for (const d of r.audit!.decisions) {
    if (d.point !== point || !d.holderId || !ids.has(d.holderId)) continue;
    out[d.chosenOptionId ?? "null"] = (out[d.chosenOptionId ?? "null"] ?? 0) + 1;
  }
  return out;
}

describe("ME-07B v2 §2.4: lecturas del receptor del roll y del manejador", () => {
  const base = play(92);

  it("los partidos naturales producen varias primeras y segundas lecturas y los cuatro tipos de tiro de campo", () => {
    const first = sierraChoices(base, "lectura_bloqueo_o1");
    const second = sierraChoices(base, "lectura_segunda_o5");
    expect(Object.keys(first).length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(second).length).toBeGreaterThanOrEqual(2);
    const types = new Set<string>();
    for (const r of [base, play(93), play(94)]) {
      const exported = buildAuditExport(r.input, r);
      for (const shot of exported.result.summary.shots!) types.add(shot.shotType);
      // Floater y tiro medio son tiros de dos en el acta (la conciliación del acta ya lo exige).
      expect(exported.result.reconciliation.every((c) => c.ok)).toBe(true);
    }
    for (const t of ["close_finish", "floater", "mid_range", "three_point"]) expect(types.has(t)).toBe(true);
  });

  it("cada vía del receptor declara quién la cierra y con qué oposición real", () => {
    for (const d of base.audit!.decisions.filter((x) => x.point === "lectura_segunda_o5")) {
      for (const o of d.options.filter((x) => x.id === "finalizar_aro" || x.id === "flotadora")) {
        expect(typeof o.values!.contesterId).toBe("string");
        expect([0, 0.5, 1]).toContain(o.values!.opposition);
      }
    }
  });

  it("subir solo T02 (floater) de los interiores de Sierra hace que el continuador elija más floaters", () => {
    const floaterBig = SIERRA_CLARA.players.map((p) => (p.template === "B" ? { ...p, attributes: { ...p.attributes, T02: 15 } } : p));
    const hi = sierraChoices(play(92, floaterBig), "lectura_segunda_o5");
    const lo = sierraChoices(base, "lectura_segunda_o5");
    expect(hi.flotadora ?? 0).toBeGreaterThan(lo.flotadora ?? 0);
  });

  it("subir solo T03 (tiro medio) de Sierra hace que el manejador se pare a tirar más a menudo", () => {
    const hi = sierraChoices(play(92, withAll(SIERRA_CLARA.players, { T03: 15 })), "lectura_bloqueo_o1");
    const lo = sierraChoices(base, "lectura_bloqueo_o1");
    expect(hi.parada_o1 ?? 0).toBeGreaterThan(lo.parada_o1 ?? 0);
  });

  it("«no dejar tirador de esquina»: con tiradores de esquina peores, D3 de Puerto ayuda al continuador más a menudo", () => {
    const helps = (r: ReturnType<typeof play>) =>
      r.events.filter((e) => e.kind === "help_decision" && e.possessionTeamId === SC && e.detail.helps === true).length;
    const badShooters = withAll(SIERRA_CLARA.players, { T04: 1 });
    expect(helps(play(92, badShooters))).toBeGreaterThan(helps(base));
  });

  it("la tendencia de tiro del receptor cambia la elección dentro de la banda, sin tocar la probabilidad del tiro", () => {
    const set = (t: PlayerProfile["shotTendency"]) => SIERRA_CLARA.players.map((p) => ({ ...p, shotTendency: t }));
    const decided = play(92, set("decidida"));
    const prudent = play(92, set("prudente"));
    const codes = (r: ReturnType<typeof play>) =>
      r.audit!.decisions.filter((d) => d.point === "lectura_segunda_o5").flatMap((d) => d.options.filter((o) => o.status === "elegida").map((o) => o.reasonCode));
    expect(codes(decided)).toContain("shot_tendency_favors_shot");
    expect(codes(prudent)).toContain("shot_tendency_favors_continuation");
  });
});
