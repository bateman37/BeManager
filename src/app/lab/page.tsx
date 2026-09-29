import { LabWorkspace } from "@match/ui/lab-workspace";
import {
  loadRosterAction,
  savePlayerAction,
  duplicatePlayerAction,
  runScenarioAction,
  compareScenarioAction,
  compareCoverageAction,
  playTramoAction,
  playGameAction,
} from "./actions";
import { listRuleBoundaryCases } from "@match/application/use-cases/list-rule-boundary-cases";
import { RULE_BOUNDARY_LABEL } from "@match/domain/game/rule-boundary-fixtures";

// El laboratorio depende de PostgreSQL en tiempo de petición; nunca en build.
export const dynamic = "force-dynamic";

export default async function LabPage() {
  const rosterResult = await loadRosterAction();
  const boundaryCases = listRuleBoundaryCases();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Laboratorio de Partido — ME-01/ME-02/ME-03/ME-04
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Drop, trampa, tramos enlazados y partido completo</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Crea o edita jugadores, elige un escenario de bloqueo directo y una
          cobertura (drop o trampa), y juega una posesión 5v5 completa, con
          relato por pasos y comparaciones rápidas por lotes. O juega un tramo
          de hasta cuatro posesiones enlazadas con rebote, transición y saques, o
          un partido completo FIBA 2026 con banquillo, faltas, bonus, relato y
          acta.
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
          compareCoverage: compareCoverageAction,
          playTramo: playTramoAction,
          playGame: playGameAction,
        }}
        boundaryCases={boundaryCases}
        boundaryLabel={RULE_BOUNDARY_LABEL}
      />
    </main>
  );
}
