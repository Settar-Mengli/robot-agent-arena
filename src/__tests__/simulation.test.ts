import { describe, expect, it } from "vitest";
import { MAX_TURNS } from "../engine/constants";
import { resolveBattle } from "../engine";
import type { AgentConfig, BattleResult } from "../engine/types";

const modules = {
  coreIdentity: "Steady Vanguard",
  memory: "Pattern Recall",
  sigilSecurity: "Aegis Layer",
  rules: "Never Skip Verification",
  strategy: "Measured Pressure"
};

const playerConfig: AgentConfig = {
  agentId: "agent-player-1",
  displayName: "PLAYER-UNIT",
  modules,
  skillIds: ["skill-override-pulse", "skill-logic-storm"]
};

const cpuConfig: AgentConfig = {
  agentId: "agent-cpu-1",
  displayName: "SENTINEL-X",
  modules,
  skillIds: ["skill-sigil-rule", "skill-signal-exposure"]
};

function historySignature(result: BattleResult): string {
  return result.turns
    .map((turn) =>
      turn.actions
        .map((action) => `${action.actor}:${action.selectedSkillId}:${action.resolvedSkillId}`)
        .join("|")
    )
    .join(";");
}

function findDifferentHistorySeedPair(): [string, string] {
  const seeds = [
    "combat-seed-a",
    "combat-seed-b",
    "combat-seed-c",
    "combat-seed-d",
    "combat-seed-e"
  ];

  for (let left = 0; left < seeds.length; left += 1) {
    for (let right = left + 1; right < seeds.length; right += 1) {
      const leftResult = resolveBattle(playerConfig, cpuConfig, seeds[left], 5);
      const rightResult = resolveBattle(playerConfig, cpuConfig, seeds[right], 5);

      if (historySignature(leftResult) !== historySignature(rightResult)) {
        return [seeds[left], seeds[right]];
      }
    }
  }

  throw new Error("Expected at least one candidate seed pair to produce different histories.");
}

describe("resolveBattle", () => {
  it("returns deeply equal BattleResults for identical configs and seeds", () => {
    const resolvedA = resolveBattle(playerConfig, cpuConfig, "simulation-seed-1", 4);
    const resolvedB = resolveBattle(playerConfig, cpuConfig, "simulation-seed-1", 4);

    expect(resolvedA).toEqual(resolvedB);
    expect(resolvedA.finalSession.status).toBe("completed");
    expect(resolvedA.totalTurns).toBe(resolvedA.turns.length);
  });

  it("can produce different valid histories for different seeds", () => {
    const [seedA, seedB] = findDifferentHistorySeedPair();
    const resolvedA = resolveBattle(playerConfig, cpuConfig, seedA, 5);
    const resolvedB = resolveBattle(playerConfig, cpuConfig, seedB, 5);

    expect(historySignature(resolvedA)).not.toBe(historySignature(resolvedB));
    expect(resolvedA.finalSession.status).toBe("completed");
    expect(resolvedB.finalSession.status).toBe("completed");
  });

  it("contains ordered turn history", () => {
    const result = resolveBattle(playerConfig, cpuConfig, "simulation-seed-2", 4);

    expect(result.turns.length).toBeGreaterThan(0);
    expect(result.turns.map((turn) => turn.turn)).toEqual(
      Array.from({ length: result.turns.length }, (_, index) => index + 1)
    );
    expect(result.turns[0].startedPlayer.side).toBe("player");
    expect(result.turns[0].actions[0].actor).toBe("player");
  });

  it("respects requested turn limits and MAX_TURNS", () => {
    const limited = resolveBattle(playerConfig, cpuConfig, "simulation-seed-3", 3);
    const capped = resolveBattle(playerConfig, cpuConfig, "simulation-seed-3", MAX_TURNS + 5);

    expect(limited.turns.length).toBeLessThanOrEqual(3);
    expect(capped.finalSession.maxTurns).toBe(MAX_TURNS);
    expect(capped.turns.length).toBeLessThanOrEqual(MAX_TURNS);
  });

  it("rejects invalid configs with unknown catalog skill IDs", () => {
    const invalidPlayerConfig: AgentConfig = {
      ...playerConfig,
      skillIds: ["skill-core-identity", "skill-unknown"]
    };

    expect(() => resolveBattle(invalidPlayerConfig, cpuConfig, "simulation-seed-4", 4)).toThrow(
      TypeError
    );
  });

  it("rejects empty player loadouts", () => {
    const emptyPlayerConfig: AgentConfig = {
      ...playerConfig,
      skillIds: []
    };

    expect(() => resolveBattle(emptyPlayerConfig, cpuConfig, "simulation-seed-5", 2)).toThrow(
      RangeError
    );
  });

  it("records both actions unless player action completes the battle", () => {
    const result = resolveBattle(
      {
        ...playerConfig,
        skillIds: ["skill-logic-storm"]
      },
      {
        ...cpuConfig,
        skillIds: ["skill-signal-exposure"]
      },
      "simulation-seed-6",
      MAX_TURNS
    );
    const finalTurn = result.turns[result.turns.length - 1];

    expect(result.outcome.reason).toBe("cpu-health-zero");
    expect(finalTurn.actions).toHaveLength(1);
    expect(finalTurn.actions[0].actor).toBe("player");
  });
});
