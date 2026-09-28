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

/**
 * Generador reanudable (ME-03 §2): el mismo mulberry32 que
 * `createSeededRandom`, pero expone su estado interno para poder registrar
 * en cada frontera de un tramo el "estado reproducible del azar".
 * `createResumableRandom(r.state())` continúa exactamente la misma
 * secuencia. No sustituye a `createSeededRandom`: la posesión individual
 * de ME-01/ME-02 sigue usando aquel sin cambios.
 */
export interface ResumableRandom extends SeededRandom {
  /** Estado interno actual (entero sin signo de 32 bits). */
  state(): number;
}

export function createResumableRandom(seed: number): ResumableRandom {
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
    state(): number {
      return state >>> 0;
    },
  };
}
