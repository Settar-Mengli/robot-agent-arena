import { MAX_TURNS, MVP_SKILL_CATALOG } from "../engine";
import type { BattleRuntime, SkillId } from "../engine";
import { createGreedySelector } from "../agent";
import { robotEnvironment } from "../env";
import { resolvePlayerPolicy } from "./policies";
import { bestResponse, oracleMemoIdentity, regret } from "./oracle";
import { buildMatchSuite, buildMatchSuiteWithSeeds, type EvalSplit, type MatchScenario } from "./scenarios";

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
  targetCount: number;
  count: number;
  /** Must equal `snapshots.length`; asserted at generation and in drift guards. */
  distinctStateCount: number;
  snapshots: DecisionSnapshot[];
  /** Present when count < targetCount after scanning. */
  warning?: string;
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
  distinctStateCount: number;
  snapshots: PivotalDecisionSnapshot[];
  /** Present when count < targetCount after a full scan. */
  warning?: string;
};

export type StakeTailCounts = Record<
  (typeof STAKE_TAIL_THRESHOLDS)[number],
  number
>;

export const ADVERSARIAL_MIN_REGRET = 1;
export const ADVERSARIAL_TARGET_COUNT = 20;
export const ADVERSARIAL_REGRET_TAIL_THRESHOLDS = [1, 100, 500, 1000] as const;

/** D-044: first pass seeds for heldout-ext. */
export const HELDOUT_EXT_SEEDS = Array.from(
  { length: 40 },
  (_, i) => 201 + i
) as readonly number[];

/** D-044: one-time widen if targetCount not met. */
export const HELDOUT_EXT_SEEDS_WIDENED = Array.from(
  { length: 80 },
  (_, i) => 201 + i
) as readonly number[];

export const HELDOUT_EXT_TARGET_COUNT = 40;

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
  distinctStateCount: number;
  snapshots: AdversarialDecisionSnapshot[];
  /** Present when count < targetCount after a full scan. */
  warning?: string;
};

/**
 * Decision-state fingerprint for snapshot dedupe (D-035).
 * Defense is the only mutable non-HP/energy combatant field (no cooldowns in-engine).
 * Implementation lives on the environment adapter (A3).
 */
export const decisionStateKey = robotEnvironment.decisionStateKey.bind(
  robotEnvironment
);

function snapshotDecisionStateKey(snap: DecisionSnapshot): string {
  return decisionStateKey(snap.runtime, snap.playerSkillId);
}

/** Keep highest-ranked (first) instance of each distinct state, up to targetCount. */
export function takeDistinctByState<T extends DecisionSnapshot>(
  ranked: readonly T[],
  targetCount: number
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const snap of ranked) {
    const key = snapshotDecisionStateKey(snap);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(snap);
    if (out.length >= targetCount) {
      break;
    }
  }
  return out;
}

function distinctStateCountAmong(
  snaps: readonly DecisionSnapshot[]
): number {
  return new Set(snaps.map(snapshotDecisionStateKey)).size;
}

export type RegretTailCounts = Record<
  (typeof ADVERSARIAL_REGRET_TAIL_THRESHOLDS)[number],
  number
>;

const TARGET_COUNT = 20;
const INITIAL_SCAN = 12;

function affordableCpuCount(runtime: BattleRuntime): number {
  return robotEnvironment.legalActions(runtime, "cpu").length;
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
    identity: oracleMemoIdentity({
      playerPolicy: scenario.playerPolicy,
      cpuAgentId: scenario.cpuConfig.agentId,
      playerAgentId: scenario.playerConfig.agentId,
      maxTurns: MAX_TURNS,
      catalogSkillIds: MVP_SKILL_CATALOG.skills.map((s) => s.skillId)
    }),
    map: new Map<string, number>()
  };
  const found: DecisionSnapshot[] = [];

  let runtime = robotEnvironment.start(
    scenario.playerConfig,
    scenario.cpuConfig,
    scenario.seed
  );

  while (!robotEnvironment.isTerminal(runtime)) {
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

    runtime = robotEnvironment.apply(runtime, playerSkillId, greedyCpu).runtime;
  }

  return found;
}

/**
 * Stable every-kth walk over sorted candidates, then fill remainder;
 * keep only distinct decision states (D-035). Shortfall does not throw.
 */
function selectEveryKth(
  candidates: DecisionSnapshot[],
  targetCount: number
): {
  snapshots: DecisionSnapshot[];
  count: number;
  warning?: string;
} {
  if (candidates.length === 0) {
    return {
      snapshots: [],
      count: 0,
      warning: `only 0 of ${targetCount} distinct decision states available`
    };
  }

  const k = Math.max(1, Math.floor(candidates.length / Math.max(1, targetCount)));
  const order: DecisionSnapshot[] = [];
  const pushed = new Set<DecisionSnapshot>();
  for (let i = 0; i < candidates.length; i += k) {
    const candidate = candidates[i]!;
    if (!pushed.has(candidate)) {
      order.push(candidate);
      pushed.add(candidate);
    }
  }
  for (const candidate of candidates) {
    if (!pushed.has(candidate)) {
      order.push(candidate);
      pushed.add(candidate);
    }
  }

  const snapshots = takeDistinctByState(order, targetCount);
  const count = snapshots.length;
  if (count < targetCount) {
    return {
      snapshots,
      count,
      warning: `only ${count} of ${targetCount} distinct decision states available`
    };
  }
  return { snapshots, count };
}

