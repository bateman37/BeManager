/**
 * Las 26 capacidades activas de ME-01 (prompt §2): 9 ofensivas,
 * 8 defensivas/rebote, 4 mentales y 5 físicas. El catálogo completo tiene
 * 45 candidatas (ver docs/match/reference/BeManager-capitulo-atributos-y-motor-v2.md
 * §2.2–2.4); solo estas 26 tienen mecanismo implementado en ME-01.
 */
export const OFFENSIVE_ATTRIBUTE_IDS = [
  "T01",
  "T02",
  "T03",
  "T04",
  "T05",
  "T06",
  "T07",
  "T09",
  "T11",
  "T13",
  "T21",
] as const;

export const DEFENSIVE_ATTRIBUTE_IDS = [
  "T15",
  "T16",
  "T17",
  "T18",
  "T19",
  "T20",
  "T22",
  "T23",
] as const;

/**
 * M09 (Comunicación) se añade en ME-02 §3: latencia de coordinación entre
 * un aviso defensivo reconocido y la respuesta de otro defensor (trampa,
 * rotaciones). Perfiles ya persistidos que carezcan de M09 reciben el
 * valor neutro 8 de forma explícita hasta que el usuario lo edite y
 * guarde (ver `buildAttributeRatings`); no se borran ni se restauran las
 * otras 26 capacidades por su ausencia.
 */
/**
 * ME-07B v2 §6/§2.4: T02 (floater) y T03 (tiro medio) pasan de candidatas a
 * activas con tarea propia y localizada: el toque intermedio por encima de la
 * primera contención y el tiro de dos fuera del aro, ambos 2FGA con zona,
 * preparación y oposición propias (`lab-0-5-parameters.ts`). Un perfil
 * persistido sin ellas recibe el valor neutro 8 (mismo patrón que M09).
 *
 * ME-07B v2 §2.5/§6: M07 (Disciplina) pasa a activa con una tarea
 * localizada: el riesgo de que un contacto defensivo real (cierre legal con
 * solape corporal, trampa cerrada, rebote por encima de la espalda) sea
 * falta (`lab-0-6-parameters.ts`). Relleno neutro 8.
 */
export const MENTAL_ATTRIBUTE_IDS = ["M01", "M03", "M04", "M05", "M07", "M09"] as const;

export const PHYSICAL_ATTRIBUTE_IDS = ["F01", "F03", "F04", "F05", "F06"] as const;

export const ACTIVE_ATTRIBUTE_IDS = [
  ...OFFENSIVE_ATTRIBUTE_IDS,
  ...DEFENSIVE_ATTRIBUTE_IDS,
  ...MENTAL_ATTRIBUTE_IDS,
  ...PHYSICAL_ATTRIBUTE_IDS,
] as const;

export type ActiveAttributeId = (typeof ACTIVE_ATTRIBUTE_IDS)[number];

export const ATTRIBUTE_LABELS: Record<ActiveAttributeId, string> = {
  T01: "Finalización",
  T02: "Floater",
  T03: "Tiro medio",
  T04: "Triple",
  T05: "Tiro libre",
  T06: "Tiro móvil",
  T07: "Manejo",
  T09: "Precisión pase",
  T11: "Recepción",
  T13: "Bloqueos",
  T21: "Desmarque",
  T15: "Contención",
  T16: "Navegación",
  T17: "Robo",
  T18: "Tapón",
  T19: "Cierre rebote",
  T20: "Captura rebote",
  T22: "Defensa perimetral",
  T23: "Defensa interior",
  M01: "Visión",
  M03: "Decisiones",
  M04: "Temporización",
  M05: "Espacios",
  M07: "Disciplina",
  M09: "Comunicación",
  F01: "Aceleración",
  F03: "Frenada",
  F04: "Agilidad lateral",
  F05: "Fuerza",
  F06: "Salto",
};

export const RATING_MIN = 1;
export const RATING_MAX = 15;

export type Rating = number; // entero 1..15

/** Grados de referencia: d(X) = rating(X) - 8, rango -7..+7 (prompt §3). */
export function d(rating: Rating): number {
  return rating - 8;
}

const LETTER_GRADES = [
  "E-",
  "E",
  "E+",
  "D-",
  "D",
  "D+",
  "C-",
  "C",
  "C+",
  "B-",
  "B",
  "B+",
  "A-",
  "A",
  "A+",
] as const;

/** Convierte 1–15 a la notación de ficha E− … A+ (prompt §2.1 del capítulo de atributos). */
export function ratingToLetterGrade(rating: Rating): string {
  if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    throw new RangeError(`Rating fuera de rango 1-15: ${rating}`);
  }
  return LETTER_GRADES[rating - 1] as string;
}

export function isValidRating(value: number): value is Rating {
  return Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX;
}
