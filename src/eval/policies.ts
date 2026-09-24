import {
  createGreedySelector,
  playAgentTurn,
  PROMPT_VERSIONS_ALL
} from "../agent";
import type {
  DecisionTrace,
  PlayAgentTurnOptions,
  PlayAgentTurnResult
} from "../agent";
import {
  createSeededRng,
  findSkillDefinition,
  MVP_SKILL_CATALOG
} from "../engine";
import type {
  AgentConfig,
  BattleRuntime,
  Seed,
  SkillId
} from "../engine";
import { robotEnvironment } from "../env";
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

export const LLM_VARIANTS = [
  "base",
  "grounded",
  "grounded-v2",
  "memory",
  "grounded+memory",
  "freetext",
  "base-repeat",
  "perturb",
  "advctx",
  "info-partial"
] as const;

export type LlmVariant = (typeof LLM_VARIANTS)[number];

export type CpuPolicyId =
  | "random"
  | "greedy"
  | "llm"
  | "optimal"
  | `llm:${LlmVariant}`;

export type CpuDecideResult = {
  step: ReturnType<typeof robotEnvironment.apply>;
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

export const QUOTA_CALL_CAP = 300;
export const QUOTA_DECISIONS_PER_MATCH = 17;

export function isLlmVariant(value: string): value is LlmVariant {
  return (LLM_VARIANTS as readonly string[]).includes(value);
}

/**
 * Parse `--variants` list. Record/live default: base,grounded.
 * Replay default when unset: base (legacy fixtures).
 * `all` expands to every known variant (including grounded-v2).
 */
export function parseVariantsList(
  raw: string | undefined,
  mode: "record" | "live" | "replay" | "baseline" | "discriminate" | "bench"
): LlmVariant[] {
  if (raw === undefined || raw.trim() === "") {
    if (mode === "replay" || mode === "bench") {
      return ["base"];
    }
    if (mode === "record" || mode === "live") {
      return ["base", "grounded"];
    }
    return ["base"];
  }
  const trimmed = raw.trim();
  if (trimmed === "all") {
    return [...LLM_VARIANTS];
  }
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  const out: LlmVariant[] = [];
  for (const part of parts) {
    if (!isLlmVariant(part)) {
      throw new Error(
        `unknown variant "${part}"; expected one of ${LLM_VARIANTS.join(", ")} or all`
      );
    }
    if (!out.includes(part)) {
      out.push(part);
    }
  }
  if (out.length === 0) {
    throw new Error("variants list is empty");
  }
  return out;
}

export function variantToPlayOptions(
  variant: LlmVariant
): Pick<
  PlayAgentTurnOptions,
  "grounding" | "memory" | "json" | "responseFormat" | "promptVariant"
> {
  switch (variant) {
    case "base":
      return { grounding: "off", memory: "off" };
    case "grounded":
      return { grounding: "facts", memory: "off" };
    case "grounded-v2":
      return { grounding: "facts-v2", memory: "off" };
    case "memory":
      return { grounding: "off", memory: "match" };
    case "grounded+memory":
      return { grounding: "facts", memory: "match" };
    case "freetext":
      return {
        grounding: "off",
        memory: "off",
        json: false,
        responseFormat: "freetext"
      };
    case "base-repeat":
      return {
        grounding: "off",
        memory: "off",
        promptVariant: "base-repeat"
      };
    case "perturb":
      return { grounding: "off", memory: "off", promptVariant: "perturb" };
    case "advctx":
      return { grounding: "off", memory: "off", promptVariant: "advctx" };
    case "info-partial":
      return {
        grounding: "off",
        memory: "off",
        promptVariant: "info-partial"
      };
  }
}

export function variantPromptVersion(variant: LlmVariant): string {
  switch (variant) {
    case "base":
      return PROMPT_VERSIONS_ALL.v1;
    case "grounded":
      return PROMPT_VERSIONS_ALL.grounded;
    case "grounded-v2":
      return PROMPT_VERSIONS_ALL.groundedV2;
    case "memory":
      return PROMPT_VERSIONS_ALL.memory;
    case "grounded+memory":
      return PROMPT_VERSIONS_ALL.groundedMemory;
    case "freetext":
      return PROMPT_VERSIONS_ALL.freeText;
    case "base-repeat":
      return PROMPT_VERSIONS_ALL.baseRepeat;
    case "perturb":
      return PROMPT_VERSIONS_ALL.perturb;
    case "advctx":
      return PROMPT_VERSIONS_ALL.advctx;
    case "info-partial":
      return PROMPT_VERSIONS_ALL.infoPartial;
  }
}

export function llmPolicyIdForVariant(variant: LlmVariant): `llm:${LlmVariant}` {
  return `llm:${variant}`;
}

export function projectQuotaCalls(
  variantCount: number,
  snapshotCount: number,
  matchCount: number,
  decisionsPerMatch: number = QUOTA_DECISIONS_PER_MATCH
): number {
  return variantCount * (snapshotCount + matchCount * decisionsPerMatch);
}

export function assertQuotaWithinCap(
  projected: number,
  forceQuota: boolean,
  cap: number = QUOTA_CALL_CAP
): void {
  if (projected > cap && !forceQuota) {
    throw new Error(
      `projected call count ${projected} exceeds cap ${cap}; pass --force-quota to override`
    );
  }
}

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
        step: robotEnvironment.apply(runtime, playerSkillId, () => cpuSkillId)
      };
    }
  };
}

export function randomCpuPolicy(): CpuPolicy {
  return {
    id: "random",
    decide: async (runtime, playerSkillId) => ({
      step: robotEnvironment.apply(runtime, playerSkillId)
    })
  };
}

export function greedyCpuPolicy(cpuConfig: AgentConfig): CpuPolicy {
  const select = createGreedySelector(cpuConfig);
  return {
    id: "greedy",
    decide: async (runtime, playerSkillId) => ({
      step: robotEnvironment.apply(runtime, playerSkillId, select)
    })
  };
}

export type LlmCpuPolicyOptions = PlayAgentTurnOptions & {
  variant?: LlmVariant;
};

export function llmCpuPolicy(options: LlmCpuPolicyOptions = {}): CpuPolicy {
  const variant = options.variant ?? "base";
  const playOptions: PlayAgentTurnOptions = {
    budgetMs: options.budgetMs,
    signal: options.signal,
    inference: options.inference,
    now: options.now,
    catalog: options.catalog,
    ...variantToPlayOptions(variant)
  };
  return {
    id: llmPolicyIdForVariant(variant),
    decide: async (runtime, playerSkillId) => {
      const { step, trace }: PlayAgentTurnResult = await playAgentTurn(
        runtime,
        playerSkillId,
        playOptions
      );
      return { step, trace };
    }
  };
}

export function resolvePlayerPolicy(
  scenario: {
    playerConfig: AgentConfig;
    playerPolicy: "greedy" | "seeded-random";
    seed: Seed;
  }
): PlayerPolicy {
  if (scenario.playerPolicy === "greedy") {
    return greedyPlayer(scenario.playerConfig);
  }
  return seededRandomPlayer(scenario.playerConfig, scenario.seed);
}
