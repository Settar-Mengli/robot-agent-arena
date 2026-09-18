import {
  findSkillDefinition,
  isBattleOver,
  MVP_SKILL_CATALOG,
  startBattle,
  stepBattle
} from "../engine";
import type { BattleRuntime, SkillId } from "../engine";
import { createGreedySelector } from "../agent";
import { resolvePlayerPolicy } from "./policies";
import { bestResponse, regret } from "./oracle";
import { buildMatchSuite, type EvalSplit, type MatchScenario } from "./scenarios";

export type DecisionSnapshot = {
  id: string;
  scenarioId: string;
  runtime: BattleRuntime;
  playerSkillId: SkillId;
  cpuConfigId: string;
  values: Record<SkillId, number>;
  best: SkillId[];
  exact: true;
};

export type SnapshotSuite = {
  scenariosScanned: number;
  snapshots: DecisionSnapshot[];
};

export const PIVOTAL_MIN_SPREAD = 100;
export const PIVOTAL_TARGET_COUNT = 20;
export const STAKE_TAIL_THRESHOLDS = [10, 100, 500, 1000] as const;

export type PivotalDecisionSnapshot = DecisionSnapshot & { spread: number };

export type PivotalSnapshotSuite = {
  scenariosScanned: number;
  minSpread: number;
  targetCount: number;
  count: number;
  snapshots: PivotalDecisionSnapshot[];
  /** Present when count < targetCount after a full scan. */
  warning?: string;
};

export type StakeTailCounts = Record<
  (typeof STAKE_TAIL_THRESHOLDS)[number],
  number
>;

export const ADVERSARIAL_MIN_REGRET = 100;
export const ADVERSARIAL_TARGET_COUNT = 20;
export const ADVERSARIAL_REGRET_TAIL_THRESHOLDS = [1, 100, 500, 1000] as const;

export type AdversarialDecisionSnapshot = DecisionSnapshot & {
  spread: number;
  greedyRegret: number;
  greedySkillId: SkillId;
};

export type AdversarialSnapshotSuite = {
  scenariosScanned: number;
  minRegret: number;
  targetCount: number;
  count: number;
  snapshots: AdversarialDecisionSnapshot[];
  /** Present when count < targetCount after a full scan. */
  warning?: string;
};

export type RegretTailCounts = Record<
  (typeof ADVERSARIAL_REGRET_TAIL_THRESHOLDS)[number],
  number
>;

const TARGET_COUNT = 20;
const INITIAL_SCAN = 12;

function affordableCpuCount(runtime: BattleRuntime): number {
  return runtime.session.cpu.skillIds.filter((skillId) => {
    const skill = findSkillDefinition(MVP_SKILL_CATALOG, skillId);
    return skill !== undefined && skill.energyCost <= runtime.cpu.energy;
  }).length;
}

function valuesAreFlat(values: Record<SkillId, number>): boolean {
  const nums = Object.values(values);
  if (nums.length === 0) {
    return true;
  }
  const first = nums[0]!;
  return nums.every((value) => value === first);
}

/** Oracle value spread: max − min (same notion as discriminate). */
export function valueSpread(values: Record<SkillId, number>): number {
  const nums = Object.values(values);
  if (nums.length === 0) {
    return 0;
  }
  let min = Infinity;
  let max = -Infinity;
  for (const value of nums) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return max - min;
}

