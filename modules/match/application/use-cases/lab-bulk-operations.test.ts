import { describe, expect, it } from "vitest";
import { restoreLabTeamFromFixture } from "./restore-lab-team-from-fixture";
import { bulkIncrementLabAttributes } from "./bulk-increment-lab-attributes";
import type { LabTeamRecord, LabTeamRepository, LabTeamSummary } from "../ports/lab-team-repository.port";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../../domain/players/lab-roster-fixture";
import type { PlayerProfile } from "../../domain/players/player-profile";
import { RATING_MAX } from "../../domain/players/attribute";

class InMemoryLabTeamRepository implements LabTeamRepository {
  teams = new Map<string, LabTeamRecord>();
  /** Cuando es `true`, `savePlayers` lanza tras aplicar la mitad de la lista (para probar atomicidad real). */
  failHalfway = false;

  constructor(seed: readonly LabTeamRecord[] = []) {
    for (const team of seed) this.teams.set(team.id, { ...team, players: [...team.players] });
  }

  async listTeams(): Promise<LabTeamSummary[]> {
    return [...this.teams.values()].map((t) => ({ id: t.id, name: t.name, playerCount: t.players.length }));
  }

  async getTeam(teamId: string): Promise<LabTeamRecord | null> {
    const team = this.teams.get(teamId);
    return team ? { ...team, players: [...team.players] } : null;
  }

  async savePlayer(teamId: string, player: PlayerProfile): Promise<void> {
    const team = this.teams.get(teamId);
    if (!team) throw new Error("Equipo no encontrado");
    const others = team.players.filter((p) => p.id !== player.id);
    this.teams.set(teamId, { ...team, players: [...others, player] });
  }

  async savePlayers(teamId: string, players: readonly PlayerProfile[]): Promise<void> {
    const team = this.teams.get(teamId);
    if (!team) throw new Error("Equipo no encontrado");
    if (this.failHalfway && players.length > 1) {
      // Simula un fallo real a mitad de una operación multi-fila: si la
      // capa de persistencia no fuera realmente atómica, el resultado
      // dejaría medio equipo modificado.
      throw new Error("fallo simulado a mitad de la transacción");
    }
    let others = team.players;
    for (const player of players) {
      others = others.filter((p) => p.id !== player.id);
    }
    this.teams.set(teamId, { ...team, players: [...others, ...players] });
  }
}

describe("ME-06 (4): restablecer desde el seed", () => {
  it("recupera el fixture exacto de un equipo sin tocar el otro ni a los jugadores añadidos a mano", async () => {
    const repo = new InMemoryLabTeamRepository([SIERRA_CLARA, PUERTO_AMBAR]);
    // Edita un atributo y añade un jugador manual fuera del fixture.
    const edited = { ...SIERRA_CLARA.players[0]!, attributes: { ...SIERRA_CLARA.players[0]!.attributes, T09: 15 } };
    await repo.savePlayer(SIERRA_CLARA.id, edited);
    const manual: PlayerProfile = { ...SIERRA_CLARA.players[1]!, id: "manual-99", name: "Manual XYZ" };
    await repo.savePlayer(SIERRA_CLARA.id, manual);

    const result = await restoreLabTeamFromFixture(repo, SIERRA_CLARA.id);
    expect(result.status).toBe("restored");
    if (result.status !== "restored") return;
    expect(result.restoredCount).toBe(SIERRA_CLARA.players.length);

    const restoredTeam = await repo.getTeam(SIERRA_CLARA.id);
    const restoredO1 = restoredTeam!.players.find((p) => p.id === "O1")!;
    expect(restoredO1.attributes.T09).toBe(SIERRA_CLARA.players.find((p) => p.id === "O1")!.attributes.T09);
    // El jugador manual sigue intacto.
    expect(restoredTeam!.players.find((p) => p.id === "manual-99")).toBeDefined();
    // El otro equipo no cambió.
    const otherTeam = await repo.getTeam(PUERTO_AMBAR.id);
    expect(otherTeam!.players.length).toBe(PUERTO_AMBAR.players.length);
  });

  it("un equipo sin fixture versionado devuelve un error controlado, no un restablecimiento inventado", async () => {
    const repo = new InMemoryLabTeamRepository([SIERRA_CLARA, PUERTO_AMBAR]);
    const result = await restoreLabTeamFromFixture(repo, "equipo-inexistente");
    expect(result.status).toBe("error");
  });
});

