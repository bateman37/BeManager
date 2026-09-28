"use client";

import { useMemo, useState } from "react";
import type { LabTeamRecord } from "@match/application/ports/lab-team-repository.port";
import type { SaveLabPlayerResult } from "@match/application/use-cases/save-lab-player";
import type { PlayerProfile } from "@match/domain/players/player-profile";
import type { MatchState } from "@match/domain/simulation/match-state";
import type { Fact } from "@match/domain/simulation/fact";
import type {
  HelpComparisonResult,
  CoverageComparisonResult,
  ScenarioBatchCategories,
  ScenarioBatchResult,
} from "@match/domain/fast/fast-resolver";
import type { ScenarioId } from "@match/domain/lab/scenario";
import type { DefensiveCoverage } from "@match/domain/lab/match-input";
import { PlayerEditor } from "./player-editor";
import { CourtView } from "./court-view";
import { NarrativeLog } from "./narrative-log";
import { TramoSection, toTramoTeam, type PlayTramoAction } from "./tramo-panel";
import type { ReboundPriority, TramoResult } from "@match/domain/sequence/tramo-model";

const SCENARIO_LABELS: Record<ScenarioId, string> = {
  drop_con_ayuda: "Drop con ayuda",
  drop_sin_ayuda: "Drop sin ayuda",
  closeout_tardio_con_contacto: "Closeout tardío con contacto",
};

const SCENARIOS: { id: ScenarioId; label: string }[] = (
  Object.keys(SCENARIO_LABELS) as ScenarioId[]
).map((id) => ({ id, label: SCENARIO_LABELS[id] }));

const COVERAGE_LABELS: Record<DefensiveCoverage, string> = {
  drop: "Drop",
  trampa: "Trampa (doble sobre el bloqueo)",
};

/**
 * Etiquetas deportivas en español para cada categoría agregada (ME-02 §4:
 * "no obligues a Dennis a interpretar claves internas `passesToRoll`").
 */
const CATEGORY_LABELS_ES: Record<keyof ScenarioBatchCategories, string> = {
  screensNavigated: "Bloqueos navegados",
  helpLeftAssignment: "Veces que la ayuda deja su marca",
  passesToRoll: "Pases al roll (O5)",
  passesToCorner: "Pases a la esquina (O3)",
  passesToOutlet: "Pases a la salida exterior (O4)",
  safeOutlets: "Salidas seguras (control conservado)",
  shotOpportunities: "Oportunidades de tiro (intentos preparados)",
  fieldGoalAttempts2: "Tiros de 2 intentados (2FGA)",
  fieldGoalMade2: "Tiros de 2 anotados (2FGM)",
  fieldGoalAttempts3: "Triples intentados (3FGA)",
  fieldGoalMade3: "Triples anotados (3FGM)",
  freeThrowAttempts: "Tiros libres intentados (FTA)",
  freeThrowMade: "Tiros libres anotados (FTM)",
  points: "Puntos",
  shootingFouls: "Faltas de tiro",
  turnovers: "Pérdidas",
  steals: "Robos",
  blockedShots: "Tiros taponados",
  offensiveRebounds: "Rebotes ofensivos",
  defensiveRebounds: "Rebotes defensivos",
  shotClockViolations: "Violaciones de 24s",
  outOfBounds: "Balones fuera",
  trapCommitted: "Trampas comprometidas (D1+D5)",
  trapBrokenAdvantage: "Ventajas por trampa rota (4x3)",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS_ES) as (keyof ScenarioBatchCategories)[];

