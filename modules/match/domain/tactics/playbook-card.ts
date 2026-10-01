/**
 * Ficha de libro (ME-07B v2 §3): la unidad que une **fase/condición,
 * colocación, roles y sustitutos, primera acción, variantes, lecturas
 * permitidas, seguridad/reinicio y prioridad** de una acción del ataque. Es
 * dato puro: el motor la consulta para saber qué colocaciones puede ofrecer
 * al organizar (`assignOrganizedRoles`), qué primera acción ejecuta el
 * núcleo y qué lecturas son legítimas dentro de ella (comprobado por
 * `playbook-card.test.ts` y por las pruebas de partido completo); la
 * ejecución sigue siendo la de las primitivas compartidas (llegada,
 * pantalla, pase, lectura frente al mejor cierre real, salida segura), sin
 * guiones ni movimiento instantáneo.
 *
 * Fichas: las tres acciones organizadas de partida y **Horns→bloqueo**
 * (LAB-0.8, primera ficha del «libro por fase» de §4). 1-4 alto, Delay,
 * Spain, drag, saques… siguen pendientes (ver
 * `docs/match/TACTICAL-MATRIX.md`); se añaden aquí como fichas nuevas cuando
 * tengan su mecanismo. Dos fichas con la misma primitiva solo existen si
 * difieren en orden, espacio, responsabilidad o lectura (la central y la
 * lateral difieren en espacio y en las coberturas aplicables: el ICE; Horns
 * difiere de la central en espacio —dos interiores en los codos, esquinas
 * llenas— y en responsabilidad: ayuda al roll el defensor del segundo
 * cuerno, que deja un tiro medio en el codo, no un triple de esquina).
 */
import type { AuditDecisionPoint } from "../audit/audit-types";
import type { OffensivePlan, OffensivePlanChoice } from "../lab/match-input";
import type { ScreenPlacement, ScreenPlacementChoice } from "../lab/lab-0-7-parameters";

export type PlaybookCardId = "bloqueo_directo_central" | "mano_a_mano_central" | "bloqueo_directo_lateral" | "horns_bloqueo";

/** Fase del libro en que la ficha puede llamarse. Solo el ataque organizado tiene fichas hoy. */
export type PlaybookPhase = "ataque_organizado";

export interface PlaybookCard {
  readonly id: PlaybookCardId;
  readonly label: string;
  readonly phase: PlaybookPhase;
  /** Condición de entrada: planes del entrenador que la permiten. */
  readonly allowedPlans: readonly OffensivePlanChoice[];
  /** Colocación (disposición de los diez al situarse). */
  readonly placement: ScreenPlacement;
  /**
   * Función de cada rol canónico del árbol en esta colocación (espacio y
   * responsabilidad): quién bloquea, quién queda libre si su defensor ayuda
   * al roll (O3) y quién si repara el siguiente (O4).
   */
  readonly structure: Readonly<Record<"O1" | "O2" | "O3" | "O4" | "O5", string>>;
  /**
   * Roles canónicos de la ficha y sus sustitutos al organizar (§2.4): el
   * creador puede ser el O1 vigente o el poseedor real; el bloqueador, O5 u
   * O4. Se elige por proyección en seco, nunca por nombre.
   */
  readonly roles: {
    readonly creator: { readonly role: "O1"; readonly substitutes: readonly ("poseedor_real")[] };
    readonly screener: { readonly role: "O5"; readonly substitutes: readonly ("O4")[] };
  };
  /** Primera acción: la familia que ejecuta el núcleo. */
  readonly firstAction: OffensivePlan;
  /** Variantes que la ficha puede encadenar (hoy: la segunda entrada del bloqueo). */
  readonly variants: readonly ("segunda_entrada")[];
  /** Puntos de lectura legítimos dentro de la ficha (manejador, receptor, defensa que lee). */
  readonly reads: readonly AuditDecisionPoint[];
  /** Seguridad/reinicio: si nada vale más, salida segura y reorganización con el control. */
  readonly safety: "salida_segura_y_reorganizar";
  /** Prioridad para el empate exacto de valor (menor = preferida); la central es el plan base. */
  readonly priority: number;
}

/** Lecturas del bloqueo directo ante cualquier cobertura aplicable a una pantalla central. */
const PNR_READS: readonly AuditDecisionPoint[] = [
  "lectura_bloqueo_o1",
  "lectura_trampa",
  "lectura_cambio",
  "lectura_show",
  "lectura_a_la_altura",
  "lectura_segunda_o5",
  "segunda_entrada",
];

/** 4-out/1-in de la disposición de partida (ME-01): central y lateral. */
const STRUCTURE_4_OUT: PlaybookCard["structure"] = {
  O1: "manejador arriba",
  O2: "esquina fuerte",
  O3: "esquina débil: libre si su defensor ayuda al roll",
  O4: "ala débil: libre si su defensor repara hacia la esquina",
  O5: "bloqueador",
};

