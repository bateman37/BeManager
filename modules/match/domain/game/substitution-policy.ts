/**
 * Rotación automática **fija** del laboratorio (ME-04 §4), sin fatiga ni
 * lectura del marcador: el cansancio y las órdenes manuales llegan en
 * ME-05. Función pura: recibe el estado de la oportunidad legal (que ya
 * decidió el perfil de reglas) y devuelve los cambios.
 *
 * 1. **Exclusiones** (quinta falta): se sustituyen siempre, antes que las
 *    voluntarias y sin consumir su cupo.
 * 2. **Voluntarias**: como máximo `voluntaryCap` por equipo (dos en una
 *    parada; cinco entre períodos). Solo son candidatos quienes llevan al
 *    menos `continuousThresholdMs` (5:00) de reloj jugado continuo desde
 *    su última entrada; primero el de mayor tiempo continuo, desempate por
 *    ID estable. Para cada puesto entra el suplente elegible con ese rol
 *    declarado y **menos minutos en todo el partido**, desempate por ID.
 *    Sin suplente compatible, el jugador sigue en pista.
 *    **Relevo por reajuste (ME-04-ROT-2):** si ningún suplente declara el
 *    rol del excluido, un compañero en pista que sí lo declara pasa a ese
 *    rol y entra por el suyo el suplente elegible (con ese rol declarado y
 *    menos minutos; desempate por rol e ID). Todos siguen en un rol
 *    declarado.
 *    **Relevo de emergencia (ME-04-ROT-3, decisión de Dennis, 01-10-2026):**
 *    solo si ni el relevo por rol ni el reajuste completan el quinteto, entra
 *    un suplente inscrito y habilitado aunque no declare el rol vacante. Se
 *    elige la asignación de los cinco (cuatro en pista + uno que entra) que
 *    **conserve más roles declarados**; entre ellas, la de mayor capacidad
 *    pertinente en el puesto excepcional (media de los atributos que el
 *    motor lee para las tareas de esa ranura, `EMERGENCY_ROLE_TASK_ATTRIBUTES`),
 *    después menos reajustes en pista, menos minutos del que entra e ID.
 *    Sin sorteo: se reproduce igual con la misma entrada y no consume RNG.
 *    No cambia roles persistidos ni atributos y no aplica ningún malus: sus
 *    atributos reales son la única desventaja. El excluido nunca vuelve.
 *    Si quedan menos de cinco inscritos habilitados (`menos_de_cinco`), es
 *    otro caso reglamentario aún sin regla en el motor: queda sin resolver,
 *    sin fabricar un quinto jugador, y el partido lo explica (guardián).
 * 3. Nadie que acabe de entrar o salir puede invertir su cambio hasta que
 *    haya corrido el reloj y llegue otro balón muerto (`locked`); así una
 *    misma parada nunca produce sustituciones infinitas. Quien debe tirar
 *    libres por la falta recibida (`protectedIds`) no sale.
 */
import type { Milliseconds } from "../time/clock";
import type { FunctionalRole } from "../players/functional-roles";
import type { ActiveAttributeId } from "../players/attribute";

export const SUBSTITUTION_POLICY_VERSION = "ME-04-ROT-3";

/**
 * Capacidades pertinentes de cada rol para el relevo de emergencia
 * (ME-04-ROT-3): los atributos que el motor de esta versión lee
 * específicamente para la ranura de ese rol, en ataque (O_n) y en defensa
 * (D_n). No es un coeficiente: solo ordena candidatos para el puesto
 * excepcional; el juego posterior usa sus atributos reales, sin malus.
 */
