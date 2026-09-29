/**
 * Roles funcionales de un quinteto de laboratorio (ME-04 §4): `1 base /
 * 2 escolta / 3 alero / 4 ala-pívot / 5 interior`. Un quinteto legal del
 * laboratorio cubre los cinco. Cada jugador aporta **uno o dos roles
 * declarados** en su ficha de fixture; no se deducen de la altura ni de
 * la plantilla G/W/B (ser alto no implica saber manejar, ni al revés).
 *
 * Un perfil sin roles declarados (por ejemplo, una copia creada desde el
 * editor) queda inscrito, pero la rotación automática nunca lo hace entrar
 * hasta que ME-05/ME-07 permitan declarar roles desde la interfaz.
 */
export type FunctionalRole = 1 | 2 | 3 | 4 | 5;

export const FUNCTIONAL_ROLES: readonly FunctionalRole[] = [1, 2, 3, 4, 5];

export const FUNCTIONAL_ROLE_LABELS: Readonly<Record<FunctionalRole, string>> = {
  1: "base",
  2: "escolta",
  3: "alero",
  4: "ala-pívot",
  5: "interior",
};

/** Roles declarados del fixture de laboratorio: titulares (su rol) y los 14 suplentes de ME-04. */
export const LAB_DECLARED_ROLES: Readonly<Record<string, readonly FunctionalRole[]>> = {
  // Sierra Clara
  O1: [1],
  O2: [2],
  O3: [3],
  O4: [4],
  O5: [5],
  SC06: [1, 2],
  SC07: [2],
  SC08: [2, 3],
  SC09: [3],
  SC10: [3, 4],
  SC11: [4, 5],
  SC12: [5],
  // Puerto Ámbar
  D1: [1],
  D2: [2],
  D3: [3],
  D4: [4],
  D5: [5],
  PA06: [1, 2],
  PA07: [2],
  PA08: [2, 3],
  PA09: [3],
  PA10: [3, 4],
  PA11: [4, 5],
  PA12: [5],
};
