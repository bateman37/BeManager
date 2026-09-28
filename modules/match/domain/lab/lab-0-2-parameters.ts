import type { Point2D } from "../geometry/point";
import { clamp } from "./lab-0-1-parameters";
import type { Rating } from "../players/attribute";

/**
 * Parámetros nuevos de ME-02 (C1 y §3 del prompt): siguen la misma
 * convención que LAB-0.1 (hipótesis de prototipo trazables, no porcentajes
 * de liga). Solo se aprueban aquí tres parámetros deportivos nuevos: el
 * radio corporal de contacto, los dos puntos de referencia del short
 * roll/continuación, y la latencia de coordinación de M09. Todo lo demás
 * (tiempos, presión, intercepción, tiro, rebote) reutiliza LAB-0.1.
 */
export const LAB_0_2_PARAMETERS_VERSION = "LAB-0.2";

/**
 * Radio corporal de contacto por jugador, en metros (prompt C1 §2). Solo
 * puede haber contacto de tiro si los espacios corporales de defensor y
 * tirador se solapan en la interacción de tiro, es decir, si la distancia
 * entre sus posiciones reales en el instante de liberación es menor o
 * igual que la suma de sus dos radios.
 */
export const BODY_CONTACT_RADIUS_METERS = 0.35;
export const COMBINED_CONTACT_RADIUS_METERS = BODY_CONTACT_RADIUS_METERS * 2;

/**
 * Puntos de referencia de la continuación de O5 tras el bloqueo central
 * (prompt ME-02 §3): short roll y continuación profunda. Son geometría
 * mínima de esta secuencia, no teletransporte ni recepción obligatoria; la
 * llegada real depende de distancia/velocidad y de las ventanas ya
 * vigentes en LAB-0.1.
 */
export const SHORT_ROLL_SPOT: Point2D = { x: 23.0, y: 7.5 };
export const DEEP_CONTINUATION_SPOT: Point2D = { x: 24.8, y: 7.5 };

/**
 * Latencia de coordinación de M09 (Comunicación), en segundos, entre un
 * aviso defensivo reconocido y la respuesta de otro defensor (prompt
 * ME-02 §3). Se aplica una única vez por aviso pertinente que tenga emisor
 * y receptor identificables, nunca por fotograma ni como bonus de robo o
 * tiro. M09 no sustituye a M01 (reconocer), M05 (situarse) ni M04
 * (sincronizar el gesto): solo retrasa u adelanta cuándo el receptor puede
 * empezar a actuar sobre un aviso ya reconocido.
 */
export function m09CoordinationLatencySeconds(m09Sender: Rating, m09Receiver: Rating): number {
  const worst = Math.min(m09Sender, m09Receiver);
  return clamp(0.12 - 0.008 * (worst - 8), 0.06, 0.18);
}