function collectFromScenario(scenario: MatchScenario): DecisionSnapshot[] {
  const playerPolicy = resolvePlayerPolicy(scenario);
  const greedyCpu = createGreedySelector(scenario.cpuConfig);
  const memo = {
    identity: `${scenario.playerPolicy}|${scenario.cpuConfig.agentId}|${scenario.playerConfig.agentId}|maxTurns`,
    map: new Map<string, number>()
  };
  const found: DecisionSnapshot[] = [];

  let runtime = startBattle(
    scenario.playerConfig,
    scenario.cpuConfig,
    scenario.seed
  );

  while (!isBattleOver(runtime.session)) {
    const playerSkillId = playerPolicy(runtime);

    if (affordableCpuCount(runtime) >= 2) {
      const result = bestResponse(runtime, playerSkillId, playerPolicy, {
        memo
      });

      if (
        result.exact &&
        !valuesAreFlat(result.values) &&
        Object.keys(result.values).length >= 2
      ) {
        found.push({
          id: `${scenario.id}__t${runtime.session.turn}`,
          scenarioId: scenario.id,
          runtime: structuredClone(runtime),
          playerSkillId,
          cpuConfigId: scenario.cpuConfig.agentId,
          values: result.values,
          best: result.best,
          exact: true
        });
      }
    }

    runtime = stepBattle(runtime, playerSkillId, greedyCpu).runtime;
  }

  return found;
}

function selectEveryKth(
  candidates: DecisionSnapshot[],
  count: number
): DecisionSnapshot[] {
  if (candidates.length < count) {
    throw new Error(
      `need at least ${count} candidates, got ${candidates.length}`
    );
  }

  const k = Math.max(1, Math.floor(candidates.length / count));
  const selected: DecisionSnapshot[] = [];
  for (
    let i = 0;
    selected.length < count && i < candidates.length;
    i += k
  ) {
    selected.push(candidates[i]!);
  }

  if (selected.length < count) {
    for (const candidate of candidates) {
      if (selected.length >= count) {
        break;
      }
      if (!selected.includes(candidate)) {
        selected.push(candidate);
      }
    }
  }

  return selected.slice(0, count);
}

/**
 * Bounded snapshot generation: scan the first 12 scenarios (stable id order),
 * extend one-at-a-time if needed until 20 discriminative exact points exist.
 * Oracle memo is reused within each scenario walk.
 */
export function generateSnapshots(split: EvalSplit): SnapshotSuite {
  const suite = buildMatchSuite(split);
  const candidates: DecisionSnapshot[] = [];
  let scenariosScanned = 0;

  for (let i = 0; i < suite.length; i += 1) {
    const scenario = suite[i]!;
    candidates.push(...collectFromScenario(scenario));
    scenariosScanned = i + 1;

    if (scenariosScanned >= INITIAL_SCAN && candidates.length >= TARGET_COUNT) {
      break;
    }
  }

  candidates.sort((a, b) => {
    if (a.scenarioId !== b.scenarioId) {
      return a.scenarioId < b.scenarioId ? -1 : 1;
    }
    return a.runtime.session.turn - b.runtime.session.turn;
  });

  const snapshots = selectEveryKth(candidates, TARGET_COUNT);
  return { scenariosScanned, snapshots };
}

function withSpread(snap: DecisionSnapshot): PivotalDecisionSnapshot {
  return { ...snap, spread: valueSpread(snap.values) };
}

function comparePivotal(
  a: PivotalDecisionSnapshot,
  b: PivotalDecisionSnapshot
): number {
  if (a.spread !== b.spread) {
    return b.spread - a.spread;
  }
  if (a.scenarioId !== b.scenarioId) {
    return a.scenarioId < b.scenarioId ? -1 : 1;
  }
  return a.runtime.session.turn - b.runtime.session.turn;
}

export type SelectPivotalOptions = {
  minSpread?: number;
  targetCount?: number;
};

/**
 * Rank qualifying candidates by spread descending; take up to targetCount.
 * Never throws on shortfall — returns all qualifiers and a warning string.
 */
export function selectPivotalSnapshots(
  candidates: readonly PivotalDecisionSnapshot[],
  options: SelectPivotalOptions = {}
): {
  snapshots: PivotalDecisionSnapshot[];
  count: number;
  warning?: string;
} {
  const minSpread = options.minSpread ?? PIVOTAL_MIN_SPREAD;
  const targetCount = options.targetCount ?? PIVOTAL_TARGET_COUNT;
  const qualified = candidates
    .filter((c) => c.spread >= minSpread)
    .slice()
    .sort(comparePivotal);
  const snapshots = qualified.slice(0, targetCount);
  const count = snapshots.length;
  if (count < targetCount) {
    return {
      snapshots,
      count,
      warning: `only ${count} of ${targetCount} pivotal points qualified at spread>=${minSpread}`
    };
  }
  return { snapshots, count };
}