/**
 * Bounded snapshot generation: scan until enough DISTINCT decision states exist
 * (or the split is exhausted). Oracle memo is reused within each scenario walk.
 */
export function generateSnapshots(split: EvalSplit): SnapshotSuite {
  const suite = buildMatchSuite(split);
  const candidates: DecisionSnapshot[] = [];
  let scenariosScanned = 0;

  for (let i = 0; i < suite.length; i += 1) {
    const scenario = suite[i]!;
    candidates.push(...collectFromScenario(scenario));
    scenariosScanned = i + 1;

    if (
      scenariosScanned >= INITIAL_SCAN &&
      distinctStateCountAmong(candidates) >= TARGET_COUNT
    ) {
      break;
    }
  }

  // If still short on distinct states, scan the rest of the split.
  if (distinctStateCountAmong(candidates) < TARGET_COUNT) {
    for (let i = scenariosScanned; i < suite.length; i += 1) {
      const scenario = suite[i]!;
      candidates.push(...collectFromScenario(scenario));
      scenariosScanned = i + 1;
      if (distinctStateCountAmong(candidates) >= TARGET_COUNT) {
        break;
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.scenarioId !== b.scenarioId) {
      return a.scenarioId < b.scenarioId ? -1 : 1;
    }
    return a.runtime.session.turn - b.runtime.session.turn;
  });

  const selected = selectEveryKth(candidates, TARGET_COUNT);
  const result: SnapshotSuite = {
    scenariosScanned,
    targetCount: TARGET_COUNT,
    count: selected.count,
    distinctStateCount: selected.count,
    snapshots: selected.snapshots
  };
  if (selected.warning !== undefined) {
    result.warning = selected.warning;
  }
  return result;
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
 * Rank qualifying candidates by spread descending; keep distinct states up to targetCount.
 * Never throws on shortfall — returns all distinct qualifiers and a warning string.
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
  const snapshots = takeDistinctByState(qualified, targetCount);
  const count = snapshots.length;
  if (count < targetCount) {
    return {
      snapshots,
      count,
      warning: `only ${count} of ${targetCount} distinct pivotal states qualified at spread>=${minSpread}`
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
 * ranked by spread, deduped by decision state. Shortfall after full scan does not throw.
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

  const distinctQualified = (): number =>
    distinctStateCountAmong(
      candidates.filter((c) => c.spread >= minSpread)
    );

  for (let i = 0; i < suite.length && i < limit; i += 1) {
    const scenario = suite[i]!;
    for (const snap of collectFromScenario(scenario)) {
      candidates.push(withSpread(snap));
    }
    scenariosScanned = i + 1;

    if (
      options.maxScenarios === undefined &&
      scenariosScanned >= INITIAL_SCAN &&
      distinctQualified() >= targetCount
    ) {
      break;
    }
  }

  // If still short and we stopped early, scan the rest of the split.
  if (
    options.maxScenarios === undefined &&
    distinctQualified() < targetCount
  ) {
    for (let i = scenariosScanned; i < suite.length; i += 1) {
      const scenario = suite[i]!;
      for (const snap of collectFromScenario(scenario)) {
        candidates.push(withSpread(snap));
      }
      scenariosScanned = i + 1;
      if (distinctQualified() >= targetCount) {
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
    distinctStateCount: selected.count,
    snapshots: selected.snapshots
  };
  if (selected.warning !== undefined) {
    result.warning = selected.warning;
  }
  return result;
}

/**
 * Full-split scan: count DISTINCT decision states meeting each stake threshold.
 */
export function countStakeTail(split: EvalSplit): {
  scenariosScanned: number;
  counts: StakeTailCounts;
} {
  const suite = buildMatchSuite(split);
  const bestSpreadByState = new Map<string, number>();
  let scenariosScanned = 0;
  for (let i = 0; i < suite.length; i += 1) {
    for (const snap of collectFromScenario(suite[i]!)) {
      const key = snapshotDecisionStateKey(snap);
      const spread = valueSpread(snap.values);
      const prev = bestSpreadByState.get(key);
      if (prev === undefined || spread > prev) {
        bestSpreadByState.set(key, spread);
      }
    }
    scenariosScanned = i + 1;
  }
  const spreads = [...bestSpreadByState.values()];
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
 * Rank qualifying candidates by greedyRegret descending; keep distinct states up to targetCount.
 * Never throws on shortfall — returns all distinct qualifiers and a warning string.
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
  const snapshots = takeDistinctByState(qualified, targetCount);
  const count = snapshots.length;
  if (count < targetCount) {
    return {
      snapshots,
      count,
      warning: `only ${count} of ${targetCount} distinct adversarial states qualified at greedyRegret>=${minRegret}`
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
    distinctStateCount: selected.count,
    snapshots: selected.snapshots
  };
  if (selected.warning !== undefined) {
    result.warning = selected.warning;
  }
  return result;
}

export type HeldoutExtSuiteMeta = {
  seedBand: "201-240" | "201-280";
  seedsUsed: number;
};

/**
 * Match scenarios for the heldout-ext generator (D-044).
 * Same Cartesian product as `buildMatchSuite("heldout")`, with an explicit seed band.
 * Default seeds are the widened band (201–280) so indexes cover any committed ext suite.
 */
export function buildHeldoutExtMatchSuite(
  seeds: readonly number[] = HELDOUT_EXT_SEEDS_WIDENED
): MatchScenario[] {
  return buildMatchSuiteWithSeeds("heldout", seeds);
}

/**
 * D-044 additive heldout-ext suite: seeds 201–240, target 40; widen once to 201–280.
 * Excludes any decisionStateKey that appears in the standard heldout/dev snapshot suites
 * (leakage guard).
 */
export function generateAdversarialHeldoutExtSnapshots(
  options: {
    minRegret?: number;
    targetCount?: number;
    /** Precomputed forbidden keys; default scans existing generators. */
    forbiddenStateKeys?: ReadonlySet<string>;
  } = {}
): AdversarialSnapshotSuite & HeldoutExtSuiteMeta {
  const minRegret = options.minRegret ?? ADVERSARIAL_MIN_REGRET;
  const targetCount = options.targetCount ?? HELDOUT_EXT_TARGET_COUNT;
  const forbidden =
    options.forbiddenStateKeys ?? collectExistingSuiteStateKeys();

  const tryBand = (
    seeds: readonly number[],
    band: HeldoutExtSuiteMeta["seedBand"]
  ): AdversarialSnapshotSuite & HeldoutExtSuiteMeta => {
    const suite = buildHeldoutExtMatchSuite(seeds);
    const candidates: AdversarialDecisionSnapshot[] = [];
    let scenariosScanned = 0;
    for (let i = 0; i < suite.length; i += 1) {
      for (const snap of collectFromScenario(suite[i]!)) {
        const adv = withAdversarialFields(snap);
        if (forbidden.has(snapshotDecisionStateKey(snap))) {
          continue;
        }
        candidates.push(adv);
      }
      scenariosScanned = i + 1;
    }
    const selected = selectAdversarialSnapshots(candidates, {
      minRegret,
      targetCount
    });
    const result: AdversarialSnapshotSuite & HeldoutExtSuiteMeta = {
      scenariosScanned,
      minRegret,
      targetCount,
      count: selected.count,
      distinctStateCount: selected.count,
      snapshots: selected.snapshots,
      seedBand: band,
      seedsUsed: seeds.length
    };
    if (selected.warning !== undefined) {
      result.warning = selected.warning;
    }
    return result;
  };

  const first = tryBand(HELDOUT_EXT_SEEDS, "201-240");
  if (first.count >= targetCount) {
    return first;
  }
  return tryBand(HELDOUT_EXT_SEEDS_WIDENED, "201-280");
}

function collectExistingSuiteStateKeys(): Set<string> {
  const keys = new Set<string>();
  for (const split of ["dev", "heldout"] as const) {
    for (const snap of generateSnapshots(split).snapshots) {
      keys.add(snapshotDecisionStateKey(snap));
    }
    for (const snap of generatePivotalSnapshots(split).snapshots) {
      keys.add(snapshotDecisionStateKey(snap));
    }
    for (const snap of generateAdversarialSnapshots(split).snapshots) {
      keys.add(snapshotDecisionStateKey(snap));
    }
  }
  return keys;
}

/**
 * Full-split scan: count DISTINCT decision states meeting each greedyRegret threshold.
 */
export function countRegretTail(split: EvalSplit): {
  scenariosScanned: number;
  counts: RegretTailCounts;
} {
  const suite = buildMatchSuite(split);
  const bestRegretByState = new Map<string, number>();
  let scenariosScanned = 0;
  for (let i = 0; i < suite.length; i += 1) {
    for (const snap of collectFromScenario(suite[i]!)) {
      const adv = withAdversarialFields(snap);
      const key = snapshotDecisionStateKey(snap);
      const prev = bestRegretByState.get(key);
      if (prev === undefined || adv.greedyRegret > prev) {
        bestRegretByState.set(key, adv.greedyRegret);
      }
    }
    scenariosScanned = i + 1;
  }
  const regrets = [...bestRegretByState.values()];
  const counts = {} as RegretTailCounts;
  for (const threshold of ADVERSARIAL_REGRET_TAIL_THRESHOLDS) {
    counts[threshold] = regrets.filter((r) => r >= threshold).length;
  }
  return { scenariosScanned, counts };
}
