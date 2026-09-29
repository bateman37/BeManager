"use client";

import { useMemo, useState } from "react";
import { COURT_LENGTH_METERS, COURT_WIDTH_METERS } from "@match/domain/geometry/court";
import type { Point2D } from "@match/domain/geometry/point";
import type { LabTeamRecord } from "@match/application/ports/lab-team-repository.port";
import type { PlayLabTramoResult } from "@match/application/use-cases/play-lab-tramo";
import type { DefensiveCoverage } from "@match/domain/lab/match-input";
import type {
  BuildTramoTeamArgs,
  PhaseKind,
  PhaseEntry,
  ReboundPriority,
  Responsibility,
  TramoEvent,
  TramoResult,
} from "@match/domain/sequence/tramo-model";

/**
 * Modo «Jugar tramo» de ME-03: controles (semilla y cobertura compartidas
 * con el resto del laboratorio, prioridad por equipo) y visor del tramo ya
 * generado. El visor solo presenta hechos calculados por el dominio: no
 * contiene reglas de juego.
 */

const PRIORITY_LABELS: Record<ReboundPriority, string> = {
  proteger_balance: "Proteger balance (1 carga, 3 retornan)",
  cargar_rebote: "Cargar rebote (2 cargan, 2 retornan)",
};

const STOP_LABELS: Record<TramoResult["stop"]["cause"], string> = {
  cuatro_posesiones: "Cuatro posesiones cerradas",
  tiempo_agotado: "Tiempo reglamentario agotado",
  guardian: "Detenido por el guardián de progreso",
};

const PHASE_KIND_LABELS: Record<PhaseKind, string> = {
  inicio_tramo: "Inicio del tramo",
  rebote_defensivo: "Control rival = nueva posesión (rebote defensivo)",
  robo: "Control rival = nueva posesión (robo)",
  recuperacion_rival: "Control rival = nueva posesión (balón suelto recuperado)",
  saque: "Saque",
  rebote_ofensivo: "Rebote ofensivo = nueva fase de la misma posesión",
  salida_segura: "Salida segura = nueva fase de la misma posesión",
  recuperacion_propia: "Balón suelto recuperado = nueva fase de la misma posesión",
  salto_inicial: "Primer control tras el salto inicial",
};

const ENTRY_LABELS: Record<PhaseEntry, string> = {
  ataque_organizado: "Ataque organizado",
  ventaja_temprana: "Ventaja temprana",
  segunda_oportunidad: "Segunda oportunidad",
  segunda_entrada: "Segunda entrada del bloqueo",
  pendiente: "Por decidir",
};

const RESPONSIBILITY_LABELS: Record<Responsibility, string> = {
  cargar_rebote: "Carga el rebote",
  proteger_balance: "Protege el balance",
  retorno_defensivo: "Retorno defensivo",
  salida: "Salida del balón",
  carril_transicion: "Carril de transición",
  sacador: "Sacador",
  receptor_saque: "Receptor del saque",
  organizacion: "Se coloca para atacar",
  accion_organizada: "Acción organizada",
};

const RESPONSIBILITY_BADGE: Partial<Record<Responsibility, string>> = {
  cargar_rebote: "C",
  proteger_balance: "B",
  retorno_defensivo: "R",
  carril_transicion: "T",
  sacador: "S",
};

const TEAM_COLORS = ["#4338ca", "#b91c1c"] as const;

function formatGameClock(ms: number): string {
  const tenths = Math.max(0, Math.floor(ms / 100));
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths % 10}`;
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2).replace(".", ",")} s`;
}

// --- cancha completa ----------------------------------------------------------

const SCALE = 16;
const MARGIN_M = 1;

function toSvg(p: Point2D): { x: number; y: number } {
  return { x: (p.x + MARGIN_M) * SCALE, y: (COURT_WIDTH_METERS - p.y + MARGIN_M) * SCALE };
}

