import { DEFAULT_MAX_TURNS, MAX_TURNS } from "./constants";
import type { AgentConfig, BattleSession, Seed, SkillId } from "./types";

function toMaxTurns(maxTurns: number | undefined): number {
  if (maxTurns === undefined) {
    return DEFAULT_MAX_TURNS;
  }

  if (!Number.isInteger(maxTurns) || maxTurns <= 0) {
    throw new RangeError("maxTurns must be a positive integer.");
  }

  return Math.min(maxTurns, MAX_TURNS);
}

function createSessionId(configA: AgentConfig, configB: AgentConfig, seed: Seed): string {
  return `session:${configA.agentId}:${configB.agentId}:${String(seed)}`;
}

export function initBattle(
  configA: AgentConfig,
  configB: AgentConfig,
  seed: Seed,
  maxTurns?: number
): BattleSession {
  return {
    sessionId: createSessionId(configA, configB, seed),
    seed,
    turn: 1,
    maxTurns: toMaxTurns(maxTurns),
    status: "awaiting-player-action",
    player: configA,
    cpu: configB
  };
}

export function submitPlayerAction(session: BattleSession, skillId: SkillId): BattleSession {
  return {
    ...session,
    lastPlayerAction: {
      type: "use-skill",
      skillId
    }
  };
}

export function isBattleOver(session: BattleSession): boolean {
  return session.status === "completed" || session.turn >= session.maxTurns;
}

export function finalizeBattle(session: BattleSession): BattleSession {
  if (session.status === "completed") {
    return session;
  }

  return {
    ...session,
    status: "completed"
  };
}

export function resolveBattle(
  configA: AgentConfig,
  configB: AgentConfig,
  seed: Seed,
  maxTurns?: number
): BattleSession {
  const session = initBattle(configA, configB, seed, maxTurns);

  return finalizeBattle({
    ...session,
    turn: Math.max(session.turn, session.maxTurns)
  });
}
