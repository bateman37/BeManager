import { describe, expect, it } from "vitest";
import { saveLabPlayer } from "./save-lab-player";
import { loadLabRoster } from "./load-lab-roster";
import type { LabTeamRecord, LabTeamRepository, LabTeamSummary } from "../ports/lab-team-repository.port";
import { SIERRA_CLARA, findFixturePlayer } from "../../domain/players/lab-roster-fixture";
import type { PlayerProfile } from "../../domain/players/player-profile";

class InMemoryLabTeamRepository implements LabTeamRepository {
  private teams = new Map<string, LabTeamRecord>();

  constructor(seed: readonly LabTeamRecord[] = []) {
    for (const team of seed) this.teams.set(team.id, team);
  }

  async listTeams(): Promise<LabTeamSummary[]> {
    return [...this.teams.values()].map((t) => ({ id: t.id, name: t.name, playerCount: t.players.length }));
  }

  async getTeam(teamId: string): Promise<LabTeamRecord | null> {
    return this.teams.get(teamId) ?? null;
  }

  async savePlayer(teamId: string, player: PlayerProfile): Promise<void> {
    const team = this.teams.get(teamId);
    if (!team) throw new Error("Equipo no encontrado");
    const others = team.players.filter((p) => p.id !== player.id);
    this.teams.set(teamId, { ...team, players: [...others, player] });
  }
}

class FailingLabTeamRepository implements LabTeamRepository {
  async listTeams(): Promise<LabTeamSummary[]> {
    throw new Error("conexión rechazada a postgres://user:secret@host:5432/db");
  }
  async getTeam(): Promise<LabTeamRecord | null> {
    throw new Error("conexión rechazada");
  }
  async savePlayer(): Promise<void> {
    throw new Error("conexión rechazada a postgres://user:secret@host:5432/db");
  }
}

describe("saveLabPlayer + loadLabRoster: persistencia de perfil por interfaz (invariante 8)", () => {
  it("tras guardar y recargar se recuperan los valores editados", async () => {
    const repository = new InMemoryLabTeamRepository([SIERRA_CLARA]);
    const original = findFixturePlayer("O1");
    const edited: PlayerProfile = { ...original, attributes: { ...original.attributes, T09: 15 } };

    const saveResult = await saveLabPlayer(repository, SIERRA_CLARA.id, edited);
    expect(saveResult.status).toBe("saved");

    const loadResult = await loadLabRoster(repository);
    expect(loadResult.status).toBe("loaded");
    const reloaded = loadResult.teams[0]!.players.find((p) => p.id === "O1");
    expect(reloaded?.attributes.T09).toBe(15);
  });

  it("un fallo de base de datos devuelve un error controlado sin filtrar la cadena de conexión", async () => {
    const repository = new FailingLabTeamRepository();
    const player = findFixturePlayer("O1");

    const result = await saveLabPlayer(repository, SIERRA_CLARA.id, player);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).not.toMatch(/postgres:\/\//);
      expect(result.message).not.toMatch(/secret/);
    }
  });

  it("si la carga falla, devuelve los perfiles de referencia marcados como no disponibles", async () => {
    const repository = new FailingLabTeamRepository();
    const result = await loadLabRoster(repository);

    expect(result.status).toBe("unavailable");
    expect(result.teams.length).toBeGreaterThan(0);
  });
});
