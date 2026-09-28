/**
 * Generador de azar determinista e inyectado (mulberry32). El núcleo nunca
 * usa `Math.random()`: cada partido/escenario conserva su semilla y estado
 * para ser reproducible (prompt §2, "Única instrucción..."; estudio §13.2).
 */
export interface SeededRandom {
  /** Flotante en [0, 1). */
  next(): number;
  /** Flotante en [min, max). */
  nextInRange(min: number, max: number): number;
  /** Entero en [min, max] (inclusive). */
  nextInt(min: number, max: number): number;
  /** +1 o -1 con igual probabilidad. */
  nextSign(): 1 | -1;
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;

  function raw(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next: raw,
    nextInRange(min: number, max: number): number {
      return min + raw() * (max - min);
    },
    nextInt(min: number, max: number): number {
      return Math.floor(min + raw() * (max - min + 1));
    },
    nextSign(): 1 | -1 {
      return raw() < 0.5 ? -1 : 1;
    },
  };
}
