import { describe, expect, it } from "vitest";
import {
  LOW_HEALTH_RATIO,
  PROMPT_VERSION,
  PROMPT_VERSIONS,
  buildAgentMessages,
  resolvePromptVersion,
  summarizePlayerTendencies
} from "../agent";
import { SENTINEL_X } from "../data/opponents";
import {
  startBattle,
  stepBattle,
  type AgentConfig,
  type BattleRuntime,
  type CombatantState,
  type SkillId,
  type TurnRecord
} from "../engine";

const modules = {
  coreIdentity: "id",
  memory: "mem",
  sigilSecurity: "sig",
  rules: "rules",
  strategy: "strat"
};

function makeAgent(agentId: string, skillIds: SkillId[]): AgentConfig {
  return { agentId, displayName: agentId, modules, skillIds };
}

function combatant(
  side: "cpu" | "player",
  overrides: Partial<CombatantState> = {}
): CombatantState {
  return {
    side,
    agentId: side === "cpu" ? "cpu-1" : "player-1",
    displayName: side,
    health: 30,
    maxHealth: 30,
    energy: 6,
    maxEnergy: 10,
    defense: 0,
    ...overrides
  };
}

function fakeTurn(
  skillId: SkillId,
  effectCategory: "attack" | "defense" | "recovery" | "disrupt" | "fallback",
  startedCpuHealth: number
): TurnRecord {
  const startedPlayer = combatant("player");
  const startedCpu = combatant("cpu", { health: startedCpuHealth });
  return {
    turn: 1,
    startedPlayer,
    startedCpu,
    actions: [
      {
        actor: "player",
        target: "cpu",
        selectedSkillId: skillId,
        resolvedSkillId: skillId,
        effectCategory,
        fallback: false,
        energySpent: 1,
        damageDealt: effectCategory === "attack" || effectCategory === "disrupt" ? 3 : 0,
        defenseReduced: 0,
        defenseGained: 0,
        healthRecovered: 0,
        energyRecovered: 0,
        energyReduced: 0
      }
    ],
    endedPlayer: startedPlayer,
    endedCpu: startedCpu
  };
}

describe("summarizePlayerTendencies", () => {
  it("returns a well-formed empty summary for empty history", () => {
    const runtime = startBattle(
      makeAgent("player-1", ["skill-core-identity"]),
      makeAgent("cpu-1", ["skill-core-identity"]),
      "empty-mem",
      5
    );
    const summary = summarizePlayerTendencies(runtime);
    expect(summary).toEqual({
      turnsObserved: 0,
      skillCounts: {},
      mostFrequentSkillId: null,
      lastTwoMoves: [],
      attacksWhileCpuLowHealth: 0,
      lowHealthRatio: LOW_HEALTH_RATIO
    });
  });

  it("matches a hand-built turn history", () => {
    const lowThreshold = Math.floor(30 * LOW_HEALTH_RATIO); // 12
    const runtime = {
      turns: [
        fakeTurn("skill-override-pulse", "attack", lowThreshold),
        fakeTurn("skill-core-identity", "defense", 30),
        fakeTurn("skill-override-pulse", "attack", lowThreshold),
        fakeTurn("skill-logic-drift", "recovery", lowThreshold)
      ]
    } as BattleRuntime;

    const summary = summarizePlayerTendencies(runtime);
    expect(summary.turnsObserved).toBe(4);
    expect(summary.skillCounts).toEqual({
      "skill-override-pulse": 2,
      "skill-core-identity": 1,
      "skill-logic-drift": 1
    });
    expect(summary.mostFrequentSkillId).toBe("skill-override-pulse");
    expect(summary.lastTwoMoves).toEqual([
      "skill-override-pulse",
      "skill-logic-drift"
    ]);
    // Two attacks while CPU at/below low-health threshold
    expect(summary.attacksWhileCpuLowHealth).toBe(2);
    expect(summary.lowHealthRatio).toBe(LOW_HEALTH_RATIO);
  });

  it("prompt memory variant snapshots; default path unchanged", () => {
    expect(PROMPT_VERSION).toBe("agent-v1");
    const defaultMessages = buildAgentMessages({
      turn: 1,
      maxTurns: 20,
      observation: {
        cpu: combatant("cpu", {
          agentId: SENTINEL_X.agentId,
          displayName: SENTINEL_X.displayName,
          health: 24
        }),
        player: combatant("player", {
          agentId: "agent-player-1",
          displayName: "PLAYER-UNIT",
          energy: 1
        })
      },
      cpuConfig: SENTINEL_X
    });
    expect(defaultMessages).toHaveLength(2);
    expect(defaultMessages[0]!.content).not.toContain("PLAYER_TENDENCIES");
    expect(defaultMessages[0]!.content).not.toContain("ENGINE_GROUNDED_FACTS");

    const memory = summarizePlayerTendencies({
      turns: [fakeTurn("skill-override-pulse", "attack", 10)]
    } as BattleRuntime);
    expect(resolvePromptVersion({ memory })).toBe(PROMPT_VERSIONS.memory);
    const memoryMessages = buildAgentMessages({
      turn: 1,
      maxTurns: 20,
      observation: {
        cpu: combatant("cpu"),
        player: combatant("player")
      },
      cpuConfig: SENTINEL_X,
      memory
    });
    expect(memoryMessages).toMatchSnapshot();
    expect(memoryMessages.some((m) => m.content.startsWith("PLAYER_TENDENCIES"))).toBe(
      true
    );
  });
});

describe("summarizePlayerTendencies live runtime", () => {
  it("counts skills after real steps", () => {
    const player = makeAgent("player-1", [
      "skill-override-pulse",
      "skill-core-identity"
    ]);
    const cpu = makeAgent("cpu-1", ["skill-core-identity"]);
    let runtime = startBattle(player, cpu, "live-mem", 10);
    runtime = stepBattle(runtime, "skill-override-pulse", () => "skill-core-identity").runtime;
    runtime = stepBattle(runtime, "skill-core-identity", () => "skill-core-identity").runtime;
    const summary = summarizePlayerTendencies(runtime);
    expect(summary.turnsObserved).toBe(2);
    expect(summary.skillCounts["skill-override-pulse"]).toBe(1);
    expect(summary.skillCounts["skill-core-identity"]).toBe(1);
    expect(summary.lastTwoMoves).toEqual([
      "skill-override-pulse",
      "skill-core-identity"
    ]);
  });
});