export const EMERGENCY_ROLE_TASK_ATTRIBUTES: Readonly<Record<FunctionalRole, readonly ActiveAttributeId[]>> = {
  // O1 manejador del bloqueo (pase, tiro móvil, manejo, visión); D1 sobre el balón.
  1: ["T07", "T09", "T06", "M01", "T15", "T16", "F04"],
  // O2 ala/esquina (tirador exterior, carrera); D2 defensa perimetral.
  2: ["T04", "F01", "T22", "F04"],
  // O3 alero (triple, recepción, desmarque); D3 ayuda al roll (robo, interior, lectura).
  3: ["T04", "T11", "T21", "T17", "T23", "M05"],
  // O4 (triple, pantalla débil); D4 rotación a la esquina (robo, perímetro).
  4: ["T04", "T13", "T11", "T17", "T22", "F04"],
  // O5 bloqueador y continuador; D5 protección de aro y salida al bloqueo.
  5: ["T13", "T11", "T01", "F05", "T23", "T22", "F04", "M09"],
};

/** Capacidad pertinente de un jugador para un rol: media de sus atributos de esa tarea (8 si falta uno). */
export function emergencyRoleFit(attributes: Readonly<Partial<Record<ActiveAttributeId, number>>> | undefined, role: FunctionalRole): number {
  const ids = EMERGENCY_ROLE_TASK_ATTRIBUTES[role];
  return ids.reduce((sum, id) => sum + (attributes?.[id] ?? 8), 0) / ids.length;
}

/** 5:00 de reloj jugado continuo (ME-04 §4). */
export const CONTINUOUS_THRESHOLD_MS: Milliseconds = 5 * 60_000;
export const VOLUNTARY_CAP_PER_STOPPAGE = 2;
export const VOLUNTARY_CAP_BETWEEN_PERIODS = 5;

export interface RotationPlayerState {
  readonly id: string;
  readonly declaredRoles: readonly FunctionalRole[];
  readonly onCourt: boolean;
  readonly continuousMs: Milliseconds;
  readonly totalMs: Milliseconds;
  readonly disqualified: boolean;
  /** Entró o salió en esta misma parada (sin reloj corrido desde entonces). */
  readonly locked: boolean;
  /** Atributos reales (solo se leen en el relevo de emergencia, ME-04-ROT-3). */
  readonly attributes?: Readonly<Partial<Record<ActiveAttributeId, number>>>;
}

/** Quién asume un rol no declarado en un relevo de emergencia y con qué capacidad. */
export interface EmergencyOutOfRole {
  readonly playerId: string;
  readonly role: FunctionalRole;
  readonly declaredRoles: readonly FunctionalRole[];
  readonly fit: number;
}

/** Candidato comparado en el relevo de emergencia (mejor asignación posible con él). */
export interface EmergencyCandidate {
  readonly inId: string;
  readonly declaredKept: number;
  readonly outOfRole: readonly EmergencyOutOfRole[];
  readonly fit: number;
  readonly moves: number;
  readonly inTotalMs: Milliseconds;
}

export interface EmergencyFill {
  /** Quinteto resultante por rol (índice 0 = rol 1). */
  readonly lineupAfter: readonly string[];
  /** Compañeros en pista que cambian de rol para la asignación elegida. */
  readonly moves: readonly { readonly playerId: string; readonly fromRole: FunctionalRole; readonly toRole: FunctionalRole }[];
  readonly outOfRole: readonly EmergencyOutOfRole[];
  readonly declaredKept: number;
  /** Criterio que decidió frente al segundo mejor candidato. */
  readonly decidedBy: "unico_candidato" | "roles_declarados" | "capacidad_pertinente" | "menos_reajustes" | "menos_minutos" | "id";
  readonly candidates: readonly EmergencyCandidate[];
  readonly summary: string;
}

export interface SubstitutionPlanInput {
  /** Quinteto en pista por rol funcional 1–5 (`lineup[0]` es el rol 1). */
  readonly lineup: readonly string[];
  readonly players: readonly RotationPlayerState[];
  readonly voluntaryCap: number;
  readonly continuousThresholdMs: Milliseconds;
  readonly protectedIds: readonly string[];
}

export type SubstitutionReason = "exclusion" | "voluntaria";

