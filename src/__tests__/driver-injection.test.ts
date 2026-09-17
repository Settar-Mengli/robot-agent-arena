import { describe, expect, it, vi } from "vitest";
import { SENTINEL_X } from "../data/opponents";
import {
  FALLBACK_ACTION_ID,
  startBattle,
  stepBattle
} from "../engine";
import type {
  AgentConfig,
  BattleRuntime,
  CombatantState,
  SelectCpuSkillId,
  SkillId
} from "../engine";

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

const PLAYER_SKILL: SkillId = "skill-logic-storm";
const CPU_INJECTED_SKILL: SkillId = "skill-null-pulse";

function cloneRuntime(runtime: BattleRuntime): BattleRuntime {
  return JSON.parse(JSON.stringify(runtime)) as BattleRuntime;
}

describe("stepBattle selectCpuSkillId injection", () => {
  it("matches default when the optional selector is omitted or undefined", () => {
    const seed = "injection-parity-1";
    const runtime = startBattle(playerConfig, SENTINEL_X, seed, 5);

    const withTwoArgs = stepBattle(runtime, PLAYER_SKILL);
    const withUndefined = stepBattle(runtime, PLAYER_SKILL, undefined);

    expect(withTwoArgs).toEqual(withUndefined);
    expect(withTwoArgs.runtime.rng).toEqual(withUndefined.runtime.rng);
  });

  it("uses the injected selector for the CPU action", () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "injection-used-1", 5);
    const selectCpuSkillId = vi.fn<SelectCpuSkillId>(() => CPU_INJECTED_SKILL);

    const stepped = stepBattle(runtime, PLAYER_SKILL, selectCpuSkillId);

    expect(selectCpuSkillId).toHaveBeenCalledTimes(1);
    const cpuAction = stepped.turnRecord.actions.find((action) => action.actor === "cpu");
    expect(cpuAction?.selectedSkillId).toBe(CPU_INJECTED_SKILL);
  });

  it("does not advance rng when a selector is injected; default picker does", () => {
    const seed = "injection-rng-1";
    const runtime = startBattle(playerConfig, SENTINEL_X, seed, 5);
    const selectCpuSkillId: SelectCpuSkillId = () => CPU_INJECTED_SKILL;

    const injected = stepBattle(runtime, PLAYER_SKILL, selectCpuSkillId);
    expect(injected.runtime.rng).toEqual(runtime.rng);

    const defaulted = stepBattle(runtime, PLAYER_SKILL);
    expect(defaulted.runtime.rng.calls).toBeGreaterThan(runtime.rng.calls);
  });

  it("passes post-player-action state with CPU first", () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "injection-args-1", 5);
    const preCpuHealth = runtime.cpu.health;
    let capturedCpu: CombatantState | undefined;
    let capturedPlayer: CombatantState | undefined;

    const selectCpuSkillId: SelectCpuSkillId = (cpu, player) => {
      capturedCpu = cpu;
      capturedPlayer = player;
      return CPU_INJECTED_SKILL;
    };

    stepBattle(runtime, PLAYER_SKILL, selectCpuSkillId);

    expect(capturedCpu?.side).toBe("cpu");
    expect(capturedPlayer?.side).toBe("player");
    expect(capturedCpu?.health).toBeLessThan(preCpuHealth);
  });

  it("skips the selector when the player action ends the battle", () => {
    let runtime = startBattle(playerConfig, SENTINEL_X, "injection-lethal-1", 5);
    runtime = cloneRuntime(runtime);
    runtime.cpu = { ...runtime.cpu, health: 1 };

    const selectCpuSkillId = vi.fn<SelectCpuSkillId>(() => {
      throw new Error("selectCpuSkillId must not be called on a lethal player action");
    });

    const stepped = stepBattle(runtime, PLAYER_SKILL, selectCpuSkillId);

    expect(selectCpuSkillId).not.toHaveBeenCalled();
    expect(stepped.outcome).toBeDefined();
    expect(stepped.outcome?.result).toBe("player-victory");
    expect(stepped.outcome?.reason).toBe("cpu-health-zero");
    expect(stepped.turnRecord.actions.some((action) => action.actor === "cpu")).toBe(false);
  });

  it("passes an unaffordable selected skill through to fallback-stabilize", () => {
    let runtime = startBattle(playerConfig, SENTINEL_X, "injection-unaffordable-1", 5);
    runtime = cloneRuntime(runtime);
    runtime.cpu = { ...runtime.cpu, energy: 0 };

    const selectCpuSkillId: SelectCpuSkillId = () => CPU_INJECTED_SKILL;
    const stepped = stepBattle(runtime, PLAYER_SKILL, selectCpuSkillId);

    const cpuAction = stepped.turnRecord.actions.find((action) => action.actor === "cpu");
    expect(cpuAction).toBeDefined();
    expect(cpuAction?.selectedSkillId).toBe(CPU_INJECTED_SKILL);
    expect(cpuAction?.resolvedSkillId).toBe(FALLBACK_ACTION_ID);
    expect(cpuAction?.fallback).toBe(true);
  });

  it("keeps BattleRuntime JSON-serializable after an injected step", () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "injection-serialize-1", 5);
    const selectCpuSkillId: SelectCpuSkillId = () => CPU_INJECTED_SKILL;

    const stepped = stepBattle(runtime, PLAYER_SKILL, selectCpuSkillId);
    const restored = cloneRuntime(stepped.runtime);

    expect(restored).toEqual(stepped.runtime);
    expect(() => stepBattle(restored, "skill-override-pulse")).not.toThrow();
  });
});
