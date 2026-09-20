import {
  MVP_SKILL_CATALOG,
  validateAgentConfigInput,
  type AgentConfig
} from "../../engine";

export type AgentConfigDraft = {
  agentId: unknown;
  displayName: unknown;
  modules: unknown;
  skillIds: unknown;
};

export type BuildAgentConfigResult =
  | { ok: true; config: AgentConfig }
  | { ok: false; errors: string[] };

/**
 * Builds a validated AgentConfig by reusing engine validation (no duplicated rules).
 */
export function buildAgentConfig(draft: AgentConfigDraft): BuildAgentConfigResult {
  try {
    const candidate: unknown = draft;
    validateAgentConfigInput(candidate, MVP_SKILL_CATALOG, "agentConfig");
    return { ok: true, config: candidate };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid agent configuration.";
    return { ok: false, errors: [message] };
  }
}
