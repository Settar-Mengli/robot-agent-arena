import type { BattleRuntime, SkillId } from "../engine";
import { robotEnvironment } from "../env";
import type { PlayerPolicy } from "./policies";

/**
 * Exact best-response oracle vs a fixed, known player policy.
 * This is NOT a game-theoretic equilibrium — the player does not adapt.
 *
 * RNG is irrelevant under full CPU injection: apply only advances RNG
 * via selectSimulationSkillId when the selector is omitted; with an injected
 * selector, memo keys need only {turn, player, cpu}.
 *
 * MemoScope is only valid for one (playerPolicy, agents, maxTurns, catalog)
 * combination: sharing a memo across different games silently corrupts values.
 */

/**
 * Shared memo for value-of-state within one scenario walk.
 * Bind once via `identity`; reusing the same object with a different identity throws.
 */
export type MemoScope = {
  identity: string;
  map: Map<string, number>;
};

/** Stable identity string for MemoScope binding (must include numeric maxTurns + catalog). */
export function oracleMemoIdentity(input: {
  playerPolicy: string;
  cpuAgentId: string;
  playerAgentId: string;
  maxTurns: number;
  catalogSkillIds: readonly string[];
}): string {
  return (
    `${input.playerPolicy}|${input.cpuAgentId}|${input.playerAgentId}` +
    `|maxTurns=${input.maxTurns}|catalog=${input.catalogSkillIds.join(",")}`
  );
}

export type BestResponseOptions = {
  maxNodes?: number;
  memo?: MemoScope;
};

export type BestResponseResult = {
  exact: boolean;
  values: Record<SkillId, number>;
  best: SkillId[];
  nodes: number;
};

const DEFAULT_MAX_NODES = 200_000;

/** Tracks the identity first bound to each MemoScope object. */
const boundMemoIdentities = new WeakMap<MemoScope, string>();

function resolveMemoMap(scope: MemoScope | undefined): Map<string, number> {
  if (scope === undefined) {
    return new Map<string, number>();
  }
  const bound = boundMemoIdentities.get(scope);
  if (bound === undefined) {
    boundMemoIdentities.set(scope, scope.identity);
    return scope.map;
  }
  if (bound !== scope.identity) {
    throw new Error(
      `MemoScope reused with different identity: was '${bound}', now '${scope.identity}'. ` +
        "Memo is only valid for one (playerPolicy, agents, maxTurns, catalog) combination."
    );
  }
  return scope.map;
}

type SearchCtx = {
  playerPolicy: PlayerPolicy;
  maxNodes: number;
  memo: Map<string, number>;
  nodes: number;
  exact: boolean;
};

function valueOfState(runtime: BattleRuntime, ctx: SearchCtx): number {
  if (robotEnvironment.isTerminal(runtime)) {
    return robotEnvironment.terminalValue(runtime);
  }

  const key = robotEnvironment.memoStateKey(runtime);
  const cached = ctx.memo.get(key);
  if (cached !== undefined) {
    return cached;
  }

  ctx.nodes += 1;
  if (ctx.nodes > ctx.maxNodes) {
    ctx.exact = false;
    return 0;
  }

  const playerSkillId = ctx.playerPolicy(runtime);
  const cpuSkills = robotEnvironment.equippedActions(runtime, "cpu");
  let best = -Infinity;

  for (const cpuSkillId of cpuSkills) {
    const { runtime: next } = robotEnvironment.apply(
      runtime,
      playerSkillId,
      () => cpuSkillId
    );
    const value = valueOfState(next, ctx);
    if (value > best) {
      best = value;
    }
    if (!ctx.exact) {
      break;
    }
  }

  if (ctx.exact) {
    ctx.memo.set(key, best);
  }
  return best;
}

/**
 * Evaluate each equipped CPU skill at the current decision point
 * (runtime + playerSkillId), then optimal CPU play thereafter vs playerPolicy.
 */
export function bestResponse(
  runtime: BattleRuntime,
  playerSkillId: SkillId,
  playerPolicy: PlayerPolicy,
  options: BestResponseOptions = {}
): BestResponseResult {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const memo = resolveMemoMap(options.memo);
  const ctx: SearchCtx = {
    playerPolicy,
    maxNodes,
    memo,
    nodes: 0,
    exact: true
  };

  const values: Record<SkillId, number> = {};
  const cpuSkills = robotEnvironment.equippedActions(runtime, "cpu");

  for (const cpuSkillId of cpuSkills) {
    ctx.nodes += 1;
    if (ctx.nodes > maxNodes) {
      ctx.exact = false;
      values[cpuSkillId] = 0;
      continue;
    }

    const { runtime: next } = robotEnvironment.apply(
      runtime,
      playerSkillId,
      () => cpuSkillId
    );
    values[cpuSkillId] = valueOfState(next, ctx);
  }

  const entries = Object.entries(values);
  let max = -Infinity;
  for (const [, value] of entries) {
    if (value > max) {
      max = value;
    }
  }

  const best = entries
    .filter(([, value]) => value === max)
    .map(([skillId]) => skillId);

  return {
    exact: ctx.exact,
    values,
    best,
    nodes: ctx.nodes
  };
}

export function regret(
  values: Record<SkillId, number>,
  skillId: SkillId
): number {
  const skillValue = values[skillId];
  if (skillValue === undefined) {
    throw new TypeError(`skillId missing from values: ${skillId}`);
  }
  let max = -Infinity;
  for (const value of Object.values(values)) {
    if (value > max) {
      max = value;
    }
  }
  return max - skillValue;
}