export interface PlannedSubstitution {
  readonly outId: string;
  readonly inId: string;
  readonly role: FunctionalRole;
  readonly reason: SubstitutionReason;
  readonly outContinuousMs: Milliseconds;
  readonly inTotalMs: Milliseconds;
  /**
   * Reajuste en pista que hace posible el relevo de un excluido: `playerId`
   * pasa de `fromRole` (que ocupa quien entra, `role`) a `toRole` (el del
   * excluido).
   */
  readonly reassigned?: { readonly playerId: string; readonly fromRole: FunctionalRole; readonly toRole: FunctionalRole };
  /** Relevo de emergencia (ME-04-ROT-3): `role` es el que ocupa quien entra. */
  readonly emergency?: EmergencyFill;
}

export type UnresolvedKind = "sin_relevo" | "menos_de_cinco";

export interface SubstitutionPlan {
  readonly changes: readonly PlannedSubstitution[];
  /** Excluidos sin suplente elegible y compatible: estado reglamentario que el partido debe explicar. */
  readonly unresolved: readonly { readonly outId: string; readonly role: FunctionalRole; readonly kind: UnresolvedKind; readonly eligible: number }[];
}

/** Orden de candidatos de emergencia: más roles declarados, más capacidad, menos reajustes, menos minutos, ID. */
function compareOptions(a: EmergencyCandidate, b: EmergencyCandidate): number {
  return b.declaredKept - a.declaredKept || b.fit - a.fit || a.moves - b.moves || a.inTotalMs - b.inTotalMs || byId(a.inId, b.inId);
}

const permutations = <T>(items: readonly T[]): T[][] =>
  items.length <= 1 ? [[...items]] : items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));

