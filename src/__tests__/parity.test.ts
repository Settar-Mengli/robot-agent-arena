import { describe, expect, it } from "vitest";
import {
  initBattle,
  isBattleOver,
  resolveBattle,
  resolveTurn
} from "../engine";
import type { AgentConfig, BattleResult, TurnRecord } from "../engine";

const modules = {
  coreIdentity: "Steady Vanguard",
  memory: "Pattern Recall",
  sigilSecurity: "Aegis Layer",
  rules: "Never Skip Verification",
  strategy: "Measured Pressure"
};

const attackPlayer: AgentConfig = {
  agentId: "agent-player-1",
  displayName: "PLAYER-UNIT",
  modules,
  skillIds: ["skill-override-pulse", "skill-logic-storm"]
};

const attackCpu: AgentConfig = {
  agentId: "agent-cpu-1",
  displayName: "SENTINEL-X",
  modules,
  skillIds: ["skill-signal-breach", "skill-signal-exposure"]
};

const defensePlayer: AgentConfig = {
  agentId: "agent-player-defense",
  displayName: "PLAYER-UNIT",
  modules,
  skillIds: ["skill-core-identity", "skill-logic-drift"]
};

const defenseCpu: AgentConfig = {
  agentId: "agent-cpu-defense",
  displayName: "SENTINEL-X",
  modules,
  skillIds: ["skill-sigil-rule", "skill-null-pulse"]
};

function replayInteractiveSeam(
  configA: AgentConfig,
  configB: AgentConfig,
  seed: string,
  maxTurns: number
): { ref: BattleResult; replayTurns: TurnRecord[] } {
  const ref = resolveBattle(configA, configB, seed, maxTurns);

  let session = initBattle(configA, configB, seed, maxTurns);
  let player = ref.turns[0].startedPlayer;
  let cpu = ref.turns[0].startedCpu;
  const replayTurns: TurnRecord[] = [];
  let i = 0;

  while (!isBattleOver(session)) {
    const rt = ref.turns[i];
    const playerSkillId = rt.actions.find((a) => a.actor === "player")!.selectedSkillId;
    const cpuAction = rt.actions.find((a) => a.actor === "cpu");

    const res = resolveTurn({
      session,
      player,
      cpu,
      playerSkillId,
      selectCpuSkillId: () => {
        if (cpuAction === undefined) {
          throw new Error("selectCpuSkillId invoked without a CPU action in the reference turn.");
        }
        return cpuAction.selectedSkillId;
      }
    });

    session = res.session;
    player = res.player;
    cpu = res.cpu;
    replayTurns.push(res.turnRecord);
    i += 1;
  }

  return { ref, replayTurns };
}

describe("interactive seam parity with resolveBattle", () => {
  it("replays a health-depletion battle for seed parity-health-a", () => {
    const { ref, replayTurns } = replayInteractiveSeam(
      attackPlayer,
      attackCpu,
      "parity-health-a",
      20
    );

    expect(ref.outcome.reason).not.toBe("turn-limit");
    expect(ref.totalTurns).toBeLessThan(20);
    expect(replayTurns).toEqual(ref.turns);
    expect(replayTurns[replayTurns.length - 1]?.outcome).toEqual(ref.outcome);
    expect(replayTurns.length).toBe(ref.totalTurns);
  });

  it("replays a health-depletion battle for seed parity-health-b", () => {
    const { ref, replayTurns } = replayInteractiveSeam(
      attackPlayer,
      attackCpu,
      "parity-health-b",
      20
    );

    expect(ref.outcome.reason).not.toBe("turn-limit");
    expect(ref.totalTurns).toBeLessThan(20);
    expect(replayTurns).toEqual(ref.turns);
    expect(replayTurns[replayTurns.length - 1]?.outcome).toEqual(ref.outcome);
    expect(replayTurns.length).toBe(ref.totalTurns);
  });

  it("replays a turn-limit battle through the final capped turn", () => {
    const maxTurns = 3;
    const { ref, replayTurns } = replayInteractiveSeam(
      defensePlayer,
      defenseCpu,
      "parity-turn-limit",
      maxTurns
    );

    expect(ref.outcome.reason).toBe("turn-limit");
    expect(ref.totalTurns).toBe(maxTurns);
    expect(replayTurns.length).toBe(maxTurns);
    expect(replayTurns).toEqual(ref.turns);
    expect(replayTurns[replayTurns.length - 1]?.outcome).toEqual(ref.outcome);
  });
});
