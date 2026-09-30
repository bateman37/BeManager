"use client";

import { useMemo, useState } from "react";
import type { LabTeamRecord } from "@match/application/ports/lab-team-repository.port";
import type { LabGameView, PlayLabGameResult } from "@match/application/use-cases/play-lab-game";
import type { BuildGameTeamArgs } from "@match/domain/game/game-model";
import type { PlayerBoxLine, TeamBoxTotals } from "@match/domain/game/box-score";
import type { RuleBoundaryCase } from "@match/domain/game/rule-boundary-fixtures";
import type {
  DefensiveCoverageChoice,
  OffensivePlanChoice,
  OffBallDefensiveCallChoice,
  OffensiveCreationPriority,
} from "@match/domain/lab/match-input";
import type { PhaseEntry, ReboundPriority, TramoEvent } from "@match/domain/sequence/tramo-model";
import { LAB_DECLARED_ROLES, FUNCTIONAL_ROLE_LABELS, type FunctionalRole } from "@match/domain/players/functional-roles";
import { LAB_STARTER_IDS } from "@match/domain/players/lab-roster-fixture";
import { buildAuditExport } from "@match/domain/audit/build-audit-export";
import { TramoCourt } from "./tramo-panel";

/**
 * Sección «Partido completo» de ME-04: controles de la foto (semilla,
 * cobertura y prioridad de cada equipo), visor del partido ya resuelto
 * (marcador, parciales, faltas y bonus, sustituciones, relato por período →
 * posesión → evento con foto de cancha, acta) y los casos de frontera
 * reglamentarios. Solo presenta hechos calculados por el dominio: no
 * contiene reglas de juego.
 */

export interface GameTeamSettings {
  /** ME-07A §4: admite `"auto"`. */
  readonly coverage: DefensiveCoverageChoice;
  readonly priority: ReboundPriority;
  /** ME-06 §3.2: plan ofensivo previo de este equipo para todo el partido. */
  readonly offensivePlan: OffensivePlanChoice;
  /** ME-06 §3.1: orden de defensa sin balón de este equipo ante la mano a mano (ME-07A §4: admite `"auto"`). */
  readonly offBallDefensiveCall: OffBallDefensiveCallChoice;
  /** ME-07A §3.1: prioridad de creación de este equipo para todo el partido. */
  readonly creationPriority: OffensiveCreationPriority;
}

export interface GameSettings {
  readonly seed: number;
  readonly teams: Readonly<Record<string, GameTeamSettings>>;
  /** «Registrar auditoría» (ME-04A §2): activado por defecto en este laboratorio. */
  readonly auditEnabled: boolean;
}

export type PlayGameAction = (
  seed: number,
  home: BuildGameTeamArgs,
  away: BuildGameTeamArgs,
  auditEnabled: boolean,
) => Promise<PlayLabGameResult>;

const DEFAULT_TEAM_SETTINGS: GameTeamSettings = {
  coverage: "auto",
  priority: "proteger_balance",
  offensivePlan: "auto",
  offBallDefensiveCall: "auto",
  creationPriority: "equilibrado",
};

export function teamSettings(settings: GameSettings, teamId: string): GameTeamSettings {
  return settings.teams[teamId] ?? DEFAULT_TEAM_SETTINGS;
}

/** Datos mínimos que el caso de uso necesita de cada equipo. */
export function toGameTeam(team: LabTeamRecord, s: GameTeamSettings): BuildGameTeamArgs {
  return {
    id: team.id,
    name: team.name,
    players: team.players,
    priority: s.priority,
    coverage: s.coverage,
    offensivePlan: s.offensivePlan,
    offBallDefensiveCall: s.offBallDefensiveCall,
    creationPriority: s.creationPriority,
  };
}

