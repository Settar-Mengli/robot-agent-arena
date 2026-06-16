import { DEFAULT_MAX_TURNS, MAX_TURNS } from "./constants";
import { MVP_SKILL_CATALOG } from "./skills";
import type { AgentConfig, BattleSession, Seed, SkillId } from "./types";
import {
  validateAgentConfigInput,
  validateAgentSkillIdInput,
  validateBattleSessionInput,
} from "./validation";

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
  validateAgentConfigInput(configA, MVP_SKILL_CATALOG, "configA");
  validateAgentConfigInput(configB, MVP_SKILL_CATALOG, "configB");

  const session: BattleSession = {
    sessionId: createSessionId(configA, configB, seed),
    seed,
    turn: 1,
    maxTurns: toMaxTurns(maxTurns),
    status: "awaiting-player-action",
    player: configA,
    cpu: configB
  };

  validateBattleSessionInput(session, MVP_SKILL_CATALOG);

  return session;
}

export function submitPlayerAction(session: BattleSession, skillId: SkillId): BattleSession {
  validateBattleSessionInput(session, MVP_SKILL_CATALOG);
  validateAgentSkillIdInput(session.player, skillId);

  if (session.status === "completed") {
    throw new RangeError("completed battle sessions cannot accept player actions.");
  }

  if (session.lastPlayerAction !== undefined) {
    throw new RangeError("battleSession already has a player action for the current turn.");
  }

  const nextSession: BattleSession = {
    ...session,
    lastPlayerAction: {
      type: "use-skill",
      skillId
    }
  };

  validateBattleSessionInput(nextSession, MVP_SKILL_CATALOG);

  return nextSession;
}

export function isBattleOver(session: BattleSession): boolean {
  validateBattleSessionInput(session, MVP_SKILL_CATALOG);

  return session.status === "completed" || session.turn >= session.maxTurns;
}

export function finalizeBattle(session: BattleSession): BattleSession {
  validateBattleSessionInput(session, MVP_SKILL_CATALOG);

  if (session.status === "completed") {
    return session;
  }

  const finalizedSession: BattleSession = {
    ...session,
    status: "completed"
  };

  validateBattleSessionInput(finalizedSession, MVP_SKILL_CATALOG);

  return finalizedSession;
}

export function advanceBattleTurn(session: BattleSession): BattleSession {
  validateBattleSessionInput(session, MVP_SKILL_CATALOG);

  if (session.status === "completed") {
    throw new RangeError("completed battle sessions cannot advance turns.");
  }

  if (session.turn >= session.maxTurns) {
    throw new RangeError("battleSession.turn cannot advance beyond battleSession.maxTurns.");
  }

  const nextSession: BattleSession = {
    ...session,
    turn: session.turn + 1,
    lastPlayerAction: undefined
  };

  validateBattleSessionInput(nextSession, MVP_SKILL_CATALOG);

  return nextSession;
}
