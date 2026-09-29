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

/**
 * Contacto al contener o cerrar el paso de un atacante en movimiento (ME-04
 * §3, «vía ordinaria sin tiro»), antes de que empiece ningún gesto de tiro.
 * Se decide una vez, por hechos geométricos, con la misma idea de frenada
 * que el cierre (`evaluateCloseoutLegality`): el defensor tiene posición
 * legal si ya había llegado **y frenado** (llegada + frenada F03) antes del
 * primer contacto corporal. Si el atacante ya estaba parado cuando llega el
 * defensor, es contención legal (el defensor frena delante de él). Sin
 * solape corporal no hay contacto. No hay cuota aleatoria de faltas.
 */
export type ContainmentLegality = "sin_contacto" | "contencion_legal" | "contacto_ilegal";

export interface ContainmentContactFacts {
  /** Primer instante de solape corporal (s), o `null` si no se solapan. */
  readonly contactSeconds: number | null;
  /** El atacante seguía desplazándose en el instante de contacto. */
  readonly attackerMoving: boolean;
  /** Instante en que el defensor llega a su punto de contención (s). */
  readonly defenderArrivalSeconds: number;
  /** Tiempo extra de frenada del defensor (`closeoutBrakingExtraSeconds(F03)`). */
  readonly brakingExtraSeconds: number;
}

export function evaluateContainmentContact(facts: ContainmentContactFacts): ContainmentLegality {
  if (facts.contactSeconds === null) return "sin_contacto";
  if (!facts.attackerMoving) return "contencion_legal";
  const defenderSetSeconds = facts.defenderArrivalSeconds + facts.brakingExtraSeconds;
  return defenderSetSeconds <= facts.contactSeconds ? "contencion_legal" : "contacto_ilegal";
}
