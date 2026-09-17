import { createSeededRng, createSeededRngFromState } from "./rng";
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
  BattleOutcome,
  BattleResult,
  BattleRuntime,
  BattleSession,
  CombatantState,
  Seed,
  SeededRng,
  SelectCpuSkillId,
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

export function resolveTurn(params: {
  session: BattleSession;
  player: CombatantState;
  cpu: CombatantState;
  playerSkillId: SkillId;
  selectCpuSkillId: SelectCpuSkillId;
}): {
  session: BattleSession;
  player: CombatantState;
  cpu: CombatantState;
  turnRecord: TurnRecord;
  outcome?: BattleOutcome;
} {
  let { session, player, cpu } = params;
  const { playerSkillId, selectCpuSkillId } = params;

  const turn = session.turn;
  const startedPlayer = player;
  const startedCpu = cpu;
  const actions = [];

  session = submitPlayerAction(session, playerSkillId);

  const playerAction: BattleAction = {
    actor: "player",
    skillId: playerSkillId
  };
  const resolvedPlayerAction = resolveAction(player, cpu, playerAction, session.player);
  player = resolvedPlayerAction.actor;
  cpu = resolvedPlayerAction.target;
  actions.push(resolvedPlayerAction.resolvedAction);

  let outcome = determineHealthOutcome(player, cpu);

  if (outcome === undefined) {
    const cpuSkillId = selectCpuSkillId(cpu, player);
    const cpuAction: BattleAction = {
      actor: "cpu",
      skillId: cpuSkillId
    };
    const resolvedCpuAction = resolveAction(cpu, player, cpuAction, session.cpu);
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

  const turnRecord: TurnRecord = {
    turn,
    startedPlayer,
    startedCpu,
    actions,
    endedPlayer: player,
    endedCpu: cpu,
    outcome
  };

  if (outcome !== undefined) {
    session = finalizeBattle(session);
  } else {
    session = advanceBattleTurn(session);
  }

  return {
    session,
    player,
    cpu,
    turnRecord,
    outcome
  };
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
    const playerSkillId = selectSimulationSkillId(session.player, player, rng);
    const turnResult = resolveTurn({
      session,
      player,
      cpu,
      playerSkillId,
      selectCpuSkillId: (cpuState) =>
        selectSimulationSkillId(session.cpu, cpuState, rng)
    });

    session = turnResult.session;
    player = turnResult.player;
    cpu = turnResult.cpu;
    turns.push(turnResult.turnRecord);

    if (turnResult.outcome !== undefined) {
      return {
        finalSession: session,
        finalPlayer: player,
        finalCpu: cpu,
        turns,
        outcome: turnResult.outcome,
        seed,
        totalTurns: turns.length
      };
    }
  }

  throw new Error("resolveBattle reached a completed session without an outcome.");
}

export function startBattle(
  configA: AgentConfig,
  configB: AgentConfig,
  seed: Seed,
  maxTurns?: number
): BattleRuntime {
  const session = initBattle(configA, configB, seed, maxTurns);

  return {
    session,
    player: createInitialCombatantState(configA, "player"),
    cpu: createInitialCombatantState(configB, "cpu"),
    rng: createSeededRng(seed).snapshot(),
    turns: []
  };
}

export function stepBattle(
  runtime: BattleRuntime,
  playerSkillId: SkillId,
  selectCpuSkillId?: SelectCpuSkillId
): {
  runtime: BattleRuntime;
  turnRecord: TurnRecord;
  outcome?: BattleOutcome;
} {
  const rng = createSeededRngFromState(runtime.rng);
  const turnResult = resolveTurn({
    session: runtime.session,
    player: runtime.player,
    cpu: runtime.cpu,
    playerSkillId,
    selectCpuSkillId:
      selectCpuSkillId ??
      ((cpuState) => selectSimulationSkillId(runtime.session.cpu, cpuState, rng))
  });

  return {
    runtime: {
      session: turnResult.session,
      player: turnResult.player,
      cpu: turnResult.cpu,
      rng: rng.snapshot(),
      turns: [...runtime.turns, turnResult.turnRecord]
    },
    turnRecord: turnResult.turnRecord,
    outcome: turnResult.outcome
  };
}
