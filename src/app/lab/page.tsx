import { LabWorkspace } from "@match/ui/lab-workspace";
import {
  loadRosterAction,
  savePlayerAction,
  duplicatePlayerAction,
  runScenarioAction,
  compareScenarioAction,
} from "./actions";

// El laboratorio depende de PostgreSQL en tiempo de petición; nunca en build.
export const dynamic = "force-dynamic";

export default async function LabPage() {
  const rosterResult = await loadRosterAction();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Laboratorio de Partido — ME-01
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Primera posesión integrada</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Crea o edita jugadores, elige un escenario de bloqueo directo y
          juega una posesión 5v5 completa, con relato por pasos y
          comparación rápida de la ayuda de D3.
        </p>
      </header>

      <LabWorkspace
        initialTeams={rosterResult.teams}
        initialWarning={rosterResult.status === "unavailable" ? rosterResult.reason : undefined}
        actions={{
          savePlayer: savePlayerAction,
          duplicatePlayer: duplicatePlayerAction,
          runScenario: runScenarioAction,
          compareScenario: compareScenarioAction,
        }}
      />
    </main>
  );
}
