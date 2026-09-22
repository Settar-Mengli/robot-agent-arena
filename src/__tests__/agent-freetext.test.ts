import { describe, expect, it } from "vitest";
import { MVP_SKILL_CATALOG } from "../engine";
import {
  buildAgentMessages,
  PROMPT_VERSIONS,
  resolvePromptVersion
} from "../agent/prompt";
import { validateAgentResponse } from "../agent/validate";
import { fixtureKey } from "../eval/transport";
import { variantPromptVersion, variantToPlayOptions } from "../eval/policies";

const equipped = ["skill-logic-storm", "skill-override-pulse"] as const;

describe("freetext variant (M5 code)", () => {
  it("maps variant to json:false and agent-v5-freetext", () => {
    expect(variantToPlayOptions("freetext")).toEqual({
      grounding: "off",
      memory: "off",
      json: false,
      responseFormat: "freetext"
    });
    expect(variantPromptVersion("freetext")).toBe(PROMPT_VERSIONS.freeText);
  });

  it("free-text prompt version differs from agent-v1 system bytes", () => {
    const base = {
      turn: 1,
      maxTurns: 20,
      observation: {
        cpu: {
          side: "cpu" as const,
          agentId: "c",
          displayName: "C",
          health: 10,
          maxHealth: 10,
          energy: 5,
          maxEnergy: 10,
          defense: 0
        },
        player: {
          side: "player" as const,
          agentId: "p",
          displayName: "P",
          health: 10,
          maxHealth: 10,
          energy: 5,
          maxEnergy: 10,
          defense: 0
        }
      },
      cpuConfig: {
        agentId: "c",
        displayName: "C",
        modules: {
          coreIdentity: "a",
          memory: "b",
          sigilSecurity: "c",
          rules: "d",
          strategy: "e"
        },
        skillIds: [...equipped]
      }
    };
    const jsonMsgs = buildAgentMessages({ ...base, responseFormat: "json" });
    const freeMsgs = buildAgentMessages({ ...base, responseFormat: "freetext" });
    expect(resolvePromptVersion({ responseFormat: "freetext" })).toBe(
      PROMPT_VERSIONS.freeText
    );
    expect(jsonMsgs[0]!.content).not.toEqual(freeMsgs[0]!.content);
    expect(freeMsgs[0]!.content).toContain("plain text");
    expect(jsonMsgs[0]!.content).toContain("JSON object");
  });

  it("parses free-text skillId and rejects garbage", () => {
    const ok = validateAgentResponse(
      "I choose skill-logic-storm because pressure.",
      equipped,
      10,
      MVP_SKILL_CATALOG,
      { allowFreeText: true }
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.skillId).toBe("skill-logic-storm");
    }
    const bad = validateAgentResponse(
      "no skill here",
      equipped,
      10,
      MVP_SKILL_CATALOG,
      { allowFreeText: true }
    );
    expect(bad.ok).toBe(false);
  });

  it("fixture keys diverge when response_format is omitted", () => {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const messages = [{ role: "user", content: "hi" }];
    const withJson = fixtureKey(url, {
      model: "openai/gpt-oss-20b",
      messages,
      response_format: { type: "json_object" },
      temperature: 0
    });
    const withoutJson = fixtureKey(url, {
      model: "openai/gpt-oss-20b",
      messages,
      temperature: 0
    });
    expect(withJson).not.toBe(withoutJson);
  });
});
