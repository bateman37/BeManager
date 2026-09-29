"use client";

import { useState } from "react";
import type { LabTeamRecord } from "@match/application/ports/lab-team-repository.port";
import type { RestoreLabTeamResult } from "@match/application/use-cases/restore-lab-team-from-fixture";
import type { BulkIncrementLabAttributesResult, LabBulkIncrementAmount } from "@match/application/use-cases/bulk-increment-lab-attributes";
import { ACTIVE_ATTRIBUTE_IDS, RATING_MAX } from "@match/domain/players/attribute";
import { LAB_ROSTER_FIXTURE } from "@match/domain/players/lab-roster-fixture";

/**
 * Panel breve de experimentación de laboratorio por equipo (ME-06 §4):
 * selección múltiple de jugadores, restablecer desde el seed (con
 * confirmación) e incremento masivo (+1/+3/+5, con confirmación de que se
 * acumula). Ambas operaciones son atómicas por equipo en el servidor; este
 * panel solo compone la llamada y refresca desde el resultado persistido.
 */
export interface ProfileControlsActions {
  restoreTeamFromFixture: (teamId: string) => Promise<RestoreLabTeamResult>;
  bulkIncrementAttributes: (
    teamId: string,
    playerIds: readonly string[],
    amount: LabBulkIncrementAmount,
  ) => Promise<BulkIncrementLabAttributesResult>;
}

export interface ProfileControlsPanelProps {
  readonly teams: readonly LabTeamRecord[];
  readonly actions: ProfileControlsActions;
  /** Se llama tras cualquier cambio persistido, con los equipos ya refrescados desde el servidor. */
  readonly onTeamsChanged: (teams: readonly LabTeamRecord[]) => void;
  /** Se llama cuando cualquier cambio de perfiles deja obsoleto un partido/tramo/comparación previos. */
  readonly onProfilesChanged: (reason: string) => void;
}

const INCREMENT_AMOUNTS: readonly LabBulkIncrementAmount[] = [1, 3, 5];
const FIXTURE_TEAM_IDS = new Set(LAB_ROSTER_FIXTURE.map((t) => t.id));