function CategoryTable({
  columns,
}: {
  readonly columns: readonly { readonly label: string; readonly result: ScenarioBatchResult }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left dark:border-slate-700">
            <th className="py-1 pr-2">Categoría</th>
            {columns.map((c) => (
              <th key={c.label} className="py-1 pr-2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.map((key) => (
            <tr key={key} className="border-b border-slate-100 dark:border-slate-900">
              <td className="py-1 pr-2">{CATEGORY_LABELS_ES[key]}</td>
              {columns.map((c) => (
                <td key={c.label} className="py-1 pr-2">
                  {c.result.categories[key]}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-slate-300 font-medium dark:border-slate-700">
            <td className="py-1 pr-2">% 2 puntos</td>
            {columns.map((c) => (
              <td key={c.label} className="py-1 pr-2">
                {c.result.categories.fieldGoalAttempts2 > 0
                  ? `${((100 * c.result.categories.fieldGoalMade2) / c.result.categories.fieldGoalAttempts2).toFixed(1)}%`
                  : "—"}
              </td>
            ))}
          </tr>
          <tr className="font-medium">
            <td className="py-1 pr-2">% triple</td>
            {columns.map((c) => (
              <td key={c.label} className="py-1 pr-2">
                {c.result.categories.fieldGoalAttempts3 > 0
                  ? `${((100 * c.result.categories.fieldGoalMade3) / c.result.categories.fieldGoalAttempts3).toFixed(1)}%`
                  : "—"}
              </td>
            ))}
          </tr>
          <tr className="font-medium">
            <td className="py-1 pr-2">% tiro libre</td>
            {columns.map((c) => (
              <td key={c.label} className="py-1 pr-2">
                {c.result.categories.freeThrowAttempts > 0
                  ? `${((100 * c.result.categories.freeThrowMade) / c.result.categories.freeThrowAttempts).toFixed(1)}%`
                  : "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-xs text-slate-500">
        Posesiones de muestra: {columns[0]?.result.sampleSize} por variante · Semillas:{" "}
        {columns[0]?.result.seedStart}–{columns[0]?.result.seedEnd} · Reglas:{" "}
        {columns[0]?.result.rulesetVersion} · Parámetros: {columns[0]?.result.labParametersVersion}
      </p>
    </div>
  );
}

interface LabWorkspaceActions {
  savePlayer: (teamId: string, player: PlayerProfile) => Promise<SaveLabPlayerResult>;
  duplicatePlayer: (
    teamId: string,
    source: PlayerProfile,
    newId: string,
    newName: string,
  ) => Promise<SaveLabPlayerResult>;
  runScenario: (
    scenarioId: ScenarioId,
    coverage: DefensiveCoverage,
    seed: number,
    offense: readonly PlayerProfile[],
    defense: readonly PlayerProfile[],
  ) => Promise<MatchState>;
  compareScenario: (
    seed: number,
    sampleSize: number,
    offense: readonly PlayerProfile[],
    defense: readonly PlayerProfile[],
  ) => Promise<HelpComparisonResult>;
  compareCoverage: (
    seed: number,
    sampleSize: number,
    offense: readonly PlayerProfile[],
    defense: readonly PlayerProfile[],
  ) => Promise<CoverageComparisonResult>;
  /** ME-03: tramo de hasta cuatro posesiones enlazadas. */
  playTramo: PlayTramoAction;
}

interface LabWorkspaceProps {
  readonly initialTeams: readonly LabTeamRecord[];
  readonly initialWarning?: string;
  readonly actions: LabWorkspaceActions;
}

function findTeamOf(teams: readonly LabTeamRecord[], playerId: string): LabTeamRecord | undefined {
  return teams.find((t) => t.players.some((p) => p.id === playerId));
}

export function LabWorkspace({ initialTeams, initialWarning, actions }: LabWorkspaceProps) {
  const [teams, setTeams] = useState(initialTeams);
  const offenseTeam = teams[0];
  const defenseTeam = teams[1];

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(offenseTeam?.players[0]?.id ?? "");
  const [scenarioId, setScenarioId] = useState<ScenarioId>("drop_con_ayuda");
  const [coverage, setCoverage] = useState<DefensiveCoverage>("drop");
  const [seed, setSeed] = useState(1);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<Fact["positions"] | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [sampleSize, setSampleSize] = useState(30);
  const [comparison, setComparison] = useState<HelpComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [coverageComparison, setCoverageComparison] = useState<CoverageComparisonResult | null>(null);
  const [comparingCoverage, setComparingCoverage] = useState(false);
  const [priorities, setPriorities] = useState<Record<string, ReboundPriority>>({});
  const [tramoResult, setTramoResult] = useState<TramoResult | null>(null);
  const [tramoError, setTramoError] = useState<string | null>(null);
  const [playingTramo, setPlayingTramo] = useState(false);
  const [tramoRunId, setTramoRunId] = useState(0);

  // HF-002 §1.7/§4: un resultado calculado con una configuración anterior
  // nunca se atribuye visualmente a la selección actual. Al cambiar
  // escenario, cobertura, semilla, tamaño de lote o el roster guardado, se
  // limpian los resultados desactualizados (ME-02 §4). ME-03: también el
  // tramo enlazado, y además al cambiar la prioridad de cualquier equipo.
  function invalidatePreviousResults() {
    setMatchState(null);
    setSelectedPositions(null);
    setComparison(null);
    setCoverageComparison(null);
    setTramoResult(null);
    setTramoError(null);
  }

  function handlePriorityChange(teamId: string, priority: ReboundPriority) {
    setPriorities((prev) => ({ ...prev, [teamId]: priority }));
    invalidatePreviousResults();
  }

  async function handlePlayTramo() {
    if (!offenseTeam || !defenseTeam) return;
    setPlayingTramo(true);
    setTramoError(null);
    try {
      const outcome = await actions.playTramo(
        seed,
        coverage,
        toTramoTeam(offenseTeam, priorities[offenseTeam.id] ?? "proteger_balance"),
        toTramoTeam(defenseTeam, priorities[defenseTeam.id] ?? "proteger_balance"),
      );
      if (outcome.status === "played") {
        setTramoResult(outcome.result);
        setTramoRunId((n) => n + 1);
      } else {
        setTramoResult(null);
        setTramoError(outcome.message);
      }
    } catch {
      setTramoResult(null);
      setTramoError("No se pudo contactar con el servidor para jugar el tramo. Inténtalo de nuevo.");
    } finally {
      setPlayingTramo(false);
    }
  }

  function handleScenarioChange(next: ScenarioId) {
    setScenarioId(next);
    invalidatePreviousResults();
  }

  function handleCoverageChange(next: DefensiveCoverage) {
    setCoverage(next);
    invalidatePreviousResults();
  }

  function handleSeedChange(next: number) {
    setSeed(next);
    invalidatePreviousResults();
  }

  function handleSampleSizeChange(next: number) {
    setSampleSize(next);
    invalidatePreviousResults();
  }

  const selectedPlayer = useMemo(() => {
    for (const team of teams) {
      const player = team.players.find((p) => p.id === selectedPlayerId);
      if (player) return player;
    }
    return undefined;
  }, [teams, selectedPlayerId]);

  async function handleSave(player: PlayerProfile) {
    const team = findTeamOf(teams, player.id);
    if (!team) return;
    setSaving(true);
    setSaveMessage(null);
    const result = await actions.savePlayer(team.id, player);
    setSaving(false);
    if (result.status === "saved") {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === team.id
            ? { ...t, players: t.players.map((p) => (p.id === player.id ? player : p)) }
            : t,
        ),
      );
      invalidatePreviousResults();
      setSaveMessage(
        result.warnings.length > 0
          ? `Guardado con avisos: ${result.warnings.map((w) => w.message).join(" ")}`
          : "Guardado correctamente.",
      );
    } else {
      setSaveMessage(result.message);
    }
  }

  async function handleDuplicate(player: PlayerProfile) {
    const team = findTeamOf(teams, player.id);
    if (!team) return;
    const newId = `${player.id}-copia-${Date.now().toString(36)}`;
    setSaving(true);
    const result = await actions.duplicatePlayer(team.id, player, newId, `${player.name} (copia)`);
    setSaving(false);
    if (result.status === "saved") {
      const duplicated: PlayerProfile = { ...player, id: newId, name: `${player.name} (copia)` };
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, players: [...t.players, duplicated] } : t)),
      );
      setSelectedPlayerId(newId);
      invalidatePreviousResults();
      setSaveMessage("Jugador duplicado y guardado.");
    } else {
      setSaveMessage(result.message);
    }
  }

  async function handleRun() {
    if (!offenseTeam || !defenseTeam) return;
    setRunning(true);
    setSelectedPositions(null);
    const state = await actions.runScenario(scenarioId, coverage, seed, offenseTeam.players, defenseTeam.players);
    setMatchState(state);
    setRunning(false);
  }

  async function handleCompare() {
    if (!offenseTeam || !defenseTeam) return;
    setComparing(true);
    const result = await actions.compareScenario(seed, sampleSize, offenseTeam.players, defenseTeam.players);
    setComparison(result);
    setComparing(false);
  }

  async function handleCompareCoverage() {
    if (!offenseTeam || !defenseTeam) return;
    setComparingCoverage(true);
    const result = await actions.compareCoverage(seed, sampleSize, offenseTeam.players, defenseTeam.players);
    setCoverageComparison(result);
    setComparingCoverage(false);
  }

  const displayedPositions = selectedPositions
    ? Object.fromEntries(selectedPositions.map((p) => [p.playerId, p.position]))
    : matchState
      ? Object.fromEntries(Object.entries(matchState.players).map(([id, p]) => [id, p.position]))
      : undefined;

  return (
    <div className="space-y-6">
      {initialWarning && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {initialWarning}
        </p>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Jugadores</h2>
          {teams.map((team) => (
            <div key={team.id}>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{team.name}</p>
              <ul className="space-y-1">
                {team.players.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedPlayerId(player.id)}
                      className={`w-full rounded px-2 py-1 text-left text-sm ${
                        selectedPlayerId === player.id
                          ? "bg-indigo-100 dark:bg-indigo-950"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {player.id} · {player.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div>
          {selectedPlayer ? (
            <PlayerEditor
              key={selectedPlayer.id}
              player={selectedPlayer}
              onSave={handleSave}
              onDuplicate={handleDuplicate}
              saving={saving}
            />
          ) : (
            <p className="text-sm text-slate-500">Selecciona un jugador para editarlo.</p>
          )}
          {saveMessage && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{saveMessage}</p>}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Escenario</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-slate-700"
            value={scenarioId}
            onChange={(e) => handleScenarioChange(e.target.value as ScenarioId)}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            Cobertura ante el bloqueo
            <select
              className="rounded border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-slate-700"
              value={coverage}
              onChange={(e) => handleCoverageChange(e.target.value as DefensiveCoverage)}
            >
              {(Object.keys(COVERAGE_LABELS) as DefensiveCoverage[]).map((c) => (
                <option key={c} value={c}>
                  {COVERAGE_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            Semilla
            <input
              type="number"
              className="w-24 rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
              value={seed}
              onChange={(e) => handleSeedChange(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={running}
            onClick={() => void handleRun()}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Ejecutar
          </button>
          <button
            type="button"
            disabled={running || !matchState}
            onClick={() => void handleRun()}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
          >
            Repetir (misma semilla)
          </button>
        </div>

        {matchState && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <CourtView positions={displayedPositions ?? {}} />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Estado terminal: <span className="font-mono">{matchState.terminal?.kind}</span>
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Balón: <span className="font-mono">{matchState.ball.status}</span>
                {matchState.ball.holderId ? ` · en poder de ${matchState.ball.holderId}` : ""}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Escenario ejecutado: {SCENARIO_LABELS[matchState.input.scenarioId]} · Cobertura:{" "}
                {COVERAGE_LABELS[matchState.input.coverage]} · Semilla: {matchState.input.seed} · Reglas:{" "}
                {matchState.input.rulesetVersion} · Parámetros: {matchState.input.labParametersVersion}
              </p>
            </div>
            <NarrativeLog facts={matchState.facts} onSelectPositions={setSelectedPositions} />
          </div>
        )}
      </section>

      <TramoSection
        teams={teams}
        seed={seed}
        coverage={coverage}
        coverageLabels={COVERAGE_LABELS}
        onSeedChange={handleSeedChange}
        onCoverageChange={handleCoverageChange}
        priorities={priorities}
        onPriorityChange={handlePriorityChange}
        result={tramoResult}
        resultKey={tramoRunId}
        error={tramoError}
        running={playingTramo}
        usingReferenceProfiles={initialWarning !== undefined}
        onPlay={() => void handlePlayTramo()}
      />

      <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Tamaño de muestra (para las dos tablas siguientes)</h2>
        <label className="flex items-center gap-2 text-sm">
          Tamaño de muestra
          <input
            type="number"
            min={1}
            className="w-24 rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
            value={sampleSize}
            onChange={(e) => handleSampleSizeChange(Number(e.target.value))}
          />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Drop: ayuda sí/no (resolución rápida)</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Esta comparación siempre ejecuta «Drop con ayuda» frente a «Drop sin ayuda», con
          independencia del escenario seleccionado arriba. El escenario de closeout tardío no es
          una variante de ayuda sí/no: pruébalo en la ejecución individual, no en esta tabla.
        </p>
        <button
          type="button"
          disabled={comparing}
          onClick={() => void handleCompare()}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Comparar lote (ayuda sí/no)
        </button>

        {comparison && (
          <CategoryTable
            columns={[
              { label: "Con ayuda", result: comparison.withHelp },
              { label: "Sin ayuda", result: comparison.withoutHelp },
            ]}
          />
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Misma posesión: drop/trampa (con ayuda)</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Compara exactamente «Drop con ayuda» frente a «Trampa», con la misma entrada de media
          pista, quintetos, bloqueo central y semillas (ME-02 §3). En ambas variantes D3 tiene
          encomendada la ayuda al continuador y D4 la reparación; solo cambia la cobertura.
        </p>
        <button
          type="button"
          disabled={comparingCoverage}
          onClick={() => void handleCompareCoverage()}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Comparar lote (drop/trampa)
        </button>

        {coverageComparison && (
          <CategoryTable
            columns={[
              { label: "Drop", result: coverageComparison.drop },
              { label: "Trampa", result: coverageComparison.trampa },
            ]}
          />
        )}
      </section>
    </div>
  );
}