const COVERAGE_LABELS: Record<DefensiveCoverageChoice, string> = {
  auto: "Auto (elige la defensa)",
  drop: "Drop",
  trampa: "Trampa",
  cambio: "Cambio (switch)",
  show: "Show (hedge)",
  por_debajo: "Por debajo (under)",
  ice: "ICE lateral",
};
const PRIORITY_LABELS: Record<ReboundPriority, string> = {
  proteger_balance: "Proteger balance",
  cargar_rebote: "Cargar rebote",
};
const OFFENSIVE_PLAN_LABELS: Record<OffensivePlanChoice, string> = {
  auto: "Auto (elige el motor)",
  bloqueo_directo: "Bloqueo directo",
  mano_a_mano_sin_balon: "Mano a mano sin balón",
};
const OFF_BALL_CALL_LABELS: Record<OffBallDefensiveCallChoice, string> = {
  auto: "Auto (elige la defensa)",
  guardar_espacio: "Guardar espacio (protege carril y ayuda)",
  negar_primera_salida: "Negar primera salida (sigue y niega)",
};
const CREATION_PRIORITY_LABELS: Record<OffensiveCreationPriority, string> = {
  equilibrado: "Equilibrado",
  buscar_aro: "Buscar aro",
  buscar_triple: "Buscar triple",
};
const ENTRY_LABELS: Record<PhaseEntry, string> = {
  ataque_organizado: "ataque organizado",
  ventaja_temprana: "ventaja temprana",
  segunda_oportunidad: "segunda oportunidad",
  segunda_entrada: "segunda entrada del bloqueo",
  pendiente: "sin leer (fin de período)",
};
const WINDOW_LABELS: Record<string, string> = {
  falta: "falta",
  libre_anotado: "último libre anotado",
  fuera: "balón fuera",
  violacion: "violación",
  canasta: "canasta en los 2 últimos minutos (equipo que encaja)",
  inicio_periodo: "inicio de período",
};
const TEAM_COLORS = ["#4338ca", "#b91c1c"] as const;

function clock(ms: number): string {
  const tenths = Math.max(0, Math.floor(ms / 100));
  return `${Math.floor(tenths / 600)}:${String(Math.floor((tenths % 600) / 10)).padStart(2, "0")}.${tenths % 10}`;
}

