/**
 * Tipos de la auditoría exportable de partidos (ME-04A). Puro dominio: sin
 * React ni Prisma. Un `AuditDecisionRecord` es un punto de decisión que el
 * motor **ya evaluó** durante la simulación (`docs/match/AUDIT.md` §3): no
 * se reconstruye después con el acta ni se recalcula al exportar.
 *
 * Los códigos de motivo son estables y en inglés (`AuditReasonCode`): no se
 * depende de parsear frases en español para saber por qué se descartó una
 * opción (prompt ME-04A §3).
 */

/** Estado de cada opción realmente evaluada en un punto de decisión. */
export type AuditOptionStatus =
  | "elegida"
  | "descartada_por_condicion"
  | "no_evaluada_por_cortocircuito";

/** Puntos de observación priorizados por el prompt (§3, puntos 1-5). */
export type AuditDecisionPoint =
  | "entrada_fase_transicion"
  | "organizacion_creador"
  | "lectura_bloqueo_o1"
  | "lectura_segunda_o5"
  | "lectura_trampa"
  | "segunda_entrada"
  | "resolucion_tiro"
  | "asignacion_rebote"
  | "puerta_falta_sin_tiro"
  | "sustitucion";

/**
 * Motivo estructurado y estable de cada opción. Uno por causa real del
 * árbol de decisión (`ACTIONS.md`); nunca un texto libre como única fuente.
 */
export type AuditReasonCode =
  | "lane_open_before_help"
  | "lane_closed_help_ready"
  | "screen_delay_sufficient"
  | "screen_delay_insufficient"
  | "roll_denied_before_decision"
  | "second_read_contained"
  | "second_read_not_contained"
  | "corner_window_open"
  | "corner_window_closed"
  | "three_point_eligible"
  | "three_point_ineligible_skill"
  | "three_point_window_closed"
  | "safe_outlet_default"
  | "trap_closed_before_pass"
  | "trap_broken_lane_open"
  | "trap_broken_no_lane_recovered"
  | "second_entry_pass_line_blocked"
  | "second_entry_not_exterior_frontcourt"
  | "second_entry_screen_spot_illegal"
  | "second_entry_shot_clock_insufficient"
  | "second_entry_viable_shortest_pass"
  | "shot_contact_no_overlap"
  | "shot_contact_legal"
  | "shot_contact_late_illegal"
  | "shot_block_ineligible_no_touch"
  | "containment_gate_not_reached"
  | "containment_gate_legal"
  | "containment_gate_illegal"
  | "rebound_duty_crash_fastest"
  | "rebound_duty_balance_return"
  | "transition_advantage_found"
  | "transition_no_advantage"
  | "role_fixed_no_ranking"
  | "not_evaluated_short_circuit"
  | "situational_value_lower"
  | "tie_band_resolved_by_tendency"
  | "not_available";

export interface AuditOptionRecord {
  /** Identificador estable de la opción dentro de este punto (p. ej. "pase_o5", "finalizar"). */
  readonly id: string;
  readonly status: AuditOptionStatus;
  readonly reasonCode: AuditReasonCode;
  /** Explicación breve en español, nunca la única fuente del motivo (el código lo es). */
  readonly reasonNote?: string;
  /**
   * Valores realmente usados en la comparación (distancia, llegada, reloj,
   * capacidad, umbral). `null`/`no_disponible` cuando esa magnitud no se
   * calculó en esta rama; nunca un número inventado.
   */
  readonly values?: Readonly<Record<string, number | string | boolean | null>>;
}

/** Enlace al hecho (`timeline`) relevante, cuando existe (§2 `decisions`). */
export interface AuditFactLink {
  readonly atMs: number;
  readonly kind: string;
}

export interface AuditDecisionRecord {
  readonly id: number;
  readonly atMs: number;
  readonly point: AuditDecisionPoint;
  readonly possessionIndex: number | null;
  readonly phaseIndex: number | null;
  readonly holderId: string | null;
  readonly participants: readonly string[];
  readonly options: readonly AuditOptionRecord[];
  readonly chosenOptionId: string | null;
  /** Referencia al hecho de `timeline` que ejecuta esta decisión, si se pudo enlazar. */
  readonly factLink: AuditFactLink | null;
  /** Estado del generador antes/después, solo cuando esta decisión consume un sorteo. */
  readonly rngStateBefore: number | null;
  readonly rngStateAfter: number | null;
  readonly note?: string;
}

/** Cobertura declarada como faltante (§3): nunca se presenta como completa. */
export interface AuditCoverageGap {
  readonly point: string;
  readonly reason: string;
  readonly possessionsAffected: number;
}

export interface RawAuditLog {
  readonly decisions: readonly AuditDecisionRecord[];
  readonly coverageGaps: readonly AuditCoverageGap[];
}
