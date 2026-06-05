import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_TURNS, MAX_TURNS } from "../engine/constants";
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
  skillIds: ["skill-signal-burst", "skill-shield-matrix"]
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
  skillIds: ["skill-null-pulse", "skill-override-pulse"]
};

describe("session lifecycle API shape", () => {
  it("creates a BattleSession with initBattle defaults", () => {
    const session = initBattle(playerConfig, cpuConfig, "seed-1");

    expect(session.sessionId).toBe("session:agent-player-1:agent-cpu-1:seed-1");
    expect(session.seed).toBe("seed-1");
    expect(session.turn).toBe(1);
    expect(session.maxTurns).toBe(DEFAULT_MAX_TURNS);
    expect(session.status).toBe("awaiting-player-action");
    expect(session.player).toBe(playerConfig);
    expect(session.cpu).toBe(cpuConfig);
    expect(session.lastPlayerAction).toBeUndefined();
  });

  it("normalizes maxTurns to the MVP cap", () => {
    const capped = initBattle(playerConfig, cpuConfig, "seed-1", MAX_TURNS + 5);

    expect(capped.maxTurns).toBe(MAX_TURNS);
  });

  it("sets lastPlayerAction on submitPlayerAction and returns a new session", () => {
    const session = initBattle(playerConfig, cpuConfig, "seed-2");
    const next = submitPlayerAction(session, "skill-signal-burst");

    expect(next).not.toBe(session);
    expect(next.lastPlayerAction).toEqual({
      type: "use-skill",
      skillId: "skill-signal-burst"
    });
    expect(session.lastPlayerAction).toBeUndefined();
  });

  it("does not enforce one-action-per-step yet", () => {
    const session = initBattle(playerConfig, cpuConfig, "seed-3");
    const first = submitPlayerAction(session, "skill-signal-burst");
    const second = submitPlayerAction(first, "skill-shield-matrix");

    expect(second.lastPlayerAction?.skillId).toBe("skill-shield-matrix");
  });

  it("checks battle completion using status or max turn cap", () => {
    const base = initBattle(playerConfig, cpuConfig, "seed-4", 3);

    expect(isBattleOver(base)).toBe(false);
    expect(
      isBattleOver({
        ...base,
        status: "completed"
      })
    ).toBe(true);
    expect(
      isBattleOver({
        ...base,
        turn: 3,
        status: "awaiting-player-action"
      })
    ).toBe(true);
  });

  it("returns a completed session from finalizeBattle and stays idempotent", () => {
    const session = initBattle(playerConfig, cpuConfig, "seed-5");
    const completed = finalizeBattle(session);
    const completedAgain = finalizeBattle(completed);

    expect(completed.status).toBe("completed");
    expect(completedAgain).toEqual(completed);
  });

  it("returns a deterministic completed stub session from resolveBattle", () => {
    const resolvedA = resolveBattle(playerConfig, cpuConfig, "seed-6", 4);
    const resolvedB = resolveBattle(playerConfig, cpuConfig, "seed-6", 4);

    expect(resolvedA).toEqual(resolvedB);
    expect(resolvedA.status).toBe("completed");
    expect(resolvedA.turn).toBe(resolvedA.maxTurns);
    expect(isBattleOver(resolvedA)).toBe(true);
  });
});
