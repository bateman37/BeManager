/**
 * Tramo de hasta cuatro posesiones estadísticas enlazadas (ME-03,
 * ADR-0006). La continuidad (cancha, diez jugadores, balón, relojes,
 * saques, transición, rebotes) vive en el motor compartido
 * `linked-run.ts`, que también usa el partido de ME-04; este módulo solo
 * fija lo propio del tramo: parte de `drop_con_ayuda` (7:12 de C1, 18 s),
 * un único quinteto por equipo, sentido de ataque fijo, una sola cobertura
 * para quien defienda, y se detiene al cerrar cuatro posesiones, al
 * agotarse el tiempo (sin adjudicar la bocina) o por el guardián.
 *
 * ME-06 §3.2: este tramo no declara la segunda familia posicional (mano a
 * mano sin balón) ni el selector de plan ofensivo — conserva los valores
 * por defecto del motor compartido (`bloqueo_directo`/`guardar_espacio`
 * siempre) y solo mide esa familia, tal y como permite el prompt cuando
 * la tabla de resolución limitada del laboratorio no comparte aún el
 * alcance real de la nueva familia. No lo etiquetes como una comparación
 * de ME-06 si se usa este tramo.
 */
import type { AttackDirection } from "../geometry/frame";
import { toGlobal } from "../geometry/frame";
import type { Milliseconds } from "../time/clock";
import type { DefensiveCoverage } from "../lab/match-input";
import { getScenario } from "../lab/scenario";
import type { PlayerProfile } from "../players/player-profile";
import { LinkedRun, buildFrameFromTeams, type EmitArgs, type LinkedLimits } from "./linked-run";
import {
  TRAMO_MAX_POSSESSIONS,
  type TramoInput,
  type TramoResult,
  type TramoStop,
  type TramoTeamBox,
  type TramoTeamSnapshot,
} from "./tramo-model";

export type TramoLimits = LinkedLimits;

/** Mismo límite de 12 fases que el guardián de rebotes encadenados de ME-01. */
export const DEFAULT_TRAMO_LIMITS: TramoLimits = { maxPhasesPerPossession: 12, maxSteps: 80, maxZeroTimeSteps: 3 };

export interface PlayTramoOptions {
  readonly limits?: Partial<TramoLimits>;
  /**
   * Solo para comprobar la frontera de tiempo en pruebas automáticas: reloj
   * de partido restante al empezar. La interfaz siempre usa 7:12.
   */
  readonly initialGameClockMs?: Milliseconds;
}

class TramoRun extends LinkedRun {
  private readonly input: TramoInput;
  private readonly byTeam = new Map<string, TramoTeamSnapshot>();

  constructor(input: TramoInput, options: PlayTramoOptions) {
    super({
      seed: input.seed,
      rulesetVersion: input.rulesetVersion,
      labParametersVersion: input.labParametersVersion,
      dispositionScenarioId: input.startScenarioId,
      teams: [
        { id: input.teams[0].id, name: input.teams[0].name, priority: input.teams[0].priority },
        { id: input.teams[1].id, name: input.teams[1].name, priority: input.teams[1].priority },
      ],
      roster: input.teams.flatMap((t) => t.players.map((profile) => ({ teamId: t.id, profile }))),
      limits: { ...DEFAULT_TRAMO_LIMITS, ...options.limits },
    });
    this.input = input;
    for (const team of input.teams) this.byTeam.set(team.id, team);
    const scenario = getScenario(input.startScenarioId);
    this.game = { ms: options.initialGameClockMs ?? scenario.initialGameClockMs, running: true, ref: 0 };
    this.shot = { ms: scenario.initialShotClockMs, running: true, ref: 0 };
    const frame0 = this.frameFor(input.teams[0].id);
    for (const slot of [...scenario.offense, ...scenario.defense]) {
      const id = frame0.slotToId[slot.playerId]!;
      this.tracks[id] = [{ atMs: 0, position: toGlobal(frame0.dir, slot.initialPosition) }];
    }
    this.ball = { status: "held", holderId: frame0.slotToId.O1!, fixed: null };
  }

  protected lineup(teamId: string): readonly PlayerProfile[] {
    return this.byTeam.get(teamId)!.players;
  }

  protected attackDirection(teamId: string): AttackDirection {
    return this.byTeam.get(teamId)!.attackDirection;
  }

  protected coverageWhenDefending(): DefensiveCoverage {
    return this.input.coverage;
  }

  protected onGameClockExpired(_e: EmitArgs, expiryMs: Milliseconds): boolean {
    this.expire(expiryMs);
    return false;
  }

