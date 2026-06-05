import { DEFAULT_MAX_TURNS, MAX_TURNS } from "./constants";
import type { AgentConfig, BattleSession, Seed, SkillId } from "./types";

const REQUIRED_AGENT_MODULE_KEYS = [
  "coreIdentity",
  "memory",
  "sigilSecurity",
  "rules",
  "strategy"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
}

function assertPositiveInteger(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${fieldName} must be a positive integer.`);
  }
}

function validateAgentConfigShape(agent: unknown, label: string): asserts agent is AgentConfig {
  if (!isRecord(agent)) {
    throw new TypeError(`${label} must be an object.`);
  }

  assertNonEmptyString(agent.agentId, `${label}.agentId`);
  assertNonEmptyString(agent.displayName, `${label}.displayName`);

  const modules = agent.modules;
  if (!isRecord(modules)) {
    throw new TypeError(`${label}.modules must be an object.`);
  }

  for (const moduleKey of REQUIRED_AGENT_MODULE_KEYS) {
    assertNonEmptyString(modules[moduleKey], `${label}.modules.${moduleKey}`);
  }

  if (!Array.isArray(agent.skillIds)) {
    throw new TypeError(`${label}.skillIds must be an array.`);
  }

  for (let index = 0; index < agent.skillIds.length; index += 1) {
    assertNonEmptyString(agent.skillIds[index], `${label}.skillIds[${index}]`);
  }
}

function validateSkillIdInput(skillId: unknown): asserts skillId is SkillId {
  assertNonEmptyString(skillId, "skillId");
}

function validateBattleSessionInput(session: unknown): asserts session is BattleSession {
  if (!isRecord(session)) {
    throw new TypeError("battleSession must be an object.");
  }

  assertNonEmptyString(session.sessionId, "battleSession.sessionId");

  if (
    typeof session.seed !== "string" &&
    (typeof session.seed !== "number" || !Number.isFinite(session.seed))
  ) {
    throw new TypeError("battleSession.seed must be a string or a finite number.");
  }

  assertPositiveInteger(session.turn, "battleSession.turn");
  assertPositiveInteger(session.maxTurns, "battleSession.maxTurns");

  if (session.maxTurns > MAX_TURNS) {
    throw new RangeError(`battleSession.maxTurns cannot exceed ${MAX_TURNS}.`);
  }

  if (session.turn > session.maxTurns) {
    throw new RangeError("battleSession.turn cannot exceed battleSession.maxTurns.");
  }

  if (session.status !== "awaiting-player-action" && session.status !== "completed") {
    throw new TypeError(
      "battleSession.status must be either 'awaiting-player-action' or 'completed'."
    );
  }

  validateAgentConfigShape(session.player, "battleSession.player");
  validateAgentConfigShape(session.cpu, "battleSession.cpu");

  if (session.lastPlayerAction !== undefined) {
    if (!isRecord(session.lastPlayerAction)) {
      throw new TypeError("battleSession.lastPlayerAction must be an object when provided.");
    }

    if (session.lastPlayerAction.type !== "use-skill") {
      throw new TypeError("battleSession.lastPlayerAction.type must be 'use-skill'.");
    }

    validateSkillIdInput(session.lastPlayerAction.skillId);
  }
}

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
  validateAgentConfigShape(configA, "configA");
  validateAgentConfigShape(configB, "configB");

  const session: BattleSession = {
    sessionId: createSessionId(configA, configB, seed),
    seed,
    turn: 1,
    maxTurns: toMaxTurns(maxTurns),
    status: "awaiting-player-action",
    player: configA,
    cpu: configB
  };

  validateBattleSessionInput(session);

  return session;
}

export function submitPlayerAction(session: BattleSession, skillId: SkillId): BattleSession {
  validateBattleSessionInput(session);
  validateSkillIdInput(skillId);

  const nextSession: BattleSession = {
    ...session,
    lastPlayerAction: {
      type: "use-skill",
      skillId
    }
  };

  validateBattleSessionInput(nextSession);

  return nextSession;
}

export function isBattleOver(session: BattleSession): boolean {
  validateBattleSessionInput(session);

  return session.status === "completed" || session.turn >= session.maxTurns;
}

export function finalizeBattle(session: BattleSession): BattleSession {
  validateBattleSessionInput(session);

  if (session.status === "completed") {
    return session;
  }

  const finalizedSession: BattleSession = {
    ...session,
    status: "completed"
  };

  validateBattleSessionInput(finalizedSession);

  return finalizedSession;
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
