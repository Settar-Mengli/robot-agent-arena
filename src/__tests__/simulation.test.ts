import { describe, expect, it } from "vitest";
import { MAX_TURNS } from "../engine/constants";
import { createSeededRng } from "../engine/rng";
import {
  finalizeBattle,
  initBattle,
  isBattleOver,
  resolveBattle,
  submitPlayerAction
} from "../engine";
import type { AgentConfig } from "../engine/types";

const playerConfig: AgentConfig = {
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

const cpuConfig: AgentConfig = {
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

describe("resolveBattle", () => {
  it("returns deterministic completed sessions for identical configs and seeds", () => {
    const resolvedA = resolveBattle(playerConfig, cpuConfig, "simulation-seed-1", 4);
    const resolvedB = resolveBattle(playerConfig, cpuConfig, "simulation-seed-1", 4);

    expect(resolvedA).toEqual(resolvedB);
    expect(resolvedA.status).toBe("completed");
    expect(resolvedA.turn).toBe(resolvedA.maxTurns);
    expect(isBattleOver(resolvedA)).toBe(true);
  });

  it("respects the MAX_TURNS cap", () => {
    const resolved = resolveBattle(playerConfig, cpuConfig, "simulation-seed-2", MAX_TURNS + 5);

    expect(resolved.maxTurns).toBe(MAX_TURNS);
    expect(resolved.turn).toBe(MAX_TURNS);
    expect(resolved.status).toBe("completed");
  });

  it("finalizes maxTurns 1 without selecting an action", () => {
    const resolved = resolveBattle(playerConfig, cpuConfig, "simulation-seed-3", 1);

    expect(resolved.turn).toBe(1);
    expect(resolved.status).toBe("completed");
    expect(resolved.lastPlayerAction).toBeUndefined();
  });

  it("keeps the final simulated action inside the player loadout", () => {
    const resolved = resolveBattle(playerConfig, cpuConfig, "simulation-seed-4", 4);

    expect(resolved.lastPlayerAction).toBeDefined();
    expect(playerConfig.skillIds).toContain(resolved.lastPlayerAction?.skillId);
  });

  it("rejects invalid configs with unknown catalog skill IDs", () => {
    const invalidPlayerConfig: AgentConfig = {
      ...playerConfig,
      skillIds: ["skill-core-identity", "skill-unknown"]
    };

    expect(() => resolveBattle(invalidPlayerConfig, cpuConfig, "simulation-seed-5", 4)).toThrow(
      TypeError
    );
  });

  it("rejects empty player loadouts when simulation needs a selection", () => {
    const emptyPlayerConfig: AgentConfig = {
      ...playerConfig,
      skillIds: []
    };

    expect(() => resolveBattle(emptyPlayerConfig, cpuConfig, "simulation-seed-6", 2)).toThrow(
      RangeError
    );
  });

  it("matches manual lifecycle composition for a one-step simulation", () => {
    const seed = "simulation-seed-7";
    const rng = createSeededRng(seed);
    const selectedSkillId = playerConfig.skillIds[rng.nextInt(playerConfig.skillIds.length)];
    const initialized = initBattle(playerConfig, cpuConfig, seed, 2);
    const submitted = submitPlayerAction(initialized, selectedSkillId);
    const manual = finalizeBattle({
      ...submitted,
      turn: 2
    });

    expect(resolveBattle(playerConfig, cpuConfig, seed, 2)).toEqual(manual);
  });
});
