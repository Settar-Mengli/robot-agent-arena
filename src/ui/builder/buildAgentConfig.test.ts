import { describe, expect, it } from "vitest";
import { MVP_SKILL_SLOT_LIMIT } from "../../engine";
import { buildAgentConfig } from "./buildAgentConfig";

const validModules = {
  coreIdentity: "Steady Vanguard",
  memory: "Pattern Recall",
  sigilSecurity: "Aegis Layer",
  rules: "Never Skip Verification",
  strategy: "Measured Pressure"
};

describe("buildAgentConfig", () => {
  it("accepts a catalog-valid draft", () => {
    const result = buildAgentConfig({
      agentId: "agent-1",
      displayName: "UNIT-A",
      modules: validModules,
      skillIds: ["skill-override-pulse", "skill-logic-storm"]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.displayName).toBe("UNIT-A");
    }
  });

  it("rejects an unknown skill id via engine validation", () => {
    const result = buildAgentConfig({
      agentId: "agent-1",
      displayName: "UNIT-A",
      modules: validModules,
      skillIds: ["skill-not-in-catalog"]
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/known skill ID/i);
    }
  });

  it("rejects skill counts above MVP_SKILL_SLOT_LIMIT via engine validation", () => {
    const result = buildAgentConfig({
      agentId: "agent-1",
      displayName: "UNIT-A",
      modules: validModules,
      skillIds: [
        "skill-override-pulse",
        "skill-logic-storm",
        "skill-core-identity"
      ]
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain(String(MVP_SKILL_SLOT_LIMIT));
    }
  });

  it("rejects a non-object draft via engine validation", () => {
    const result = buildAgentConfig("not-an-object" as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/must be an object/i);
    }
  });
});
