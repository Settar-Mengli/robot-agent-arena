import type { AgentModule, SkillCatalog, SkillDefinition } from "./types";

const VALID_AGENT_MODULES = [
  "coreIdentity",
  "memory",
  "sigilSecurity",
  "rules",
  "strategy"
] as const satisfies readonly AgentModule[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
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

  if (
    typeof skill.module !== "string" ||
    !VALID_AGENT_MODULES.includes(skill.module as AgentModule)
  ) {
    throw new TypeError(
      `${label}.module must be one of: ${VALID_AGENT_MODULES.join(", ")}.`
    );
  }
}

export function validateSkillCatalogInput(catalog: unknown): asserts catalog is SkillCatalog {
  if (!isRecord(catalog)) {
    throw new TypeError("skillCatalog must be an object.");
  }

  if (!Array.isArray(catalog.skills)) {
    throw new TypeError("skillCatalog.skills must be an array.");
  }

  for (let index = 0; index < catalog.skills.length; index += 1) {
    validateSkillDefinitionInput(catalog.skills[index], `skillCatalog.skills[${index}]`);
  }
}
