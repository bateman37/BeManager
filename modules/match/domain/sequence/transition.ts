/**
 * Lecturas de transición y segunda oportunidad (ME-03 §3-§4), en el marco
 * local del equipo que ataca (aro `ATTACKED_HOOP`, pista delantera x > 14).
 * Solo deciden **si existe una ventana** y quién la ejecuta, con tiempos de
 * llegada reales desde posiciones reales y el movimiento ya modelado; la
 * ejecución (pase, recepción, tiro, oposición, tapón, falta, rebote) la
 * hace el núcleo compartido. No hay multiplicador de "ataque temprano": la
 * ventaja es solo que el defensor llega más tarde, y su efecto sale de la
 * geometría del contacto en el instante de lanzar.
 */
import type { Point2D } from "../geometry/point";
import { distance, timeToReach } from "../geometry/point";
import { ATTACKED_HOOP } from "../geometry/court";
import { MIDCOURT_LINE_X } from "../geometry/frame";
import {
  interiorArrivalAdjustmentSeconds,
  PASS_FLIGHT_SPEED_MPS,
  PASS_RELEASE_SECONDS,
  CATCH_AND_SHOOT_PREP_SECONDS,
} from "../lab/lab-0-1-parameters";
import type { Rating } from "../players/attribute";
import { BODY_CONTACT_RADIUS_METERS } from "../lab/lab-0-2-parameters";
import { isBehindThreePointLine, distanceToHoop, FIBA_THREE_POINT_RADIUS_METERS } from "../geometry/court";

/**
 * Carrera de intercepción sobre una línea de pase recta: ¿puede algún
 * defensor, corriendo desde su posición real, llevar su espacio corporal
 * (radio LAB-0.2) a algún punto de la línea antes de que pase el balón?
 * Solo se intenta un pase de transición si la línea está libre; así no se
 * necesita ningún porcentaje nuevo de robo en transición.
 */
export function firstInterceptor(
  from: Point2D,
  to: Point2D,
  releaseSeconds: number,
  defenders: readonly RaceParticipant[],
): TimedParticipant | null {
  const length = distance(from, to);
  const flight = length / PASS_FLIGHT_SPEED_MPS;
  const samples = Math.max(1, Math.ceil(length / 0.5));
  let best: TimedParticipant | null = null;
  for (const d of defenders) {
    for (let i = 0; i <= samples; i++) {
      const f = i / samples;
      const point = { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f };
      const ballAt = releaseSeconds + flight * f;
      const reach = Math.max(0, distance(d.position, point) - BODY_CONTACT_RADIUS_METERS);
      const defenderAt = reach / d.runSpeedMps;
      if (defenderAt <= ballAt) {
        const candidate = { slot: d.slot, id: d.id, arrivalSeconds: defenderAt };
        if (!best || byArrivalThenId(candidate, best) < 0) best = candidate;
        break;
      }
    }
  }
  return best;
}

export interface RaceParticipant {
  readonly slot: string;
  /** ID real, para desempates estables (nunca el rol canónico). */
  readonly id: string;
  readonly position: Point2D;
  /** Carrera (F01, `attackerMoveSpeedMps`). */
  readonly runSpeedMps: number;
  /** Desplazamiento defensivo lateral (F04, `defenderLateralSpeedMps`). */
  readonly lateralSpeedMps: number;
  readonly t23: Rating;
}

export interface TimedParticipant {
  readonly slot: string;
  readonly id: string;
  readonly arrivalSeconds: number;
}

