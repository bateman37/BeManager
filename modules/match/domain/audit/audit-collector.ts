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
