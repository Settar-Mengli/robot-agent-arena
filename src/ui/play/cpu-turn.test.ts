import { describe, expect, it } from "vitest";
import { createGreedySelector } from "../../agent";
import { FRACTURE, SENTINEL_X } from "../../data/opponents";
import { startBattle, stepBattle } from "../../engine";
import type { AgentConfig, BattleRuntime } from "../../engine";
import { createGreedyPlayTurn } from "./cpu-turn";

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

function runtimeFor(cpu: AgentConfig, seed = "cpu-turn-1"): BattleRuntime {
  return startBattle(playerConfig, cpu, seed, 5);
}

describe("createGreedyPlayTurn", () => {
  it("matches direct stepBattle + createGreedySelector(runtime.session.cpu)", async () => {
    const runtime = runtimeFor(SENTINEL_X);
    const playTurn = createGreedyPlayTurn();
    const playerSkillId = "skill-logic-storm" as const;

    const viaAdapter = await playTurn(runtime, playerSkillId);
    const select = createGreedySelector(runtime.session.cpu);
    const viaDirect = stepBattle(runtime, playerSkillId, select);

    expect(viaAdapter.step).toEqual(viaDirect);
    expect(viaAdapter.trace).toBeUndefined();
  });

  it("derives CPU config from runtime.session.cpu (not a captured opponent)", async () => {
    const fractureRuntime = runtimeFor(FRACTURE, "cpu-fracture");
    const sentinelRuntime = runtimeFor(SENTINEL_X, "cpu-sentinel");
    // Same seed string family but different opponents must disagree if config is used.
    const playTurn = createGreedyPlayTurn();

    const a = await playTurn(fractureRuntime, "skill-override-pulse");
    const b = await playTurn(sentinelRuntime, "skill-override-pulse");

    expect(a.step.runtime.session.cpu.agentId).toBe(FRACTURE.agentId);
    expect(b.step.runtime.session.cpu.agentId).toBe(SENTINEL_X.agentId);
    expect(a.step.turnRecord.actions.find((x) => x.actor === "cpu")).not.toEqual(
      b.step.turnRecord.actions.find((x) => x.actor === "cpu")
    );
  });

  it("unaffordable player skill resolves with fallback: true on the player action", async () => {
    const runtime = runtimeFor(SENTINEL_X);
    runtime.player = { ...runtime.player, energy: 0 };

    const playTurn = createGreedyPlayTurn();
    const { step } = await playTurn(runtime, "skill-logic-storm");
    const playerAction = step.turnRecord.actions.find((a) => a.actor === "player");

    expect(playerAction).toBeDefined();
    expect(playerAction!.fallback).toBe(true);
    expect(playerAction!.resolvedSkillId).toBe("fallback-stabilize");
  });
});
