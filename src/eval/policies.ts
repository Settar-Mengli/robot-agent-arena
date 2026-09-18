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
import { bestResponse } from "./oracle";

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

export type CpuPolicyId = "random" | "greedy" | "llm" | "optimal";

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

export type OptimalCpuPolicy = CpuPolicy & {
  /** Turns where the oracle was inexact and greedy was used instead. */
  inexactTurns: () => number;
};

/**
 * Pick the first skill in MVP catalog order that is in `best`, equipped, and
 * affordable at the current CPU energy; otherwise the first equipped best.
 */
export function pickBestByCatalogOrder(
  best: readonly SkillId[],
  equipped: readonly SkillId[],
  energy: number
): SkillId {
  const bestSet = new Set(best);
  const equippedSet = new Set(equipped);
  for (const skill of MVP_SKILL_CATALOG.skills) {
    if (!bestSet.has(skill.skillId) || !equippedSet.has(skill.skillId)) {
      continue;
    }
    if (skill.energyCost <= energy) {
      return skill.skillId;
    }
  }
  for (const skill of MVP_SKILL_CATALOG.skills) {
    if (bestSet.has(skill.skillId) && equippedSet.has(skill.skillId)) {
      return skill.skillId;
    }
  }
  if (best[0] !== undefined && equippedSet.has(best[0])) {
    return best[0];
  }
  throw new Error("optimalCpuPolicy: no equipped skill in oracle best set");
}

/**
 * Exact best-response CPU baseline vs a fixed player policy.
 * Must receive the SAME playerPolicy instance the match uses.
 */
export function optimalCpuPolicy(
  playerPolicy: PlayerPolicy,
  options: { maxNodes?: number } = {}
): OptimalCpuPolicy {
  let inexact = 0;

  return {
    id: "optimal",
    inexactTurns: () => inexact,
    decide: async (runtime, playerSkillId) => {
      const result = bestResponse(
        runtime,
        playerSkillId,
        playerPolicy,
        options.maxNodes !== undefined ? { maxNodes: options.maxNodes } : {}
      );

      let cpuSkillId: SkillId;
      if (!result.exact || result.best.length === 0) {
        inexact += 1;
        const greedy = createGreedySelector(runtime.session.cpu);
        cpuSkillId = greedy(runtime.cpu, runtime.player);
      } else {
        cpuSkillId = pickBestByCatalogOrder(
          result.best,
          runtime.session.cpu.skillIds,
          runtime.cpu.energy
        );
      }

      return {
        step: stepBattle(runtime, playerSkillId, () => cpuSkillId)
      };
    }
  };
}

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
