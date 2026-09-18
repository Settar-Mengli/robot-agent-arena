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
import { bestResponse } from "./oracle";
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
