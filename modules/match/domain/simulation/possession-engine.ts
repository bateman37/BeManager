/**
 * Motor detallado de una posesión de laboratorio (ME-01, HF-002). Delega
 * todo el árbol de decisión y las fórmulas LAB-0.1 en
 * `possession-core.ts` (compartido con el resolvedor rápido) y se limita a
 * construir el relato completo de hechos con foto de posiciones por
 * instante, cancha esquemática y el estado terminal legal.
 *
 * La foto de cada hecho se reconstruye a partir del historial real de
 * llegadas (`positionHistory`), no de la posición "actual" mutada durante
 * el cálculo: así un hecho nunca muestra una posición futura como si ya
 * hubiese ocurrido (HF-002 §1.3).
 */
import type { Point2D } from "../geometry/point";
import type { MatchInput } from "../lab/match-input";
import type { MatchState } from "./match-state";
import { createFact, type Fact, type PlayerSnapshot } from "./fact";
import { computePossessionCore, type PositionHistory, type RawEvent } from "./possession-core";

function snapshotAt(positionHistory: PositionHistory, atMs: number): PlayerSnapshot[] {
  return Object.entries(positionHistory).map(([playerId, entries]) => {
    let position: Point2D = entries[0]!.position;
    for (const entry of entries) {
      if (entry.atMs <= atMs) {
        position = entry.position;
      } else {
        break;
      }
    }
    return { playerId, position };
  });
}

function toFact(raw: RawEvent, positionHistory: PositionHistory): Fact {
  return createFact(
    raw.sequence,
    raw.atMs,
    raw.phase,
    raw.kind,
    raw.actors,
    raw.text,
    snapshotAt(positionHistory, raw.atMs),
    raw.detail,
  );
}

/**
 * Ejecuta la posesión completa de forma determinista y devuelve el estado
 * terminal con el relato completo de hechos. Misma entrada (perfiles,
 * escenario y semilla) produce siempre la misma secuencia (invariante 2).
 */
export function runPossession(input: MatchInput): MatchState {
  const core = computePossessionCore(input, { trackPositionHistory: true });
  const positionHistory = core.positionHistory ?? {};
  const facts = core.timeline.map((raw) => toFact(raw, positionHistory));

  return {
    input,
    clockMs: facts.length > 0 ? facts[facts.length - 1]!.atMs : 0,
    gameClockMs: core.gameClockMs,
    shotClockMs: core.shotClockMs,
    players: Object.fromEntries(
      Object.entries(core.finalPositions).map(([id, position]) => [id, { playerId: id, position }]),
    ),
    ball: core.ball,
    facts,
    terminal: core.terminal,
    possessionPhase: core.possessionPhase,
  };
}
