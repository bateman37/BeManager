import { buildAttributeRatings } from "./player-profile";
import type { PlayerProfile } from "./player-profile";

/**
 * Perfiles de laboratorio escritos a mano. Fixture del repositorio: no se
 * genera nada al azar. Sirve de semilla de base de datos y de datos de
 * prueba automatizada.
 *
 * - Los diez perfiles de ME-01 (§2) son los cinco primeros de cada equipo:
 *   titulares iniciales del partido de ME-04, con sus IDs históricos
 *   («O1»…«D5» no son posiciones universales ni el bando atacante).
 * - ME-04 §4 añade siete suplentes concretos por equipo (IDs `SC06`–`SC12`
 *   y `PA06`–`PA12`): relevo de base, dos exteriores, dos alas y dos
 *   interiores, con medidas y capacidades compatibles con sus funciones y
 *   fortalezas/debilidades repartidas. No es el generador de ME-07.
 *   Sus roles funcionales declarados viven en `functional-roles.ts`.
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
    // --- Suplentes (ME-04 §4) ---------------------------------------------
    {
      // Relevo de base: bajo y rápido, buen pase y manejo; poco peso en la pintura.
      id: "SC06",
      name: "Mateo Arcos",
      age: 24,
      positionLabel: "Base / G",
      template: "G",
      measures: { heightCm: 184, weightKg: 80, wingspanCm: 190, standingReachCm: 241 },
      attributes: buildAttributeRatings("G", { T09: 12, T07: 12, F01: 12, M01: 11, T04: 8, T22: 8, T18: 2 }),
      pnrTendency: "explorar_segunda_opcion",
    },
    {
      // Exterior tirador: buen triple y libres, defensa exterior floja.
      id: "SC07",
      name: "Iker Salas",
      age: 26,
      positionLabel: "Escolta / W",
      template: "W",
      measures: { heightCm: 193, weightKg: 86, wingspanCm: 199, standingReachCm: 252 },
      attributes: buildAttributeRatings("W", { T04: 12, T05: 12, T07: 9, T22: 7, F04: 8 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      // Exterior defensivo: largo y con pies, tiro exterior irregular.
      id: "SC08",
      name: "Gael Montero",
      age: 23,
      positionLabel: "Escolta-alero / W",
      template: "W",
      measures: { heightCm: 197, weightKg: 90, wingspanCm: 206, standingReachCm: 258 },
      attributes: buildAttributeRatings("W", { T22: 11, T15: 10, F04: 10, F03: 10, T04: 8 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      // Ala anotador cerca del aro y cortador; lento lateralmente.
      id: "SC09",
      name: "Hugo Ferrán",
      age: 29,
      positionLabel: "Alero / W",
      template: "W",
      measures: { heightCm: 200, weightKg: 97, wingspanCm: 205, standingReachCm: 262 },
      attributes: buildAttributeRatings("W", { T01: 11, T21: 11, T04: 9, F01: 9, F04: 7 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      // Ala grande: rebote y defensa interior aceptables, abre algo el campo.
      id: "SC10",
      name: "Joel Brandt",
      age: 27,
      positionLabel: "Alero-ala-pívot / W",
      template: "W",
      measures: { heightCm: 203, weightKg: 101, wingspanCm: 212, standingReachCm: 268 },
      attributes: buildAttributeRatings("W", { T19: 10, T23: 9, T04: 10, F05: 10, T09: 7 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      // Interior que tira desde fuera a ratos; buen bloqueador, poca velocidad.
      id: "SC11",
      name: "Sergi Olabe",
      age: 31,
      positionLabel: "Ala-pívot-pívot / B",
      template: "B",
      measures: { heightCm: 207, weightKg: 108, wingspanCm: 214, standingReachCm: 274 },
      attributes: buildAttributeRatings("B", { T04: 8, T13: 11, T20: 10, F06: 9, T18: 9, F01: 8 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      // Pívot joven: taponador y reboteador, malo en libres y lento de pies.
      id: "SC12",
      name: "Álvaro Resa",
      age: 22,
      positionLabel: "Pívot / B",
      template: "B",
      measures: { heightCm: 213, weightKg: 117, wingspanCm: 224, standingReachCm: 285 },
      attributes: buildAttributeRatings("B", { T18: 12, T20: 12, T01: 10, T05: 6, F04: 5, M01: 7 }),
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
      attributes: buildAttributeRatings("G", { T22: 12, T16: 12, T15: 11, M09: 12 }),
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
      attributes: buildAttributeRatings("W", { M05: 11, T18: 8, F01: 11, M09: 11 }),
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
        M09: 11,
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
      attributes: buildAttributeRatings("B", { T23: 13, T18: 12, F06: 11, T04: 4, M09: 10 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    // --- Suplentes (ME-04 §4) ---------------------------------------------
    {
      // Relevo de base organizador: gran pase y defensa sobre el balón, no tira de fuera.
      id: "PA06",
      name: "Teo Vidal",
      age: 29,
      positionLabel: "Base / G",
      template: "G",
      measures: { heightCm: 182, weightKg: 78, wingspanCm: 186, standingReachCm: 237 },
      attributes: buildAttributeRatings("G", { T09: 13, M03: 12, T15: 10, T22: 11, F01: 12, T04: 7 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      // Exterior anotador tras bote; persigue mal los bloqueos.
      id: "PA07",
      name: "Nil Estrada",
      age: 25,
      positionLabel: "Escolta / W",
      template: "W",
      measures: { heightCm: 191, weightKg: 84, wingspanCm: 197, standingReachCm: 249 },
      attributes: buildAttributeRatings("W", { T04: 11, T06: 11, T07: 10, T16: 7 }),
      pnrTendency: "explorar_segunda_opcion",
    },
    {
      // Exterior de líneas de pase: rápido y largo, tiro exterior pobre.
      id: "PA08",
      name: "Yeray Costa",
      age: 24,
      positionLabel: "Escolta-alero / W",
      template: "W",
      measures: { heightCm: 198, weightKg: 92, wingspanCm: 208, standingReachCm: 260 },
      attributes: buildAttributeRatings("W", { T17: 11, T15: 11, F01: 11, T04: 7 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      // Ala tirador veterano: fiable desde fuera y en libres, lento de pies.
      id: "PA09",
      name: "Marc Oriol",
      age: 30,
      positionLabel: "Alero / W",
      template: "W",
      measures: { heightCm: 201, weightKg: 98, wingspanCm: 207, standingReachCm: 264 },
      attributes: buildAttributeRatings("W", { T04: 11, T05: 11, M05: 11, F01: 8, F04: 7 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      // Ala grande defensivo y saltador; pasa poco.
      id: "PA10",
      name: "Aitor Lenz",
      age: 26,
      positionLabel: "Alero-ala-pívot / W",
      template: "W",
      measures: { heightCm: 204, weightKg: 102, wingspanCm: 213, standingReachCm: 270 },
      attributes: buildAttributeRatings("W", { T22: 10, T23: 10, T19: 10, F06: 10, T09: 7 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      // Interior físico: rebote y bloqueo, sin tiro exterior.
      id: "PA11",
      name: "Rubén Castell",
      age: 28,
      positionLabel: "Ala-pívot-pívot / B",
      template: "B",
      measures: { heightCm: 208, weightKg: 109, wingspanCm: 217, standingReachCm: 276 },
      attributes: buildAttributeRatings("B", { T19: 12, F05: 12, T13: 12, T04: 4, T01: 10 }),
      pnrTendency: "priorizar_primera_opcion",
    },
    {
      // Pívot veterano de posición: protege el aro y comunica, muy lento.
      id: "PA12",
      name: "Dani Pardo",
      age: 33,
      positionLabel: "Pívot / B",
      template: "B",
      measures: { heightCm: 211, weightKg: 115, wingspanCm: 220, standingReachCm: 281 },
      attributes: buildAttributeRatings("B", { T23: 12, M01: 10, T18: 10, F01: 6, F04: 5, M09: 11 }),
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

/**
 * Titulares iniciales del laboratorio (ME-04 §4): los cinco perfiles
 * originales de cada equipo, en orden de rol funcional 1–5. Son también
 * el único quinteto del tramo de ME-03.
 */
export const LAB_STARTER_IDS: Readonly<Record<string, readonly [string, string, string, string, string]>> = {
  [SIERRA_CLARA_TEAM_ID]: ["O1", "O2", "O3", "O4", "O5"],
  [PUERTO_AMBAR_TEAM_ID]: ["D1", "D2", "D3", "D4", "D5"],
};