export const ORGANIZED_PLAYBOOK: readonly PlaybookCard[] = [
  {
    id: "bloqueo_directo_central",
    label: "Bloqueo directo central",
    phase: "ataque_organizado",
    allowedPlans: ["auto", "bloqueo_directo"],
    placement: "central",
    structure: STRUCTURE_4_OUT,
    roles: { creator: { role: "O1", substitutes: ["poseedor_real"] }, screener: { role: "O5", substitutes: ["O4"] } },
    firstAction: "bloqueo_directo",
    variants: ["segunda_entrada"],
    reads: PNR_READS,
    safety: "salida_segura_y_reorganizar",
    priority: 0,
  },
  {
    id: "mano_a_mano_central",
    label: "Mano a mano con indirecto en el lado débil",
    phase: "ataque_organizado",
    allowedPlans: ["auto", "mano_a_mano_sin_balon"],
    placement: "central",
    structure: STRUCTURE_4_OUT,
    roles: { creator: { role: "O1", substitutes: ["poseedor_real"] }, screener: { role: "O5", substitutes: ["O4"] } },
    firstAction: "mano_a_mano_sin_balon",
    variants: [],
    reads: ["entrada_mano_a_mano", "transferencia_mano_a_mano", "bloqueo_indirecto_o3", "lectura_mano_a_mano", "seleccion_orden_sin_balon"],
    safety: "salida_segura_y_reorganizar",
    priority: 1,
  },
  {
    id: "bloqueo_directo_lateral",
    label: "Bloqueo directo lateral",
    phase: "ataque_organizado",
    allowedPlans: ["auto", "bloqueo_directo"],
    placement: "lateral",
    structure: { ...STRUCTURE_4_OUT, O1: "manejador en el ala", O5: "bloqueador lateral" },
    roles: { creator: { role: "O1", substitutes: ["poseedor_real"] }, screener: { role: "O5", substitutes: ["O4"] } },
    firstAction: "bloqueo_directo",
    variants: ["segunda_entrada"],
    // El ICE solo existe ante esta colocación.
    reads: [...PNR_READS, "lectura_ice"],
    safety: "salida_segura_y_reorganizar",
    priority: 2,
  },
  {
    // Libro por fase (§4): «Organizado: Horns→bloqueo». LAB-0.8.
    id: "horns_bloqueo",
    label: "Horns → bloqueo directo desde el codo",
    phase: "ataque_organizado",
    allowedPlans: ["auto", "bloqueo_directo"],
    placement: "horns",
    structure: {
      O1: "manejador arriba",
      O2: "esquina fuerte",
      O3: "segundo cuerno en el codo contrario (interior que no bloquea): libre si su defensor ayuda al roll",
      O4: "esquina débil: libre si su defensor repara hacia el codo",
      O5: "cuerno que bloquea",
    },
    // El bloqueador es O5 u O4 (el que no bloquea pasa a segundo cuerno).
    roles: { creator: { role: "O1", substitutes: ["poseedor_real"] }, screener: { role: "O5", substitutes: ["O4"] } },
    firstAction: "bloqueo_directo",
    variants: ["segunda_entrada"],
    // La pantalla queda dentro de la franja de la zona: sin ICE.
    reads: PNR_READS,
    safety: "salida_segura_y_reorganizar",
    priority: 3,
  },
];

export function playbookCard(id: PlaybookCardId): PlaybookCard {
  return ORGANIZED_PLAYBOOK.find((c) => c.id === id)!;
}

/** Ficha que corresponde a una primera acción resuelta en una colocación. */
export function cardFor(firstAction: OffensivePlan, placement: ScreenPlacement): PlaybookCard {
  const card = ORGANIZED_PLAYBOOK.find((c) => c.firstAction === firstAction && c.placement === placement);
  if (!card) throw new Error(`No hay ficha para ${firstAction} con colocación ${placement}.`);
  return card;
}

/**
 * Colocaciones que el ataque puede ofrecer al organizar: las de las fichas
 * cuya condición admite el plan del entrenador y cuya colocación admite la
 * orden de colocación, en orden de prioridad y sin repetir.
 */
export function eligiblePlacements(plan: OffensivePlanChoice, placementChoice: ScreenPlacementChoice): ScreenPlacement[] {
  const out: ScreenPlacement[] = [];
  for (const card of [...ORGANIZED_PLAYBOOK].sort((a, b) => a.priority - b.priority)) {
    if (!card.allowedPlans.includes(plan)) continue;
    if (placementChoice !== "auto" && card.placement !== placementChoice) continue;
    if (!out.includes(card.placement)) out.push(card.placement);
  }
  // Sin ficha compatible (p. ej. mano a mano obligada con colocación lateral): la central, donde vive el plan.
  return out.length > 0 ? out : ["central"];
}
