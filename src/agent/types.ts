import type { AttemptInfo, ChatMessage, CompleteChatOptions, TokenUsage } from "../inference";
import type { CombatantState, SkillCatalog, SkillId } from "../engine";

export type ValidationOk = {
  ok: true;
  skillId: SkillId;
  reason?: string;
  affordable: boolean;
};

export type ValidationErrorCode =
  | "no_json"
  | "not_object"
  | "missing_skill_id"
  | "skill_id_not_string"
  | "unknown_skill"
  | "not_equipped";

export type ValidationErr = {
  ok: false;
  code: ValidationErrorCode;
  detail: string;
};

export type ValidationResult = ValidationOk | ValidationErr;

export type AgentFallbackReason =
  | "budget_exceeded"
  | "cancelled"
  | "all_providers_failed"
  | "invalid_output";

export type AgentTurnSource = "llm" | "fallback" | "skipped";

export type AgentInferenceOptions = Partial<
  Omit<CompleteChatOptions, "signal" | "json" | "onAttempt">
>;

export interface PlayAgentTurnOptions {
  budgetMs?: number;
  signal?: AbortSignal;
  inference?: AgentInferenceOptions;
  now?: () => number;
  catalog?: SkillCatalog;
}

export interface DecisionTrace {
  promptVersion: string;
  turn: number;
  budgetMs: number;
  elapsedMs: number;
  observation: { cpu: CombatantState; player: CombatantState } | null;
  messages: ChatMessage[];
  attempts: AttemptInfo[];
  provider?: string;
  model?: string;
  usage?: TokenUsage;
  rawText?: string;
  validation?: ValidationResult;
  proposedSkillId?: SkillId;
  executedSkillId?: SkillId;
  resolvedSkillId?: string;
  source: AgentTurnSource;
  fallbackReason?: AgentFallbackReason;
  failures?: Array<{
    provider: string;
    reason: string;
    model?: string;
    attempt?: number;
    status?: number;
    durationMs?: number;
  }>;
}
