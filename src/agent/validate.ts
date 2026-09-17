import { extractJson } from "../inference";
import type { SkillCatalog, SkillId } from "../engine";
import type { ValidationResult } from "./types";

const REASON_CAP = 280;

export function validateAgentResponse(
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

  const skillId = record.skillId.trim();
  const definition = catalog.skills.find((skill) => skill.skillId === skillId);
  if (definition === undefined) {
    return { ok: false, code: "unknown_skill", detail: `skillId not in catalog: ${skillId}` };
  }

  if (!equippedSkillIds.includes(skillId)) {
    return { ok: false, code: "not_equipped", detail: `skillId not equipped: ${skillId}` };
  }

  let reason: string | undefined;
  if (typeof record.reason === "string") {
    reason =
      record.reason.length <= REASON_CAP
        ? record.reason
        : record.reason.slice(0, REASON_CAP);
  }

  return {
    ok: true,
    skillId,
    reason,
    affordable: definition.energyCost <= cpuEnergy
  };
}
