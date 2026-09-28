/**
 * Ámbito de faltas de ME-01 (prompt §2): solo contacto defensivo ordinario
 * sancionable en acto de tiro. Se decide por hecho de contacto y
 * posición/legalidad, una vez por interacción; no como una probabilidad
 * repartida en cada actualización temporal (estudio §5.6, §9.6).
 */
export type CloseoutLegality = "legal_contest" | "no_contest" | "late_illegal_contact";

/**
 * `arrivalMarginSeconds` = instante de llegada del cierre − instante de
 * liberación del tiro. Negativo: el defensor llega antes de soltar.
 * `brakingExtraSeconds` es el tiempo extra de frenada del defensor
 * (`closeoutBrakingExtraSeconds`): si el margen no le deja frenar a tiempo,
 * el contacto es inevitable y se adjudica como falta ordinaria de tiro.
 */
export function evaluateCloseoutLegality(
  arrivalMarginSeconds: number,
  brakingExtraSeconds: number,
): CloseoutLegality {
  if (arrivalMarginSeconds >= 0) return "no_contest";
  if (arrivalMarginSeconds <= -brakingExtraSeconds) return "legal_contest";
  return "late_illegal_contact";
}

export interface FreeThrowAward {
  readonly count: number;
  readonly basketCounted: boolean;
}

/**
 * Canasta válida con falta → un libre adicional; tiro fallado de dos o tres
 * → los libres que procedan; último libre fallado vivo se resuelve como
 * rebote disputado aparte (prompt §2).
 */
export function awardFreeThrowsForShootingFoul(
  shotType: "close_finish" | "three_point",
  madeShot: boolean,
): FreeThrowAward {
  if (madeShot) {
    return { count: 1, basketCounted: true };
  }
  return { count: shotType === "three_point" ? 3 : 2, basketCounted: false };
}
