import { describe, expect, it } from "vitest";
import {
  isBattleOver,
  startBattle,
  stepBattle
} from "../engine";
import type { AgentConfig, BattleRuntime, SkillId } from "../engine";

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
  skillIds: ["skill-signal-breach", "skill-signal-exposure"]
};

/** Player always picks the first equipped skill each turn. */
const PLAYER_SKILL_SEQUENCE: SkillId[] = Array.from(
  { length: 20 },
  () => "skill-logic-storm"
);

function runWithSkills(
  seed: string,
  maxTurns: number,
  skills: SkillId[],
  startFrom?: BattleRuntime
): BattleRuntime {
  let runtime = startFrom ?? startBattle(playerConfig, cpuConfig, seed, maxTurns);

  for (const skillId of skills) {
    if (isBattleOver(runtime.session)) {
      break;
    }

    runtime = stepBattle(runtime, skillId).runtime;
  }

  return runtime;
}

describe("interactive battle driver", () => {
  it("is deterministic for the same seed and player skill sequence", () => {
    const seed = "driver-determinism-1";
    const maxTurns = 20;

    const runA = runWithSkills(seed, maxTurns, PLAYER_SKILL_SEQUENCE);
    const runB = runWithSkills(seed, maxTurns, PLAYER_SKILL_SEQUENCE);

    expect(isBattleOver(runA.session)).toBe(true);
    expect(runA.turns[runA.turns.length - 1]?.outcome).toBeDefined();
    expect(runA.turns).toEqual(runB.turns);
    expect(runA.turns[runA.turns.length - 1]?.outcome).toEqual(
      runB.turns[runB.turns.length - 1]?.outcome
    );
    expect(runA.player).toEqual(runB.player);
    expect(runA.cpu).toEqual(runB.cpu);
  });

  it("resumes identically after a JSON round-trip mid-battle", () => {
    const seed = "driver-resume-1";
    const maxTurns = 20;
    const pauseAfter = 2;

    const uninterrupted = runWithSkills(seed, maxTurns, PLAYER_SKILL_SEQUENCE);
    expect(uninterrupted.turns[uninterrupted.turns.length - 1]?.outcome).toBeDefined();

    let paused = runWithSkills(seed, maxTurns, PLAYER_SKILL_SEQUENCE.slice(0, pauseAfter));
    expect(paused.turns).toHaveLength(pauseAfter);
    expect(isBattleOver(paused.session)).toBe(false);

    paused = JSON.parse(JSON.stringify(paused)) as BattleRuntime;

    const resumed = runWithSkills(
      seed,
      maxTurns,
      PLAYER_SKILL_SEQUENCE.slice(pauseAfter),
      paused
    );

    expect(resumed.turns).toEqual(uninterrupted.turns);
    expect(resumed.turns[resumed.turns.length - 1]?.outcome).toEqual(
      uninterrupted.turns[uninterrupted.turns.length - 1]?.outcome
    );
    expect(resumed.player).toEqual(uninterrupted.player);
    expect(resumed.cpu).toEqual(uninterrupted.cpu);
  });

  it("reaches a turn-limit outcome with a small maxTurns and defense loadouts", () => {
    const defensePlayer: AgentConfig = {
      ...playerConfig,
      agentId: "agent-player-defense",
      skillIds: ["skill-core-identity", "skill-logic-drift"]
    };
    const defenseCpu: AgentConfig = {
      ...cpuConfig,
      agentId: "agent-cpu-defense",
      skillIds: ["skill-sigil-rule", "skill-null-pulse"]
    };
    const maxTurns = 3;
    const skills: SkillId[] = Array.from({ length: maxTurns }, () => "skill-core-identity");

    let runtime = startBattle(defensePlayer, defenseCpu, "driver-turn-limit", maxTurns);
    for (const skillId of skills) {
      runtime = stepBattle(runtime, skillId).runtime;
    }

    expect(runtime.turns).toHaveLength(maxTurns);
    expect(runtime.turns[maxTurns - 1]?.outcome?.reason).toBe("turn-limit");
    expect(isBattleOver(runtime.session)).toBe(true);
  });

  it("throws when stepping a completed battle", () => {
    const runtime = runWithSkills("driver-completed-throw", 20, PLAYER_SKILL_SEQUENCE);
    expect(isBattleOver(runtime.session)).toBe(true);

    expect(() => stepBattle(runtime, "skill-logic-storm")).toThrow(RangeError);
  });
});
