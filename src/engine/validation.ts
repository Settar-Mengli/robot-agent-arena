import {
  AGENT_MODULES,
  MAX_TURNS,
  MVP_SKILL_COUNT,
  MVP_SKILL_SLOT_LIMIT
} from "./constants";
import type {
  AgentConfig,
  AgentModule,
  BattleSession,
  SkillCatalog,
  SkillDefinition,
  SkillId
} from "./types";

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

function isAgentModule(value: unknown): value is AgentModule {
  return typeof value === "string" && AGENT_MODULES.includes(value as AgentModule);
}

export function validateSkillDefinitionInput(
  skill: unknown,
  label = "skillDefinition"
): asserts skill is SkillDefinition {
  if (!isRecord(skill)) {
    throw new TypeError(`${label} must be an object.`);
  }

  assertNonEmptyString(skill.skillId, `${label}.skillId`);
  assertNonEmptyString(skill.displayName, `${label}.displayName`);
  assertNonEmptyString(skill.summary, `${label}.summary`);

  if (!isAgentModule(skill.module)) {
    throw new TypeError(`${label}.module must be one of: ${AGENT_MODULES.join(", ")}.`);
  }
}

export function validateSkillCatalogInput(
  catalog: unknown,
  label = "skillCatalog"
): asserts catalog is SkillCatalog {
  if (!isRecord(catalog)) {
    throw new TypeError(`${label} must be an object.`);
  }

  if (!Array.isArray(catalog.skills)) {
    throw new TypeError(`${label}.skills must be an array.`);
  }

  if (catalog.skills.length !== MVP_SKILL_COUNT) {
    throw new RangeError(`${label}.skills must contain exactly ${MVP_SKILL_COUNT} skills.`);
  }

  const seenSkillIds = new Set<SkillId>();

  for (let index = 0; index < catalog.skills.length; index += 1) {
    const skillLabel = `${label}.skills[${index}]`;
    validateSkillDefinitionInput(catalog.skills[index], skillLabel);

    const skillId = catalog.skills[index].skillId;
    if (seenSkillIds.has(skillId)) {
      throw new TypeError(`${skillLabel}.skillId must be unique.`);
    }

    seenSkillIds.add(skillId);
  }
}

export function validateSkillIdInput(
  skillId: unknown,
  label = "skillId"
): asserts skillId is SkillId {
  assertNonEmptyString(skillId, label);
}

export function validateAgentSkillIdInput(
  agent: AgentConfig,
  skillId: unknown,
  label = "skillId"
): asserts skillId is SkillId {
  validateSkillIdInput(skillId, label);

  if (!agent.skillIds.includes(skillId)) {
    throw new TypeError(`${label} must reference a skill ID loaded by the agent.`);
  }
}

export function validateAgentConfigInput(
  agent: unknown,
  catalog: SkillCatalog,
  label = "agentConfig"
): asserts agent is AgentConfig {
  validateSkillCatalogInput(catalog);

  if (!isRecord(agent)) {
    throw new TypeError(`${label} must be an object.`);
  }

  assertNonEmptyString(agent.agentId, `${label}.agentId`);
  assertNonEmptyString(agent.displayName, `${label}.displayName`);

  const modules = agent.modules;
  if (!isRecord(modules)) {
    throw new TypeError(`${label}.modules must be an object.`);
  }

  for (const moduleKey of AGENT_MODULES) {
    assertNonEmptyString(modules[moduleKey], `${label}.modules.${moduleKey}`);
  }

  if (!Array.isArray(agent.skillIds)) {
    throw new TypeError(`${label}.skillIds must be an array.`);
  }

  if (agent.skillIds.length > MVP_SKILL_SLOT_LIMIT) {
    throw new RangeError(
      `${label}.skillIds cannot contain more than ${MVP_SKILL_SLOT_LIMIT} skills.`
    );
  }

  const knownSkillIds = new Set(catalog.skills.map((skill) => skill.skillId));

  for (let index = 0; index < agent.skillIds.length; index += 1) {
    const skillLabel = `${label}.skillIds[${index}]`;
    validateSkillIdInput(agent.skillIds[index], skillLabel);

    if (!knownSkillIds.has(agent.skillIds[index])) {
      throw new TypeError(`${skillLabel} must reference a known skill ID.`);
    }
  }
}

export function validateBattleSessionInput(
  session: unknown,
  catalog: SkillCatalog
): asserts session is BattleSession {
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

  validateAgentConfigInput(session.player, catalog, "battleSession.player");
  validateAgentConfigInput(session.cpu, catalog, "battleSession.cpu");

  if (session.lastPlayerAction !== undefined) {
    if (!isRecord(session.lastPlayerAction)) {
      throw new TypeError("battleSession.lastPlayerAction must be an object when provided.");
    }

    if (session.lastPlayerAction.type !== "use-skill") {
      throw new TypeError("battleSession.lastPlayerAction.type must be 'use-skill'.");
    }

    validateAgentSkillIdInput(
      session.player,
      session.lastPlayerAction.skillId,
      "battleSession.lastPlayerAction.skillId"
    );
  }
}
