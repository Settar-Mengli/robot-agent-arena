import { createSeededRng } from "./rng";
import {
  applyTurnEnergyRecovery,
  createInitialCombatantState,
  findSkillDefinition,
  resolveAction
} from "./combat";
import {
  determineBattleOutcome,
  determineHealthOutcome
} from "./outcome";
import {
  advanceBattleTurn,
  finalizeBattle,
  initBattle,
  submitPlayerAction
} from "./session";
import { MVP_SKILL_CATALOG } from "./skills";
import type {
  AgentConfig,
  BattleAction,
  BattleResult,
  CombatantState,
  Seed,
  SeededRng,
  SkillId,
  TurnRecord
} from "./types";

function selectSimulationSkillId(
  agent: AgentConfig,
  combatant: CombatantState,
  rng: SeededRng
): SkillId {
  if (agent.skillIds.length === 0) {
    throw new RangeError("agent.skillIds must contain at least one skill for simulation.");
  }

  const affordableSkillIds = agent.skillIds.filter((skillId) => {
    const skill = findSkillDefinition(MVP_SKILL_CATALOG, skillId);
    return skill !== undefined && skill.energyCost <= combatant.energy;
  });

  if (affordableSkillIds.length > 0) {
    return affordableSkillIds[rng.nextInt(affordableSkillIds.length)];
  }

  return agent.skillIds[0];
}

export function resolveBattle(
  configA: AgentConfig,
  configB: AgentConfig,
  seed: Seed,
  maxTurns?: number
): BattleResult {
  let session = initBattle(configA, configB, seed, maxTurns);
  const rng = createSeededRng(seed);
  let player = createInitialCombatantState(configA, "player");
  let cpu = createInitialCombatantState(configB, "cpu");
  const turns: TurnRecord[] = [];

  while (session.status !== "completed") {
    const turn = session.turn;
    const startedPlayer = player;
    const startedCpu = cpu;
    const actions = [];

    const playerSkillId = selectSimulationSkillId(session.player, player, rng);
    session = submitPlayerAction(session, playerSkillId);

    const playerAction: BattleAction = {
      actor: "player",
      skillId: playerSkillId
    };
    const resolvedPlayerAction = resolveAction(player, cpu, playerAction, configA);
    player = resolvedPlayerAction.actor;
    cpu = resolvedPlayerAction.target;
    actions.push(resolvedPlayerAction.resolvedAction);

    let outcome = determineHealthOutcome(player, cpu);

    if (outcome === undefined) {
      const cpuSkillId = selectSimulationSkillId(session.cpu, cpu, rng);
      const cpuAction: BattleAction = {
        actor: "cpu",
        skillId: cpuSkillId
      };
      const resolvedCpuAction = resolveAction(cpu, player, cpuAction, configB);
      cpu = resolvedCpuAction.actor;
      player = resolvedCpuAction.target;
      actions.push(resolvedCpuAction.resolvedAction);
      outcome = determineHealthOutcome(player, cpu);
    }

    if (outcome === undefined) {
      player = applyTurnEnergyRecovery(player);
      cpu = applyTurnEnergyRecovery(cpu);
      outcome = determineBattleOutcome(player, cpu, turn, session.maxTurns);
    }

    turns.push({
      turn,
      startedPlayer,
      startedCpu,
      actions,
      endedPlayer: player,
      endedCpu: cpu,
      outcome
    });

    if (outcome !== undefined) {
      const finalSession = finalizeBattle(session);
      return {
        finalSession,
        finalPlayer: player,
        finalCpu: cpu,
        turns,
        outcome,
        seed,
        totalTurns: turns.length
      };
    }

    session = advanceBattleTurn(session);
  }

  throw new Error("resolveBattle reached a completed session without an outcome.");
}
