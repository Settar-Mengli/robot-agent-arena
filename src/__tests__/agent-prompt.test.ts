import { describe, expect, it } from "vitest";
import { SENTINEL_X } from "../data/opponents";
import { PROMPT_VERSION, buildAgentMessages } from "../agent";
import type { CombatantState } from "../engine";

const cpu: CombatantState = {
  side: "cpu",
  agentId: SENTINEL_X.agentId,
  displayName: SENTINEL_X.displayName,
  health: 24,
  maxHealth: 30,
  energy: 6,
  maxEnergy: 10,
  defense: 0
};

const player: CombatantState = {
  side: "player",
  agentId: "agent-player-1",
  displayName: "PLAYER-UNIT",
  health: 30,
  maxHealth: 30,
  energy: 1,
  maxEnergy: 10,
  defense: 0
};

describe("buildAgentMessages", () => {
  it("builds a stable prompt snapshot for a fixed input", () => {
    expect(PROMPT_VERSION).toBe("agent-v1");
    const messages = buildAgentMessages({
      turn: 1,
      maxTurns: 20,
      observation: { cpu, player },
      cpuConfig: SENTINEL_X
    });
    expect(messages).toMatchSnapshot();
  });

  it("caps module strings and skill summaries at 500 characters", () => {
    const long = "x".repeat(600);
    const messages = buildAgentMessages({
      turn: 2,
      maxTurns: 10,
      observation: { cpu, player },
      cpuConfig: {
        ...SENTINEL_X,
        modules: {
          coreIdentity: long,
          memory: long,
          sigilSecurity: long,
          rules: long,
          strategy: long
        }
      }
    });
    const data = JSON.parse(messages[1]!.content) as {
      cpuConfig: { modules: Record<string, string> };
      equippedSkills: Array<{ summary: string }>;
    };
    for (const value of Object.values(data.cpuConfig.modules)) {
      expect(value.length).toBe(500);
    }
  });
});
