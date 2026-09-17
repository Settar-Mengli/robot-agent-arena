import { describe, expect, it } from "vitest";
import { CPU_OPPONENTS, FRACTURE, SENTINEL_X } from "../data/opponents";
import {
  CPU_OPPONENT_COUNT,
  MVP_SKILL_CATALOG,
  MVP_SKILL_SLOT_LIMIT,
  startBattle,
  stepBattle,
  validateAgentConfigInput
} from "../engine";
import type { AgentConfig } from "../engine";

const playerFixture: AgentConfig = {
  agentId: "agent-player-1",
  displayName: "PLAYER-UNIT",
  modules: {
    coreIdentity: "Steady Vanguard",
    memory: "Pattern Recall",
    sigilSecurity: "Aegis Layer",
    rules: "Never Skip Verification",
    strategy: "Measured Pressure"
  },
  skillIds: ["skill-override-pulse", "skill-logic-storm"]
};

const knownSkillIds = new Set<string>(
  MVP_SKILL_CATALOG.skills.map((skill) => skill.skillId)
);

describe("CPU opponent catalog", () => {
  it("includes exactly CPU_OPPONENT_COUNT unique opponents", () => {
    expect(CPU_OPPONENTS).toHaveLength(CPU_OPPONENT_COUNT);
    expect(CPU_OPPONENTS).toEqual([FRACTURE, SENTINEL_X]);

    const ids = CPU_OPPONENTS.map((opponent) => opponent.agentId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(CPU_OPPONENTS)(
    "passes validateAgentConfigInput for $displayName",
    (opponent) => {
      expect(() => validateAgentConfigInput(opponent, MVP_SKILL_CATALOG)).not.toThrow();
    }
  );

  it("uses real catalog skills within the slot limit", () => {
    for (const opponent of CPU_OPPONENTS) {
      expect(opponent.skillIds.length).toBeGreaterThanOrEqual(1);
      expect(opponent.skillIds.length).toBeLessThanOrEqual(MVP_SKILL_SLOT_LIMIT);

      for (const skillId of opponent.skillIds) {
        expect(knownSkillIds.has(skillId)).toBe(true);
      }
    }
  });

  it("can start and step a battle against FRACTURE", () => {
    const runtime = startBattle(playerFixture, FRACTURE, "opponent-smoke-fracture", 5);
    const stepped = stepBattle(runtime, "skill-logic-storm");

    expect(stepped.turnRecord.turn).toBe(1);
    expect(stepped.runtime.session.cpu.displayName).toBe("FRACTURE");
    expect(stepped.runtime.turns).toHaveLength(1);
  });

  it("can start and step a battle against SENTINEL-X", () => {
    const runtime = startBattle(playerFixture, SENTINEL_X, "opponent-smoke-sentinel", 5);
    const stepped = stepBattle(runtime, "skill-override-pulse");

    expect(stepped.turnRecord.turn).toBe(1);
    expect(stepped.runtime.session.cpu.displayName).toBe("SENTINEL-X");
    expect(stepped.runtime.turns).toHaveLength(1);
  });
});
