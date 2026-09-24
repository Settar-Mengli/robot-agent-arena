import type {
  AgentConfig,
  BattleRuntime,
  CombatantSide,
  Seed,
  SelectCpuSkillId,
  SkillId
} from "../engine";

/**
 * Environment contract for the measurement core (D-033 / A3).
 * Robot specialization of the Batch 5 generic `EnvironmentOf` (see contract.ts).
 * Production robot signatures stay concrete BattleRuntime / SkillId (D-037 / D-052).
 */
export type Environment = {
  start: (
    player: AgentConfig,
    cpu: AgentConfig,
    seed: Seed,
    maxTurns?: number
  ) => BattleRuntime;

  isTerminal: (state: BattleRuntime) => boolean;

  apply: (
    state: BattleRuntime,
    playerAction: SkillId,
    cpuSelector?: SelectCpuSkillId
  ) => ReturnType<
    typeof import("../engine").stepBattle
  >;

  /** All equipped skill ids (oracle candidate set — no energy filter). */
  equippedActions: (
    state: BattleRuntime,
    side: CombatantSide
  ) => readonly SkillId[];

  /** Equipped skills affordable at current energy (snapshots / metrics / discriminate). */
  legalActions: (
    state: BattleRuntime,
    side: CombatantSide
  ) => SkillId[];

  terminalValue: (state: BattleRuntime) => number;

  memoStateKey: (state: BattleRuntime) => string;

  decisionStateKey: (
    state: BattleRuntime,
    playerSkillId: SkillId
  ) => string;
};
