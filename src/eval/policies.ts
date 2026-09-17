import { createGreedySelector, playAgentTurn } from "../agent";
import type { DecisionTrace, PlayAgentTurnOptions } from "../agent";
import {
  createSeededRng,
  findSkillDefinition,
  MVP_SKILL_CATALOG,
  stepBattle
} from "../engine";
import type {
  AgentConfig,
  BattleRuntime,
  Seed,
  SkillId
} from "../engine";

/**
 * Stateless player policy: output depends only on the given runtime
 * (and the closed-over config / seed for construction).
 */
export type PlayerPolicy = (runtime: BattleRuntime) => SkillId;

export function greedyPlayer(config: AgentConfig): PlayerPolicy {
  const select = createGreedySelector(config);
  return (runtime) => select(runtime.player, runtime.cpu);
}

/**
 * Mix scenario seed with turn into a deterministic integer hash.
 * Uses only integer arithmetic — no Math.random.
 */
export function mix(seed: Seed, turn: number): number {
  const seedText = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= turn >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function seededRandomPlayer(config: AgentConfig, seed: Seed): PlayerPolicy {
  return (runtime) => {
    const affordable = config.skillIds.filter((skillId) => {
      const skill = findSkillDefinition(MVP_SKILL_CATALOG, skillId);
      return skill !== undefined && skill.energyCost <= runtime.player.energy;
    });

    if (affordable.length === 0) {
      return config.skillIds[0]!;
    }

    const rng = createSeededRng(mix(seed, runtime.session.turn));
    return affordable[rng.nextInt(affordable.length)]!;
  };
}

export type CpuPolicyId = "random" | "greedy" | "llm";

export type CpuDecideResult = {
  step: ReturnType<typeof stepBattle>;
  trace?: DecisionTrace;
};

export type CpuPolicy = {
  id: CpuPolicyId;
  decide: (
    runtime: BattleRuntime,
    playerSkillId: SkillId
  ) => Promise<CpuDecideResult>;
};

export function randomCpuPolicy(): CpuPolicy {
  return {
    id: "random",
    decide: async (runtime, playerSkillId) => ({
      step: stepBattle(runtime, playerSkillId)
    })
  };
}

export function greedyCpuPolicy(cpuConfig: AgentConfig): CpuPolicy {
  const select = createGreedySelector(cpuConfig);
  return {
    id: "greedy",
    decide: async (runtime, playerSkillId) => ({
      step: stepBattle(runtime, playerSkillId, select)
    })
  };
}

export function llmCpuPolicy(
  options: PlayAgentTurnOptions = {}
): CpuPolicy {
  return {
    id: "llm",
    decide: async (runtime, playerSkillId) => {
      const { step, trace } = await playAgentTurn(runtime, playerSkillId, options);
      return { step, trace };
    }
  };
}

export function resolvePlayerPolicy(
  scenario: { playerConfig: AgentConfig; playerPolicy: "greedy" | "seeded-random"; seed: Seed }
): PlayerPolicy {
  if (scenario.playerPolicy === "greedy") {
    return greedyPlayer(scenario.playerConfig);
  }
  return seededRandomPlayer(scenario.playerConfig, scenario.seed);
}
