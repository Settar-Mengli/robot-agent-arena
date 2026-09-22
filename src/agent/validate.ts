import { extractJson } from "../inference";
import type { SkillCatalog, SkillId } from "../engine";
import type { ValidationResult } from "./types";

const REASON_CAP = 280;

export type ValidateAgentResponseOptions = {
  /** When true, fall back to extracting an equipped skillId from free text. */
  allowFreeText?: boolean;
};

export function validateAgentResponse(
  text: string,
  equippedSkillIds: readonly SkillId[],
  cpuEnergy: number,
  catalog: SkillCatalog,
  options: ValidateAgentResponseOptions = {}
): ValidationResult {
  const jsonResult = validateJsonAgentResponse(
    text,
    equippedSkillIds,
    cpuEnergy,
    catalog
  );
  if (jsonResult.ok) {
    return jsonResult;
  }
  if (options.allowFreeText !== true) {
    return jsonResult;
  }
  return validateFreeTextAgentResponse(
    text,
    equippedSkillIds,
    cpuEnergy,
    catalog
  );
}

function validateJsonAgentResponse(
  text: string,
  equippedSkillIds: readonly SkillId[],
  cpuEnergy: number,
  catalog: SkillCatalog
): ValidationResult {
  const parsed = extractJson<unknown>(text);
  if (parsed === null) {
    return { ok: false, code: "no_json", detail: "no JSON object found in model text" };
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, code: "not_object", detail: "parsed JSON was not an object" };
  }

  const record = parsed as Record<string, unknown>;
  if (!("skillId" in record)) {
    return { ok: false, code: "missing_skill_id", detail: "skillId field is missing" };
  }

  if (typeof record.skillId !== "string") {
    return { ok: false, code: "skill_id_not_string", detail: "skillId must be a string" };
  }

  return finalizeSkillId(
    record.skillId,
    typeof record.reason === "string" ? record.reason : undefined,
    equippedSkillIds,
    cpuEnergy,
    catalog
  );
}

/**
 * Prefer an equipped skillId token that appears as a whole word in the text.
 * Among matches, prefer the longest id (avoids prefix collisions).
 */
export function validateFreeTextAgentResponse(
  text: string,
  equippedSkillIds: readonly SkillId[],
  cpuEnergy: number,
  catalog: SkillCatalog
): ValidationResult {
  const matches: SkillId[] = [];
  for (const skillId of equippedSkillIds) {
    const re = new RegExp(`\\b${escapeRegExp(skillId)}\\b`);
    if (re.test(text)) {
      matches.push(skillId);
    }
  }
  if (matches.length === 0) {
    return {
      ok: false,
      code: "no_json",
      detail: "no equipped skillId found in free-text response"
    };
  }
  matches.sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  return finalizeSkillId(matches[0]!, undefined, equippedSkillIds, cpuEnergy, catalog);
}

function finalizeSkillId(
  rawSkillId: string,
  reason: string | undefined,
  equippedSkillIds: readonly SkillId[],
  cpuEnergy: number,
  catalog: SkillCatalog
): ValidationResult {
  const skillId = rawSkillId.trim();
  const definition = catalog.skills.find((skill) => skill.skillId === skillId);
  if (definition === undefined) {
    return { ok: false, code: "unknown_skill", detail: `skillId not in catalog: ${skillId}` };
  }

  if (!equippedSkillIds.includes(skillId)) {
    return { ok: false, code: "not_equipped", detail: `skillId not equipped: ${skillId}` };
  }

  let cappedReason: string | undefined;
  if (typeof reason === "string") {
    cappedReason =
      reason.length <= REASON_CAP ? reason : reason.slice(0, REASON_CAP);
  }

  return {
    ok: true,
    skillId,
    reason: cappedReason,
    affordable: definition.energyCost <= cpuEnergy
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
