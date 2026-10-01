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
  | "sustitucion"
  // ME-06 §3: segunda familia posicional (mano a mano sin balón) y su
  // selección automática entre familias.
  | "seleccion_familia"
  | "entrada_mano_a_mano"
  | "transferencia_mano_a_mano"
  | "bloqueo_indirecto_o3"
  | "lectura_mano_a_mano"
  // ME-07A §4: defensa automática de ambos equipos.
  | "seleccion_cobertura"
  | "seleccion_orden_sin_balon"
  // ME-07A §3.2: transición con tiro de tres del propio portador.
  | "lectura_transicion"
  // ME-07B v2 §2.1: disputa del rebote con cierres legales y próximos.
  | "disputa_rebote"
  // ME-07B v2 §5: lecturas del manejador ante cambio (switch) y show.
  | "lectura_cambio"
  | "lectura_show";

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
  // ME-07A §3.2: el poseedor real puede conservar la iniciativa en vez de
  // devolver siempre el balón al rol fijo O1.
  | "creator_kept_by_real_holder"
  | "creator_pass_back_faster"
  // ME-07B v2 §2.4: asignación de creador/bloqueador por proyección.
  | "creator_projected_value_higher"
  | "creator_ready_later_in_band"
  // ME-07B v2 §2.4: tiro parado de dos (tiro medio T03 / floater T02).
  | "pull_up_spot_available"
  | "pull_up_no_spot"
  // ME-07B v2 §2.4: lectura del receptor del continuador.
  | "receiver_value_higher"
  | "receiver_value_lower"
  | "receiver_option_not_viable"
  // ME-07B v2 §2.5: contacto defensivo real sancionado (LAB-0.6).
  | "contact_foul_drawn"
  | "contact_foul_not_drawn"
  // ME-07B v2 §5: lectura genérica por valor (cambio, show).
  | "read_value_higher"
  | "read_value_lower"
  | "read_option_not_viable"
  | "coverage_ice_central_not_eligible"
  | "not_evaluated_short_circuit"
  | "situational_value_lower"
  | "tie_band_resolved_by_tendency"
  | "not_available"
  // ME-06 §3.2: selección automática entre familias ofensivas.
  | "family_opportunity_higher"
  | "family_opportunity_lower"
  | "family_forced_by_plan"
  // ME-06 §3.1: mano a mano sin balón.
  | "entry_pass_completed"
  | "entry_pass_denied"
  | "handoff_completed"
  | "handoff_denied_defender_arrived"
  | "cut_window_open"
  | "cut_window_denied"
  | "help_rotation_opened_o4"
  | "help_rotation_not_available"
  // ME-07A §4: cobertura y orden sin balón en `auto`.
  | "coverage_lower_concession"
  | "coverage_higher_concession"
  | "coverage_trap_not_eligible"
  | "coverage_tied_base_kept"
  | "off_ball_call_lower_concession"
  | "off_ball_call_higher_concession"
  | "off_ball_call_tied_base_kept"
  // ME-07A §2: tendencia de tiro y prioridad de creación del entrenador
  // generalizadas a la banda de empate fuera de la primera lectura del
  // bloqueo (que conserva `pnrTendency` con sus propios códigos de arriba).
  | "creation_priority_resolved_band"
  | "shot_tendency_favors_shot"
  | "shot_tendency_favors_continuation"
  | "shot_tendency_seeded_choice"
  // ME-07A §3.2: triple del portador en transición.
  | "transition_three_point_window_open"
  | "transition_three_point_window_closed"
  | "transition_three_point_ineligible_skill"
  // ME-07B v2 §2.1: disputa del rebote (llegada efectiva tras cierre).
  | "rebound_boxed_out_by_rival"
  | "rebound_arrival_in_window"
  | "rebound_arrival_outside_window"
  // ME-04-ROT-3 (ME-07B v2): relevo de emergencia tras una exclusión.
  | "emergency_fill_chosen"
  | "emergency_fill_fewer_declared_roles"
  | "emergency_fill_lower_role_fit"
  | "emergency_fill_lost_tie_break";

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
