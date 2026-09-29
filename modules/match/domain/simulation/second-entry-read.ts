/**
 * Segunda entrada del **mismo** bloqueo directo (ME-04 §5), no una táctica
 * nueva. Solo en el partido (reglas de partido del núcleo enlazado): cuando
 * la primera lectura del bloqueo central queda **negada** —el continuador
 * recibe pero su defensor lo contiene de verdad y la inversión a la
 * esquina está cerrada, el punto en que ME-01 forzaría el tiro bajo
 * contención—, el continuador puede sacar el balón con un pase real a un
 * exterior (O2/O4) que pasa a ser el creador secundario; el bloqueador se
 * recoloca para ponerle la pantalla desde su nuevo ángulo y el árbol de
 * ME-01/ME-02 se juega de nuevo desde las posiciones alcanzadas, con reloj
 * y posiciones corriendo durante la recolocación. Si ni la línea de pase,
 * ni las ubicaciones, ni los segundos de tiro lo hacen viable, se conserva
 * el tiro forzado existente.
 *
 * Geometría: la **misma** relación entre manejador, bloqueador y defensa
 * del bloqueo aprobada en `scenario.ts` (vector O1→O5, O1→D1, O1→D5),
 * girada rígidamente para que apunte del creador al aro igual que en la
 * disposición original. No introduce coordenadas deportivas nuevas. Los
 * puntos de referencia LAB-0.2 del short roll y de la esquina débil no
 * cambian: es una simplificación declarada (`ACTIONS.md`).
 */
import type { Point2D } from "../geometry/point";
import { distance, timeToReach } from "../geometry/point";
import { ATTACKED_HOOP, isBehindThreePointLine, isInsideCourt } from "../geometry/court";
import { MIDCOURT_LINE_X } from "../geometry/frame";
import { SCREEN_SET_AFTER_ARRIVAL_SECONDS, PASS_RELEASE_SECONDS } from "../lab/lab-0-1-parameters";
import { firstInterceptor, type RaceParticipant } from "../sequence/transition";

export type CreatorSlot = "O2" | "O4";

export function isCreatorSlot(slot: string): slot is CreatorSlot {
  return slot === "O2" || slot === "O4";
}

function rotate(v: Point2D, angle: number): Point2D {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function angleTo(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Destino girado: `creator + R·(base[slot] − base.O1)`. */
function relative(base: Readonly<Record<string, Point2D>>, slot: string, creator: Point2D, angle: number): Point2D {
  const v = rotate({ x: base[slot]!.x - base.O1!.x, y: base[slot]!.y - base.O1!.y }, angle);
  return { x: creator.x + v.x, y: creator.y + v.y };
}

export type SecondEntryPlan =
  | { readonly viable: false; readonly reason: string }
  | {
      readonly viable: true;
      readonly creatorSlot: CreatorSlot;
      /** Roles canónicos intercambiados: rol → rol de origen (O1↔Ox, D1↔Dx). */
      readonly slotSwap: Readonly<Record<string, string>>;
      /** Destinos de la segunda disposición en el marco local, por rol canónico **nuevo**. */
      readonly targets: Readonly<Record<string, Point2D>>;
      readonly screenSetSeconds: number;
      readonly reason: string;
    };

export interface SecondEntryFacts {
  readonly creatorSlot: string;
  /** Posiciones locales por rol canónico **original** en el instante de decidir. */
  readonly local: Readonly<Record<string, Point2D>>;
  /** Disposición aprobada del bloqueo (`scenario.ts`), marco local. */
  readonly base: Readonly<Record<string, Point2D>>;
  /** Posiciones locales de quien saca el balón, del creador y de los cinco defensores al decidir. */
  readonly passerAtRelease: Point2D;
  readonly creatorAtRelease: Point2D;
  readonly defendersAtRelease: readonly RaceParticipant[];
  readonly screenerSpeedMps: number;
  readonly shotClockRemainingSeconds: number;
}

/** Con 2 s o menos tras colocar la pantalla no se inicia la acción (misma regla de ME-01/ME-03). */
const MIN_SECONDS_AFTER_SCREEN = 2;

export function planSecondEntry(facts: SecondEntryFacts): SecondEntryPlan {
  if (!isCreatorSlot(facts.creatorSlot)) {
    return { viable: false, reason: `${facts.creatorSlot} no es un exterior del sistema (O2/O4)` };
  }
  const creatorSlot = facts.creatorSlot;
  const creator = facts.local[creatorSlot]!;
  if (creator.x <= MIDCOURT_LINE_X || !isBehindThreePointLine(creator)) {
    return { viable: false, reason: `${creatorSlot} no está en posición exterior de pista delantera` };
  }
  const interceptor = firstInterceptor(facts.passerAtRelease, facts.creatorAtRelease, PASS_RELEASE_SECONDS, facts.defendersAtRelease);
  if (interceptor) {
    return { viable: false, reason: `la línea de pase hacia ${creatorSlot} está al alcance de ${interceptor.slot}` };
  }

  const angle = angleTo(creator, ATTACKED_HOOP) - angleTo(facts.base.O1!, ATTACKED_HOOP);
  const screen = relative(facts.base, "O5", creator, angle);
  if (!isInsideCourt(screen) || screen.x <= MIDCOURT_LINE_X) {
    return { viable: false, reason: "el nuevo punto de bloqueo quedaría fuera de la pista delantera" };
  }
  const screenSetSeconds = timeToReach(facts.local.O5!, screen, facts.screenerSpeedMps) + SCREEN_SET_AFTER_ARRIVAL_SECONDS;
  if (facts.shotClockRemainingSeconds - screenSetSeconds <= MIN_SECONDS_AFTER_SCREEN) {
    return {
      viable: false,
      reason: `recolocar el bloqueo costaría ${screenSetSeconds.toFixed(2)} s y dejaría 2 s o menos de lanzamiento`,
    };
  }

  const defenderSlot = `D${creatorSlot.slice(1)}`;
  const slotSwap: Record<string, string> = {
    O1: creatorSlot,
    [creatorSlot]: "O1",
    D1: defenderSlot,
    [defenderSlot]: "D1",
  };
  const targets: Record<string, Point2D> = { ...facts.base };
  targets.O1 = creator;
  targets[creatorSlot] = facts.base[creatorSlot]!;
  targets.O5 = screen;
  targets.D1 = relative(facts.base, "D1", creator, angle);
  targets.D5 = relative(facts.base, "D5", creator, angle);
  targets[defenderSlot] = facts.base[defenderSlot]!;
  return {
    viable: true,
    creatorSlot,
    slotSwap,
    targets,
    screenSetSeconds,
    reason: `línea de pase limpia hacia ${creatorSlot}, que está en el exterior, y ${(facts.shotClockRemainingSeconds - screenSetSeconds).toFixed(1).replace(".", ",")} s de lanzamiento tras recolocar la pantalla a ${distance(facts.local.O5!, screen).toFixed(1).replace(".", ",")} m`,
  };
}
