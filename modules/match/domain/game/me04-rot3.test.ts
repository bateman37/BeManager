import { describe, expect, it } from "vitest";
import { playFullGame } from "./play-full-game";
import { buildGameInput } from "./game-model";
import { reconcileBoxScore } from "./box-score";
import { emergencyRoleFit, planSubstitutions, type RotationPlayerState } from "./substitution-policy";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { LAB_DECLARED_ROLES, type FunctionalRole } from "../players/functional-roles";

/**
 * ME-04-ROT-3 (decisión de Dennis, 01-10-2026, semilla 39): si ni el relevo
 * por rol declarado ni el reajuste ME-04-ROT-2 completan el quinteto tras una
 * exclusión, entra un suplente inscrito y habilitado aunque no declare el rol
 * vacante; gana la asignación de los cinco que conserva más roles
 * declarados, después la capacidad pertinente en el puesto excepcional y un
 * desempate reproducible (reajustes, minutos, ID). Con menos de cinco
 * habilitados es otro caso, sin quinto jugador fabricado.
 */
const SC = SIERRA_CLARA.id;
const PA = PUERTO_AMBAR.id;
const profile = (id: string) => SIERRA_CLARA.players.find((p) => p.id === id)!;

const state = (id: string, onCourt: boolean, totalMs: number, extra: Partial<RotationPlayerState> = {}): RotationPlayerState => ({
  id,
  declaredRoles: LAB_DECLARED_ROLES[id] ?? [],
  onCourt,
  continuousMs: onCourt ? 200_000 : 0,
  totalMs,
  disqualified: false,
  locked: false,
  attributes: profile(id).attributes,
  ...extra,
});

/** Estado real de Sierra en la semilla 39 al excluir a O1 (C4, 3:27): SC06 ya excluido. */
function seed39Players(): RotationPlayerState[] {
  return [
    state("O1", true, 2_100_000, { disqualified: true }),
    state("SC07", true, 900_000),
    state("O3", true, 1_900_000),
    state("O4", true, 1_900_000),
    state("O5", true, 1_900_000),
    state("SC06", false, 1_300_000, { disqualified: true }),
    state("O2", false, 932_782),
    state("SC08", false, 985_803),
    state("SC09", false, 694_864),
    state("SC10", false, 825_458),
    state("SC11", false, 893_074),
    state("SC12", false, 700_000),
  ];
}

const common = {
  priority: "proteger_balance" as const,
  coverage: "auto" as const,
  offBallDefensiveCall: "auto" as const,
  offensivePlan: "auto" as const,
  creationPriority: "equilibrado" as const,
};

