import { buildAttributeRatings } from "./player-profile";
import type { PlayerProfile } from "./player-profile";

/**
 * Los diez perfiles de laboratorio del prompt ME-01 (§2), escritos a mano.
 * Fixture del repositorio: no se genera nada al azar. Sirve de semilla de
 * base de datos y de datos de prueba automatizada.
 */

export const SIERRA_CLARA_TEAM_ID = "sierra-clara";
export const PUERTO_AMBAR_TEAM_ID = "puerto-ambar";

export interface LabTeamFixture {
  readonly id: string;
  readonly name: string;
  readonly players: readonly PlayerProfile[];
}

export const SIERRA_CLARA: LabTeamFixture = {
  id: SIERRA_CLARA_TEAM_ID,
  name: "Sierra Clara",
  players: [
    {
      id: "O1",
      name: "Izan Marea",
      age: 27,
      positionLabel: "Base / G",
      template: "G",
      measures: { heightCm: 189, weightKg: 85, wingspanCm: 195, standingReachCm: 248 },
      attributes: buildAttributeRatings("G", { T09: 13, M01: 12, T06: 11 }),
      pnrTendency: "explorar_segunda_opcion",
    },
    {
      id: "O2",
      name: "Darío Soler",
      age: 25,
      positionLabel: "Escolta / W",
      template: "W",
      measures: { heightCm: 195, weightKg: 87, wingspanCm: 202, standingReachCm: 255 },
      attributes: buildAttributeRatings("W", { T04: 13, T11: 12, T22: 8 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      id: "O3",
      name: "Adriel Varo",
      age: 28,
      positionLabel: "Alero / W",
      template: "W",
      measures: { heightCm: 201, weightKg: 96, wingspanCm: 209, standingReachCm: 263 },
      attributes: buildAttributeRatings("W", { T21: 12, M05: 12, T01: 11 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      id: "O4",
      name: "Bruno Nemec",
      age: 30,
      positionLabel: "Ala-pívot / W",
      template: "W",
      measures: { heightCm: 205, weightKg: 103, wingspanCm: 214, standingReachCm: 271 },
      attributes: buildAttributeRatings("W", {
        T04: 11,
        T13: 10,
        T19: 10,
        F05: 10,
        T23: 9,
      }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      id: "O5",
      name: "León Uria",
      age: 29,
      positionLabel: "Pívot / B",
      template: "B",
      measures: { heightCm: 211, weightKg: 113, wingspanCm: 223, standingReachCm: 282 },
      attributes: buildAttributeRatings("B", { T13: 13, T01: 12, T20: 12, F05: 13 }),
      pnrTendency: "priorizar_primera_opcion",
    },
  ],
};

export const PUERTO_AMBAR: LabTeamFixture = {
  id: PUERTO_AMBAR_TEAM_ID,
  name: "Puerto Ámbar",
  players: [
    {
      id: "D1",
      name: "Omar Celis",
      age: 26,
      positionLabel: "Base / G",
      template: "G",
      measures: { heightCm: 188, weightKg: 83, wingspanCm: 194, standingReachCm: 246 },
      attributes: buildAttributeRatings("G", { T22: 12, T16: 12, T15: 11 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      id: "D2",
      name: "René Lasko",
      age: 27,
      positionLabel: "Escolta / W",
      template: "W",
      measures: { heightCm: 194, weightKg: 89, wingspanCm: 202, standingReachCm: 254 },
      attributes: buildAttributeRatings("W", { T22: 11, T17: 10, T04: 9 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      id: "D3",
      name: "Elian Feliu",
      age: 25,
      positionLabel: "Alero / W",
      template: "W",
      measures: { heightCm: 200, weightKg: 95, wingspanCm: 210, standingReachCm: 265 },
      attributes: buildAttributeRatings("W", { M05: 11, T18: 8, F01: 11 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      id: "D4",
      name: "Tarek Vela",
      age: 31,
      positionLabel: "Ala-pívot / W",
      template: "W",
      measures: { heightCm: 206, weightKg: 105, wingspanCm: 216, standingReachCm: 273 },
      attributes: buildAttributeRatings("W", {
        T23: 11,
        M05: 12,
        T19: 11,
        T04: 7,
      }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      id: "D5",
      name: "Niko Baran",
      age: 32,
      positionLabel: "Pívot / B",
      template: "B",
      measures: { heightCm: 210, weightKg: 111, wingspanCm: 222, standingReachCm: 280 },
      attributes: buildAttributeRatings("B", { T23: 13, T18: 12, F06: 11, T04: 4 }),
      pnrTendency: "priorizar_primera_opcion",
    },
  ],
};

export const LAB_ROSTER_FIXTURE: readonly LabTeamFixture[] = [SIERRA_CLARA, PUERTO_AMBAR];

export function findFixturePlayer(playerId: string): PlayerProfile {
  for (const team of LAB_ROSTER_FIXTURE) {
    const player = team.players.find((p) => p.id === playerId);
    if (player) return player;
  }
  throw new Error(`Jugador de fixture no encontrado: ${playerId}`);
}