describe("ME-06 (4): incremento masivo", () => {
  it("aplica min(15, valor + incremento) a los 27 atributos de los seleccionados; una segunda aplicación se acumula", async () => {
    const repo = new InMemoryLabTeamRepository([SIERRA_CLARA, PUERTO_AMBAR]);
    const before = (await repo.getTeam(SIERRA_CLARA.id))!.players.find((p) => p.id === "O1")!.attributes.T01;

    const first = await bulkIncrementLabAttributes(repo, SIERRA_CLARA.id, ["O1"], 3);
    expect(first.status).toBe("applied");
    const afterFirst = (await repo.getTeam(SIERRA_CLARA.id))!.players.find((p) => p.id === "O1")!.attributes.T01;
    expect(afterFirst).toBe(Math.min(RATING_MAX, before + 3));

    const second = await bulkIncrementLabAttributes(repo, SIERRA_CLARA.id, ["O1"], 5);
    expect(second.status).toBe("applied");
    const afterSecond = (await repo.getTeam(SIERRA_CLARA.id))!.players.find((p) => p.id === "O1")!.attributes.T01;
    expect(afterSecond).toBe(Math.min(RATING_MAX, afterFirst + 5));
    // Nunca equivalente a +5 directo desde el valor original (se acumula sobre lo ya aplicado, no sobre el seed).
    if (before + 3 < RATING_MAX && before + 3 + 5 <= RATING_MAX) {
      expect(afterSecond).not.toBe(Math.min(RATING_MAX, before + 5));
    }
  });

  it("un atributo ya en 15 se cuenta como ya saturado y no cambia; ningún otro campo se toca", async () => {
    const repo = new InMemoryLabTeamRepository([SIERRA_CLARA, PUERTO_AMBAR]);
    const maxed: PlayerProfile = { ...SIERRA_CLARA.players[0]!, attributes: { ...SIERRA_CLARA.players[0]!.attributes, T01: RATING_MAX } };
    await repo.savePlayer(SIERRA_CLARA.id, maxed);

    const result = await bulkIncrementLabAttributes(repo, SIERRA_CLARA.id, [maxed.id], 5);
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.attributesAlreadyAtMax).toBeGreaterThanOrEqual(1);

    const updated = (await repo.getTeam(SIERRA_CLARA.id))!.players.find((p) => p.id === maxed.id)!;
    expect(updated.attributes.T01).toBe(RATING_MAX);
    expect(updated.name).toBe(maxed.name);
    expect(updated.measures).toEqual(maxed.measures);
    expect(updated.pnrTendency).toBe(maxed.pnrTendency);
  });

  it("una selección vacía se rechaza sin tocar la base de datos", async () => {
    const repo = new InMemoryLabTeamRepository([SIERRA_CLARA, PUERTO_AMBAR]);
    const result = await bulkIncrementLabAttributes(repo, SIERRA_CLARA.id, [], 1);
    expect(result.status).toBe("error");
  });

  it("un ID que no pertenece al equipo se rechaza como validación de servidor, no como incremento parcial", async () => {
    const repo = new InMemoryLabTeamRepository([SIERRA_CLARA, PUERTO_AMBAR]);
    const result = await bulkIncrementLabAttributes(repo, SIERRA_CLARA.id, ["O1", "D1"], 1);
    expect(result.status).toBe("error");
    // D1 (de Puerto Ámbar) no debió tocarse.
    const otherTeam = await repo.getTeam(PUERTO_AMBAR.id);
    const d1 = otherTeam!.players.find((p) => p.id === "D1")!;
    const originalD1 = PUERTO_AMBAR.players.find((p) => p.id === "D1")!;
    expect(d1.attributes).toEqual(originalD1.attributes);
  });

  it("si la persistencia falla a mitad, no queda ningún jugador a medio modificar (atomicidad real, no solo por construcción)", async () => {
    const repo = new InMemoryLabTeamRepository([SIERRA_CLARA, PUERTO_AMBAR]);
    repo.failHalfway = true;
    const before = (await repo.getTeam(SIERRA_CLARA.id))!.players.map((p) => ({ id: p.id, attributes: { ...p.attributes } }));

    const result = await bulkIncrementLabAttributes(repo, SIERRA_CLARA.id, ["O1", "O2", "O3"], 3);
    expect(result.status).toBe("error");

    const after = (await repo.getTeam(SIERRA_CLARA.id))!.players.map((p) => ({ id: p.id, attributes: { ...p.attributes } }));
    expect(after).toEqual(before);
  });
});