describe("ME-04-ROT-3: relevo de emergencia sin nadie que declare el rol del excluido", () => {
  it("semilla 39 (pura): los dos bases declarados excluidos; entra quien conserva más roles declarados y mejor capacidad de base, sin sorteo", () => {
    const plan = planSubstitutions({ lineup: ["O1", "SC07", "O3", "O4", "O5"], players: seed39Players(), voluntaryCap: 2, continuousThresholdMs: 300_000, protectedIds: [] });
    expect(plan.unresolved).toEqual([]);
    expect(plan.changes).toHaveLength(1);
    const change = plan.changes[0]!;
    const e = change.emergency!;
    // Nadie declara el rol 1: el mejor posible conserva 4 de 5 roles declarados.
    expect(e.declaredKept).toBe(4);
    expect(e.candidates.every((c) => c.declaredKept === 4)).toBe(true);
    // El puesto excepcional lo decide la capacidad pertinente del rol 1.
    const fit = (id: string) => emergencyRoleFit(profile(id).attributes, 1);
    const best = ["SC07", "O3", "O4", "O5", "O2", "SC08", "SC09", "SC10", "SC11", "SC12"].sort((a, b) => fit(b) - fit(a))[0]!;
    expect(e.outOfRole).toEqual([{ playerId: best, role: 1, declaredRoles: LAB_DECLARED_ROLES[best], fit: fit(best) }]);
    expect(best).toBe("SC08");
    expect(change).toMatchObject({ outId: "O1", inId: "SC08", role: 1, reason: "exclusion" });
    expect(e.lineupAfter).toEqual(["SC08", "SC07", "O3", "O4", "O5"]);
    expect(e.moves).toEqual([]);
    expect(e.decidedBy).toBe("capacidad_pertinente");
    // Ningún excluido aparece como candidato ni en el quinteto resultante.
    expect(e.candidates.map((c) => c.inId)).not.toContain("SC06");
    expect(e.lineupAfter).not.toContain("O1");
    // Determinista: misma entrada, mismo plan.
    expect(planSubstitutions({ lineup: ["O1", "SC07", "O3", "O4", "O5"], players: seed39Players(), voluntaryCap: 2, continuousThresholdMs: 300_000, protectedIds: [] })).toEqual(plan);
  });

  it("orden de preferencia: relevo por rol y reajuste ROT-2 primero; la emergencia prefiere una cadena 5/5 a un fuera de rol, y empata por minutos e ID", () => {
    const p = (id: string, roles: FunctionalRole[], onCourt: boolean, totalMs = 100_000, extra: Partial<RotationPlayerState> = {}): RotationPlayerState => ({
      id,
      declaredRoles: roles,
      onCourt,
      continuousMs: 100_000,
      totalMs,
      disqualified: false,
      locked: false,
      ...extra,
    });
    // Con un base en el banquillo no hay emergencia (ME-04-ROT-1).
    const rot1 = planSubstitutions({
      lineup: ["A1", "A2", "A3", "A4", "A5"],
      players: [p("A1", [1], true, 1, { disqualified: true }), p("A2", [2, 1], true), p("A3", [3], true), p("A4", [4], true), p("A5", [5], true), p("B1", [1], false), p("B3", [3], false)],
      voluntaryCap: 0,
      continuousThresholdMs: 300_000,
      protectedIds: [],
    });
    expect(rot1.changes[0]).toMatchObject({ inId: "B1", role: 1 });
    expect(rot1.changes[0]!.emergency).toBeUndefined();
    // Cadena: A2 [1,2] → 1, A3 [2,3] → 2, entra B3 [3]. ROT-2 (un salto) no llega; ROT-3 sí, 5/5.
    const chain = planSubstitutions({
      lineup: ["A1", "A2", "A3", "A4", "A5"],
      players: [p("A1", [1], true, 1, { disqualified: true }), p("A2", [1, 2], true), p("A3", [2, 3], true), p("A4", [4], true), p("A5", [5], true), p("B3", [3], false), p("B9", [], false, 0)],
      voluntaryCap: 0,
      continuousThresholdMs: 300_000,
      protectedIds: [],
    });
    expect(chain.changes[0]!.emergency).toMatchObject({ declaredKept: 5, outOfRole: [], lineupAfter: ["A2", "A3", "B3", "A4", "A5"], decidedBy: "roles_declarados" });
    // Empate exacto de roles y capacidad (sin atributos = 8): menos minutos y después ID.
    const tie = planSubstitutions({
      lineup: ["A1", "A2", "A3", "A4", "A5"],
      players: [p("A1", [1], true, 1, { disqualified: true }), p("A2", [2], true), p("A3", [3], true), p("A4", [4], true), p("A5", [5], true), p("BZ", [3], false, 50_000), p("BY", [3], false, 50_000), p("BX", [3], false, 90_000)],
      voluntaryCap: 0,
      continuousThresholdMs: 300_000,
      protectedIds: [],
    });
    expect(tie.changes[0]).toMatchObject({ inId: "BY", role: 1 });
    expect(tie.changes[0]!.emergency!.decidedBy).toBe("id");
  });

  it("menos de cinco inscritos habilitados es otro caso: queda sin resolver como «menos_de_cinco», sin fabricar un quinto", () => {
    const p = (id: string, onCourt: boolean, disqualified = false): RotationPlayerState => ({
      id,
      declaredRoles: [2],
      onCourt,
      continuousMs: 0,
      totalMs: 0,
      disqualified,
      locked: false,
    });
    const plan = planSubstitutions({
      lineup: ["A1", "A2", "A3", "A4", "A5"],
      players: [p("A1", true, true), p("A2", true), p("A3", true), p("A4", true), p("A5", true), p("B6", false, true)],
      voluntaryCap: 2,
      continuousThresholdMs: 300_000,
      protectedIds: [],
    });
    expect(plan.changes).toEqual([]);
    expect(plan.unresolved).toEqual([{ outId: "A1", role: 1, kind: "menos_de_cinco", eligible: 4 }]);
  });

  it("partido completo natural (semilla 23): los tres interiores declarados excluidos; termina final con acta conciliada, registra quién y por qué, el excluido no vuelve y los perfiles no cambian", () => {
    // La semilla 39 (dos bases declarados excluidos) se verificó de punta a
    // punta en `399d8e6` (final 110–101, entra SC08 de base); el bloqueo
    // lateral y el ICE (LAB-0.7) cambian su secuencia y ya no llega a ese
    // estado, que conserva la prueba pura de arriba con sus valores reales.
    // En la secuencia vigente lo alcanza la semilla 23 (Sierra, rol 5).
    const home = structuredClone(SIERRA_CLARA.players);
    const homeBefore = JSON.stringify(home);
    const gameInput = buildGameInput({
      seed: 23,
      auditEnabled: true,
      home: { id: SC, name: SIERRA_CLARA.name, players: home, ...common },
      away: { id: PA, name: PUERTO_AMBAR.name, players: PUERTO_AMBAR.players, ...common },
    });
    const rolesBefore = JSON.stringify(gameInput.teams[0].declaredRoles);
    const r = playFullGame(gameInput);
    expect(r.stop.cause).toBe("final");
    const checks = reconcileBoxScore({ box: r.box, finalScore: r.finalScore, effectivePlayedMs: r.effectivePlayedMs, engineMinutesMs: r.engineMinutesMs, teamIds: [SC, PA] });
    expect(checks.filter((c) => !c.ok)).toEqual([]);

    const emergencies = r.substitutions.filter((s) => s.emergency);
    expect(emergencies).toHaveLength(1);
    const sub = emergencies[0]!;
    // Todos los inscritos que declaran el rol 5 (O5, SC11, SC12) están excluidos.
    const declare5 = Object.entries(gameInput.teams[0].declaredRoles).filter(([, roles]) => roles.includes(5)).map(([id]) => id);
    expect(declare5.sort()).toEqual(["O5", "SC11", "SC12"]);
    for (const id of declare5) expect(r.box.players[id]!.pf).toBe(5);
    // Asignación elegida: O4 [4] pasa al 5 (único fuera de rol) y entra SC10 [3,4] como ala-pívot.
    expect(sub).toMatchObject({ teamId: SC, outId: "SC12", inId: "SC10", role: 4, reason: "exclusion" });
    expect(sub.emergency!.moves).toEqual([{ playerId: "O4", fromRole: 4, toRole: 5 }]);
    expect(sub.emergency!.outOfRole).toEqual([expect.objectContaining({ playerId: "O4", role: 5, declaredRoles: [4] })]);
    expect(sub.emergency!.declaredKept).toBe(4);
    expect(sub.emergency!.decidedBy).toBe("capacidad_pertinente");
    // La capacidad pertinente del puesto excepcional es la del rol 5 con sus atributos reales.
    expect(sub.emergency!.outOfRole[0]!.fit).toBeCloseTo(emergencyRoleFit(profile("O4").attributes, 5), 9);

    // Hecho y decisión auditada (ME-07B-AUDIT-1) con quién, alternativas y criterio.
    const fact = r.events.find((e) => e.kind === "substitution" && e.atMs === sub.atMs && e.text.includes("ME-04-ROT-3"));
    expect(fact?.text).toContain("O4 4→5");
    const decision = r.audit!.decisions.find((d) => d.point === "sustitucion" && d.chosenOptionId === "SC10");
    expect(decision).toBeDefined();
    expect(decision!.factLink).toEqual({ atMs: sub.atMs, kind: "substitution" });
    expect(decision!.note).toContain("capacidad_pertinente");
    expect(decision!.options.find((o) => o.id === "SC10")).toMatchObject({ status: "elegida", reasonCode: "emergency_fill_chosen", values: expect.objectContaining({ declaredKept: 4, outOfRole: "O4:5:[4]" }) });
    expect(decision!.options.filter((o) => o.status !== "elegida").every((o) => o.reasonCode === "emergency_fill_lower_role_fit")).toBe(true);
    expect(decision!.options.map((o) => o.id)).not.toContain("O5");
    expect(decision!.options.map((o) => o.id)).not.toContain("SC11");
    expect(decision!.rngStateBefore).toBeNull();
    // El quinteto en pista tras el cambio: O4 de interior, SC10 de ala-pívot.
    const after = r.events.find((e) => e.atMs >= sub.atMs && e.kind !== "substitution" && e.onCourtIds.includes("SC10"));
    expect(after?.onCourtIds).toContain("O4");
    expect(after?.onCourtIds).not.toContain("SC12");

    // Ningún excluido vuelve a entrar ni actúa después de su exclusión.
    for (const out of declare5) {
      const dq = r.substitutions.find((s) => s.outId === out && s.reason === "exclusion")!;
      expect(r.substitutions.some((s) => s.inId === out && s.atMs >= dq.atMs)).toBe(false);
      expect(r.events.some((e) => e.atMs > dq.atMs && e.kind !== "substitution" && e.actors.includes(out))).toBe(false);
    }
    // No se tocan roles persistidos ni atributos: la entrada es la misma.
    expect(JSON.stringify(home)).toBe(homeBefore);
    expect(JSON.stringify(gameInput.teams[0].declaredRoles)).toBe(rolesBefore);
    expect(gameInput.teams[0].declaredRoles.O4).toEqual([4]);
  });
});
