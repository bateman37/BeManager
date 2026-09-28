"use server";

import { PrismaLabTeamRepository } from "@match/infrastructure/db/prisma-lab-team-repository";
import { loadLabRoster } from "@match/application/use-cases/load-lab-roster";
import { saveLabPlayer } from "@match/application/use-cases/save-lab-player";
import { duplicateLabPlayer } from "@match/application/use-cases/duplicate-lab-player";
import { runLabScenario } from "@match/application/use-cases/run-lab-scenario";
import { compareLabScenarioBatch } from "@match/application/use-cases/compare-lab-scenario-batch";
import { LAB_PARAMETERS_VERSION } from "@match/domain/lab/lab-0-1-parameters";
import type { PlayerProfile } from "@match/domain/players/player-profile";
import type { ScenarioId } from "@match/domain/lab/scenario";
import type { MatchInput } from "@match/domain/lab/match-input";

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
  seed: number,
  offensePlayers: readonly PlayerProfile[],
  defensePlayers: readonly PlayerProfile[],
) {
  const input: MatchInput = {
    scenarioId,
    seed,
    rulesetVersion: "FIBA-2026",
    labParametersVersion: LAB_PARAMETERS_VERSION,
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
      labParametersVersion: LAB_PARAMETERS_VERSION,
      offensePlayers,
      defensePlayers,
    },
    sampleSize,
  );
}
