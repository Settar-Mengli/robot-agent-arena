import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_TURNS, MAX_TURNS } from "../engine/constants";
import {
  advanceBattleTurn,
  finalizeBattle,
  initBattle,
  isBattleOver,
  submitPlayerAction
} from "../engine";
import type { AgentConfig, BattleSession } from "../engine/types";

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
    const next = submitPlayerAction(session, "skill-core-identity");

    expect(next).not.toBe(session);
    expect(next.lastPlayerAction).toEqual({
      type: "use-skill",
      skillId: "skill-core-identity"
    });
    expect(session.lastPlayerAction).toBeUndefined();
  });

  it("rejects duplicate player actions before turn advancement", () => {
    const session = initBattle(playerConfig, cpuConfig, "seed-3");
    const first = submitPlayerAction(session, "skill-core-identity");

    expect(() => submitPlayerAction(first, "skill-null-pulse")).toThrow(RangeError);
  });

  it("advances the turn and clears the player action", () => {
    const session = initBattle(playerConfig, cpuConfig, "seed-3b", 3);
    const submitted = submitPlayerAction(session, "skill-core-identity");
    const advanced = advanceBattleTurn(submitted);

    expect(advanced.turn).toBe(2);
    expect(advanced.lastPlayerAction).toBeUndefined();
    expect(submitted.lastPlayerAction?.skillId).toBe("skill-core-identity");
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

  it("rejects player actions after completion", () => {
    const session = finalizeBattle(initBattle(playerConfig, cpuConfig, "seed-5b"));

    expect(() => submitPlayerAction(session, "skill-core-identity")).toThrow(RangeError);
  });

});

describe("session lifecycle validation", () => {
  it("throws when initBattle receives an empty configA.agentId", () => {
    const invalidConfigA: AgentConfig = {
      ...playerConfig,
      agentId: ""
    };

    expect(() => initBattle(invalidConfigA, cpuConfig, "seed-invalid-a")).toThrow(TypeError);
  });

  it("throws when initBattle receives an invalid configB.modules shape", () => {
    const invalidConfigB = {
      ...cpuConfig,
      modules: {
        ...cpuConfig.modules,
        strategy: 42
      }
    } as unknown as AgentConfig;

    expect(() => initBattle(playerConfig, invalidConfigB, "seed-invalid-b")).toThrow(TypeError);
  });

  it("throws when initBattle receives empty skillIds entries", () => {
    const invalidConfigA: AgentConfig = {
      ...playerConfig,
      skillIds: ["skill-core-identity", ""]
    };

    expect(() => initBattle(invalidConfigA, cpuConfig, "seed-invalid-c")).toThrow(TypeError);
  });

  it("throws when submitPlayerAction receives an empty skillId", () => {
    const session = initBattle(playerConfig, cpuConfig, "seed-invalid-d");

    expect(() => submitPlayerAction(session, "")).toThrow(TypeError);
  });

  it("throws when submitPlayerAction receives an invalid session turn/maxTurns relationship", () => {
    const invalidSession = {
      ...initBattle(playerConfig, cpuConfig, "seed-invalid-e"),
      turn: 3,
      maxTurns: 2
    } as BattleSession;

    expect(() => submitPlayerAction(invalidSession, "skill-core-identity")).toThrow(RangeError);
  });

  it("throws when isBattleOver receives an invalid status", () => {
    const invalidSession = {
      ...initBattle(playerConfig, cpuConfig, "seed-invalid-f"),
      status: "invalid-status"
    } as unknown as BattleSession;

    expect(() => isBattleOver(invalidSession)).toThrow(TypeError);
  });

  it("throws when finalizeBattle receives an invalid session shape", () => {
    const invalidSession = {
      ...initBattle(playerConfig, cpuConfig, "seed-invalid-g"),
      player: null
    } as unknown as BattleSession;

    expect(() => finalizeBattle(invalidSession)).toThrow(TypeError);
  });

  it("throws when advanceBattleTurn would exceed maxTurns", () => {
    const session = submitPlayerAction(
      initBattle(playerConfig, cpuConfig, "seed-invalid-h", 1),
      "skill-core-identity"
    );

    expect(() => advanceBattleTurn(session)).toThrow(RangeError);
  });
});