function TeamProfileControls({
  team,
  actions,
  onTeamsChanged,
  onProfilesChanged,
  allTeams,
}: {
  readonly team: LabTeamRecord;
  readonly actions: ProfileControlsActions;
  readonly onTeamsChanged: (teams: readonly LabTeamRecord[]) => void;
  readonly onProfilesChanged: (reason: string) => void;
  readonly allTeams: readonly LabTeamRecord[];
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [restoring, setRestoring] = useState(false);
  const [incrementing, setIncrementing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const hasFixture = FIXTURE_TEAM_IDS.has(team.id);
  const fixtureTeam = LAB_ROSTER_FIXTURE.find((t) => t.id === team.id);
  const fixtureIds = new Set(fixtureTeam?.players.map((p) => p.id) ?? []);

  function toggle(playerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === team.players.length ? new Set() : new Set(team.players.map((p) => p.id))));
  }

  async function handleRestore() {
    if (!hasFixture || !fixtureTeam) return;
    const ids = fixtureTeam.players.map((p) => p.id).join(", ");
    const confirmed = window.confirm(
      `Esto sobrescribirá las ediciones de los ${fixtureTeam.players.length} perfiles del fixture de ${team.name} ` +
        `(atributos, medidas, nombre, edad, plantilla y tendencia), tal y como figuran en LAB_ROSTER_FIXTURE.\n\n` +
        `IDs afectados: ${ids}.\n\n` +
        `Los perfiles añadidos a mano que no pertenezcan al fixture quedan intactos. ¿Continuar?`,
    );
    if (!confirmed) return;
    setRestoring(true);
    setMessage(null);
    try {
      const result = await actions.restoreTeamFromFixture(team.id);
      if (result.status === "restored") {
        const restoredById = new Map(fixtureTeam.players.map((p) => [p.id, p]));
        const nextPlayers = team.players.map((p) => restoredById.get(p.id) ?? p);
        onTeamsChanged(allTeams.map((t) => (t.id === team.id ? { ...t, players: nextPlayers } : t)));
        onProfilesChanged(`Has restablecido ${team.name} desde el seed`);
        setMessage(`Restablecidos ${result.restoredCount} perfiles de ${team.name}.`);
        setSelected(new Set());
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("No se pudo contactar con el servidor para restablecer el equipo. Inténtalo de nuevo.");
    } finally {
      setRestoring(false);
    }
  }

  async function handleIncrement(amount: LabBulkIncrementAmount) {
    if (selected.size === 0) return;
    const ids = [...selected];
    const alreadyAtMax = team.players
      .filter((p) => ids.includes(p.id))
      .reduce((n, p) => n + ACTIVE_ATTRIBUTE_IDS.filter((a) => p.attributes[a] >= RATING_MAX).length, 0);
    const willBeCapped = team.players
      .filter((p) => ids.includes(p.id))
      .reduce(
        (n, p) =>
          n +
          ACTIVE_ATTRIBUTE_IDS.filter((a) => p.attributes[a] < RATING_MAX && p.attributes[a] + amount > RATING_MAX).length,
        0,
      );
    const confirmed = window.confirm(
      `Vas a aplicar +${amount} a los 27 atributos activos de ${ids.length} jugador(es) seleccionados de ${team.name}, ` +
        `sobre sus valores guardados actuales (una segunda aplicación se acumula sobre esta, no sobre el fixture).\n\n` +
        `${alreadyAtMax} atributos ya están en ${RATING_MAX} (no cambiarán). ${willBeCapped} quedarán limitados a ${RATING_MAX} por el tope.\n\n` +
        `¿Continuar?`,
    );
    if (!confirmed) return;
    setIncrementing(true);
    setMessage(null);
    try {
      const result = await actions.bulkIncrementAttributes(team.id, ids, amount);
      if (result.status === "applied") {
        // Refresca desde el resultado persistido: usa los perfiles que el
        // servidor ya guardó, no un recálculo del navegador.
        const updatedById = new Map(result.updatedPlayers.map((p) => [p.id, p]));
        const nextPlayers = team.players.map((p) => updatedById.get(p.id) ?? p);
        onTeamsChanged(allTeams.map((t) => (t.id === team.id ? { ...t, players: nextPlayers } : t)));
        onProfilesChanged(`Has aplicado +${amount} a ${result.playersChanged} jugador(es) de ${team.name}`);
        setMessage(
          `Aplicado +${amount} a ${result.playersChanged} jugador(es): ${result.attributesChanged} atributos cambiaron ` +
            `(${result.attributesClampedToMax} limitados a ${RATING_MAX}), ${result.attributesAlreadyAtMax} ya estaban en ${RATING_MAX}.`,
        );
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("No se pudo contactar con el servidor para aplicar el incremento. Inténtalo de nuevo.");
    } finally {
      setIncrementing(false);
    }
  }

  const busy = restoring || incrementing;

  return (
    <div className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
      <p className="mb-1 font-semibold">{team.name}</p>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        {selected.size} de {team.players.length} seleccionados
        {selected.size > 0 && `: ${[...selected].join(", ")}`}
      </p>
      <div className="mb-2 max-h-40 overflow-y-auto rounded border border-slate-100 p-1 dark:border-slate-900">
        <label className="flex items-center gap-2 border-b border-slate-100 py-0.5 font-medium dark:border-slate-900">
          <input type="checkbox" checked={selected.size === team.players.length} onChange={toggleAll} />
          Todos
        </label>
        {team.players.map((p) => (
          <label key={p.id} className="flex items-center gap-2 py-0.5">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
            <span className="font-mono">{p.id}</span> {p.name}
            {hasFixture && !fixtureIds.has(p.id) && <span className="text-amber-600 dark:text-amber-400"> (manual)</span>}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !hasFixture}
          onClick={() => void handleRestore()}
          className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-slate-700"
        >
          Restaurar desde el seed
        </button>
        {INCREMENT_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void handleIncrement(amount)}
            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-slate-700"
          >
            +{amount}
          </button>
        ))}
      </div>
      {message && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{message}</p>}
    </div>
  );
}

export function ProfileControlsPanel(props: ProfileControlsPanelProps) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-lg font-semibold">Perfiles de laboratorio (ME-06)</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Selecciona jugadores de un equipo para restablecerlos desde el fixture versionado o aplicarles un incremento
        masivo de sus 27 atributos activos. Ambas operaciones son atómicas por equipo y nunca tocan al otro equipo.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {props.teams.map((team) => (
          <TeamProfileControls
            key={team.id}
            team={team}
            actions={props.actions}
            allTeams={props.teams}
            onTeamsChanged={props.onTeamsChanged}
            onProfilesChanged={props.onProfilesChanged}
          />
        ))}
      </div>
    </section>
  );
}
