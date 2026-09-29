"use server";

import { PrismaLabTeamRepository } from "@match/infrastructure/db/prisma-lab-team-repository";
import { loadLabRoster } from "@match/application/use-cases/load-lab-roster";
import { saveLabPlayer } from "@match/application/use-cases/save-lab-player";
import { duplicateLabPlayer } from "@match/application/use-cases/duplicate-lab-player";
import { runLabScenario } from "@match/application/use-cases/run-lab-scenario";
import {
  compareLabScenarioBatch,
  compareLabCoverageBatch,
} from "@match/application/use-cases/compare-lab-scenario-batch";
import { playLabTramo } from "@match/application/use-cases/play-lab-tramo";
import { playLabGame } from "@match/application/use-cases/play-lab-game";
import type { BuildGameTeamArgs } from "@match/domain/game/game-model";
import { LAB_0_2_PARAMETERS_VERSION } from "@match/domain/lab/lab-0-2-parameters";
import type { BuildTramoTeamArgs } from "@match/domain/sequence/tramo-model";
import type { PlayerProfile } from "@match/domain/players/player-profile";
import type { ScenarioId } from "@match/domain/lab/scenario";
import type { DefensiveCoverage, MatchInput } from "@match/domain/lab/match-input";

const repository = new PrismaLabTeamRepository();

export async function loadRosterAction() {
  return loadLabRoster(repository);
}

export async function savePlayerAction(teamId: string, player: PlayerProfile) {
  return saveLabPlayer(repository, teamId, player);
}

export async function duplicatePlayerAction(
  teamId: string,
  source: PlayerProfile,
  newId: string,
  newName: string,
) {
  const duplicated = duplicateLabPlayer(source, newId, newName);
  return saveLabPlayer(repository, teamId, duplicated);
}

export async function runScenarioAction(
  scenarioId: ScenarioId,
  coverage: DefensiveCoverage,
  seed: number,
  offensePlayers: readonly PlayerProfile[],
  defensePlayers: readonly PlayerProfile[],
) {
  const input: MatchInput = {
    scenarioId,
    coverage,
    seed,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: LAB_0_2_PARAMETERS_VERSION,
    offensePlayers,
    defensePlayers,
  };
  return runLabScenario(input);
}

export async function compareScenarioAction(
  seed: number,
  sampleSize: number,
  offensePlayers: readonly PlayerProfile[],
  defensePlayers: readonly PlayerProfile[],
) {
  return compareLabScenarioBatch(
    {
      seed,
      rulesetVersion: "FIBA-2026",
      labParametersVersion: LAB_0_2_PARAMETERS_VERSION,
      offensePlayers,
      defensePlayers,
    },
    sampleSize,
  );
}

/** ME-02: comparación por lotes drop/trampa, misma posesión y semillas. */
export async function compareCoverageAction(
  seed: number,
  sampleSize: number,
  offensePlayers: readonly PlayerProfile[],
  defensePlayers: readonly PlayerProfile[],
) {
  return compareLabCoverageBatch(
    {
      seed,
      rulesetVersion: "FIBA-2026",
      labParametersVersion: LAB_0_2_PARAMETERS_VERSION,
      offensePlayers,
      defensePlayers,
    },
    sampleSize,
  );
}

/**
 * ME-03: tramo de hasta cuatro posesiones enlazadas. Usa los perfiles que
 * muestra la interfaz (guardados o de referencia si PostgreSQL no está
 * disponible); no escribe nada en la base de datos.
 */
export async function playTramoAction(
  seed: number,
  coverage: DefensiveCoverage,
  offenseTeam: BuildTramoTeamArgs,
  defenseTeam: BuildTramoTeamArgs,
) {
  return playLabTramo({ seed, coverage, offenseTeam, defenseTeam });
}

/**
 * ME-04: partido completo de laboratorio. Usa una única foto de los perfiles
 * que muestra la interfaz (guardados o de referencia si PostgreSQL no está
 * disponible); no escribe nada en la base de datos ni guarda el partido.
 */
export async function playGameAction(seed: number, home: BuildGameTeamArgs, away: BuildGameTeamArgs) {
  return playLabGame({ seed, home, away });
}
