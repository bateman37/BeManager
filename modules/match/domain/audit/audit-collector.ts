/**
 * Colector de auditoría (ME-04A §3): un método puro de registrar datos ya
 * disponibles en el punto exacto en que el motor decide. Nunca invoca
 * `rng.next()` ni recalcula nada; solo apunta valores que ya existían en la
 * pila de llamadas. `createNoopAuditCollector()` es el colector por
 * defecto: coste cero, sin asignar memoria (invariante ON/OFF, §6).
 */
import type { AuditCoverageGap, AuditDecisionRecord, RawAuditLog } from "./audit-types";

export type AuditDecisionInput = Omit<AuditDecisionRecord, "id">;

export interface AuditCollector {
  /** `false` en el colector nulo: permite a las llamadas evitar construir el registro. */
  readonly enabled: boolean;
  recordDecision(input: AuditDecisionInput): void;
  recordCoverageGap(point: string, reason: string, possessionsAffected?: number): void;
  snapshot(): RawAuditLog;
}

const EMPTY_LOG: RawAuditLog = Object.freeze({ decisions: Object.freeze([]) as readonly AuditDecisionRecord[], coverageGaps: Object.freeze([]) as readonly AuditCoverageGap[] });

const NOOP_COLLECTOR: AuditCollector = Object.freeze({
  enabled: false,
  recordDecision() {
    /* no-op: modo auditoría desactivado */
  },
  recordCoverageGap() {
    /* no-op */
  },
  snapshot() {
    return EMPTY_LOG;
  },
});

/** Colector sin efecto: mismo coste y comportamiento que antes de ME-04A. */
export function createNoopAuditCollector(): AuditCollector {
  return NOOP_COLLECTOR;
}

/**
 * Valida la integridad referencial de `factLink` contra la línea de tiempo
 * ya finalizada (ME-04B §4.2): un hecho puede haberse calculado dentro de un
 * tramo de cálculo y no llegar a ocurrir de verdad en el partido (bocina,
 * guardián, corte de período) — el registro de la decisión no lo sabe hasta
 * que la corrida termina. En vez de exportar un enlace que apunta a un
 * `(kind, atMs)` que no existe en `events`, esta función lo deja `null`
 * explícito (enlace ausente, no inventado). No modifica ningún otro campo.
 */
export function sanitizeAuditFactLinks<E extends { readonly kind: string; readonly atMs: number }>(
  decisions: readonly AuditDecisionRecord[],
  events: readonly E[],
): AuditDecisionRecord[] {
  const realFacts = new Set(events.map((e) => `${e.kind}@${e.atMs}`));
  return decisions.map((d) => {
    if (d.factLink === null) return d;
    const key = `${d.factLink.kind}@${d.factLink.atMs}`;
    return realFacts.has(key) ? d : { ...d, factLink: null };
  });
}

/** Colector real: acumula en memoria durante una única corrida. */
export function createRecordingAuditCollector(): AuditCollector {
  const decisions: AuditDecisionRecord[] = [];
  const gaps = new Map<string, AuditCoverageGap>();
  let nextId = 0;
  return {
    enabled: true,
    recordDecision(input) {
      decisions.push({ ...input, id: nextId++ });
    },
    recordCoverageGap(point, reason, possessionsAffected = 0) {
      const existing = gaps.get(point);
      gaps.set(point, {
        point,
        reason,
        possessionsAffected: (existing?.possessionsAffected ?? 0) + possessionsAffected,
      });
    },
    snapshot() {
      return { decisions: [...decisions], coverageGaps: [...gaps.values()] };
    },
  };
}