function byArrivalThenId(a: TimedParticipant, b: TimedParticipant): number {
  return a.arrivalSeconds - b.arrivalSeconds || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Primer defensor que puede proteger el aro corriendo desde su posición
 * real (F01), con el ajuste interior de T23 que ya usa la protección del
 * aro en ME-01 (HF-002 §1.5).
 */
export function rimProtectorsRunning(defenders: readonly RaceParticipant[]): TimedParticipant[] {
  return defenders
    .map((d) => ({
      slot: d.slot,
      id: d.id,
      arrivalSeconds: Math.max(0, timeToReach(d.position, ATTACKED_HOOP, d.runSpeedMps) - interiorArrivalAdjustmentSeconds(d.t23)),
    }))
    .sort(byArrivalThenId);
}

export function firstRimProtectorRunning(defenders: readonly RaceParticipant[]): TimedParticipant {
  return rimProtectorsRunning(defenders)[0]!;
}

/**
 * Mismo criterio que la opción 1 del árbol de ME-01 ("finalizar si ya
 * tiene carril al aro antes de que llegue el protector"), con los
 * defensores ya cerca del aro desplazándose lateralmente (F04 + T23).
 */
export function firstRimProtectorInPaint(defenders: readonly RaceParticipant[]): TimedParticipant {
  const timed = defenders.map((d) => ({
    slot: d.slot,
    id: d.id,
    arrivalSeconds: Math.max(0, timeToReach(d.position, ATTACKED_HOOP, d.lateralSpeedMps) - interiorArrivalAdjustmentSeconds(d.t23)),
  }));
  return [...timed].sort(byArrivalThenId)[0]!;
}

export type TransitionRead =
  | {
      readonly kind: "penetracion";
      readonly carrier: TimedParticipant;
      readonly firstDefender: TimedParticipant;
    }
  | {
      readonly kind: "pase_adelantado";
      readonly carrier: TimedParticipant;
      readonly receiver: TimedParticipant;
      readonly passReleaseSeconds: number;
      readonly passArrivalSeconds: number;
      readonly firstDefender: TimedParticipant;
    }
  | {
      /**
       * Superioridad 2×1 generada por las carreras (P10 del catálogo): el
       * primer defensor para al portador en el aro y el compañero recibe
       * antes de que llegue el segundo defensor, que es quien le disputa.
       */
      readonly kind: "superioridad";
      readonly carrier: TimedParticipant;
      readonly receiver: TimedParticipant;
      readonly passReleaseSeconds: number;
      readonly passArrivalSeconds: number;
      readonly firstDefender: TimedParticipant;
      readonly secondDefender: TimedParticipant;
    }
  | {
      /**
       * Superioridad 3×2 (ME-03, aclaración opción B): los dos primeros
       * defensores ya contienen al portador y al primer receptor (el
       * "corredor"), pero un segundo receptor ("el exterior") recibe antes
       * de que llegue un tercer defensor posicionado — o no hay ninguno.
       * El pase sale directamente del portador, saltando al corredor ya
       * contenido: no se inventa una segunda asistencia.
       */
      readonly kind: "superioridad_3x2";
      readonly carrier: TimedParticipant;
      /** El corredor: recibiría a tiempo, pero el segundo defensor lo cierra. */
      readonly contained: TimedParticipant;
      /** El exterior: recibe el pase directo del portador y es quien tira. */
      readonly receiver: TimedParticipant;
      readonly passReleaseSeconds: number;
      readonly passArrivalSeconds: number;
      readonly firstDefender: TimedParticipant;
      readonly secondDefender: TimedParticipant;
      readonly thirdDefender: TimedParticipant | null;
    }
  | {
      readonly kind: "sin_ventaja";
      readonly firstDefender: TimedParticipant;
      readonly fastestAttacker: TimedParticipant;
      readonly reason: string;
    };

/** Un defensor solo protege si ya está entre el balón y el aro atacado: por
 * detrás del portador (más cerca de su propio aro) todavía no participa en
 * la lectura, por rápido que corra después (ME-03, aclaración opción B). */
function isPositioned(defenderX: number, ballX: number): boolean {
  return defenderX >= ballX;
}

/**
 * Ventana de ventaja temprana tras rebote defensivo, robo, recuperación o
 * saque (ME-03 §4): existe si el portador (penetración) o un compañero al
 * que el pase llega a tiempo (pase adelantado) alcanzan el aro antes que el
 * primer defensor responsable de protegerlo. Con ≤2 s de reloj de
 * lanzamiento no se habilita (misma regla de ME-01 para finalizar).
 */
export function readTransition(
  carrier: RaceParticipant,
  teammates: readonly RaceParticipant[],
  defenders: readonly RaceParticipant[],
  shotClockRemainingSeconds: number,
): TransitionRead {
  // Solo cuentan como protectores los defensores ya situados entre el
  // balón (posición real del portador en este instante) y el aro atacado;
  // uno que todavía va por detrás del portador no participa en la lectura
  // aunque su carrera completa lo llevaría a tiempo (ME-03, opción B).
  const allRanked = rimProtectorsRunning(defenders);
  const positioned = rimProtectorsRunning(
    defenders.filter((d) => isPositioned(d.position.x, carrier.position.x)),
  );
  const hasProtector = positioned.length > 0;
  const firstDefender = positioned[0] ?? allRanked[0]!;
  const secondDefender = positioned[1];
  const thirdDefender = positioned[2] ?? null;

  const carrierTimed: TimedParticipant = {
    slot: carrier.slot,
    id: carrier.id,
    arrivalSeconds: timeToReach(carrier.position, ATTACKED_HOOP, carrier.runSpeedMps),
  };
  const passArrivalSeconds = PASS_RELEASE_SECONDS + distance(carrier.position, ATTACKED_HOOP) / PASS_FLIGHT_SPEED_MPS;
  const leaders = teammates
    .map((a) => {
      const run = timeToReach(a.position, ATTACKED_HOOP, a.runSpeedMps);
      return { slot: a.slot, id: a.id, arrivalSeconds: Math.max(run, passArrivalSeconds) };
    })
    .sort(byArrivalThenId);
  const leader = leaders[0];
  const fastestAttacker = [carrierTimed, ...(leader ? [leader] : [])].sort(byArrivalThenId)[0]!;

  if (shotClockRemainingSeconds <= 2) {
    return {
      kind: "sin_ventaja",
      firstDefender,
      fastestAttacker,
      reason: "reloj de lanzamiento de 2 s o menos: no se habilita una finalización en carrera",
    };
  }
  if (!hasProtector || carrierTimed.arrivalSeconds < firstDefender.arrivalSeconds) {
    return { kind: "penetracion", carrier: carrierTimed, firstDefender };
  }
  const laneBlocker = firstInterceptor(carrier.position, ATTACKED_HOOP, PASS_RELEASE_SECONDS, defenders);
  if (leader && leader.arrivalSeconds < firstDefender.arrivalSeconds && !laneBlocker) {
    return {
      kind: "pase_adelantado",
      carrier: carrierTimed,
      receiver: leader,
      passReleaseSeconds: PASS_RELEASE_SECONDS,
      passArrivalSeconds,
      firstDefender,
    };
  }
  // 2×1: el portador llega al aro después del primer defensor (que le para)
  // pero antes que el segundo, y un compañero recibe también antes que el
  // segundo. El pase sale cuando el portador llega al aro.
  if (secondDefender && carrierTimed.arrivalSeconds < secondDefender.arrivalSeconds) {
    const releaseSeconds = carrierTimed.arrivalSeconds + PASS_RELEASE_SECONDS;
    const options = teammates
      .map((a) => {
        const run = timeToReach(a.position, ATTACKED_HOOP, a.runSpeedMps);
        // El compañero recibe junto al aro: el vuelo del pase es corto; se
        // toma la distancia real del portador (en el aro) al compañero cuando
        // este llegue, que es el propio aro.
        return { slot: a.slot, id: a.id, arrivalSeconds: Math.max(run, releaseSeconds) };
      })
      .sort(byArrivalThenId);
    const receiver = options[0];
    if (receiver && receiver.arrivalSeconds < secondDefender.arrivalSeconds) {
      // 3×2 (opción B): el corredor (`receiver`) también recibe a tiempo,
      // pero queda contenido por el segundo defensor. Si un segundo
      // compañero ("el exterior") llega antes que un tercer defensor ya
      // situado — o no hay ninguno —, el portador le pasa directamente:
      // no se inventa una asistencia intermedia del corredor ya contenido.
      const secondReceiver = options.find((o) => o.id !== receiver.id);
      if (secondReceiver && (!thirdDefender || secondReceiver.arrivalSeconds < thirdDefender.arrivalSeconds)) {
        return {
          kind: "superioridad_3x2",
          carrier: carrierTimed,
          contained: receiver,
          receiver: secondReceiver,
          passReleaseSeconds: releaseSeconds,
          passArrivalSeconds: secondReceiver.arrivalSeconds,
          firstDefender,
          secondDefender,
          thirdDefender,
        };
      }
      return {
        kind: "superioridad",
        carrier: carrierTimed,
        receiver,
        passReleaseSeconds: carrierTimed.arrivalSeconds,
        passArrivalSeconds: receiver.arrivalSeconds,
        firstDefender,
        secondDefender,
      };
    }
  }
  return {
    kind: "sin_ventaja",
    firstDefender,
    fastestAttacker,
    reason: secondDefender
      ? "el primer defensor llega al aro antes que el portador y el segundo antes que cualquier compañero"
      : "el primer defensor llega al aro antes que cualquier atacante con balón",
  };
}

/**
 * ME-07A §3.2: profundidad máxima detrás de la línea de tres para
 * considerar el triple de transición del propio portador. Sin este
 * límite, "detrás de la línea" incluye todo el espacio entre el medio
 * campo y el arco (>5 m de margen), lo que ofrecía la vía en casi
 * cualquier transición sin ventaja y disparaba el volumen de tiro de
 * forma irreal. Parámetro nuevo, declarado aquí explícitamente (no
 * escondido en la interfaz): acota la vía a una posición ya de tiro
 * real, no a "en algún punto del camino hacia el aro".
 */
export const TRANSITION_THREE_DEPTH_BUFFER_METERS = 2;

export interface TransitionThreeOpportunity {
  readonly eligible: boolean;
  readonly windowMarginSeconds: number;
  readonly depthBehindLineMeters: number;
  readonly closeoutArrivalSeconds: number;
  readonly nearestDefender: RaceParticipant;
}

/**
 * Ventana real de triple del propio portador cuando el aro está contenido
 * pero la transición no ofrece penetración, pase adelantado ni
 * superioridad (ME-07A §3.2): el defensor que de verdad contestaría no es
 * necesariamente el protector del aro (`firstDefender` de `readTransition`),
 * sino el que puede llegar antes hasta el propio portador desde su
 * posición real. Elegible solo si el portador está detrás de la línea, a
 * una profundidad razonable tras ella (`TRANSITION_THREE_DEPTH_BUFFER_METERS`)
 * y con el mismo margen de 0,25 s que usa la primera lectura del bloqueo
 * directo entre el tiro listo y el cierre del defensor. Pura: no decide
 * si se toma (eso es la tendencia de tiro del jugador, fuera de esta
 * función) ni consume el generador.
 */
export function evaluateTransitionThreeOpportunity(
  carrierPos: Point2D,
  defenders: readonly RaceParticipant[],
  shotClockRemainingSeconds: number,
): TransitionThreeOpportunity {
  const nearestDefender = [...defenders].sort(
    (a, b) => timeToReach(a.position, carrierPos, a.lateralSpeedMps) - timeToReach(b.position, carrierPos, b.lateralSpeedMps),
  )[0]!;
  const closeoutArrivalSeconds = timeToReach(nearestDefender.position, carrierPos, nearestDefender.lateralSpeedMps);
  const windowMarginSeconds = closeoutArrivalSeconds - CATCH_AND_SHOOT_PREP_SECONDS;
  const depthBehindLineMeters = distanceToHoop(carrierPos) - FIBA_THREE_POINT_RADIUS_METERS;
  const eligible =
    shotClockRemainingSeconds > 2 &&
    isBehindThreePointLine(carrierPos) &&
    depthBehindLineMeters <= TRANSITION_THREE_DEPTH_BUFFER_METERS &&
    windowMarginSeconds >= 0.25;
  return { eligible, windowMarginSeconds, depthBehindLineMeters, closeoutArrivalSeconds, nearestDefender };
}

/**
 * Triple del portador en transición planificado hasta su punto real de
 * lanzamiento (ME-07B v2 §2.5). La ventana ya no se lee en el cruce del
 * medio campo (a más de 5 m del arco, donde la regla de profundidad nunca
 * podía cumplirse y la vía no llegaba a existir): el portador sigue botando
 * en línea recta hacia el aro hasta un punto detrás del arco, a una de las
 * profundidades candidatas (acotadas por `TRANSITION_THREE_DEPTH_BUFFER_METERS`),
 * y cada defensor puede salir a cerrarle desde su posición real en el cruce,
 * a su velocidad lateral. La oposición es la que resulta de esa geometría
 * (el nivel lo calcula quien llama con la regla R_contest de LAB-0.3).
 */
export const TRANSITION_PULL_UP_DEPTHS_METERS: readonly number[] = [TRANSITION_THREE_DEPTH_BUFFER_METERS, 1.25, 0.5];

export interface TransitionPullUpCandidate {
  readonly spot: Point2D;
  readonly depthBehindLineMeters: number;
  /** Carrera con balón desde la posición actual hasta el punto, s. */
  readonly travelSeconds: number;
  readonly closer: RaceParticipant;
  /** Llegada del defensor que antes cierra, s desde ahora. */
  readonly closeoutArrivalSeconds: number;
}

export function planTransitionPullUps(carrier: RaceParticipant, defenders: readonly RaceParticipant[]): TransitionPullUpCandidate[] {
  const total = distance(carrier.position, ATTACKED_HOOP);
  if (total <= 0) return [];
  const out: TransitionPullUpCandidate[] = [];
  for (const depth of TRANSITION_PULL_UP_DEPTHS_METERS) {
    const toHoop = FIBA_THREE_POINT_RADIUS_METERS + depth;
    if (toHoop > total) continue; // ya está más cerca que ese punto: no retrocede para tirar
    const along = total - toHoop;
    const spot = {
      x: carrier.position.x + ((ATTACKED_HOOP.x - carrier.position.x) * along) / total,
      y: carrier.position.y + ((ATTACKED_HOOP.y - carrier.position.y) * along) / total,
    };
    const closer = [...defenders].sort(
      (a, b) => timeToReach(a.position, spot, a.lateralSpeedMps) - timeToReach(b.position, spot, b.lateralSpeedMps) || (a.id < b.id ? -1 : 1),
    )[0]!;
    out.push({
      spot,
      depthBehindLineMeters: depth,
      travelSeconds: along / carrier.runSpeedMps,
      closer,
      closeoutArrivalSeconds: timeToReach(closer.position, spot, closer.lateralSpeedMps),
    });
  }
  return out;
}

export interface SecondChanceRead {
  readonly putback: boolean;
  readonly rebounderArrivalSeconds: number;
  readonly firstDefender: TimedParticipant;
}

/**
 * Tras rebote ofensivo (ME-03 §3): segunda oportunidad inmediata solo si el
 * reboteador tiene carril al aro antes que el primer protector (criterio de
 * la opción 1); si no, la posesión sale y se reorganiza con sus 14 s. No
 * está obligado a tirar.
 */
export function readSecondChance(rebounder: RaceParticipant, defenders: readonly RaceParticipant[]): SecondChanceRead {
  const firstDefender = firstRimProtectorInPaint(defenders);
  const rebounderArrivalSeconds = timeToReach(rebounder.position, ATTACKED_HOOP, rebounder.runSpeedMps);
  return { putback: rebounderArrivalSeconds < firstDefender.arrivalSeconds, rebounderArrivalSeconds, firstDefender };
}

export interface OutletRead {
  readonly viable: boolean;
  readonly passArrivalSeconds: number;
  readonly closestDefender: TimedParticipant;
  /** Defensor que podría cortar la línea del pase, si lo hay. */
  readonly interceptor: TimedParticipant | null;
}

/**
 * Salida tras rebote defensivo, robo o saque: el pase al base es viable si
 * ningún rival puede llegar al receptor ni cortar la línea antes que el
 * balón (misma velocidad de pase LAB-0.1). Si no lo es, el portador
 * conserva y sube el balón.
 */
export function readOutlet(
  holderPosition: Point2D,
  receiverPosition: Point2D,
  defenders: readonly RaceParticipant[],
): OutletRead {
  const passArrivalSeconds = PASS_RELEASE_SECONDS + distance(holderPosition, receiverPosition) / PASS_FLIGHT_SPEED_MPS;
  const closestDefender = defenders
    .map((d) => ({ slot: d.slot, id: d.id, arrivalSeconds: timeToReach(d.position, receiverPosition, d.runSpeedMps) }))
    .sort(byArrivalThenId)[0]!;
  const interceptor = firstInterceptor(holderPosition, receiverPosition, PASS_RELEASE_SECONDS, defenders);
  return {
    viable: closestDefender.arrivalSeconds > passArrivalSeconds && !interceptor,
    passArrivalSeconds,
    closestDefender,
    interceptor,
  };
}

/**
 * Segundos después de salir en que un desplazamiento recto de `from` a
 * `to` (duración `durationSeconds`) entra en la pista delantera local
 * (x > línea central). `0` si ya estaba en ella; `null` si no llega.
 */
export function frontcourtEntryOffsetSeconds(from: Point2D, to: Point2D, durationSeconds: number): number | null {
  if (from.x > MIDCOURT_LINE_X) return 0;
  if (to.x <= MIDCOURT_LINE_X) return null;
  const fraction = (MIDCOURT_LINE_X - from.x) / (to.x - from.x);
  // El balón sobre la línea central sigue en pista trasera: entra un
  // milisegundo después de tocarla.
  return fraction * durationSeconds + 0.001;
}
