/**
 * Acta del partido proyectada **desde los hechos** (ME-04 §6), en una sola
 * pasada: cada hecho se lee una vez y no se ajusta nada después. Separada
 * de la adjudicación FIBA (que ya decidió cada hecho) y del motor.
 *
 * Convenciones del Manual de Estadísticos FIBA 2024 alcanzables hoy:
 * - FGA/FGM solo con `field_goal_attempt` (falta de tiro con fallo → no
 *   FGA; and-one → FGA y FGM; tapón → FGA). Un tiro solo preparado no.
 * - Rebote: control de un jugador tras tiro de campo o último libre
 *   fallados, también tras tapón. Rebote de equipo cuando el fallo termina
 *   en saque sin control de jugador (balón fuera). Si el período acaba con
 *   el balón en el aire o suelto, no hay rebote.
 * - Asistencia solo si el último pase documentado llevó directamente a la
 *   canasta (o a una falta de tiro cuyo tirador convierte al menos un
 *   libre): recepción del tirador sin otra acción entre medias.
 * - Pérdida al último jugador con control; robo solo si el defensor obtiene
 *   el control él mismo (convención de ME-03: un balón suelto recuperado no
 *   se anota como robo). Violación de 24 s u 8 s: pérdida de equipo.
 * - Minutos: intervalos de reloj de partido en marcha de los diez en pista.
 */
import type { Milliseconds } from "../time/clock";
import type { TramoEvent } from "../sequence/tramo-model";

export interface PlayerBoxLine {
  readonly playerId: string;
  readonly teamId: string;
  fgm2: number;
  fga2: number;
  fgm3: number;
  fga3: number;
  ftm: number;
  fta: number;
  points: number;
  oreb: number;
  dreb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  pf: number;
  pfd: number;
  minutesMs: Milliseconds;
  /** Nunca estuvo en pista con el reloj en marcha ni en ningún hecho del campo. */
  dnp: boolean;
}

export interface TeamBoxTotals {
  fgm2: number;
  fga2: number;
  fgm3: number;
  fga3: number;
  ftm: number;
  fta: number;
  points: number;
  oreb: number;
  dreb: number;
  ast: number;
  tov: number;
  stl: number;
  blk: number;
  pf: number;
  pfd: number;
  minutesMs: Milliseconds;
  /** Rebotes de equipo (sin control de jugador) y pérdidas de equipo. */
  teamRebounds: number;
  teamTurnovers: number;
}

export interface BoxScore {
  readonly players: Readonly<Record<string, PlayerBoxLine>>;
  readonly teams: Readonly<Record<string, TeamBoxTotals>>;
  /** Puntos por período y equipo (`periods[0]` es C1). */
  readonly periodPoints: readonly Readonly<Record<string, number>>[];
  readonly eventsProjected: number;
}

export interface BoxScoreRoster {
  readonly teamId: string;
  readonly playerIds: readonly string[];
}

function emptyLine(playerId: string, teamId: string): PlayerBoxLine {
  return { playerId, teamId, fgm2: 0, fga2: 0, fgm3: 0, fga3: 0, ftm: 0, fta: 0, points: 0, oreb: 0, dreb: 0, ast: 0, tov: 0, stl: 0, blk: 0, pf: 0, pfd: 0, minutesMs: 0, dnp: true };
}

/** Hechos que rompen el nexo «último pase → tiro»: el tirador ya hizo otra acción. */
const ASSIST_BREAKERS = new Set<string>([
  "organized_entry",
  "second_entry",
  "transition_read",
  "second_chance_read",
  "screen_navigated",
  "possession_continues",
  "phase_started",
  "possession_started",
]);

