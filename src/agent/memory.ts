import type { BattleRuntime, SkillId } from "../engine";
import { LOW_HEALTH_RATIO } from "./baselines/greedy";

/**
 * Per-match player tendency summary derived only from `runtime.turns`.
 * Low-health uses the same LOW_HEALTH_RATIO (0.4) as the greedy baseline —
 * shared definition of "CPU is low".
 */

export type PlayerTendencies = {
  turnsObserved: number;
  skillCounts: Record<string, number>;
  mostFrequentSkillId: SkillId | null;
  lastTwoMoves: SkillId[];
  attacksWhileCpuLowHealth: number;
  lowHealthRatio: typeof LOW_HEALTH_RATIO;
};

function emptyTendencies(): PlayerTendencies {
  return {
    turnsObserved: 0,
    skillCounts: {},
    mostFrequentSkillId: null,
    lastTwoMoves: [],
    attacksWhileCpuLowHealth: 0,
    lowHealthRatio: LOW_HEALTH_RATIO
  };
}

function isAttackCategory(category: string): boolean {
  return category === "attack" || category === "disrupt";
}

/**
 * Summarize player skill usage so far this match. Pure: no RNG, clock, or mutation.
 */
export function summarizePlayerTendencies(runtime: BattleRuntime): PlayerTendencies {
  const turns = runtime.turns;
  if (turns.length === 0) {
    return emptyTendencies();
  }

  const skillCounts: Record<string, number> = {};
  const moveOrder: SkillId[] = [];
  let attacksWhileCpuLowHealth = 0;

  for (const turn of turns) {
    const playerAction = turn.actions.find((action) => action.actor === "player");
    if (playerAction === undefined) {
      continue;
    }
    const skillId = playerAction.selectedSkillId;
    skillCounts[skillId] = (skillCounts[skillId] ?? 0) + 1;
    moveOrder.push(skillId);

    const cpuHealth = turn.startedCpu.health;
    const low =
      cpuHealth <= Math.floor(turn.startedCpu.maxHealth * LOW_HEALTH_RATIO);
    if (low && isAttackCategory(playerAction.effectCategory)) {
      attacksWhileCpuLowHealth += 1;
    }
  }

  const sortedIds = Object.keys(skillCounts).sort((a, b) => {
    const diff = skillCounts[b]! - skillCounts[a]!;
    if (diff !== 0) {
      return diff;
    }
    return a.localeCompare(b);
  });

  const lastTwoMoves =
    moveOrder.length <= 2 ? [...moveOrder] : moveOrder.slice(-2);

  return {
    turnsObserved: turns.length,
    skillCounts,
    mostFrequentSkillId: (sortedIds[0] as SkillId | undefined) ?? null,
    lastTwoMoves,
    attacksWhileCpuLowHealth,
    lowHealthRatio: LOW_HEALTH_RATIO
  };
}
