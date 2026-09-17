import type { BattleOutcome, BattleRuntime, SkillId } from "../engine";
import {
  determineHealthOutcome,
  determineTurnLimitOutcome,
  isBattleOver,
  stepBattle
} from "../engine";
import type { PlayerPolicy } from "./policies";

/**
 * Exact best-response oracle vs a fixed, known player policy.
 * This is NOT a game-theoretic equilibrium — the player does not adapt.
 *
 * RNG is irrelevant under full CPU injection: stepBattle only advances RNG
 * via selectSimulationSkillId when the selector is omitted; with an injected
 * selector, memo keys need only {turn, player, cpu}.
 */

export type BestResponseOptions = {
  maxNodes?: number;
  /** Shared memo for value-of-state within a scenario walk. */
  memo?: Map<string, number>;
};

export type BestResponseResult = {
  exact: boolean;
  values: Record<SkillId, number>;
  best: SkillId[];
  nodes: number;
};

const DEFAULT_MAX_NODES = 200_000;

function resolveOutcome(runtime: BattleRuntime): BattleOutcome {
  const fromTurn = runtime.turns[runtime.turns.length - 1]?.outcome;
  if (fromTurn !== undefined) {
    return fromTurn;
  }

  const health = determineHealthOutcome(runtime.player, runtime.cpu);
  if (health !== undefined) {
    return health;
  }

  return determineTurnLimitOutcome(runtime.player, runtime.cpu);
}

function terminalValue(runtime: BattleRuntime): number {
  const outcome = resolveOutcome(runtime);

  let base = 0;
  if (outcome.result === "cpu-victory") {
    base = 1000;
  } else if (outcome.result === "player-victory") {
    base = -1000;
  }

  return base + (runtime.cpu.health - runtime.player.health);
}

function stateKey(runtime: BattleRuntime): string {
  return JSON.stringify({
    turn: runtime.session.turn,
    player: runtime.player,
    cpu: runtime.cpu
  });
}

type SearchCtx = {
  playerPolicy: PlayerPolicy;
  maxNodes: number;
  memo: Map<string, number>;
  nodes: number;
  exact: boolean;
};

function valueOfState(runtime: BattleRuntime, ctx: SearchCtx): number {
  if (isBattleOver(runtime.session)) {
    return terminalValue(runtime);
  }

  const key = stateKey(runtime);
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
  const cpuSkills = runtime.session.cpu.skillIds;
  let best = -Infinity;

  for (const cpuSkillId of cpuSkills) {
    const { runtime: next } = stepBattle(
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
  const memo = options.memo ?? new Map<string, number>();
  const ctx: SearchCtx = {
    playerPolicy,
    maxNodes,
    memo,
    nodes: 0,
    exact: true
  };

  const values: Record<SkillId, number> = {};
  const cpuSkills = runtime.session.cpu.skillIds;

  for (const cpuSkillId of cpuSkills) {
    ctx.nodes += 1;
    if (ctx.nodes > maxNodes) {
      ctx.exact = false;
      values[cpuSkillId] = 0;
      continue;
    }

    const { runtime: next } = stepBattle(
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