export type GeneratePivotalOptions = SelectPivotalOptions & {
  /** Cap scenarios scanned (for tests). Default: entire split. */
  maxScenarios?: number;
};

/**
 * High-stakes snapshot suite: exact non-flat points with spread >= minSpread,
 * ranked by spread. Shortfall after full scan does not throw.
 */
export function generatePivotalSnapshots(
  split: EvalSplit,
  options: GeneratePivotalOptions = {}
): PivotalSnapshotSuite {
  const minSpread = options.minSpread ?? PIVOTAL_MIN_SPREAD;
  const targetCount = options.targetCount ?? PIVOTAL_TARGET_COUNT;
  const suite = buildMatchSuite(split);
  const limit = options.maxScenarios ?? suite.length;
  const candidates: PivotalDecisionSnapshot[] = [];
  let scenariosScanned = 0;

  for (let i = 0; i < suite.length && i < limit; i += 1) {
    const scenario = suite[i]!;
    for (const snap of collectFromScenario(scenario)) {
      candidates.push(withSpread(snap));
    }
    scenariosScanned = i + 1;

    const qualifiedSoFar = candidates.filter((c) => c.spread >= minSpread).length;
    if (
      options.maxScenarios === undefined &&
      scenariosScanned >= INITIAL_SCAN &&
      qualifiedSoFar >= targetCount
    ) {
      break;
    }
  }

  // If still short and we stopped early, scan the rest of the split.
  if (
    options.maxScenarios === undefined &&
    candidates.filter((c) => c.spread >= minSpread).length < targetCount
  ) {
    for (let i = scenariosScanned; i < suite.length; i += 1) {
      const scenario = suite[i]!;
      for (const snap of collectFromScenario(scenario)) {
        candidates.push(withSpread(snap));
      }
      scenariosScanned = i + 1;
      if (
        candidates.filter((c) => c.spread >= minSpread).length >= targetCount
      ) {
        break;
      }
    }
  }

  const selected = selectPivotalSnapshots(candidates, { minSpread, targetCount });
  const result: PivotalSnapshotSuite = {
    scenariosScanned,
    minSpread,
    targetCount,
    count: selected.count,
    snapshots: selected.snapshots
  };
  if (selected.warning !== undefined) {
    result.warning = selected.warning;
  }
  return result;
}

/**
 * Full-split scan: count exact non-flat candidates meeting each stake threshold.
 */
export function countStakeTail(split: EvalSplit): {
  scenariosScanned: number;
  counts: StakeTailCounts;
} {
  const suite = buildMatchSuite(split);
  const spreads: number[] = [];
  let scenariosScanned = 0;
  for (let i = 0; i < suite.length; i += 1) {
    for (const snap of collectFromScenario(suite[i]!)) {
      spreads.push(valueSpread(snap.values));
    }
    scenariosScanned = i + 1;
  }
  const counts = {} as StakeTailCounts;
  for (const threshold of STAKE_TAIL_THRESHOLDS) {
    counts[threshold] = spreads.filter((s) => s >= threshold).length;
  }
  return { scenariosScanned, counts };
}

function withAdversarialFields(
  snap: DecisionSnapshot
): AdversarialDecisionSnapshot {
  const select = createGreedySelector(snap.runtime.session.cpu);
  const greedySkillId = select(snap.runtime.cpu, snap.runtime.player);
  return {
    ...snap,
    spread: valueSpread(snap.values),
    greedyRegret: regret(snap.values, greedySkillId),
    greedySkillId
  };
}

