import { describe, expect, it } from "vitest";
import { seedLabRoster } from "./seed-lab-roster";
import type { LabSeedStore } from "../ports/lab-seed-store.port";
import { LAB_ROSTER_FIXTURE, SIERRA_CLARA } from "../../domain/players/lab-roster-fixture";
import type { PlayerProfile } from "../../domain/players/player-profile";
import { checkPlayerCoherence } from "../../domain/players/player-validation";
import { LAB_DECLARED_ROLES } from "../../domain/players/functional-roles";

class InMemorySeedStore implements LabSeedStore {
  readonly teams = new Map<string, string>();
  readonly players = new Map<string, PlayerProfile>();
  async teamExists(teamId: string) {
    return this.teams.has(teamId);
  }
  async createTeam(teamId: string, name: string) {
    this.teams.set(teamId, name);
  }
  async renameTeam(teamId: string, name: string) {
    this.teams.set(teamId, name);
  }
  async playerExists(teamId: string, playerId: string) {
    return this.players.has(`${teamId}/${playerId}`);
  }
  async createPlayer(teamId: string, player: PlayerProfile) {
    this.players.set(`${teamId}/${player.id}`, structuredClone(player));
  }
  async overwritePlayer(teamId: string, player: PlayerProfile) {
    this.players.set(`${teamId}/${player.id}`, structuredClone(player));
  }
}

// ME-04 §8 (7): el seed normal no es destructivo sobre perfiles ya editados.
describe("ME-04 (7): siembra no destructiva de la plantilla ampliada", () => {
  it("con los diez titulares ya editados, solo crea los catorce suplentes y conserva las ediciones", async () => {
    const store = new InMemorySeedStore();
    // Base de datos de ME-03: dos equipos y diez jugadores, uno editado por Dennis.
    for (const team of LAB_ROSTER_FIXTURE) {
      store.teams.set(team.id, team.name);
      for (const p of team.players.slice(0, 5)) store.players.set(`${team.id}/${p.id}`, structuredClone(p));
    }
    const edited = { ...structuredClone(SIERRA_CLARA.players[0]!), name: "Izan Marea (editado)" };
    store.players.set(`${SIERRA_CLARA.id}/O1`, edited);

    const first = await seedLabRoster(store, LAB_ROSTER_FIXTURE, false);
    expect(first).toEqual({ created: 14, overwritten: 0, preserved: 10 });
    expect(store.players.get(`${SIERRA_CLARA.id}/O1`)!.name).toBe("Izan Marea (editado)");
    expect(store.players.size).toBe(24);

    // Repetible: una segunda siembra no crea ni cambia nada.
    const second = await seedLabRoster(store, LAB_ROSTER_FIXTURE, false);
    expect(second).toEqual({ created: 0, overwritten: 0, preserved: 24 });
    expect(store.players.get(`${SIERRA_CLARA.id}/O1`)!.name).toBe("Izan Marea (editado)");
  });

  it("solo el restablecimiento deliberado sobrescribe ediciones", async () => {
    const store = new InMemorySeedStore();
    await seedLabRoster(store, LAB_ROSTER_FIXTURE, false);
    store.players.set(`${SIERRA_CLARA.id}/O1`, { ...structuredClone(SIERRA_CLARA.players[0]!), name: "editado" });
    const reset = await seedLabRoster(store, LAB_ROSTER_FIXTURE, true);
    expect(reset.overwritten).toBe(24);
    expect(store.players.get(`${SIERRA_CLARA.id}/O1`)!.name).toBe("Izan Marea");
  });

  it("doce perfiles escritos a mano por equipo, con roles declarados y medidas coherentes con ellos", () => {
    for (const team of LAB_ROSTER_FIXTURE) {
      expect(team.players).toHaveLength(12);
      const roles = team.players.map((p) => LAB_DECLARED_ROLES[p.id]!);
      for (const r of roles) expect(r.length === 1 || r.length === 2).toBe(true);
      const bench = team.players.slice(5);
      // Relevo de base, dos exteriores, dos alas y dos interiores (§4).
      expect(bench.filter((p) => LAB_DECLARED_ROLES[p.id]!.includes(1))).toHaveLength(1);
      expect(bench.filter((p) => LAB_DECLARED_ROLES[p.id]!.includes(5))).toHaveLength(2);
      for (const p of team.players) {
        const declared = LAB_DECLARED_ROLES[p.id]!;
        // Ningún interior declarado bajo ni ningún base declarado gigante por defecto.
        if (declared.includes(5)) expect(p.measures.heightCm).toBeGreaterThanOrEqual(205);
        if (declared.includes(1)) expect(p.measures.heightCm).toBeLessThanOrEqual(192);
        expect(checkPlayerCoherence(p)).toEqual([]);
      }
    }
  });
});