  protected afterPossessionClosed(atMs: Milliseconds, emitted: boolean): boolean {
    if (emitted && this.closed >= TRAMO_MAX_POSSESSIONS) {
      this.stop = {
        cause: "cuatro_posesiones",
        atMs,
        explanation: `Se han cerrado ${TRAMO_MAX_POSSESSIONS} posesiones estadísticas; los rebotes ofensivos y las salidas seguras son fases, no posesiones nuevas.`,
      };
      this.pushEvent({ atMs, phase: "concedido", kind: "tramo_stopped", actors: [], text: this.stop.explanation, detail: { cause: "cuatro_posesiones" } });
      return false;
    }
    return emitted;
  }

  private expire(atMs: Milliseconds): void {
    this.game.ms = 0;
    this.game.running = false;
    this.stop = {
      cause: "tiempo_agotado",
      atMs,
      explanation:
        "El reloj de partido llega a 0:00 con la posesión abierta. El final de cuarto (bocina, tiro en el aire) no se adjudica en ME-03; queda para ME-04.",
    };
    this.pushEvent({ atMs, phase: "concedido", kind: "tramo_stopped", actors: [], text: "Se agota el tiempo reglamentario disponible: el tramo se detiene sin adjudicar el final de cuarto.", detail: { cause: "tiempo_agotado" } });
  }

  run(): TramoResult {
    const frame0 = buildFrameFromTeams(this.frameTeam(this.input.teams[0].id), this.frameTeam(this.input.teams[1].id), this.input.teams[0].attackDirection);
    this.openPossession(
      frame0.attacking.id,
      0,
      "inicio_tramo",
      "disposición del escenario «Drop con ayuda» (7:12 del primer cuarto, 18 s de lanzamiento)",
    );
    this.setPhaseEntry("ataque_organizado", "El tramo empieza con los diez ya situados en la disposición del bloqueo directo.");
    this.loop({ kind: "set", frame: frame0, atMs: 0 });
    if (!this.stop) this.guardianStop(this.lastMs, "el tramo terminó sin una causa de parada reconocida.");
    return this.finish();
  }

  private finish(): TramoResult {
    const stop = this.stop! as TramoStop;
    const events = this.materializeEvents(stop.atMs);
    const ids = Object.keys(this.tracks).sort();

    const box: Record<string, TramoTeamBox> = {};
    for (const team of this.input.teams) {
      const mine = (id: string | undefined) => (id ? this.teamOf.get(id) === team.id : false);
      let fga2 = 0,
        fgm2 = 0,
        fga3 = 0,
        fgm3 = 0,
        fta = 0,
        ftm = 0,
        oreb = 0,
        dreb = 0;
      for (const e of events) {
        const actor = e.actors[0];
        if (e.kind === "field_goal_attempt" && mine(actor)) {
          const made = e.detail.made === true;
          if (e.detail.shotType === "three_point") {
            fga3++;
            if (made) fgm3++;
          } else {
            fga2++;
            if (made) fgm2++;
          }
        } else if (e.kind === "free_throws_result" && mine(actor)) {
          fta++;
          if (e.detail.made === true) ftm++;
        } else if ((e.kind === "rebound_secured" || e.kind === "rebound_contested") && mine(actor)) {
          if (e.possessionTeamId === team.id) oreb++;
          else dreb++;
        }
      }
      box[team.id] = {
        fieldGoalAttempts2: fga2,
        fieldGoalMade2: fgm2,
        fieldGoalAttempts3: fga3,
        fieldGoalMade3: fgm3,
        freeThrowAttempts: fta,
        freeThrowMade: ftm,
        points: 2 * fgm2 + 3 * fgm3 + ftm,
        offensiveRebounds: oreb,
        defensiveRebounds: dreb,
      };
    }

    return {
      input: this.input,
      events,
      possessions: this.possessions.map((p) => ({ ...p, phases: p.phases.map((ph) => ({ ...ph })) })),
      responsibilities: this.responsibilities,
      tracks: Object.fromEntries(ids.map((id) => [id, this.tracks[id]!])),
      stop,
      finalScore: { ...this.score },
      box,
      rngStateAtBoundaries: this.rngStates,
      closedPossessions: this.closed,
    };
  }
}

/**
 * Juega un tramo de hasta cuatro posesiones estadísticas enlazadas.
 * Determinista: misma `TramoInput` produce los mismos cierres, hechos,
 * relojes y posiciones.
 */
export function playTramo(input: TramoInput, options: PlayTramoOptions = {}): TramoResult {
  return new TramoRun(input, options).run();
}
