import { MVP_SKILL_CATALOG, stepBattle } from "../engine";
import type { BattleRuntime, SkillId } from "../engine";
import {
  AllProvidersFailedError,
  completeChat,
  type AttemptInfo
} from "../inference";
import { computeGroundedFacts } from "./grounding";
import type { GroundedFacts } from "./grounding";
import { observePostPlayerState } from "./observe";
import {
  buildAgentMessages,
  resolvePromptVersion
} from "./prompt";
import type {
  DecisionTrace,
  PlayAgentTurnOptions,
  ValidationResult
} from "./types";
import { validateAgentResponse } from "./validate";

const DEFAULT_BUDGET_MS = 10000;

function cpuActionIds(step: ReturnType<typeof stepBattle>): {
  executedSkillId?: SkillId;
  resolvedSkillId?: string;
} {
  const cpuAction = step.turnRecord.actions.find((action) => action.actor === "cpu");
  if (cpuAction === undefined) {
    return {};
  }
  return {
    executedSkillId: cpuAction.selectedSkillId,
    resolvedSkillId: cpuAction.resolvedSkillId
  };
}

export async function playAgentTurn(
  runtime: BattleRuntime,
  playerSkillId: SkillId,
  options: PlayAgentTurnOptions = {}
): Promise<{ step: ReturnType<typeof stepBattle>; trace: DecisionTrace }> {
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const now = options.now ?? (() => performance.now());
  const catalog = options.catalog ?? MVP_SKILL_CATALOG;
  const started = now();
  const attempts: AttemptInfo[] = [];

  const observation = observePostPlayerState(runtime, playerSkillId);

  let groundedFacts: GroundedFacts | undefined;
  if (options.grounding === "facts" && observation !== null) {
    groundedFacts = computeGroundedFacts(
      observation,
      runtime.session.cpu,
      runtime.session.player.skillIds,
      runtime.session.turn,
      runtime.session.maxTurns,
      catalog
    );
  }

  const promptVersion = resolvePromptVersion({ grounding: groundedFacts });

  const baseTrace = (): Pick<
    DecisionTrace,
    "promptVersion" | "turn" | "budgetMs" | "elapsedMs" | "attempts" | "groundedFacts"
  > => ({
    promptVersion,
    turn: runtime.session.turn,
    budgetMs,
    elapsedMs: now() - started,
    attempts: [...attempts],
    groundedFacts
  });

  if (observation === null) {
    const step = stepBattle(runtime, playerSkillId);
    const ids = cpuActionIds(step);
    const trace: DecisionTrace = {
      ...baseTrace(),
      elapsedMs: now() - started,
      observation: null,
      messages: [],
      source: "skipped",
      ...ids
    };
    return { step, trace };
  }

  const messages = buildAgentMessages({
    turn: runtime.session.turn,
    maxTurns: runtime.session.maxTurns,
    observation,
    cpuConfig: runtime.session.cpu,
    catalog,
    grounding: groundedFacts
  });

  const budgetSignal = AbortSignal.timeout(budgetMs);
  const combined =
    options.signal === undefined
      ? budgetSignal
      : AbortSignal.any([budgetSignal, options.signal]);

  const inference = options.inference ?? {};

  try {
    const result = await completeChat(messages, {
      ...inference,
      json: true,
      temperature: inference.temperature ?? 0,
      signal: combined,
      onAttempt: (info) => {
        attempts.push(info);
      }
    });

    const validation: ValidationResult = validateAgentResponse(
      result.text,
      runtime.session.cpu.skillIds,
      observation.cpu.energy,
      catalog
    );

    if (validation.ok) {
      const step = stepBattle(runtime, playerSkillId, () => validation.skillId);
      const ids = cpuActionIds(step);
      const trace: DecisionTrace = {
        ...baseTrace(),
        elapsedMs: now() - started,
        observation,
        messages,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        rawText: result.text,
        validation,
        proposedSkillId: validation.skillId,
        source: "llm",
        ...ids
      };
      return { step, trace };
    }

    const step = stepBattle(runtime, playerSkillId);
    const ids = cpuActionIds(step);
    const trace: DecisionTrace = {
      ...baseTrace(),
      elapsedMs: now() - started,
      observation,
      messages,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      rawText: result.text,
      validation,
      source: "fallback",
      fallbackReason: "invalid_output",
      ...ids
    };
    return { step, trace };
  } catch (error) {
    const step = stepBattle(runtime, playerSkillId);
    const ids = cpuActionIds(step);

    let fallbackReason: DecisionTrace["fallbackReason"] = "all_providers_failed";
    if (budgetSignal.aborted && options.signal?.aborted !== true) {
      fallbackReason = "budget_exceeded";
    } else if (options.signal?.aborted === true) {
      fallbackReason = "cancelled";
    }

    const failures =
      error instanceof AllProvidersFailedError ? error.failures : undefined;

    const trace: DecisionTrace = {
      ...baseTrace(),
      elapsedMs: now() - started,
      observation,
      messages,
      source: "fallback",
      fallbackReason,
      failures,
      ...ids
    };
    return { step, trace };
  }
}
