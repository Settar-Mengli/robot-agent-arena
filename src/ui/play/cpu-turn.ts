import { createGreedySelector } from "../../agent/baselines/greedy";
import { stepBattle } from "../../engine";
import type { PlayTurnFn } from "../store/battle-view";

/**
 * Browser-safe greedy CPU turn: `stepBattle` + `createGreedySelector` from the
 * live runtime's `session.cpu` (never a captured/stale opponent config).
 */
export function createGreedyPlayTurn(): PlayTurnFn {
  return async (runtime, playerSkillId) => {
    const select = createGreedySelector(runtime.session.cpu);
    return { step: stepBattle(runtime, playerSkillId, select) };
  };
}
