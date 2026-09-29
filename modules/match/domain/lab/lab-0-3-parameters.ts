/**
 * Parámetros nuevos de ME-04B (§3 del prompt): siguen la misma convención
 * que LAB-0.1/LAB-0.2 (hipótesis de prototipo trazables, versionadas como
 * datos tipados, no porcentajes de liga FIBA ni constantes repartidas por el
 * código). Solo se aprueban aquí los parámetros deportivos nuevos de esta
 * entrega: el alcance geométrico de contestación (R_contest, separado del
 * radio corporal de contacto/falta de LAB-0.2), la banda de empate del valor
 * de tiro situacional de la primera lectura y el margen de uso legal de la
 * pantalla.
 */
export const LAB_0_3_PARAMETERS_VERSION = "LAB-0.3";

/**
 * R_contest (prompt ME-04B §3.3): alcance lateral de contestación de un
 * defensor, en metros. Es el radio corporal (0,35 m, igual que LAB-0.2) más
 * el medio alcance de brazos de su envergadura (C03, cm → m). Es la
 * pregunta «¿puede un defensor intervenir en el tiro sin tocar al
 * tirador?», independiente del solape corporal de 0,70 m combinado que
 * sigue decidiendo únicamente contacto/falta (`COMBINED_CONTACT_RADIUS_METERS`,
 * LAB-0.2).
 */
export function contestReachMeters(wingspanCm: number): number {
  return 0.35 + wingspanCm / 200;
}

/** Nivel de oposición geométrica (0/0.5/1) que puede alcanzar un defensor real, prompt §3.3. */
export type ContestLevel = 0 | 0.5 | 1;

export interface ContestReachFacts {
  /** El defensor alcanza el punto de liberación dentro de `R_contest` antes de soltar el tiro. */
  readonly withinReachAtRelease: boolean;
  /**
   * El defensor ya estaba dentro de `R_contest` y colocado (llegada + frenada
   * F03) al **empezar el gesto de tiro**, no solo al liberarlo.
   */
  readonly settledBeforeGesture: boolean;
}

/**
 * Si no alcanza `R_contest` antes de liberar el tiro → 0 (sin oposición
 * atribuible a ese defensor, con independencia del reloj). Si alcanza esa
 * ventana durante el gesto sin estar aún colocado → 0,5. Si ya estaba
 * colocado al empezar el gesto → 1. Nunca se suman varios defensores ni T22
 * y T23 en una sola intervención (prompt §3.3).
 */
export function evaluateContestLevel(facts: ContestReachFacts): ContestLevel {
  if (!facts.withinReachAtRelease) return 0;
  return facts.settledBeforeGesture ? 1 : 0.5;
}

/**
 * Banda de empate del valor de tiro situacional provisional de la primera
 * lectura del bloqueo (prompt ME-04B §3.2), en puntos esperados
 * (`puntos × shotProbability`). Dentro de esta banda decide la tendencia del
 * jugador (`priorizar_primera_opcion` / `explorar_segunda_opcion`); fuera de
 * ella gana siempre el valor mayor, sin tirada de preferencia.
 */
export const FIRST_READ_TIE_BAND_POINTS = 0.15;

/**
 * Margen de separación entre dos jugadores que no pueden ocupar el mismo
 * punto (prompt ME-04B §3.1): el manejador usa la pantalla llegando junto al
 * bloqueador, a esta distancia de su posición, nunca sobre ella. Reutiliza el
 * mismo radio corporal combinado que el contacto de tiro (LAB-0.2) por ser la
 * misma noción física (dos cuerpos no se solapan), no un parámetro deportivo
 * nuevo independiente.
 */
export { COMBINED_CONTACT_RADIUS_METERS as SCREEN_USE_STANDOFF_METERS } from "./lab-0-2-parameters";
