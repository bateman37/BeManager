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
 *    declarado; solo si tampoco existe ese reajuste queda sin resolver y el
 *    partido lo explica (guardián).
 * 3. Nadie que acabe de entrar o salir puede invertir su cambio hasta que
 *    haya corrido el reloj y llegue otro balón muerto (`locked`); así una
 *    misma parada nunca produce sustituciones infinitas. Quien debe tirar
 *    libres por la falta recibida (`protectedIds`) no sale.
 */
import type { Milliseconds } from "../time/clock";
import type { FunctionalRole } from "../players/functional-roles";

export const SUBSTITUTION_POLICY_VERSION = "ME-04-ROT-2";

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
}

export interface SubstitutionPlan {
  readonly changes: readonly PlannedSubstitution[];
  /** Excluidos sin suplente elegible y compatible: estado reglamentario que el partido debe explicar. */
  readonly unresolved: readonly { readonly outId: string; readonly role: FunctionalRole }[];
}

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
  const unresolved: { outId: string; role: FunctionalRole }[] = [];

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
      unresolved.push({ outId: id, role });
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
