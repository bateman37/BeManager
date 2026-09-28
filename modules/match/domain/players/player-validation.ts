import type { PlayerProfile } from "./player-profile";

/**
 * Avisos de coherencia (prompt §2): informan, no bloquean. El editor nunca
 * corrige una medida o rating a escondidas; el usuario puede guardar una
 * excepción deliberada.
 */
export interface CoherenceWarning {
  readonly code:
    | "pivot_bajo"
    | "base_sin_pase"
    | "alcance_menor_que_altura"
    | "envergadura_atipica"
    | "peso_atipico";
  readonly message: string;
}

export function checkPlayerCoherence(profile: PlayerProfile): CoherenceWarning[] {
  const warnings: CoherenceWarning[] = [];
  const { measures, positionLabel, attributes } = profile;
  const isNominalPivot = /pívot/i.test(positionLabel);
  const isNominalBase = /base/i.test(positionLabel);

  if (isNominalPivot && measures.heightCm < 195) {
    warnings.push({
      code: "pivot_bajo",
      message: `Pívot nominal con altura ${measures.heightCm} cm, por debajo de 195 cm.`,
    });
  }

  if (isNominalBase && attributes.T09 <= 5) {
    warnings.push({
      code: "base_sin_pase",
      message: `Base nominal con precisión de pase T09=${attributes.T09} (≤5).`,
    });
  }

  if (measures.standingReachCm < measures.heightCm) {
    warnings.push({
      code: "alcance_menor_que_altura",
      message: `Alcance de pie (${measures.standingReachCm} cm) menor que la altura (${measures.heightCm} cm).`,
    });
  }

  const minWingspan = measures.heightCm - 10;
  const maxWingspan = measures.heightCm + 35;
  if (measures.wingspanCm < minWingspan || measures.wingspanCm > maxWingspan) {
    warnings.push({
      code: "envergadura_atipica",
      message: `Envergadura ${measures.wingspanCm} cm fuera del rango típico [${minWingspan}, ${maxWingspan}] para ${measures.heightCm} cm de altura.`,
    });
  }

  if (measures.weightKg < 60 || measures.weightKg > 150) {
    warnings.push({
      code: "peso_atipico",
      message: `Peso ${measures.weightKg} kg fuera del rango adulto típico [60, 150].`,
    });
  }

  return warnings;
}
