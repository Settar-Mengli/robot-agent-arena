import { describe, expect, it } from "vitest";
import {
  MVP_SKILL_CATALOG,
  MVP_SKILL_COUNT,
  MVP_SKILL_SLOT_LIMIT,
  initBattle,
  validateAgentConfigInput,
  validateSkillCatalogInput,
  validateSkillDefinitionInput
} from "../engine";
import type { AgentConfig, SkillCatalog, SkillDefinition } from "../engine";

const validAgentConfig: AgentConfig = {
  agentId: "agent-player-1",
  displayName: "PLAYER-UNIT",
  modules: {
    coreIdentity: "Steady Vanguard",
    memory: "Pattern Recall",
    sigilSecurity: "Aegis Layer",
    rules: "Never Skip Verification",
    strategy: "Measured Pressure"
  },
  skillIds: ["skill-core-identity", "skill-null-pulse"]
};

const validCpuConfig: AgentConfig = {
  agentId: "agent-cpu-1",
  displayName: "SENTINEL-X",
  modules: {
    coreIdentity: "Counter Logic",
    memory: "Adaptive Recall",
    sigilSecurity: "Echo Shield",
    rules: "Fail Closed",
    strategy: "Reactive Pressure"
  },
  skillIds: ["skill-sigil-rule", "skill-logic-storm"]
};

function catalogWithSkillPatch(
  indexToPatch: number,
  patch: Partial<SkillDefinition>
): SkillCatalog {
  return {
    skills: MVP_SKILL_CATALOG.skills.map((skill, index) =>
      index === indexToPatch ? { ...skill, ...patch } : { ...skill }
    )
  };
}

describe("MVP skill catalog", () => {
  it("contains exactly 8 skills", () => {
    expect(MVP_SKILL_CATALOG.skills).toHaveLength(MVP_SKILL_COUNT);
  });

  it("contains unique skill IDs", () => {
    const skillIds = MVP_SKILL_CATALOG.skills.map((skill) => skill.skillId);

    expect(new Set(skillIds).size).toBe(skillIds.length);
  });

  it("accepts the canonical catalog", () => {
    expect(() => validateSkillCatalogInput(MVP_SKILL_CATALOG)).not.toThrow();
  });

  it("rejects duplicate skill IDs", () => {
    const duplicateCatalog = catalogWithSkillPatch(1, {
      skillId: MVP_SKILL_CATALOG.skills[0].skillId
    });

    expect(() => validateSkillCatalogInput(duplicateCatalog)).toThrow(TypeError);
  });

  it("rejects invalid skill definitions", () => {
    const invalidCatalog = catalogWithSkillPatch(0, {
      displayName: ""
    });

    expect(() => validateSkillCatalogInput(invalidCatalog)).toThrow(TypeError);
  });

  it("rejects unsupported module values", () => {
    const invalidSkill = {
      ...MVP_SKILL_CATALOG.skills[0],
      module: "invalid-module"
    };

    expect(() => validateSkillDefinitionInput(invalidSkill)).toThrow(TypeError);
  });

  it("rejects invalid combat effect values", () => {
    const invalidCatalog = catalogWithSkillPatch(0, {
      effect: {
        category: "defense",
        defenseAmount: 0
      }
    });

    expect(() => validateSkillCatalogInput(invalidCatalog)).toThrow(RangeError);
  });

  it("rejects negative energy costs", () => {
    const invalidCatalog = catalogWithSkillPatch(0, {
      energyCost: -1
    });

    expect(() => validateSkillCatalogInput(invalidCatalog)).toThrow(RangeError);
  });
});

describe("agent config validation", () => {
  it("accepts a valid AgentConfig with the MVP skill-slot limit", () => {
    expect(validAgentConfig.skillIds).toHaveLength(MVP_SKILL_SLOT_LIMIT);
    expect(() => validateAgentConfigInput(validAgentConfig, MVP_SKILL_CATALOG)).not.toThrow();
  });

  it("rejects unknown AgentConfig skill IDs", () => {
    const invalidAgentConfig: AgentConfig = {
      ...validAgentConfig,
      skillIds: ["skill-core-identity", "skill-unknown"]
    };

    expect(() => validateAgentConfigInput(invalidAgentConfig, MVP_SKILL_CATALOG)).toThrow(
      TypeError
    );
  });

  it("rejects excessive skill loadouts", () => {
    const invalidAgentConfig: AgentConfig = {
      ...validAgentConfig,
      skillIds: ["skill-core-identity", "skill-null-pulse", "skill-logic-storm"]
    };

    expect(() => validateAgentConfigInput(invalidAgentConfig, MVP_SKILL_CATALOG)).toThrow(
      RangeError
    );
  });

  it("makes initBattle reject invalid configs through catalog-aware validation", () => {
    const invalidAgentConfig: AgentConfig = {
      ...validAgentConfig,
      skillIds: ["skill-core-identity", "skill-unknown"]
    };

    expect(() => initBattle(invalidAgentConfig, validCpuConfig, "seed-invalid-config")).toThrow(
      TypeError
    );
  });
});
