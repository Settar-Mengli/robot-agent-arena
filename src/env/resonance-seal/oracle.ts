import {
  applySealAction,
  isSealTerminal,
  sealEquippedActions,
  sealLegalActions,
  sealMemoStateKey,
  sealTerminalValue
} from "./dynamics";
import type { SealActionId, SealOracleResult, SealState } from "./types";

const NEG_INF = -1e12;

/**
 * Exact best-response values vs the fixed vault script (not an equilibrium).
 */
export function sealBestResponse(state: SealState): SealOracleResult {
  const memo = new Map<string, number>();

  function valueOf(s: SealState): number {
    if (isSealTerminal(s)) {
      return sealTerminalValue(s);
    }
    const key = sealMemoStateKey(s);
    const hit = memo.get(key);
    if (hit !== undefined) {
      return hit;
    }
    let best = NEG_INF;
    const legal = sealLegalActions(s);
    for (const action of legal) {
      const next = applySealAction(s, action);
      best = Math.max(best, valueOf(next));
    }
    if (legal.length === 0) {
      best = sealTerminalValue({ ...s, turn: s.maxTurns + 1 });
    }
    memo.set(key, best);
    return best;
  }

  const values = {} as Record<SealActionId, number>;
  const equipped = sealEquippedActions(state);
  for (const action of equipped) {
    if (!sealLegalActions(state).includes(action)) {
      values[action] = NEG_INF;
      continue;
    }
    values[action] = valueOf(applySealAction(state, action));
  }

  let max = NEG_INF;
  for (const action of equipped) {
    if (values[action] > max) {
      max = values[action];
    }
  }
  const best = equipped.filter((a) => values[a] === max && values[a] > NEG_INF / 2);
  return { values, best, exact: true };
}

export function sealRegret(
  values: Record<SealActionId, number>,
  action: SealActionId
): number {
  const v = values[action];
  if (v === undefined || !Number.isFinite(v) || v <= NEG_INF / 2) {
    return Number.POSITIVE_INFINITY;
  }
  let max = NEG_INF;
  for (const key of Object.keys(values) as SealActionId[]) {
    const x = values[key]!;
    if (x > max && x > NEG_INF / 2) {
      max = x;
    }
  }
  return max - v;
}
