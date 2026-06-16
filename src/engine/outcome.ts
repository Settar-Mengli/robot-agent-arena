import type { BattleOutcome, CombatantState } from "./types";

function playerVictory(player: CombatantState, reason: BattleOutcome["reason"]): BattleOutcome {
  return {
    result: "player-victory",
    reason,
    winnerSide: "player",
    winnerAgentId: player.agentId
  };
}

function cpuVictory(cpu: CombatantState, reason: BattleOutcome["reason"]): BattleOutcome {
  return {
    result: "cpu-victory",
    reason,
    winnerSide: "cpu",
    winnerAgentId: cpu.agentId
  };
}

function draw(reason: BattleOutcome["reason"]): BattleOutcome {
  return {
    result: "draw",
    reason
  };
}

export function determineHealthOutcome(
  player: CombatantState,
  cpu: CombatantState
): BattleOutcome | undefined {
  const playerDown = player.health <= 0;
  const cpuDown = cpu.health <= 0;

  if (playerDown && cpuDown) {
    return draw("mutual-health-zero");
  }

  if (cpuDown) {
    return playerVictory(player, "cpu-health-zero");
  }

  if (playerDown) {
    return cpuVictory(cpu, "player-health-zero");
  }

  return undefined;
}

export function determineTurnLimitOutcome(
  player: CombatantState,
  cpu: CombatantState
): BattleOutcome {
  if (player.health > cpu.health) {
    return playerVictory(player, "turn-limit");
  }

  if (cpu.health > player.health) {
    return cpuVictory(cpu, "turn-limit");
  }

  if (player.energy > cpu.energy) {
    return playerVictory(player, "turn-limit");
  }

  if (cpu.energy > player.energy) {
    return cpuVictory(cpu, "turn-limit");
  }

  return draw("turn-limit");
}

export function determineBattleOutcome(
  player: CombatantState,
  cpu: CombatantState,
  turn: number,
  maxTurns: number
): BattleOutcome | undefined {
  const healthOutcome = determineHealthOutcome(player, cpu);
  if (healthOutcome !== undefined) {
    return healthOutcome;
  }

  if (turn >= maxTurns) {
    return determineTurnLimitOutcome(player, cpu);
  }

  return undefined;
}
