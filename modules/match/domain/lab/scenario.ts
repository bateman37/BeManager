import type { Point2D } from "../geometry/point";
import { secondsToMs, type Milliseconds } from "../time/clock";

/**
 * Los tres escenarios cargables de ME-01 (prompt §4). Sus geometrías
 * iniciales, roles y condiciones son datos, no un guion que fuerza un
 * resultado: el desenlace sigue dependiendo de lectura, ejecución y semilla.
 */
export type ScenarioId = "drop_con_ayuda" | "drop_sin_ayuda" | "closeout_tardio_con_contacto";

export type OffensiveRole =
  | "handler"
  | "screener"
  | "strong_side_corner"
  | "weak_side_corner"
  | "weak_side_wing";

export type DefensiveRole =
  | "on_ball_chaser"
  | "drop_big"
  | "strong_side_corner_defender"
  | "weak_side_corner_defender"
  | "weak_side_wing_defender";

export interface ScenarioPlayerSlot {
  readonly playerId: string;
  readonly role: OffensiveRole | DefensiveRole;
  readonly initialPosition: Point2D;
}

export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly label: string;
  readonly description: string;
  /** Instrucción defensiva editable en esta entrega: D3 ayuda al continuador. */
  readonly d3HelpsRoller: boolean;
  /**
   * Solo en `closeout_tardio_con_contacto`: el estado se carga después de que
   * D3 ya haya comprometido su ayuda y O3 esté disponible. No fuerza un
   * pitido: solo sitúa la simulación en ese punto del reloj.
   */
  readonly startsWithHelpAlreadyCommitted: boolean;
  readonly offense: readonly ScenarioPlayerSlot[];
  readonly defense: readonly ScenarioPlayerSlot[];
  readonly initialGameClockMs: Milliseconds;
  readonly initialShotClockMs: Milliseconds;
}

const OFFENSE_SLOTS: readonly ScenarioPlayerSlot[] = [
  { playerId: "O1", role: "handler", initialPosition: { x: 18.0, y: 7.5 } },
  { playerId: "O2", role: "strong_side_corner", initialPosition: { x: 24.0, y: 1.1 } },
  { playerId: "O3", role: "weak_side_corner", initialPosition: { x: 24.0, y: 13.9 } },
  { playerId: "O4", role: "weak_side_wing", initialPosition: { x: 18.0, y: 12.5 } },
  { playerId: "O5", role: "screener", initialPosition: { x: 20.2, y: 8.6 } },
];

/**
 * Solo para `closeout_tardio_con_contacto` (ME-04B, tras corregir el
 * desplazamiento real de O1 hasta el punto de uso de la pantalla, §3.1): el
 * estado se carga ya avanzado (D3 comprometido, O3 disponible), así que O1
 * también parte algo más adentro que en los otros dos escenarios — sigue
 * detrás del perímetro real, pero no deja disponible un triple genuinamente
 * competitivo con el pase a la esquina que este escenario existe para
 * comprobar. Es una condición geométrica propia de este escenario sintético
 * (igual que `LATE_CLOSEOUT_D4_START`), no una fórmula LAB-0.1/LAB-0.3
 * compartida ni un cambio de las posiciones reales de `drop_con_ayuda`.
 */
const CLOSEOUT_OFFENSE_SLOTS: readonly ScenarioPlayerSlot[] = [
  { playerId: "O1", role: "handler", initialPosition: { x: 19.3, y: 7.6 } },
  { playerId: "O2", role: "strong_side_corner", initialPosition: { x: 24.0, y: 1.1 } },
  { playerId: "O3", role: "weak_side_corner", initialPosition: { x: 24.0, y: 13.9 } },
  { playerId: "O4", role: "weak_side_wing", initialPosition: { x: 18.0, y: 12.5 } },
  { playerId: "O5", role: "screener", initialPosition: { x: 20.2, y: 8.6 } },
];

const DEFENSE_SLOTS: readonly ScenarioPlayerSlot[] = [
  { playerId: "D1", role: "on_ball_chaser", initialPosition: { x: 19.1, y: 7.5 } },
  {
    playerId: "D2",
    role: "strong_side_corner_defender",
    initialPosition: { x: 23.4, y: 1.5 },
  },
  {
    playerId: "D3",
    role: "weak_side_corner_defender",
    initialPosition: { x: 23.4, y: 11.3 },
  },
  { playerId: "D4", role: "weak_side_wing_defender", initialPosition: { x: 19.0, y: 12.2 } },
  { playerId: "D5", role: "drop_big", initialPosition: { x: 22.3, y: 7.7 } },
];

/** Primer cuarto, 7:12 en el reloj de partido; 18 s de lanzamiento (prompt §2). */
const INITIAL_GAME_CLOCK_MS = secondsToMs(7 * 60 + 12);
const INITIAL_SHOT_CLOCK_MS = secondsToMs(18);

export const SCENARIOS: Readonly<Record<ScenarioId, ScenarioDefinition>> = {
  drop_con_ayuda: {
    id: "drop_con_ayuda",
    label: "Drop con ayuda",
    description:
      "Bloqueo directo central contra drop; D3 ayuda al continuador desde el lado débil.",
    d3HelpsRoller: true,
    startsWithHelpAlreadyCommitted: false,
    offense: OFFENSE_SLOTS,
    defense: DEFENSE_SLOTS,
    initialGameClockMs: INITIAL_GAME_CLOCK_MS,
    initialShotClockMs: INITIAL_SHOT_CLOCK_MS,
  },
  drop_sin_ayuda: {
    id: "drop_sin_ayuda",
    label: "Drop sin ayuda",
    description:
      "Bloqueo directo central contra drop; D3 no ayuda y conserva la marca de O3.",
    d3HelpsRoller: false,
    startsWithHelpAlreadyCommitted: false,
    offense: OFFENSE_SLOTS,
    defense: DEFENSE_SLOTS,
    initialGameClockMs: INITIAL_GAME_CLOCK_MS,
    initialShotClockMs: INITIAL_SHOT_CLOCK_MS,
  },
  closeout_tardio_con_contacto: {
    id: "closeout_tardio_con_contacto",
    label: "Closeout tardío con contacto de tiro",
    description:
      "Carga el estado después de que D3 ya comprometió su ayuda y O3 está disponible; permite alcanzar la rama de falta ordinaria sobre el tiro.",
    d3HelpsRoller: true,
    startsWithHelpAlreadyCommitted: true,
    offense: CLOSEOUT_OFFENSE_SLOTS,
    defense: DEFENSE_SLOTS,
    initialGameClockMs: INITIAL_GAME_CLOCK_MS,
    initialShotClockMs: INITIAL_SHOT_CLOCK_MS,
  },
};

export function getScenario(id: ScenarioId): ScenarioDefinition {
  return SCENARIOS[id];
}
