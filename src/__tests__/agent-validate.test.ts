import { describe, expect, it } from "vitest";
import { MVP_SKILL_CATALOG } from "../engine";
import { validateAgentResponse } from "../agent";

const equipped = ["skill-null-pulse", "skill-logic-storm"] as const;

describe("validateAgentResponse", () => {
  it("accepts clean JSON with an equipped skill", () => {
    const result = validateAgentResponse(
      '{"skillId":"skill-null-pulse","reason":"block"}',
      equipped,
      6,
      MVP_SKILL_CATALOG
    );
    expect(result).toEqual({
      ok: true,
      skillId: "skill-null-pulse",
      reason: "block",
      affordable: true
    });
  });

  it("extracts fenced/wrapped JSON", () => {
    const result = validateAgentResponse(
      'Sure.\n```json\n{"skillId":"skill-logic-storm","reason":"hit"}\n```\n',
      equipped,
      6,
      MVP_SKILL_CATALOG
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.skillId).toBe("skill-logic-storm");
    }
  });

  it("trims whitespace on skillId", () => {
    const result = validateAgentResponse(
      '{"skillId":"  skill-null-pulse  "}',
      equipped,
      6,
      MVP_SKILL_CATALOG
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.skillId).toBe("skill-null-pulse");
    }
  });

  it("marks equipped-but-unaffordable as ok with affordable false", () => {
    const result = validateAgentResponse(
      '{"skillId":"skill-logic-storm"}',
      equipped,
      0,
      MVP_SKILL_CATALOG
    );
    expect(result).toEqual({
      ok: true,
      skillId: "skill-logic-storm",
      affordable: false
    });
  });

  it("returns no_json for garbage", () => {
    expect(validateAgentResponse("not json", equipped, 6, MVP_SKILL_CATALOG)).toMatchObject({
      ok: false,
      code: "no_json"
    });
  });

  it("returns not_object for JSON arrays", () => {
    expect(validateAgentResponse("[1]", equipped, 6, MVP_SKILL_CATALOG)).toMatchObject({
      ok: false,
      code: "not_object"
    });
  });

  it("returns missing_skill_id when skillId is absent", () => {
    expect(validateAgentResponse('{"reason":"x"}', equipped, 6, MVP_SKILL_CATALOG)).toMatchObject({
      ok: false,
      code: "missing_skill_id"
    });
  });

  it("returns skill_id_not_string when skillId is not a string", () => {
    expect(validateAgentResponse('{"skillId":1}', equipped, 6, MVP_SKILL_CATALOG)).toMatchObject({
      ok: false,
      code: "skill_id_not_string"
    });
  });

  it("returns unknown_skill for catalog misses", () => {
    expect(
      validateAgentResponse('{"skillId":"skill-nope"}', equipped, 6, MVP_SKILL_CATALOG)
    ).toMatchObject({ ok: false, code: "unknown_skill" });
  });

  it("returns not_equipped for unequipped catalog skills", () => {
    expect(
      validateAgentResponse('{"skillId":"skill-sigil-rule"}', equipped, 6, MVP_SKILL_CATALOG)
    ).toMatchObject({ ok: false, code: "not_equipped" });
  });

  it("truncates reason to 280 characters", () => {
    const reason = "r".repeat(400);
    const result = validateAgentResponse(
      JSON.stringify({ skillId: "skill-null-pulse", reason }),
      equipped,
      6,
      MVP_SKILL_CATALOG
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reason?.length).toBe(280);
    }
  });
});
