import { describe, expect, it } from "vitest";
import {
  createInitialCombatantState,
  determineBattleOutcome,
  determineHealthOutcome,
  determineTurnLimitOutcome
} from "../engine";
import type { AgentConfig, CombatantState } from "../engine";

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
  skillIds: ["skill-core-identity"]
};

const cpuConfig: AgentConfig = {
  agentId: "agent-cpu-1",
  displayName: "SENTINEL-X",
  modules,
  skillIds: ["skill-sigil-rule"]
};

function player(overrides: Partial<CombatantState> = {}): CombatantState {
  return {
    ...createInitialCombatantState(playerConfig, "player"),
    ...overrides
  };
}

function cpu(overrides: Partial<CombatantState> = {}): CombatantState {
  return {
    ...createInitialCombatantState(cpuConfig, "cpu"),
    ...overrides
  };
}

describe("battle outcome", () => {
  it("detects player wins", () => {
    expect(determineHealthOutcome(player(), cpu({ health: 0 }))).toEqual({
      result: "player-victory",
      reason: "cpu-health-zero",
      winnerSide: "player",
      winnerAgentId: "agent-player-1"
    });
  });

  it("detects CPU wins", () => {
    expect(determineHealthOutcome(player({ health: 0 }), cpu())).toEqual({
      result: "cpu-victory",
      reason: "player-health-zero",
      winnerSide: "cpu",
      winnerAgentId: "agent-cpu-1"
    });
  });

  it("detects mutual draw", () => {
    expect(determineHealthOutcome(player({ health: 0 }), cpu({ health: 0 }))).toEqual({
      result: "draw",
      reason: "mutual-health-zero"
    });
  });

  it("uses health for turn-limit tie-breaks", () => {
    expect(determineTurnLimitOutcome(player({ health: 12 }), cpu({ health: 10 }))).toEqual({
      result: "player-victory",
      reason: "turn-limit",
      winnerSide: "player",
      winnerAgentId: "agent-player-1"
    });
  });

  it("uses energy for turn-limit tie-breaks after equal health", () => {
    expect(
      determineTurnLimitOutcome(player({ health: 10, energy: 4 }), cpu({ health: 10, energy: 6 }))
    ).toEqual({
      result: "cpu-victory",
      reason: "turn-limit",
      winnerSide: "cpu",
      winnerAgentId: "agent-cpu-1"
    });
  });

  it("draws turn-limit outcomes after equal health and energy", () => {
    expect(
      determineBattleOutcome(player({ health: 10, energy: 5 }), cpu({ health: 10, energy: 5 }), 4, 4)
    ).toEqual({
      result: "draw",
      reason: "turn-limit"
    });
  });
});