function TramoCourt({
  event,
  teamIndexOf,
  teamNames,
  badgeOf,
}: {
  readonly event: TramoEvent;
  readonly teamIndexOf: (playerId: string) => number;
  readonly teamNames: readonly [string, string];
  readonly badgeOf: (playerId: string) => string | undefined;
}) {
  const width = (COURT_LENGTH_METERS + 2 * MARGIN_M) * SCALE;
  const height = (COURT_WIDTH_METERS + 2 * MARGIN_M) * SCALE;
  const origin = toSvg({ x: 0, y: COURT_WIDTH_METERS });
  const mid = toSvg({ x: COURT_LENGTH_METERS / 2, y: COURT_WIDTH_METERS });
  const rightHoop = toSvg({ x: 26.425, y: 7.5 });
  const leftHoop = toSvg({ x: COURT_LENGTH_METERS - 26.425, y: 7.5 });
  const ball = toSvg(event.ball.position);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-lg border border-slate-300 bg-emerald-50 dark:border-slate-700 dark:bg-emerald-950"
      role="img"
      aria-label="Cancha completa con los diez jugadores y el balón en el instante seleccionado"
    >
      <rect
        x={origin.x}
        y={origin.y}
        width={COURT_LENGTH_METERS * SCALE}
        height={COURT_WIDTH_METERS * SCALE}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
      <line x1={mid.x} y1={origin.y} x2={mid.x} y2={origin.y + COURT_WIDTH_METERS * SCALE} stroke="currentColor" strokeWidth={1} />
      <circle cx={rightHoop.x} cy={rightHoop.y} r={6} fill="none" stroke={TEAM_COLORS[0]} strokeWidth={2} />
      <circle cx={leftHoop.x} cy={leftHoop.y} r={6} fill="none" stroke={TEAM_COLORS[1]} strokeWidth={2} />
      <text x={rightHoop.x - 4} y={origin.y + 12} textAnchor="end" fontSize={9} fill={TEAM_COLORS[0]}>
        aro que ataca {teamNames[0]} →
      </text>
      <text x={leftHoop.x + 4} y={origin.y + 12} textAnchor="start" fontSize={9} fill={TEAM_COLORS[1]}>
        ← aro que ataca {teamNames[1]}
      </text>

      {event.positions.map(({ playerId, position }) => {
        const point = toSvg(position);
        const holder = event.ball.holderId === playerId;
        const badge = badgeOf(playerId);
        return (
          <g key={playerId}>
            {holder && <circle cx={point.x} cy={point.y} r={13} fill="none" stroke="#f59e0b" strokeWidth={3} />}
            <circle cx={point.x} cy={point.y} r={10} fill={TEAM_COLORS[teamIndexOf(playerId)]} opacity={0.88} />
            <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize={10} fill="white" fontWeight="bold">
              {playerId}
            </text>
            {badge && (
              <text x={point.x + 11} y={point.y - 9} fontSize={9} fontWeight="bold" fill="#0f172a" className="dark:fill-slate-100">
                {badge}
              </text>
            )}
          </g>
        );
      })}
      {!event.ball.holderId && <circle cx={ball.x} cy={ball.y} r={5} fill="#f59e0b" stroke="#78350f" strokeWidth={1} />}
    </svg>
  );
}

// --- visor ----------------------------------------------------------------------

function controlText(event: TramoEvent, teamName: (id: string | null) => string): string {
  const c = event.control;
  switch (c.status) {
    case "control":
      return `Control: ${teamName(c.controlTeamId)}${event.ball.holderId ? ` (balón en poder de ${event.ball.holderId})` : " (pase en el aire)"}`;
    case "tiro_en_el_aire":
      return "Tiro en el aire: ningún equipo tiene control";
    case "balon_suelto":
      return "Balón suelto sin control";
    case "balon_muerto":
      return c.throwInTeamId ? `Balón muerto: derecho a saque de ${teamName(c.throwInTeamId)}` : "Balón muerto";
  }
}

