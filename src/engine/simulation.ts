import { createSeededRng } from "./rng";
import {
  finalizeBattle,
  initBattle,
  isBattleOver,
  submitPlayerAction
} from "./session";
import type { AgentConfig, BattleSession, Seed, SeededRng, SkillId } from "./types";

function selectSimulationSkillId(agent: AgentConfig, rng: SeededRng): SkillId {
  if (agent.skillIds.length === 0) {
    throw new RangeError("agent.skillIds must contain at least one skill for simulation.");
  }

  return agent.skillIds[rng.nextInt(agent.skillIds.length)];
}

function advanceSimulationTurn(session: BattleSession): BattleSession {
  if (session.turn >= session.maxTurns) {
    return session;
  }

  return {
    ...session,
    turn: session.turn + 1
  };
}

export function resolveBattle(
  configA: AgentConfig,
  configB: AgentConfig,
  seed: Seed,
  maxTurns?: number
): BattleSession {
  let session = initBattle(configA, configB, seed, maxTurns);
  const rng = createSeededRng(seed);

  while (!isBattleOver(session)) {
    const playerSkillId = selectSimulationSkillId(session.player, rng);
    session = submitPlayerAction(session, playerSkillId);
    session = advanceSimulationTurn(session);
  }

  return finalizeBattle(session);
}
