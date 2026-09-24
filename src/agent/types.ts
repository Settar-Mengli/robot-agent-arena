import type { AttemptInfo, ChatMessage, CompleteChatOptions, TokenUsage } from "../inference";
import type { CombatantState, SkillCatalog, SkillId } from "../engine";
import type { AnyGroundedFacts } from "./grounding";
import type { PlayerTendencies } from "./memory";

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
  /** Default "off" — must stay off for fixture-compatible prompts. */
  grounding?: "off" | "facts" | "facts-v2";
  /** Default "off" — per-match tendencies from runtime.turns. */
  memory?: "off" | "match";
  /**
   * Default true (JSON response_format). Set false for free-text variant
   * (agent-v5-freetext) — changes fixture keys via response_format absence.
   */
  json?: boolean;
  /** When "freetext", uses agent-v5-freetext prompt bytes (not agent-v1). */
  responseFormat?: "json" | "freetext";
  /**
   * Batch 4 robustness arms. Absent/"default" keeps agent-v1 path bytes.
   * "base-repeat" is message-identical to base (distinct fixture via setRepeat).
   */
  promptVariant?:
    | "default"
    | "base-repeat"
    | "perturb"
    | "advctx"
    | "info-partial";
  /** Snapshot id for deterministic perturb option shuffle. */
  snapshotId?: string;
}

export interface DecisionTrace {
  promptVersion: string;
  turn: number;
  budgetMs: number;
  elapsedMs: number;
  observation: { cpu: CombatantState; player: CombatantState } | null;
  messages: ChatMessage[];
  attempts: AttemptInfo[];
  groundedFacts?: AnyGroundedFacts;
  playerTendencies?: PlayerTendencies;
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

/** Named result of `playAgentTurn` — `step` tracks `stepBattle`'s return shape. */
export type PlayAgentTurnResult = {
  step: ReturnType<typeof import("../engine").stepBattle>;
  trace: DecisionTrace;
};