function minutes(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function periodLabel(period: number): string {
  return period <= 4 ? `C${period}` : `Prórroga ${period - 4}`;
}

function rolesOf(playerId: string): string {
  const roles = LAB_DECLARED_ROLES[playerId] as readonly FunctionalRole[] | undefined;
  return roles && roles.length > 0 ? roles.map((r) => `${r} ${FUNCTIONAL_ROLE_LABELS[r]}`).join(" / ") : "sin rol declarado";
}

/** Titulares en orden de rol y después suplentes por ID (presentación). */
function ordered<T extends { readonly id: string }>(players: readonly T[], starters: readonly string[]): T[] {
  const rank = (id: string) => (starters.includes(id) ? starters.indexOf(id) : 100);
  return [...players].sort((a, b) => rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const button = "rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-slate-700";

// --- visor del partido -------------------------------------------------------------

function Scoreboard({ game }: { readonly game: LabGameView }) {
  const [home, away] = game.input.teams;
  const winner = game.input.teams.find((t) => t.id === game.winnerTeamId);
  return (
    <div className="space-y-2 rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
      <p className={`text-base font-semibold ${game.stop.cause === "guardian" ? "text-red-700 dark:text-red-400" : ""}`}>
        {game.stop.cause === "final" ? `Final: gana ${winner?.name}` : "Partido detenido por el guardián (sin ganador)"} · {home.name}{" "}
        {game.finalScore[home.id]} – {game.finalScore[away.id]} {away.name}
      </p>
      <p className="text-slate-600 dark:text-slate-300">{game.stop.explanation}</p>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left dark:border-slate-700">
              <th className="py-1 pr-3">Equipo</th>
              {game.periods.map((p) => (
                <th key={p.period} className="py-1 pr-3">
                  {p.label}
                </th>
              ))}
              <th className="py-1 pr-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {[home, away].map((t, i) => (
              <tr key={t.id}>
                <td className="py-1 pr-3 font-medium" style={{ color: TEAM_COLORS[i] }}>
                  {t.name}
                </td>
                {game.periods.map((p) => (
                  <td key={p.period} className="py-1 pr-3">
                    {p.points[t.id] ?? 0}
                  </td>
                ))}
                <td className="py-1 pr-3 font-semibold">{game.finalScore[t.id]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Partido {game.gameId} · semilla {game.input.seed} · {home.name}: defiende {COVERAGE_LABELS[home.coverage]}, {PRIORITY_LABELS[home.priority]} ·{" "}
        {away.name}: defiende {COVERAGE_LABELS[away.coverage]}, {PRIORITY_LABELS[away.priority]} · Reglas {game.input.rulesetVersion} · Parámetros{" "}
        {game.input.labParametersVersion} · {game.input.gameVersion} · salto {game.input.jumpBallVersion} · rotación {game.input.substitutionPolicyVersion} ·{" "}
        {game.possessions.length} posesiones · {game.events.length} hechos
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Plan ofensivo (ME-06): {home.name} ataca con {OFFENSIVE_PLAN_LABELS[home.offensivePlan]}, prioridad {CREATION_PRIORITY_LABELS[home.creationPriority]},
        defiende la mano a mano con {OFF_BALL_CALL_LABELS[home.offBallDefensiveCall]} · {away.name} ataca con {OFFENSIVE_PLAN_LABELS[away.offensivePlan]},
        prioridad {CREATION_PRIORITY_LABELS[away.creationPriority]}, defiende la mano a mano con {OFF_BALL_CALL_LABELS[away.offBallDefensiveCall]}.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Entradas de ataque (fases):{" "}
        {(Object.keys(ENTRY_LABELS) as PhaseEntry[])
          .filter((k) => k !== "pendiente" || game.entryCounts[k] > 0)
          .map((k) => `${ENTRY_LABELS[k]} ${game.entryCounts[k]}`)
          .join(" · ")}
        .
      </p>
    </div>
  );
}

function FoulsSummary({ game }: { readonly game: LabGameView }) {
  const keys = [...new Set(game.periods.map((p) => Math.min(p.period, 4)))];
  return (
    <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
      <p className="mb-1 font-semibold">Faltas de equipo por período (bonus desde la 5.ª sin tiro)</p>
      <table className="text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left dark:border-slate-700">
            <th className="py-1 pr-3">Equipo</th>
            {keys.map((k) => (
              <th key={k} className="py-1 pr-3">
                {k === 4 && game.periods.length > 4 ? "C4 + prórrogas" : `C${k}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {game.input.teams.map((t, i) => (
            <tr key={t.id}>
              <td className="py-1 pr-3 font-medium" style={{ color: TEAM_COLORS[i] }}>
                {t.name}
              </td>
              {keys.map((k) => {
                const n = game.fouls.filter((f) => f.teamId === t.id && Math.min(f.period, 4) === k).length;
                return (
                  <td key={k} className="py-1 pr-3">
                    {n}
                    {n >= 4 ? " (bonus)" : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {game.fouls.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs">
          {game.fouls.map((f) => (
            <li key={`${f.atMs}-${f.foulerId}`}>
              {periodLabel(f.period)} {clock(f.gameClockMs)} · {f.foulerId} sobre {f.fouledId} ({f.type === "tiro" ? "de tiro" : "sin tiro"}) · {f.personalFoulsAfter}.ª personal ·{" "}
              {f.teamFoulsAfter}.ª de equipo · {f.sanction.kind === "saque" ? "saque" : `${f.sanction.count} libre(s)${f.sanction.byBonus ? " por bonus" : ""}`}
              {f.disqualified ? " · EXCLUIDO" : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Sin faltas personales en este partido.</p>
      )}
    </div>
  );
}

function SubstitutionsList({ game }: { readonly game: LabGameView }) {
  const teamName = (id: string) => game.input.teams.find((t) => t.id === id)?.name ?? id;
  return (
    <details className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
      <summary className="cursor-pointer font-semibold">
        Sustituciones ({game.substitutions.length}) y quintetos iniciales
      </summary>
      <p className="mt-2 text-xs">
        Titulares: {game.input.teams.map((t) => `${t.name}: ${t.starters.join(", ")}`).join(" · ")}
      </p>
      <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto text-xs">
        {game.substitutions.map((s, i) => (
          <li key={i}>
            {periodLabel(s.period)} {clock(s.gameClockMs)} · {teamName(s.teamId)}: entra <span className="font-mono">{s.inId}</span> por{" "}
            <span className="font-mono">{s.outId}</span> (rol {s.role}, {FUNCTIONAL_ROLE_LABELS[s.role]}) ·{" "}
            {s.reason === "exclusion" ? "obligatoria por exclusión" : `voluntaria, ${minutes(s.outContinuousMs)} seguidos`} · oportunidad: {WINDOW_LABELS[s.window] ?? s.window}
          </li>
        ))}
      </ul>
    </details>
  );
}

function PlayByPlay({ game }: { readonly game: LabGameView }) {
  const events = game.events;
  const [index, setIndex] = useState(0);
  const event = events[Math.min(index, events.length - 1)]!;
  const [home, away] = game.input.teams;
  const teamNames: readonly [string, string] = [home.name, away.name];
  const teamIndexOf = useMemo(() => {
    const map = new Map<string, number>();
    game.input.teams.forEach((t, i) => t.roster.forEach((p) => map.set(p.id, i)));
    return (id: string) => map.get(id) ?? 0;
  }, [game]);
  const teamName = (id: string | null) => game.input.teams.find((t) => t.id === id)?.name ?? "—";
  const periods = game.periods.map((p) => p.period);
  const possessionsOf = (period: number) =>
    game.possessions.filter((p) => events.some((e) => e.period === period && e.possessionIndex === p.index));
  const firstIndexOf = (pred: (e: TramoEvent) => boolean) => Math.max(0, events.findIndex(pred));
  const inPossession = events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.period === event.period && e.possessionIndex === event.possessionIndex);
  const teamFoulsNow = (teamId: string) =>
    game.fouls.filter((f) => f.teamId === teamId && Math.min(f.period, 4) === Math.min(event.period, 4) && f.atMs <= event.atMs).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            className={`${button} ${p === event.period ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950" : ""}`}
            onClick={() => setIndex(firstIndexOf((e) => e.period === p))}
          >
            {periodLabel(p)}
          </button>
        ))}
      </div>
      <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
        {possessionsOf(event.period).map((p) => (
          <button
            key={p.index}
            type="button"
            onClick={() => setIndex(firstIndexOf((e) => e.possessionIndex === p.index))}
            className={`rounded border px-1.5 py-0.5 text-xs ${
              p.index === event.possessionIndex ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950" : "border-slate-300 dark:border-slate-700"
            }`}
            style={{ color: TEAM_COLORS[home.id === p.teamId ? 0 : 1] }}
            title={`${p.startReason} → ${p.endReason ?? "sin cerrar"}`}
          >
            P{p.index}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
          ◀ Evento anterior
        </button>
        <button
          type="button"
          className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-40"
          disabled={index >= events.length - 1}
          onClick={() => setIndex((i) => Math.min(events.length - 1, i + 1))}
        >
          Evento siguiente ▶
        </button>
        <button
          type="button"
          className={button}
          onClick={() => {
            const next = events.findIndex((e, i) => i > index && e.kind === "possession_started");
            if (next >= 0) setIndex(next);
          }}
        >
          Posesión siguiente ⏭
        </button>
        <button type="button" className={button} onClick={() => setIndex(events.length - 1)}>
          Final ⏭⏭
        </button>
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="w-48"
          aria-label="Recorrer el partido por eventos"
        />
        <span className="text-xs text-slate-500">
          Evento {index + 1} / {events.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-2">
          <TramoCourt
            event={event}
            teamIndexOf={teamIndexOf}
            teamNames={teamNames}
            badgeOf={() => undefined}
            rightHoopTeamIndex={event.period >= 3 ? 1 : 0}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Anillo naranja: poseedor del balón (punto naranja: balón sin poseedor). Los diez que estaban en pista en ese instante, en
            coordenadas globales; desde C3 los equipos atacan el otro aro.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="rounded border border-slate-200 p-3 dark:border-slate-800">
            <p className="font-semibold">
              {periodLabel(event.period)} · {clock(event.gameClockMs)} · Lanzamiento {event.shotClockMs === null ? "sin correr" : `${(event.shotClockMs / 1000).toFixed(1).replace(".", ",")} s`}
            </p>
            <p>
              {event.possessionIndex > 0 ? `Posesión ${event.possessionIndex} (${teamName(event.possessionTeamId)}) · fase ${event.phaseIndex}` : "Fuera de posesión"}
            </p>
            <p>
              Marcador: {home.name} {event.score[home.id] ?? 0} – {event.score[away.id] ?? 0} {away.name}
            </p>
            <p>
              Faltas de equipo en el período: {home.name} {teamFoulsNow(home.id)} · {away.name} {teamFoulsNow(away.id)}
            </p>
            <p className="mt-1">{event.text}</p>
          </div>
          <div className="rounded border border-slate-200 p-3 text-xs dark:border-slate-800">
            <p className="mb-1 font-semibold">En pista en este instante</p>
            {game.input.teams.map((t, i) => (
              <p key={t.id} style={{ color: TEAM_COLORS[i] }}>
                {t.name}: {event.onCourtIds.filter((id) => teamIndexOf(id) === i).join(", ")}
              </p>
            ))}
          </div>
        </div>
      </div>

      <ol className="max-h-80 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 text-sm dark:border-slate-800">
        {inPossession.map(({ e, i }) => (
          <li key={e.sequence}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className={`w-full rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${i === index ? "bg-slate-100 dark:bg-slate-800" : ""}`}
            >
              <span className="mr-2 font-mono text-xs text-slate-400">
                {periodLabel(e.period)} {clock(e.gameClockMs)}
              </span>
              {e.text}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

const BOX_COLUMNS: { key: keyof PlayerBoxLine & keyof TeamBoxTotals; label: string }[] = [
  { key: "points", label: "PTS" },
  { key: "oreb", label: "RO" },
  { key: "dreb", label: "RD" },
  { key: "ast", label: "AST" },
  { key: "tov", label: "PER" },
  { key: "stl", label: "ROB" },
  { key: "blk", label: "TAP" },
  { key: "pf", label: "FC" },
  { key: "pfd", label: "FR" },
];

function shooting(made: number, attempts: number): string {
  return `${made}/${attempts}`;
}

function BoxScoreTables({ game }: { readonly game: LabGameView }) {
  return (
    <div className="space-y-4">
      {game.input.teams.map((t, i) => {
        const lines = ordered(t.roster, t.starters).map((p) => game.box.players[p.id]!).filter(Boolean);
        const totals = game.box.teams[t.id]!;
        return (
          <div key={t.id} className="overflow-x-auto">
            <p className="mb-1 font-semibold" style={{ color: TEAM_COLORS[i] }}>
              Acta de {t.name}
            </p>
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-left dark:border-slate-700">
                  <th className="py-1 pr-2">Jugador</th>
                  <th className="py-1 pr-2">Roles</th>
                  <th className="py-1 pr-2">MIN</th>
                  <th className="py-1 pr-2">T2</th>
                  <th className="py-1 pr-2">T3</th>
                  <th className="py-1 pr-2">TL</th>
                  {BOX_COLUMNS.map((c) => (
                    <th key={c.key} className="py-1 pr-2">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const player = t.roster.find((p) => p.id === l.playerId)!;
                  return (
                    <tr key={l.playerId} className="border-b border-slate-100 dark:border-slate-900">
                      <td className="py-1 pr-2">
                        <span className="font-mono">{l.playerId}</span> {player.name}
                        {t.starters.includes(l.playerId) ? " *" : ""}
                      </td>
                      <td className="py-1 pr-2 text-slate-500">{rolesOf(l.playerId)}</td>
                      {l.dnp ? (
                        <td className="py-1 pr-2 italic text-slate-500" colSpan={4 + BOX_COLUMNS.length}>
                          No jugó (DNP)
                        </td>
                      ) : (
                        <>
                          <td className="py-1 pr-2">{minutes(l.minutesMs)}</td>
                          <td className="py-1 pr-2">{shooting(l.fgm2, l.fga2)}</td>
                          <td className="py-1 pr-2">{shooting(l.fgm3, l.fga3)}</td>
                          <td className="py-1 pr-2">{shooting(l.ftm, l.fta)}</td>
                          {BOX_COLUMNS.map((c) => (
                            <td key={c.key} className="py-1 pr-2">
                              {l[c.key]}
                            </td>
                          ))}
                        </>
                      )}
                    </tr>
                  );
                })}
                <tr className="font-semibold">
                  <td className="py-1 pr-2">Total</td>
                  <td className="py-1 pr-2" />
                  <td className="py-1 pr-2">{minutes(totals.minutesMs)}</td>
                  <td className="py-1 pr-2">{shooting(totals.fgm2, totals.fga2)}</td>
                  <td className="py-1 pr-2">{shooting(totals.fgm3, totals.fga3)}</td>
                  <td className="py-1 pr-2">{shooting(totals.ftm, totals.fta)}</td>
                  {BOX_COLUMNS.map((c) => (
                    <td key={c.key} className="py-1 pr-2">
                      {totals[c.key]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-xs text-slate-500">
              * titular · Rebotes de equipo: {totals.teamRebounds} · Pérdidas de equipo: {totals.teamTurnovers} · MIN redondeado al segundo
              (interno en ms).
            </p>
          </div>
        );
      })}
      <div className="rounded border border-slate-200 p-3 text-xs dark:border-slate-800">
        <p className="mb-1 font-semibold">Conciliación del acta con los hechos</p>
        <ul>
          {game.reconciliation.map((c) => (
            <li key={c.id} className={c.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
              {c.ok ? "✓" : "✗"} {c.label}: {c.detail}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function sanitizeFileNamePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}

/**
 * Comprime a gzip en el propio navegador (`CompressionStream`, ME-04A §5):
 * medido con el fixture natural completo (doce inscritos por equipo), el
 * `.json` indentado pesa del orden de 14 MB, incómodo de adjuntar; gzip lo
 * deja en torno a 0,6 MB sin perder ni un campo (ver `docs/match/AUDIT.md`).
 * Un único archivo `.json.gz`, nunca varios por partido.
 */
async function gzipJson(json: string): Promise<Blob> {
  const bytes = new TextEncoder().encode(json);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Blob([buffer], { type: "application/gzip" });
}

/**
 * Botón «Descargar auditoría (.json)» (ME-04A §2, §5): construye el archivo
 * con `buildAuditExport` a partir del `GameResult` ya sostenido en memoria
 * (el mismo `game` que ya pinta el visor) — sin volver a jugar el partido,
 * sin red y sin escribir en PostgreSQL — y lo entrega como descarga del
 * navegador. Si la corrida no activó el registro, explica por qué las
 * decisiones no se pueden reconstruir después y qué hacer.
 */
function AuditDownloadPanel({ game }: { readonly game: LabGameView }) {
  const [state, setState] = useState<{ readonly sizeBytes: number; readonly fileName: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const auditOn = game.audit !== undefined;

  async function download() {
    setPreparing(true);
    try {
      const exported = buildAuditExport(game.input, game);
      const json = JSON.stringify(exported, null, 2);
      const blob = await gzipJson(json);
      const fileName = `bemanager-auditoria-semilla-${sanitizeFileNamePart(String(game.input.seed))}-${sanitizeFileNamePart(game.gameId)}.json.gz`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState({ sizeBytes: blob.size, fileName });
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
      <p className="mb-1 font-semibold">Auditoría exportable (ME-04A)</p>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Semilla {game.input.seed} · Partido {game.gameId} · Registro de auditoría {auditOn ? "activado" : "desactivado"} en esta corrida.
      </p>
      {auditOn ? (
        <>
          <button
            type="button"
            disabled={preparing}
            className="mt-2 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => void download()}
          >
            {preparing ? "Preparando archivo…" : "Descargar auditoría (.json.gz)"}
          </button>
          {state && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Descargado <span className="font-mono">{state.fileName}</span> · {(state.sizeBytes / 1024).toFixed(1)} KB comprimido (gzip, sin
              perder información: descomprímelo para leer el `.json`). Un archivo autónomo de esta misma ejecución: no se ha vuelto a simular el
              partido ni se ha enviado nada fuera del equipo.
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          El registro de auditoría estaba apagado al jugar este partido: los motivos de cada decisión no se pueden reconstruir a posteriori con
          el acta. Activa «Registrar auditoría» y vuelve a jugar esta misma semilla para poder descargarla.
        </p>
      )}
    </div>
  );
}

export function GameViewer({ game }: { readonly game: LabGameView }) {
  return (
    <div className="space-y-4">
      <Scoreboard game={game} />
      <AuditDownloadPanel game={game} />
      <FoulsSummary game={game} />
      <SubstitutionsList game={game} />
      <PlayByPlay game={game} />
      <BoxScoreTables game={game} />
    </div>
  );
}

// --- casos de frontera --------------------------------------------------------------

export function RuleBoundaryCases({ cases, label }: { readonly cases: readonly RuleBoundaryCase[]; readonly label: string }) {
  const [caseIndex, setCaseIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const current = cases[caseIndex];
  if (!current) return null;
  const step = current.steps[Math.min(stepIndex, current.steps.length - 1)]!;
  return (
    <section className="space-y-3 rounded-lg border-2 border-dashed border-amber-400 p-4 dark:border-amber-700">
      <h2 className="text-lg font-semibold">Casos de frontera reglamentarios (ME-04)</h2>
      <p className="rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        {label}. Cada caso parte de un estado y unos hechos de entrada explícitos y los adjudica con las mismas funciones puras que el partido;
        no se insertan en el acta de ningún partido.
      </p>
      <div className="flex flex-wrap gap-2">
        {cases.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className={`${button} ${i === caseIndex ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : ""}`}
            onClick={() => {
              setCaseIndex(i);
              setStepIndex(0);
            }}
          >
            {c.title}
          </button>
        ))}
      </div>
      <p className="text-sm">{current.summary}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
          ◀ Paso anterior
        </button>
        <button
          type="button"
          className={button}
          disabled={stepIndex >= current.steps.length - 1}
          onClick={() => setStepIndex((i) => Math.min(current.steps.length - 1, i + 1))}
        >
          Paso siguiente ▶
        </button>
        <span className="text-xs text-slate-500">
          Paso {stepIndex + 1} / {current.steps.length}
        </span>
      </div>
      <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
        <p className="font-semibold">
          {periodLabel(step.period)} · {clock(step.gameClockMs)} · {step.label}
        </p>
        <p className="mt-1">
          <span className="font-medium">Veredicto:</span> {step.verdict}
        </p>
        <p className="mt-1 text-xs text-slate-500">Función del partido: {step.rule}</p>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs dark:bg-slate-900">Entrada: {JSON.stringify(step.input, null, 2)}</pre>
          <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs dark:bg-slate-900">Resultado: {JSON.stringify(step.output, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}

// --- sección con controles ------------------------------------------------------------

export interface GameSectionProps {
  readonly teams: readonly LabTeamRecord[];
  readonly settings: GameSettings;
  readonly onSettingsChange: (settings: GameSettings) => void;
  readonly result: LabGameView | null;
  readonly resultKey: number;
  readonly error: string | null;
  readonly staleNotice: string | null;
  readonly running: boolean;
  readonly usingReferenceProfiles: boolean;
  readonly onPlay: () => void;
}

export function GameSection(props: GameSectionProps) {
  const [home, away] = props.teams;
  const setTeam = (teamId: string, patch: Partial<GameTeamSettings>) =>
    props.onSettingsChange({ ...props.settings, teams: { ...props.settings.teams, [teamId]: { ...teamSettings(props.settings, teamId), ...patch } } });
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-lg font-semibold">Partido completo FIBA 2026 (ME-04)</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Un partido entero de 4 × 10:00 (y las prórrogas de 5:00 que hagan falta) desde el salto inicial, con los doce inscritos de cada equipo,
        rotación automática fija (sin fatiga), faltas y bonus, relato y acta calculados de los hechos. Se juega completo al pulsar el botón y
        después se consulta; dirigirlo en directo llega en ME-05. Se usa una foto de los perfiles mostrados: editarlos después no cambia un
        partido ya jugado.
      </p>
      {props.usingReferenceProfiles && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          PostgreSQL no está disponible: el partido usa los perfiles de referencia del fixture. No se guarda ni se borra nada.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[home, away].map(
          (team, i) =>
            team && (
              <div key={team.id} className="rounded border border-slate-200 p-2 text-xs dark:border-slate-800">
                <p className="mb-1 text-sm font-semibold" style={{ color: TEAM_COLORS[i] }}>
                  {team.name} ({team.players.length} inscritos)
                </p>
                {team.players.length < 12 && (
                  <p className="mb-1 text-amber-700 dark:text-amber-400">
                    Solo {team.players.length} jugadores: ejecuta el seed no destructivo (npm run prisma:seed) para crear los suplentes que falten.
                  </p>
                )}
                <ul className="space-y-0.5">
                  {ordered(team.players, (LAB_STARTER_IDS[team.id] ?? []) as readonly string[]).map((p) => (
                    <li key={p.id}>
                      <span className="font-mono">{p.id}</span> {p.name} · {rolesOf(p.id)}
                      {((LAB_STARTER_IDS[team.id] ?? []) as readonly string[]).includes(p.id) ? " · titular" : " · suplente"}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="flex items-center gap-1">
                    Defiende el bloqueo con
                    <select
                      className="rounded border border-slate-300 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={teamSettings(props.settings, team.id).coverage}
                      onChange={(e) => setTeam(team.id, { coverage: e.target.value as DefensiveCoverageChoice })}
                    >
                      {(Object.keys(COVERAGE_LABELS) as DefensiveCoverageChoice[]).map((c) => (
                        <option key={c} value={c}>
                          {COVERAGE_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    Tras tiro
                    <select
                      className="rounded border border-slate-300 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={teamSettings(props.settings, team.id).priority}
                      onChange={(e) => setTeam(team.id, { priority: e.target.value as ReboundPriority })}
                    >
                      {(Object.keys(PRIORITY_LABELS) as ReboundPriority[]).map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    Plan ofensivo
                    <select
                      className="rounded border border-slate-300 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={teamSettings(props.settings, team.id).offensivePlan}
                      onChange={(e) => setTeam(team.id, { offensivePlan: e.target.value as OffensivePlanChoice })}
                    >
                      {(Object.keys(OFFENSIVE_PLAN_LABELS) as OffensivePlanChoice[]).map((p) => (
                        <option key={p} value={p}>
                          {OFFENSIVE_PLAN_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    Defensa sin balón
                    <select
                      className="rounded border border-slate-300 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={teamSettings(props.settings, team.id).offBallDefensiveCall}
                      onChange={(e) => setTeam(team.id, { offBallDefensiveCall: e.target.value as OffBallDefensiveCallChoice })}
                    >
                      {(Object.keys(OFF_BALL_CALL_LABELS) as OffBallDefensiveCallChoice[]).map((c) => (
                        <option key={c} value={c}>
                          {OFF_BALL_CALL_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    Prioridad de creación
                    <select
                      className="rounded border border-slate-300 bg-transparent px-1 py-0.5 dark:border-slate-700"
                      value={teamSettings(props.settings, team.id).creationPriority}
                      onChange={(e) => setTeam(team.id, { creationPriority: e.target.value as OffensiveCreationPriority })}
                    >
                      {(Object.keys(CREATION_PRIORITY_LABELS) as OffensiveCreationPriority[]).map((c) => (
                        <option key={c} value={c}>
                          {CREATION_PRIORITY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ),
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Semilla del partido
          <input
            type="number"
            className="w-24 rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
            value={props.settings.seed}
            onChange={(e) => props.onSettingsChange({ ...props.settings, seed: Number(e.target.value) })}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={props.settings.auditEnabled}
            onChange={(e) => props.onSettingsChange({ ...props.settings, auditEnabled: e.target.checked })}
          />
          Registrar auditoría
        </label>
        <button
          type="button"
          disabled={props.running || !home || !away}
          onClick={props.onPlay}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {props.running ? "Jugando partido…" : "Jugar partido"}
        </button>
        {props.running && <span className="text-xs text-slate-500">Calculando el partido completo (puede tardar unos segundos)…</span>}
      </div>
      {props.error && <p className="text-sm text-red-700 dark:text-red-400">{props.error}</p>}
      {props.staleNotice && !props.result && (
        <p className="rounded border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {props.staleNotice}
        </p>
      )}
      {props.result && <GameViewer key={props.resultKey} game={props.result} />}
    </section>
  );
}