function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function planSubstitutions(input: SubstitutionPlanInput): SubstitutionPlan {
  const byPlayer = new Map(input.players.map((p) => [p.id, p]));
  const lineup = [...input.lineup];
  const used = new Set<string>();
  /** Compañeros reajustados de rol en esta parada: no salen en ella. */
  const moved = new Set<string>();
  const changes: PlannedSubstitution[] = [];
  const unresolved: { outId: string; role: FunctionalRole; kind: UnresolvedKind; eligible: number }[] = [];

  const pickIncoming = (role: FunctionalRole): RotationPlayerState | undefined =>
    input.players
      .filter(
        (p) =>
          !p.onCourt &&
          !p.disqualified &&
          !p.locked &&
          !used.has(p.id) &&
          p.declaredRoles.includes(role),
      )
      .sort((a, b) => a.totalMs - b.totalMs || byId(a.id, b.id))[0];

  /**
   * ME-04-ROT-3: ni relevo por rol ni reajuste. Para cada suplente inscrito y
   * habilitado se busca la asignación de los cinco a los roles 1–5 que
   * conserva más roles declarados; los candidatos se ordenan por roles
   * conservados, capacidad pertinente en los puestos excepcionales, menos
   * reajustes en pista, menos minutos e ID (determinista, sin sorteo).
   */
  const emergencyFill = (outId: string, index: number, out: RotationPlayerState): void => {
    const role = (index + 1) as FunctionalRole;
    // Otros excluidos de esta misma parada conservan su ranura: se resuelven en su turno.
    const freeSlots = lineup.map((_, i) => i).filter((i) => i === index || !byPlayer.get(lineup[i]!)?.disqualified);
    const stay = freeSlots.filter((i) => i !== index).map((i) => lineup[i]!);
    const bench = input.players.filter((p) => !p.onCourt && !p.disqualified && !p.locked && !used.has(p.id));
    const eligible = input.players.filter((p) => !p.disqualified).length;
    if (eligible < 5 || bench.length === 0) {
      unresolved.push({ outId, role, kind: eligible < 5 ? "menos_de_cinco" : "sin_relevo", eligible });
      return;
    }
    const fixedRoles = new Map<string, FunctionalRole>();
    lineup.forEach((mateId, i) => {
      // Un compañero ya reajustado o entrado en esta parada conserva su rol.
      if (moved.has(mateId) || used.has(mateId)) fixedRoles.set(mateId, (i + 1) as FunctionalRole);
    });
    const currentRole = new Map(lineup.map((mateId, i) => [mateId, (i + 1) as FunctionalRole]));
    type Option = EmergencyCandidate & { readonly lineupAfter: readonly string[] };
    const evaluated: Option[] = [];
    for (const incoming of bench) {
      let bestForIncoming: Option | null = null;
      for (const perm of permutations([...stay, incoming.id])) {
        const order = [...lineup];
        freeSlots.forEach((slot, k) => (order[slot] = perm[k]!));
        if (order.some((pid, i) => fixedRoles.has(pid) && fixedRoles.get(pid) !== i + 1)) continue;
        const outOfRole: EmergencyOutOfRole[] = [];
        let moves = 0;
        freeSlots.forEach((i) => {
          const pid = order[i]!;
          const r = (i + 1) as FunctionalRole;
          const p = byPlayer.get(pid)!;
          if (pid !== incoming.id && currentRole.get(pid) !== r) moves += 1;
          if (!p.declaredRoles.includes(r)) outOfRole.push({ playerId: pid, role: r, declaredRoles: p.declaredRoles, fit: emergencyRoleFit(p.attributes, r) });
        });
        const option: Option = {
          inId: incoming.id,
          declaredKept: freeSlots.length - outOfRole.length,
          outOfRole,
          fit: Math.round(outOfRole.reduce((a, o) => a + o.fit, 0) * 1e4) / 1e4,
          moves,
          inTotalMs: incoming.totalMs,
          lineupAfter: order,
        };
        if (!bestForIncoming || compareOptions(option, bestForIncoming) < 0) bestForIncoming = option;
      }
      if (bestForIncoming) evaluated.push(bestForIncoming);
    }
    evaluated.sort(compareOptions);
    const chosen = evaluated[0];
    if (!chosen) {
      unresolved.push({ outId, role, kind: "sin_relevo", eligible });
      return;
    }
    const runnerUp = evaluated[1];
    const decidedBy: EmergencyFill["decidedBy"] = !runnerUp
      ? "unico_candidato"
      : chosen.declaredKept !== runnerUp.declaredKept
        ? "roles_declarados"
        : chosen.fit !== runnerUp.fit
          ? "capacidad_pertinente"
          : chosen.moves !== runnerUp.moves
            ? "menos_reajustes"
            : chosen.inTotalMs !== runnerUp.inTotalMs
              ? "menos_minutos"
              : "id";
    const incomingRole = (chosen.lineupAfter.indexOf(chosen.inId) + 1) as FunctionalRole;
    const moves = freeSlots
      .map((i) => ({ playerId: chosen.lineupAfter[i]!, fromRole: currentRole.get(chosen.lineupAfter[i]!)!, toRole: (i + 1) as FunctionalRole }))
      .filter((m) => m.playerId !== chosen.inId && m.fromRole !== m.toRole);
    const summary =
      `${outId} (rol ${role}) excluido sin relevo declarado; entra ${chosen.inId} como rol ${incomingRole}` +
      (moves.length > 0 ? `, ${moves.map((m) => `${m.playerId} ${m.fromRole}→${m.toRole}`).join(", ")}` : "") +
      `; fuera de rol declarado: ${chosen.outOfRole.map((o) => `${o.playerId} en rol ${o.role} (capacidad ${o.fit.toFixed(2)})`).join(", ") || "nadie"}` +
      `; ${chosen.declaredKept}/${freeSlots.length} roles declarados; decide: ${decidedBy}.`;
    used.add(chosen.inId);
    for (const m of moves) moved.add(m.playerId);
    chosen.lineupAfter.forEach((pid, i) => (lineup[i] = pid));
    changes.push({
      outId,
      inId: chosen.inId,
      role: incomingRole,
      reason: "exclusion",
      outContinuousMs: out.continuousMs,
      inTotalMs: chosen.inTotalMs,
      emergency: {
        lineupAfter: chosen.lineupAfter,
        moves,
        outOfRole: chosen.outOfRole,
        declaredKept: chosen.declaredKept,
        decidedBy,
        candidates: evaluated.map((c) => ({ inId: c.inId, declaredKept: c.declaredKept, outOfRole: c.outOfRole, fit: c.fit, moves: c.moves, inTotalMs: c.inTotalMs })),
        summary,
      },
    });
  };

  // 1. Exclusiones obligatorias, sin consumir el cupo voluntario.
  lineup.forEach((id, index) => {
    const player = byPlayer.get(id);
    if (!player?.disqualified) return;
    const role = (index + 1) as FunctionalRole;
    const incoming = pickIncoming(role);
    if (incoming) {
      used.add(incoming.id);
      lineup[index] = incoming.id;
      changes.push({ outId: id, inId: incoming.id, role, reason: "exclusion", outContinuousMs: player.continuousMs, inTotalMs: incoming.totalMs });
      return;
    }
    // Relevo por reajuste: un compañero en pista que declara el rol del
    // excluido pasa a él y el suplente entra por el rol que deja libre.
    let best: { mateIndex: number; incoming: RotationPlayerState } | null = null;
    lineup.forEach((mateId, mateIndex) => {
      if (mateIndex === index || moved.has(mateId) || used.has(mateId)) return;
      const mate = byPlayer.get(mateId);
      if (!mate || mate.disqualified || !mate.declaredRoles.includes(role)) return;
      const candidate = pickIncoming((mateIndex + 1) as FunctionalRole);
      if (candidate && (!best || candidate.totalMs < best.incoming.totalMs)) best = { mateIndex, incoming: candidate };
    });
    if (!best) {
      emergencyFill(id, index, player);
      return;
    }
    const { mateIndex, incoming: viaMate } = best as { mateIndex: number; incoming: RotationPlayerState };
    const mateId = lineup[mateIndex]!;
    used.add(viaMate.id);
    moved.add(mateId);
    lineup[index] = mateId;
    lineup[mateIndex] = viaMate.id;
    const fromRole = (mateIndex + 1) as FunctionalRole;
    changes.push({
      outId: id,
      inId: viaMate.id,
      role: fromRole,
      reason: "exclusion",
      outContinuousMs: player.continuousMs,
      inTotalMs: viaMate.totalMs,
      reassigned: { playerId: mateId, fromRole, toRole: role },
    });
  });

  // 2. Voluntarias: candidatos con 5:00 continuos, mayor tiempo primero.
  // Sobre el quinteto ya corregido por las exclusiones (índice = rol vigente).
  const candidates = lineup
    .map((id, index) => ({ player: byPlayer.get(id)!, index }))
    .filter(
      ({ player }) =>
        !player.disqualified &&
        !used.has(player.id) &&
        !moved.has(player.id) &&
        !player.locked &&
        !input.protectedIds.includes(player.id) &&
        player.continuousMs >= input.continuousThresholdMs,
    )
    .sort((a, b) => b.player.continuousMs - a.player.continuousMs || byId(a.player.id, b.player.id));

  let voluntary = 0;
  for (const { player, index } of candidates) {
    if (voluntary >= input.voluntaryCap) break;
    const role = (index + 1) as FunctionalRole;
    const incoming = pickIncoming(role);
    if (!incoming) continue;
    used.add(incoming.id);
    lineup[index] = incoming.id;
    voluntary += 1;
    changes.push({ outId: player.id, inId: incoming.id, role, reason: "voluntaria", outContinuousMs: player.continuousMs, inTotalMs: incoming.totalMs });
  }

  return { changes, unresolved };
}