export function TramoViewer({ result }: { readonly result: TramoResult }) {
  const [index, setIndex] = useState(0);
  const events = result.events;
  const event = events[Math.min(index, events.length - 1)]!;
  const teams = result.input.teams;
  const teamNames: readonly [string, string] = [teams[0].name, teams[1].name];

  const teamIndexOf = useMemo(() => {
    const map = new Map<string, number>();
    teams.forEach((t, i) => t.players.forEach((p) => map.set(p.id, i)));
    return (id: string) => map.get(id) ?? 0;
  }, [teams]);
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "—";

  // Responsabilidad vigente de cada jugador en el instante escogido.
  const responsibilityAt = useMemo(() => {
    const current = new Map<string, (typeof result.responsibilities)[number]>();
    for (const r of result.responsibilities) {
      if (r.atMs <= event.atMs) current.set(r.playerId, r);
    }
    return current;
  }, [result, event.atMs]);

  const possession = result.possessions[event.possessionIndex - 1]!;
  const phase = possession.phases[event.phaseIndex - 1];
  const possessionStarts = events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.kind === "possession_started")
    .map(({ i }) => i);

  function goToPossession(direction: 1 | -1) {
    if (direction === 1) {
      const next = possessionStarts.find((i) => i > index);
      if (next !== undefined) setIndex(next);
    } else {
      const previous = [...possessionStarts].reverse().find((i) => i < index);
      setIndex(previous ?? 0);
    }
  }

  const button = "rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-slate-700";

  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
        <p className="font-medium">
          {STOP_LABELS[result.stop.cause]} · Posesiones cerradas: {result.closedPossessions} · Marcador final:{" "}
          {teams[0].name} {result.finalScore[teams[0].id]} – {result.finalScore[teams[1].id]} {teams[1].name}
        </p>
        <p className="text-slate-600 dark:text-slate-300">{result.stop.explanation}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Tramo ejecutado con: semilla {result.input.seed} · cobertura {result.input.coverage} · {teams[0].name}:{" "}
          {PRIORITY_LABELS[teams[0].priority]} · {teams[1].name}: {PRIORITY_LABELS[teams[1].priority]} · Reglas{" "}
          {result.input.rulesetVersion} · Parámetros {result.input.labParametersVersion} · {result.input.tramoVersion}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {result.possessions.map((p) => {
          const active = p.index === event.possessionIndex;
          return (
            <button
              key={p.index}
              type="button"
              onClick={() => setIndex(possessionStarts[p.index - 1] ?? 0)}
              className={`rounded border px-2 py-1 text-left text-xs ${
                active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950" : "border-slate-300 dark:border-slate-700"
              }`}
            >
              <span className="font-semibold" style={{ color: TEAM_COLORS[teams[0].id === p.teamId ? 0 : 1] }}>
                Posesión {p.index} · {teamName(p.teamId)}
              </span>
              <br />
              {formatSeconds(p.startMs)} → {p.endMs === null ? "sin cerrar" : formatSeconds(p.endMs)} ·{" "}
              {p.phases.length} fase(s)
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={button} disabled={index === 0} onClick={() => goToPossession(-1)}>
          ⏮ Posesión anterior
        </button>
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
          disabled={!possessionStarts.some((i) => i > index)}
          onClick={() => goToPossession(1)}
        >
          Posesión siguiente ⏭
        </button>
        <input
          type="range"
          min={0}
          max={events.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="w-48"
          aria-label="Recorrer el tramo por eventos"
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
            badgeOf={(id) => {
              const r = responsibilityAt.get(id);
              return r ? RESPONSIBILITY_BADGE[r.responsibility] : undefined;
            }}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Anillo naranja: poseedor del balón (punto naranja: balón sin poseedor). Letras: C carga, B balance, R
            retorno defensivo, T carril de transición, S sacador. Posiciones globales en el instante del evento.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="rounded border border-slate-200 p-3 dark:border-slate-800">
            <p className="font-semibold">
              Posesión {event.possessionIndex} ({teamName(event.possessionTeamId)}) · fase {event.phaseIndex}
            </p>
            {phase && (
              <>
                <p>{PHASE_KIND_LABELS[phase.kind]}</p>
                <p>
                  <span className="font-medium">{ENTRY_LABELS[phase.entry]}</span>
                  {phase.entryReason ? `: ${phase.entryReason}` : ""}
                </p>
              </>
            )}
            <p className="mt-1">
              Instante {formatSeconds(event.atMs)} · Reloj de partido {formatGameClock(event.gameClockMs)} (1.er cuarto) ·
              Reloj de lanzamiento {event.shotClockMs === null ? "sin correr" : formatSeconds(event.shotClockMs)}
            </p>
            <p>{controlText(event, teamName)}</p>
            <p>
              Marcador: {teams[0].name} {event.score[teams[0].id]} – {event.score[teams[1].id]} {teams[1].name}
            </p>
          </div>

          <div className="rounded border border-slate-200 p-3 dark:border-slate-800">
            <p className="mb-1 font-semibold">Quién carga, quién vuelve (en este instante)</p>
            {teams.map((team, ti) => (
              <div key={team.id} className="mb-1">
                <p className="text-xs font-medium" style={{ color: TEAM_COLORS[ti] }}>
                  {team.name} · plan {PRIORITY_LABELS[team.priority]}
                </p>
                <ul className="text-xs">
                  {team.players.map((p) => {
                    const r = responsibilityAt.get(p.id);
                    return (
                      <li key={p.id}>
                        <span className="font-mono">{p.id}</span>: {r ? `${RESPONSIBILITY_LABELS[r.responsibility]} — ${r.reason}` : "—"}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ol className="max-h-96 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 text-sm dark:border-slate-800">
        {events.map((e, i) => {
          const marker = e.kind === "possession_started" || e.kind === "possession_ended" || e.kind === "phase_started" || e.kind === "tramo_stopped";
          return (
            <li key={e.sequence}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={`w-full rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                  i === index ? "bg-slate-100 dark:bg-slate-800" : ""
                } ${marker ? "font-semibold" : ""}`}
              >
                <span className="mr-2 font-mono text-xs text-slate-400">{formatSeconds(e.atMs)}</span>
                <span className="mr-2 rounded bg-slate-200 px-1 text-xs dark:bg-slate-700">
                  P{e.possessionIndex}·F{e.phaseIndex}
                </span>
                {e.text}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// --- sección con controles ----------------------------------------------------------

export interface TramoSectionProps {
  readonly teams: readonly LabTeamRecord[];
  readonly seed: number;
  readonly coverage: DefensiveCoverage;
  readonly coverageLabels: Readonly<Record<DefensiveCoverage, string>>;
  readonly onSeedChange: (seed: number) => void;
  readonly onCoverageChange: (coverage: DefensiveCoverage) => void;
  readonly priorities: Readonly<Record<string, ReboundPriority>>;
  readonly onPriorityChange: (teamId: string, priority: ReboundPriority) => void;
  readonly result: TramoResult | null;
  /** Cambia en cada tramo jugado: reinicia el visor al primer evento. */
  readonly resultKey: number;
  readonly error: string | null;
  readonly running: boolean;
  readonly usingReferenceProfiles: boolean;
  readonly onPlay: () => void;
}

export function TramoSection(props: TramoSectionProps) {
  const [offense, defense] = props.teams;
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-lg font-semibold">Jugar tramo: posesiones enlazadas (ME-03)</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Un tramo de hasta cuatro posesiones estadísticas con los mismos diez jugadores, el mismo balón y la misma
        cancha. Empieza en «Drop con ayuda» (7:12 del primer cuarto, 18 s de lanzamiento) y continúa con rebotes,
        transición, saques y cambios de lado. Un rebote ofensivo es una fase nueva de la misma posesión; el control
        del rival abre una posesión nueva. Separado de las pruebas de una posesión y de los lotes de arriba.
      </p>
      {props.usingReferenceProfiles && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          PostgreSQL no está disponible: el tramo usa los perfiles de referencia del fixture. No se guarda ni se borra
          nada.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Semilla
          <input
            type="number"
            className="w-24 rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
            value={props.seed}
            onChange={(e) => props.onSeedChange(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2">
          Cobertura (ambos equipos al defender)
          <select
            className="rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
            value={props.coverage}
            onChange={(e) => props.onCoverageChange(e.target.value as DefensiveCoverage)}
          >
            {(Object.keys(props.coverageLabels) as DefensiveCoverage[]).map((c) => (
              <option key={c} value={c}>
                {props.coverageLabels[c]}
              </option>
            ))}
          </select>
        </label>
        {[offense, defense].map(
          (team) =>
            team && (
              <label key={team.id} className="flex items-center gap-2">
                Prioridad tras tiro de {team.name}
                <select
                  className="rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
                  value={props.priorities[team.id] ?? "proteger_balance"}
                  onChange={(e) => props.onPriorityChange(team.id, e.target.value as ReboundPriority)}
                >
                  {(Object.keys(PRIORITY_LABELS) as ReboundPriority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>
            ),
        )}
        <button
          type="button"
          disabled={props.running || !offense || !defense}
          onClick={props.onPlay}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {props.running ? "Jugando…" : "Jugar tramo"}
        </button>
      </div>
      {props.error && <p className="text-sm text-red-700 dark:text-red-400">{props.error}</p>}
      {props.result && <TramoViewer key={props.resultKey} result={props.result} />}
    </section>
  );
}

/** Datos mínimos que el caso de uso necesita de cada equipo. */
export function toTramoTeam(team: LabTeamRecord, priority: ReboundPriority): BuildTramoTeamArgs {
  return { id: team.id, name: team.name, players: team.players, priority };
}

export type PlayTramoAction = (
  seed: number,
  coverage: DefensiveCoverage,
  offenseTeam: BuildTramoTeamArgs,
  defenseTeam: BuildTramoTeamArgs,
) => Promise<PlayLabTramoResult>;
