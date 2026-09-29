import { describe, expect, it } from "vitest";
import { playLabGame } from "./play-lab-game";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../../domain/players/lab-roster-fixture";

describe("playLabGame (caso de uso de ME-04)", () => {
  it("devuelve una vista reproducible con el acta conciliada", async () => {
    const args = {
      seed: 82,
      home: { ...SIERRA_CLARA, priority: "proteger_balance" as const, coverage: "drop" as const },
      away: { ...PUERTO_AMBAR, priority: "proteger_balance" as const, coverage: "drop" as const },
    };
    const a = await playLabGame(args);
    const b = await playLabGame(args);
    expect(a.status).toBe("played");
    if (a.status !== "played" || b.status !== "played") return;
    expect(a.game.gameId).toBe(b.game.gameId);
    expect(a.game.finalScore).toEqual(b.game.finalScore);
    expect(a.game.reconciliation.every((c) => c.ok)).toBe(true);
    // ME-04A: `responsibilities` viaja a la vista (aunque el visor del
    // partido no la muestre) porque la exportación de auditoría la necesita
    // para `continuity`, sin volver a jugar el partido.
    expect("responsibilities" in a.game).toBe(true);
    expect(a.game.audit).toBeUndefined();
  });

  it("un quinteto incompleto se traduce en un error comprensible, sin excepción", async () => {
    const result = await playLabGame({
      seed: 1,
      home: { ...SIERRA_CLARA, players: SIERRA_CLARA.players.slice(1), priority: "proteger_balance", coverage: "drop" },
      away: { ...PUERTO_AMBAR, priority: "proteger_balance", coverage: "drop" },
    });
    expect(result).toEqual({ status: "error", message: expect.stringContaining("Falta el titular O1") });
  });
});
