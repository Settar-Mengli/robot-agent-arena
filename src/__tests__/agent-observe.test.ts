import { describe, expect, it } from "vitest";
import { SENTINEL_X } from "../data/opponents";
import { startBattle, stepBattle } from "../engine";
import type { AgentConfig, BattleRuntime, CombatantState } from "../engine";
import { observePostPlayerState } from "../agent";

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

function cloneRuntime(runtime: BattleRuntime): BattleRuntime {
  return JSON.parse(JSON.stringify(runtime)) as BattleRuntime;
}

describe("observePostPlayerState", () => {
  it("captures the same post-player state the real selector receives", () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "observe-eq-1", 5);
    const observed = observePostPlayerState(runtime, "skill-logic-storm");
    expect(observed).not.toBeNull();

    let selectorArgs: { cpu: CombatantState; player: CombatantState } | undefined;
    stepBattle(runtime, "skill-logic-storm", (cpu, player) => {
      selectorArgs = { cpu, player };
      return "skill-null-pulse";
    });

    expect(selectorArgs).toEqual(observed);
  });

  it("leaves the input runtime deep-unchanged after the probe", () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "observe-immut-1", 5);
    const before = cloneRuntime(runtime);
    observePostPlayerState(runtime, "skill-logic-storm");
    expect(runtime).toEqual(before);
  });

  it("returns null when the player action ends the battle", () => {
    let runtime = startBattle(playerConfig, SENTINEL_X, "observe-lethal-1", 5);
    runtime = cloneRuntime(runtime);
    runtime.cpu = { ...runtime.cpu, health: 1 };

    const observed = observePostPlayerState(runtime, "skill-logic-storm");
    expect(observed).toBeNull();
  });
});
