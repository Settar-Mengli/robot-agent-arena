import { AGENT_MODULES, FALLBACK_ACTION_ID } from "./constants";

export type Seed = number | string;

export type AgentId = string;
export type SkillId = string;

export type AgentModule = (typeof AGENT_MODULES)[number];

export interface AgentModules {
  coreIdentity: string;
  memory: string;
  sigilSecurity: string;
  rules: string;
  strategy: string;
}

export interface AgentConfig {
  agentId: AgentId;
  displayName: string;
  modules: AgentModules;
  skillIds: SkillId[];
}

export interface AttackSkillEffect {
  category: "attack";
  basePower: number;
}

export interface DefenseSkillEffect {
  category: "defense";
  defenseAmount: number;
}

export interface RecoverySkillEffect {
  category: "recovery";
  recoveryAmount: number;
}

export interface DisruptSkillEffect {
  category: "disrupt";
  basePower: number;
  energyDamage: number;
}

export type SkillEffect =
  | AttackSkillEffect
  | DefenseSkillEffect
  | RecoverySkillEffect
  | DisruptSkillEffect;

export type SkillEffectCategory = SkillEffect["category"];

export interface SkillDefinition {
  skillId: SkillId;
  displayName: string;
  module: AgentModule;
  summary: string;
  energyCost: number;
  effect: SkillEffect;
}

export interface SkillCatalog {
  skills: readonly SkillDefinition[];
}

export interface PlayerUseSkillAction {
  type: "use-skill";
  skillId: SkillId;
}

export type PlayerAction = PlayerUseSkillAction;

export type BattleSessionStatus = "awaiting-player-action" | "completed";

export interface BattleSession {
  sessionId: string;
  seed: Seed;
  turn: number;
  maxTurns: number;
  status: BattleSessionStatus;
  player: AgentConfig;
  cpu: AgentConfig;
  lastPlayerAction?: PlayerAction;
}

export type CombatantSide = "player" | "cpu";
export type ResolvedSkillId = SkillId | typeof FALLBACK_ACTION_ID;
export type ResolvedEffectCategory = SkillEffectCategory | "fallback";
export type BattleCompletionReason =
  | "player-health-zero"
  | "cpu-health-zero"
  | "mutual-health-zero"
  | "turn-limit";
export type BattleOutcomeResult = "player-victory" | "cpu-victory" | "draw";

export interface CombatantState {
  side: CombatantSide;
  agentId: AgentId;
  displayName: string;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  defense: number;
}

export interface BattleAction {
  actor: CombatantSide;
  skillId: SkillId;
}

export interface ResolvedAction {
  actor: CombatantSide;
  target: CombatantSide;
  selectedSkillId: SkillId;
  resolvedSkillId: ResolvedSkillId;
  effectCategory: ResolvedEffectCategory;
  fallback: boolean;
  energySpent: number;
  damageDealt: number;
  defenseReduced: number;
  defenseGained: number;
  healthRecovered: number;
  energyRecovered: number;
  energyReduced: number;
}

export interface BattleOutcome {
  result: BattleOutcomeResult;
  reason: BattleCompletionReason;
  winnerSide?: CombatantSide;
  winnerAgentId?: AgentId;
}

export interface TurnRecord {
  turn: number;
  startedPlayer: CombatantState;
  startedCpu: CombatantState;
  actions: ResolvedAction[];
  endedPlayer: CombatantState;
  endedCpu: CombatantState;
  outcome?: BattleOutcome;
}

export interface BattleResult {
  finalSession: BattleSession;
  finalPlayer: CombatantState;
  finalCpu: CombatantState;
  turns: TurnRecord[];
  outcome: BattleOutcome;
  seed: Seed;
  totalTurns: number;
}

export interface BattleRuntime {
  session: BattleSession;
  player: CombatantState;
  cpu: CombatantState;
  rng: RngState;
  turns: TurnRecord[];
}

export interface RngState {
  seed: Seed;
  state: number;
  calls: number;
}

export interface SeededRng {
  nextFloat: () => number;
  nextInt: (maxExclusive: number) => number;
  snapshot: () => RngState;
}
