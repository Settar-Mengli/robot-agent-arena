import {
  determineHealthOutcome,
  determineTurnLimitOutcome,
  findSkillDefinition,
  isBattleOver,
  MVP_SKILL_CATALOG,
  startBattle,
  stepBattle,
  type AgentConfig,
  type BattleOutcome,
  type BattleRuntime,
  type CombatantSide,
  type Seed,
  type SelectCpuSkillId,
  type SkillId
} from "../engine";
import type { Environment } from "./types";

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
  const hpDiff = runtime.cpu.health - runtime.player.health;
  if (!isBattleOver(runtime.session)) {
    return hpDiff;
  }

  const outcome = resolveOutcome(runtime);

  let base = 0;
  if (outcome.result === "cpu-victory") {
    base = 1000;
  } else if (outcome.result === "player-victory") {
    base = -1000;
  }

  return base + hpDiff;
}

function memoStateKey(runtime: BattleRuntime): string {
  return JSON.stringify({
    turn: runtime.session.turn,
    player: runtime.player,
    cpu: runtime.cpu
  });
}

function decisionStateKey(
  runtime: BattleRuntime,
  playerSkillId: SkillId
): string {
  const p = runtime.player;
  const c = runtime.cpu;
  return [
    runtime.session.turn,
    p.health,
    p.energy,
    p.defense,
    c.health,
    c.energy,
    c.defense,
    playerSkillId
  ].join("|");
}

function legalActions(
  state: BattleRuntime,
  side: CombatantSide
): SkillId[] {
  const skillIds = state.session[side].skillIds;
  const energy = side === "player" ? state.player.energy : state.cpu.energy;
  return skillIds.filter((skillId) => {
    const skill = findSkillDefinition(MVP_SKILL_CATALOG, skillId);
    return skill !== undefined && skill.energyCost <= energy;
  });
}

export const robotEnvironment: Environment = {
  start(
    player: AgentConfig,
    cpu: AgentConfig,
    seed: Seed,
    maxTurns?: number
  ): BattleRuntime {
    return startBattle(player, cpu, seed, maxTurns);
  },

  isTerminal(state: BattleRuntime): boolean {
    return isBattleOver(state.session);
  },

  apply(
    state: BattleRuntime,
    playerAction: SkillId,
    cpuSelector?: SelectCpuSkillId
  ) {
    return stepBattle(state, playerAction, cpuSelector);
  },

  equippedActions(
    state: BattleRuntime,
    side: CombatantSide
  ): readonly SkillId[] {
    return state.session[side].skillIds;
  },

  legalActions,

  terminalValue,

  memoStateKey,

  decisionStateKey
};
