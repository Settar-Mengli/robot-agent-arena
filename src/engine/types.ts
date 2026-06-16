import { AGENT_MODULES } from "./constants";

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

export interface SkillDefinition {
  skillId: SkillId;
  displayName: string;
  module: AgentModule;
  summary: string;
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
