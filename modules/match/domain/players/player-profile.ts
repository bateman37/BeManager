import {
  ACTIVE_ATTRIBUTE_IDS,
  type ActiveAttributeId,
  type Rating,
  isValidRating,
} from "./attribute";

/** Plantilla base de arquetipo (prompt §2): base (G), exterior/alero (W), interior (B). */
export type PlayerTemplate = "G" | "W" | "B";

export type PnrTendency = "priorizar_primera_opcion" | "explorar_segunda_opcion";

/**
 * Tendencia individual de tiro (ME-07A §2.2): disposición del jugador a
 * tomar un tiro viable frente a conservar/pasar cuando varias vías compiten
 * dentro de la banda de empate `FIRST_READ_TIE_BAND_POINTS` (LAB-0.3). Es
 * ortogonal a T04/T01 (habilidad para convertirlo) y a `pnrTendency`, que
 * conserva su papel específico en la primera lectura del bloqueo directo
 * (ME-07A §2 nota final). No introduce otra escala oculta de personalidad.
 */
export type ShotTendency = "prudente" | "equilibrada" | "decidida";

export interface BodyMeasures {
  /** C01: altura, cm. */
  readonly heightCm: number;
  /** C02: peso, kg. */
  readonly weightKg: number;
  /** C03: envergadura, cm. */
  readonly wingspanCm: number;
  /** C04: alcance de pie, cm. */
  readonly standingReachCm: number;
}

export type AttributeRatings = Readonly<Record<ActiveAttributeId, Rating>>;

export interface PlayerProfile {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly positionLabel: string;
  readonly template: PlayerTemplate;
  readonly measures: BodyMeasures;
  readonly attributes: AttributeRatings;
  readonly pnrTendency: PnrTendency;
  readonly shotTendency: ShotTendency;
}

/**
 * Valores base por plantilla (prompt §2, tablas de plantilla G/W/B). Sirven
 * de punto de partida; cada jugador aplica después sus overrides.
 */
export const TEMPLATE_BASE_RATINGS: Record<PlayerTemplate, Partial<AttributeRatings>> = {
  G: {
    T01: 8,
    T02: 8,
    T03: 8,
    T04: 9,
    T05: 10,
    T06: 10,
    T07: 12,
    T09: 12,
    T11: 10,
    T13: 5,
    T21: 8,
    T15: 8,
    T16: 8,
    T17: 8,
    T18: 3,
    T19: 5,
    T20: 6,
    T22: 9,
    T23: 4,
    M01: 11,
    M03: 10,
    M04: 10,
    M05: 9,
    F01: 11,
    F03: 10,
    F04: 10,
    F05: 6,
    F06: 6,
    M09: 10,
  },
  W: {
    T01: 9,
    T02: 8,
    T03: 8,
    T04: 10,
    T05: 9,
    T06: 9,
    T07: 8,
    T09: 8,
    T11: 10,
    T13: 7,
    T21: 10,
    T15: 9,
    T16: 9,
    T17: 8,
    T18: 6,
    T19: 8,
    T20: 8,
    T22: 10,
    T23: 7,
    M01: 9,
    M03: 9,
    M04: 9,
    M05: 10,
    F01: 10,
    F03: 9,
    F04: 8,
    F05: 8,
    F06: 9,
    M09: 9,
  },
  B: {
    T01: 11,
    T02: 8,
    T03: 8,
    T04: 5,
    T05: 8,
    T06: 6,
    T07: 5,
    T09: 7,
    T11: 9,
    T13: 12,
    T21: 7,
    T15: 8,
    T16: 6,
    T17: 5,
    T18: 11,
    T19: 11,
    T20: 11,
    T22: 6,
    T23: 12,
    M01: 8,
    M03: 8,
    M04: 10,
    M05: 9,
    F01: 7,
    F03: 7,
    F04: 6,
    F05: 12,
    F06: 10,
    M09: 9,
  },
};

/**
 * Valor neutro de M09 (Comunicación) para un perfil ya persistido antes de
 * ME-02 que todavía no lo tiene guardado (ME-02 §3). Es explícito y
 * visible en ficha; no borra ni recalcula las otras 26 capacidades, y deja
 * de aplicarse en cuanto el usuario edita y guarda el perfil con su propio
 * valor de M09.
 */
export const M09_BACKFILL_NEUTRAL_RATING = 8;

/**
 * Capacidades activadas después de que existieran perfiles persistidos y su
 * valor neutro explícito de relleno (ME-02 §3 para M09; ME-07B v2 §6 para
 * T02/T03). Solo se aplica cuando el perfil guardado no tiene la capacidad;
 * nunca borra ni recalcula ediciones existentes, y deja de aplicarse en
 * cuanto el usuario guarda su propio valor.
 */
export const NEUTRAL_BACKFILL_RATINGS: Readonly<Partial<Record<ActiveAttributeId, Rating>>> = {
  M09: M09_BACKFILL_NEUTRAL_RATING,
  T02: 8,
  T03: 8,
};

/**
 * Valor explícito para un perfil ya persistido antes de ME-07A que todavía
 * no tiene `shotTendency` guardada (mismo patrón que
 * `M09_BACKFILL_NEUTRAL_RATING`, ME-02 §3): se rellena con `"equilibrada"`
 * en vez de fallar, sin borrar atributos ni ediciones existentes. Deja de
 * aplicarse en cuanto el usuario edita y guarda el perfil con su propia
 * tendencia. El reset al fixture y el incremento masivo (+1/+3/+5) nunca
 * alteran esta tendencia.
 */
export const SHOT_TENDENCY_BACKFILL_DEFAULT: ShotTendency = "equilibrada";

/**
 * Construye las capacidades de un perfil aplicando la plantilla base y los
 * overrides explícitos del prompt (§2). Falla si falta alguna de las 26
 * capacidades activas originales tras aplicar la plantilla y los
 * overrides: no se permite rellenar con un valor oculto por defecto.
 *
 * Excepción explícita y documentada (ME-02 §3): M09 (Comunicación) es la
 * única capacidad activa que, si falta tras plantilla + overrides, se
 * rellena con el valor neutro `M09_BACKFILL_NEUTRAL_RATING` (8) en vez de
 * fallar, para no romper perfiles ya persistidos guardados antes de ME-02.
 * El resto de capacidades sigue exigiendo un valor explícito.
 */
export function buildAttributeRatings(
  template: PlayerTemplate,
  overrides: Partial<AttributeRatings>,
): AttributeRatings {
  const base = TEMPLATE_BASE_RATINGS[template];
  const result: { -readonly [K in ActiveAttributeId]?: Rating } = { ...base, ...overrides };

  for (const id of ACTIVE_ATTRIBUTE_IDS) {
    const value = result[id];
    if (value === undefined || !isValidRating(value)) {
      const neutral = NEUTRAL_BACKFILL_RATINGS[id];
      if (neutral !== undefined) {
        result[id] = neutral;
        continue;
      }
      throw new RangeError(
        `Falta o es inválida la capacidad activa ${id} (plantilla ${template})`,
      );
    }
  }

  return result as AttributeRatings;
}
