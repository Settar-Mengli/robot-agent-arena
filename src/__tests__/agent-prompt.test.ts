import { describe, expect, it } from "vitest";
import { SENTINEL_X } from "../data/opponents";
import {
  PROMPT_VERSION,
  PROMPT_VERSIONS,
  buildAgentMessages,
  computeGroundedFacts,
  computeGroundedFactsV2,
  resolvePromptVersion
} from "../agent";
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
    expect(PROMPT_VERSION).toBe(PROMPT_VERSIONS.v1);
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

  it("grounded path has its own snapshot and authoritative system line", () => {
    const grounding = computeGroundedFacts(
      { cpu, player },
      SENTINEL_X,
      ["skill-core-identity"],
      1,
      20
    );
    expect(resolvePromptVersion({ grounding })).toBe(PROMPT_VERSIONS.grounded);
    const messages = buildAgentMessages({
      turn: 1,
      maxTurns: 20,
      observation: { cpu, player },
      cpuConfig: SENTINEL_X,
      grounding
    });
    expect(messages).toMatchSnapshot();
    expect(messages[0]!.content).toContain("authoritative");
    expect(messages[0]!.content).not.toMatch(/sk-|api[_-]?key|Bearer/i);
    expect(messages.some((m) => m.content.startsWith("ENGINE_GROUNDED_FACTS"))).toBe(
      true
    );
  });

  it("facts-v2 path uses agent-v4-grounded and its own snapshot", () => {
    const grounding = computeGroundedFactsV2(
      { cpu, player },
      SENTINEL_X,
      ["skill-core-identity"],
      1,
      20
    );
    expect(resolvePromptVersion({ grounding })).toBe(PROMPT_VERSIONS.groundedV2);
    const messages = buildAgentMessages({
      turn: 1,
      maxTurns: 20,
      observation: { cpu, player },
      cpuConfig: SENTINEL_X,
      grounding
    });
    expect(messages).toMatchSnapshot();
    expect(messages[0]!.content).toContain("diesNextTurnPreAction");
    expect(messages.some((m) => m.content.startsWith("ENGINE_GROUNDED_FACTS"))).toBe(
      true
    );
    expect(messages.find((m) => m.content.startsWith("ENGINE_GROUNDED_FACTS"))!.content).toContain(
      '"factsVersion":2'
    );
  });

  it("grounded facts mark lethal when a lethal equipped move exists", () => {
    const fragilePlayer: CombatantState = {
      ...player,
      health: 1,
      defense: 0
    };
    const grounding = computeGroundedFacts(
      { cpu: { ...cpu, energy: 10 }, player: fragilePlayer },
      SENTINEL_X,
      ["skill-core-identity"],
      1,
      20
    );
    const lethal = grounding.cpuSkills.filter((s) => s.lethal && s.affordable);
    expect(lethal.length).toBeGreaterThan(0);
    const messages = buildAgentMessages({
      turn: 1,
      maxTurns: 20,
      observation: { cpu, player: fragilePlayer },
      cpuConfig: SENTINEL_X,
      grounding
    });
    const factsMsg = messages.find((m) => m.content.startsWith("ENGINE_GROUNDED_FACTS"));
    expect(factsMsg).toBeDefined();
    expect(factsMsg!.content).toContain('"lethal":true');
  });
});