function compareAdversarial(
  a: AdversarialDecisionSnapshot,
  b: AdversarialDecisionSnapshot
): number {
  if (a.greedyRegret !== b.greedyRegret) {
    return b.greedyRegret - a.greedyRegret;
  }
  if (a.scenarioId !== b.scenarioId) {
    return a.scenarioId < b.scenarioId ? -1 : 1;
  }
  return a.runtime.session.turn - b.runtime.session.turn;
}

export type SelectAdversarialOptions = {
  minRegret?: number;
  targetCount?: number;
};

/**
 * Rank qualifying candidates by greedyRegret descending; take up to targetCount.
 * Never throws on shortfall — returns all qualifiers and a warning string.
 */
export function selectAdversarialSnapshots(
  candidates: readonly AdversarialDecisionSnapshot[],
  options: SelectAdversarialOptions = {}
): {
  snapshots: AdversarialDecisionSnapshot[];
  count: number;
  warning?: string;
} {
  const minRegret = options.minRegret ?? ADVERSARIAL_MIN_REGRET;
  const targetCount = options.targetCount ?? ADVERSARIAL_TARGET_COUNT;
  const qualified = candidates
    .filter((c) => c.greedyRegret >= minRegret)
    .slice()
    .sort(compareAdversarial);
  const snapshots = qualified.slice(0, targetCount);
  const count = snapshots.length;
  if (count < targetCount) {
    return {
      snapshots,
      count,
      warning: `only ${count} of ${targetCount} adversarial points qualified at greedyRegret>=${minRegret}`
    };
  }
  return { snapshots, count };
}

export type GenerateAdversarialOptions = SelectAdversarialOptions & {
  /** Cap scenarios scanned (for tests). Default: entire split. */
  maxScenarios?: number;
};

/**
 * Adversarial snapshot suite: exact non-flat points where greedy regret >= minRegret,
 * ranked by greedyRegret. Always full-split (unless maxScenarios). Shortfall does not throw.
 */
export function generateAdversarialSnapshots(
  split: EvalSplit,
  options: GenerateAdversarialOptions = {}
): AdversarialSnapshotSuite {
  const minRegret = options.minRegret ?? ADVERSARIAL_MIN_REGRET;
  const targetCount = options.targetCount ?? ADVERSARIAL_TARGET_COUNT;
  const suite = buildMatchSuite(split);
  const limit = options.maxScenarios ?? suite.length;
  const candidates: AdversarialDecisionSnapshot[] = [];
  let scenariosScanned = 0;

  for (let i = 0; i < suite.length && i < limit; i += 1) {
    const scenario = suite[i]!;
    for (const snap of collectFromScenario(scenario)) {
      candidates.push(withAdversarialFields(snap));
    }
    scenariosScanned = i + 1;
  }

  const selected = selectAdversarialSnapshots(candidates, {
    minRegret,
    targetCount
  });
  const result: AdversarialSnapshotSuite = {
    scenariosScanned,
    minRegret,
    targetCount,
    count: selected.count,
    snapshots: selected.snapshots
  };
  if (selected.warning !== undefined) {
    result.warning = selected.warning;
  }
  return result;
}

/**
 * Full-split scan: count exact non-flat candidates meeting each greedyRegret threshold.
 */
export function countRegretTail(split: EvalSplit): {
  scenariosScanned: number;
  counts: RegretTailCounts;
} {
  const suite = buildMatchSuite(split);
  const regrets: number[] = [];
  let scenariosScanned = 0;
  for (let i = 0; i < suite.length; i += 1) {
    for (const snap of collectFromScenario(suite[i]!)) {
      regrets.push(withAdversarialFields(snap).greedyRegret);
    }
    scenariosScanned = i + 1;
  }
  const counts = {} as RegretTailCounts;
  for (const threshold of ADVERSARIAL_REGRET_TAIL_THRESHOLDS) {
    counts[threshold] = regrets.filter((r) => r >= threshold).length;
  }
  return { scenariosScanned, counts };
}
