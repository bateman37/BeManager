/**
 * LAB-0.6 (ME-07B v2 §2.5): riesgo de falta de un **contacto defensivo real**
 * en balón vivo. Antes solo podía haber falta si un cierre llegaba tarde y
 * sin frenar (contacto ilegal por tiempo) o si la ayuda cortaba la carrera
 * del continuador; cualquier otro contacto real —un cierre legal con solape
 * corporal en una finalización, una trampa cerrada sobre el balón, un
 * defensor al que le cierran el rebote y aun así disputa por encima de la
 * espalda— nunca se adjudicaba, y las faltas del partido nacían casi solo de
 * esos cierres tardíos. Aquí solo se decide *si un contacto que ya ocurrió
 * por geometría es falta*; nunca se crea un contacto ni se reparte una cuota.
 *
 * - Unidad: probabilidad [0, 1] por contacto real adjudicado.
 * - Intervalo de la base por situación: finalización [0,06; 0,20], tiro
 *   exterior [0,01; 0,06], trampa [0,04; 0,12], rebote [0,03; 0,10].
 * - Caso neutro: M07 = 8 → la base de la situación.
 * - Sensibilidad: −0,008 por punto de M07 del defensor (disciplina: controlar
 *   el riesgo evitable), acotada [0,01; 0,35] (probado en
 *   `lab-0-6-parameters.test.ts`).
 * - No duplicación: la oposición al tiro (R_contest), el tapón (T18), la
 *   presión de la trampa (T07/T15) y el cierre de rebote (T19/F05) siguen
 *   decidiéndose igual; M07 solo actúa cuando ya hay contacto y no cambia
 *   llegadas, alcance ni acierto. No es un ajuste universal de faltas.
 */
import { clamp } from "./lab-0-1-parameters";
import type { Rating } from "../players/attribute";

export const LAB_0_6_PARAMETERS_VERSION = "LAB-0.6";

export type ContactSituation = "finalizacion" | "tiro_exterior" | "trampa" | "rebote_sobre_espalda";

export const CONTACT_FOUL_BASE_PROBABILITY: Readonly<Record<ContactSituation, number>> = {
  finalizacion: 0.12,
  tiro_exterior: 0.03,
  trampa: 0.07,
  rebote_sobre_espalda: 0.06,
};

export function contactFoulProbability(situation: ContactSituation, foulerM07: Rating): number {
  return clamp(CONTACT_FOUL_BASE_PROBABILITY[situation] - 0.008 * (foulerM07 - 8), 0.01, 0.35);
}
