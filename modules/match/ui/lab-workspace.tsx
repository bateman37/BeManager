"use client";

import { useMemo, useState } from "react";
import type { LabTeamRecord } from "@match/application/ports/lab-team-repository.port";
import type { SaveLabPlayerResult } from "@match/application/use-cases/save-lab-player";
import type { PlayerProfile } from "@match/domain/players/player-profile";
import type { MatchState } from "@match/domain/simulation/match-state";
import type { Fact } from "@match/domain/simulation/fact";
import type { HelpComparisonResult } from "@match/domain/fast/fast-resolver";
import type { ScenarioId } from "@match/domain/lab/scenario";
import { PlayerEditor } from "./player-editor";
import { CourtView } from "./court-view";
import { NarrativeLog } from "./narrative-log";

const SCENARIO_LABELS: Record<ScenarioId, string> = {
  drop_con_ayuda: "Drop con ayuda",
  drop_sin_ayuda: "Drop sin ayuda",
  closeout_tardio_con_contacto: "Closeout tardío con contacto",
};

const SCENARIOS: { id: ScenarioId; label: string }[] = (
  Object.keys(SCENARIO_LABELS) as ScenarioId[]
).map((id) => ({ id, label: SCENARIO_LABELS[id] }));

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
  const [seed, setSeed] = useState(1);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<Fact["positions"] | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [sampleSize, setSampleSize] = useState(30);
  const [comparison, setComparison] = useState<HelpComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);

  // HF-002 §1.7/§4: un resultado calculado con una configuración anterior
  // nunca se atribuye visualmente a la selección actual. Al cambiar
  // escenario, semilla o el roster guardado, se limpian los resultados.
  function invalidatePreviousResults() {
    setMatchState(null);
    setSelectedPositions(null);
    setComparison(null);
  }

  function handleScenarioChange(next: ScenarioId) {
    setScenarioId(next);
    invalidatePreviousResults();
  }

  function handleSeedChange(next: number) {
    setSeed(next);
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
    const state = await actions.runScenario(scenarioId, seed, offenseTeam.players, defenseTeam.players);
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
                Escenario ejecutado: {SCENARIO_LABELS[matchState.input.scenarioId]} · Semilla:{" "}
                {matchState.input.seed} · Reglas: {matchState.input.rulesetVersion} · Parámetros:{" "}
                {matchState.input.labParametersVersion}
              </p>
            </div>
            <NarrativeLog facts={matchState.facts} onSelectPositions={setSelectedPositions} />
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Comparar ayuda sí/no (resolución rápida)</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Esta comparación siempre ejecuta «Drop con ayuda» frente a «Drop sin ayuda», con
          independencia del escenario seleccionado arriba. El escenario de closeout tardío no es
          una variante de ayuda sí/no: pruébalo en la ejecución individual, no en esta tabla.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            Tamaño de muestra
            <input
              type="number"
              min={1}
              className="w-24 rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={comparing}
            onClick={() => void handleCompare()}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Comparar lote
          </button>
        </div>

        {comparison && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left dark:border-slate-700">
                  <th className="py-1 pr-2">Categoría</th>
                  <th className="py-1 pr-2">Con ayuda</th>
                  <th className="py-1">Sin ayuda</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(comparison.withHelp.categories) as (keyof typeof comparison.withHelp.categories)[]).map(
                  (key) => (
                    <tr key={key} className="border-b border-slate-100 dark:border-slate-900">
                      <td className="py-1 pr-2">{key}</td>
                      <td className="py-1 pr-2">{comparison.withHelp.categories[key]}</td>
                      <td className="py-1">{comparison.withoutHelp.categories[key]}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-slate-500">
              Tamaño de muestra: {comparison.withHelp.sampleSize} corridas por variante · Semillas:{" "}
              {comparison.withHelp.seedStart}–{comparison.withHelp.seedEnd} · Reglas:{" "}
              {comparison.withHelp.rulesetVersion} · Parámetros: {comparison.withHelp.labParametersVersion}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