export function projectBoxScore(events: readonly TramoEvent[], rosters: readonly BoxScoreRoster[]): BoxScore {
  const teamOf = new Map<string, string>();
  const players: Record<string, PlayerBoxLine> = {};
  const teams: Record<string, TeamBoxTotals> = {};
  for (const r of rosters) {
    teams[r.teamId] = { fgm2: 0, fga2: 0, fgm3: 0, fga3: 0, ftm: 0, fta: 0, points: 0, oreb: 0, dreb: 0, ast: 0, tov: 0, stl: 0, blk: 0, pf: 0, pfd: 0, minutesMs: 0, teamRebounds: 0, teamTurnovers: 0 };
    for (const id of r.playerIds) {
      teamOf.set(id, r.teamId);
      players[id] = emptyLine(id, r.teamId);
    }
  }
  const periodPoints: Record<string, number>[] = [];
  const addPoints = (period: number, teamId: string, pts: number) => {
    while (periodPoints.length < period) periodPoints.push(Object.fromEntries(rosters.map((r) => [r.teamId, 0])));
    periodPoints[period - 1]![teamId] = (periodPoints[period - 1]![teamId] ?? 0) + pts;
  };

  let lastPass: { passer: string; receiver: string } | null = null;
  let pendingFreeThrowAssist: { passer: string; shooter: string; granted: boolean } | null = null;
  let lastControl: string | null = null;
  let pendingMiss = false;
  let looseFromBlock = false;
  let prev: TramoEvent | null = null;

  for (const e of events) {
    // Minutos: el reloj de partido que corrió entre dos hechos del mismo período, para quienes estaban en pista.
    if (prev && prev.period === e.period && prev.gameClockMs > e.gameClockMs) {
      const ran = prev.gameClockMs - e.gameClockMs;
      for (const id of prev.onCourtIds) {
        const line = players[id];
        if (line) {
          line.minutesMs += ran;
          line.dnp = false;
        }
      }
    }
    for (const id of e.onCourtIds) {
      const line = players[id];
      if (line) line.dnp = false;
    }
    prev = e;

    const actor = e.actors[0];
    const line = actor ? players[actor] : undefined;
    switch (e.kind) {
      case "pass_released":
        lastControl = actor ?? lastControl;
        lastPass = actor && e.actors[1] ? { passer: actor, receiver: e.actors[1] } : null;
        break;
      case "pass_received":
        lastControl = actor ?? lastControl;
        if (lastPass && lastPass.receiver !== actor) lastPass = null;
        break;
      case "throw_in_completed":
      case "jump_ball_control":
        lastControl = actor ?? lastControl;
        break;
      case "shot_prepared":
        lastControl = actor ?? lastControl;
        break;
      case "field_goal_attempt": {
        if (!line) break;
        const three = e.detail.shotType === "three_point";
        const made = e.detail.made === true;
        if (three) {
          line.fga3++;
          if (made) line.fgm3++;
        } else {
          line.fga2++;
          if (made) line.fgm2++;
        }
        if (made) {
          const pts = three ? 3 : 2;
          line.points += pts;
          addPoints(e.period, line.teamId, pts);
          if (lastPass && lastPass.receiver === actor && players[lastPass.passer]) players[lastPass.passer]!.ast++;
          pendingMiss = false;
        } else {
          pendingMiss = true;
        }
        lastPass = null;
        break;
      }
      case "shooting_foul":
        // Falta de tiro con fallo tras pase directo: asistencia si convierte al menos un libre.
        if (e.detail.madeShot !== true && lastPass && lastPass.receiver === actor) {
          pendingFreeThrowAssist = { passer: lastPass.passer, shooter: actor!, granted: false };
        } else {
          pendingFreeThrowAssist = null;
        }
        pendingMiss = false;
        lastPass = null;
        break;
      case "free_throws_result": {
        if (!line) break;
        line.fta++;
        const made = e.detail.made === true;
        if (made) {
          line.ftm++;
          line.points += 1;
          addPoints(e.period, line.teamId, 1);
          if (pendingFreeThrowAssist && pendingFreeThrowAssist.shooter === actor && !pendingFreeThrowAssist.granted) {
            const passer = players[pendingFreeThrowAssist.passer];
            if (passer) passer.ast++;
            pendingFreeThrowAssist.granted = true;
          }
        }
        const last = e.detail.index === e.detail.of;
        if (last) {
          pendingFreeThrowAssist = null;
          pendingMiss = !made;
        }
        break;
      }
      case "rebound_secured":
      case "rebound_contested":
        if (line) {
          if (e.possessionTeamId === line.teamId) line.oreb++;
          else line.dreb++;
        }
        pendingMiss = false;
        lastControl = actor ?? lastControl;
        lastPass = null;
        break;
      case "shot_blocked":
        if (line) line.blk++;
        looseFromBlock = true;
        pendingMiss = false;
        break;
      case "pass_control_lost":
        looseFromBlock = false;
        break;
      case "loose_ball_recovered": {
        if (line) {
          const sameTeam = e.possessionTeamId === line.teamId;
          if (looseFromBlock) {
            // Recuperar un tiro taponado es un rebote (Manual FIBA).
            if (sameTeam) line.oreb++;
            else line.dreb++;
          } else if (!sameTeam && lastControl && players[lastControl]) {
            players[lastControl]!.tov++;
          }
        }
        looseFromBlock = false;
        lastControl = actor ?? lastControl;
        lastPass = null;
        break;
      }
      case "turnover": {
        // El defensor que termina con el balón roba; pierde el último atacante con control.
        const stealer = e.actors[e.actors.length - 1];
        if (stealer && players[stealer]) players[stealer]!.stl++;
        if (lastControl && players[lastControl] && teamOf.get(lastControl) !== teamOf.get(stealer ?? "")) players[lastControl]!.tov++;
        lastControl = stealer ?? lastControl;
        lastPass = null;
        break;
      }
      case "out_of_bounds":
        if (pendingMiss && actor) {
          // Fallo sin control de jugador que acaba en saque: rebote de equipo para quien saca.
          const shooterTeam = teamOf.get(actor);
          const other = rosters.find((r) => r.teamId !== shooterTeam)?.teamId;
          if (other) teams[other]!.teamRebounds++;
        }
        pendingMiss = false;
        break;
      case "shot_clock_violation":
      case "backcourt_violation":
        if (e.possessionTeamId && teams[e.possessionTeamId]) teams[e.possessionTeamId]!.teamTurnovers++;
        break;
      case "throw_in_violation":
        if (line) line.tov++;
        break;
      case "personal_foul": {
        if (line) line.pf++;
        const fouled = e.actors[1] ? players[e.actors[1]] : undefined;
        if (fouled) fouled.pfd++;
        break;
      }
      case "period_ended":
        pendingMiss = false;
        looseFromBlock = false;
        lastPass = null;
        break;
      default:
        if (ASSIST_BREAKERS.has(e.kind)) lastPass = null;
        if (e.kind === "organized_entry" && actor) lastControl = actor;
        break;
    }
  }

  for (const lineItem of Object.values(players)) {
    const t = teams[lineItem.teamId]!;
    for (const k of ["fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "points", "oreb", "dreb", "ast", "tov", "stl", "blk", "pf", "pfd", "minutesMs"] as const) {
      t[k] += lineItem[k];
    }
  }
  return { players, teams, periodPoints, eventsProjected: events.length };
}

export interface ReconciliationCheck {
  readonly id: string;
  readonly label: string;
  readonly ok: boolean;
  readonly detail: string;
}

/**
 * Invariantes del acta (ME-04 §6), comprobables en pruebas y visibles en
 * la interfaz: nunca se «arreglan», solo se informan.
 */
export function reconcileBoxScore(args: {
  readonly box: BoxScore;
  readonly finalScore: Readonly<Record<string, number>>;
  readonly effectivePlayedMs: Milliseconds;
  readonly engineMinutesMs: Readonly<Record<string, Milliseconds>>;
  readonly teamIds: readonly string[];
}): ReconciliationCheck[] {
  const checks: ReconciliationCheck[] = [];
  const lines = Object.values(args.box.players);
  for (const teamId of args.teamIds) {
    const t = args.box.teams[teamId]!;
    const mine = lines.filter((l) => l.teamId === teamId);
    const pts = 2 * t.fgm2 + 3 * t.fgm3 + t.ftm;
    checks.push({ id: `puntos-${teamId}`, label: `Puntos = 2×2FGM + 3×3FGM + FTM (${teamId})`, ok: pts === t.points && t.points === args.finalScore[teamId], detail: `${pts} calculados, ${t.points} en acta, ${args.finalScore[teamId]} en marcador` });
    const periodSum = args.box.periodPoints.reduce((a, p) => a + (p[teamId] ?? 0), 0);
    checks.push({ id: `parciales-${teamId}`, label: `Suma de parciales = marcador (${teamId})`, ok: periodSum === args.finalScore[teamId], detail: `${periodSum} frente a ${args.finalScore[teamId]}` });
    const fgOk = mine.every((l) => l.fgm2 <= l.fga2 && l.fgm3 <= l.fga3 && l.ftm <= l.fta);
    checks.push({ id: `tiros-${teamId}`, label: `FGM ≤ FGA y FTM ≤ FTA en cada fila (${teamId})`, ok: fgOk, detail: fgOk ? "sin excepciones" : "alguna fila incumple" });
    const minutes = mine.reduce((a, l) => a + l.minutesMs, 0);
    checks.push({ id: `minutos-${teamId}`, label: `Minutos del equipo = 5 × tiempo disputado (${teamId})`, ok: minutes === 5 * args.effectivePlayedMs, detail: `${minutes} ms frente a ${5 * args.effectivePlayedMs} ms` });
    const engineOk = mine.every((l) => l.minutesMs === (args.engineMinutesMs[l.playerId] ?? 0));
    checks.push({ id: `minutos-motor-${teamId}`, label: `Minutos del acta = minutos del motor (${teamId})`, ok: engineOk, detail: engineOk ? "coinciden al milisegundo" : "difieren" });
  }
  return checks;
}
