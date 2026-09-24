import { MVP_SKILL_CATALOG, stepBattle } from "../engine";
import type { BattleRuntime, SkillId } from "../engine";
import {
  AllProvidersFailedError,
  completeChat,
  type AttemptInfo
} from "../inference";
import { computeGroundedFacts, computeGroundedFactsV2 } from "./grounding";
import type { AnyGroundedFacts } from "./grounding";
import { summarizePlayerTendencies } from "./memory";
import type { PlayerTendencies } from "./memory";
import { observePostPlayerState } from "./observe";
import {
  buildAgentMessagesBatch4 as buildAgentMessages,
  resolvePromptVersionBatch4 as resolvePromptVersion
} from "./prompt-batch4";
import type {
  DecisionTrace,
  PlayAgentTurnOptions,
  PlayAgentTurnResult,
  ValidationResult
} from "./types";
import { validateAgentResponse } from "./validate";

const DEFAULT_BUDGET_MS = 10000;

function cpuActionIds(step: PlayAgentTurnResult["step"]): {
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
): Promise<PlayAgentTurnResult> {
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const now = options.now ?? (() => performance.now());
  const catalog = options.catalog ?? MVP_SKILL_CATALOG;
  const started = now();
  const attempts: AttemptInfo[] = [];

  const observation = observePostPlayerState(runtime, playerSkillId);

  let groundedFacts: AnyGroundedFacts | undefined;
  if (options.grounding === "facts" && observation !== null) {
    groundedFacts = computeGroundedFacts(
      observation,
      runtime.session.cpu,
      runtime.session.player.skillIds,
      runtime.session.turn,
      runtime.session.maxTurns,
      catalog
    );
  } else if (options.grounding === "facts-v2" && observation !== null) {
    groundedFacts = computeGroundedFactsV2(
      observation,
      runtime.session.cpu,
      runtime.session.player.skillIds,
      runtime.session.turn,
      runtime.session.maxTurns,
      catalog
    );
  }

  let playerTendencies: PlayerTendencies | undefined;
  if (options.memory === "match") {
    playerTendencies = summarizePlayerTendencies(runtime);
  }

  const responseFormat = options.responseFormat ?? "json";
  const useJson = options.json ?? responseFormat !== "freetext";

  const promptVersion = resolvePromptVersion({
    grounding: groundedFacts,
    memory: playerTendencies,
    responseFormat,
    promptVariant: options.promptVariant
  });

  const baseTrace = (): Pick<
    DecisionTrace,
    | "promptVersion"
    | "turn"
    | "budgetMs"
    | "elapsedMs"
    | "attempts"
    | "groundedFacts"
    | "playerTendencies"
  > => ({
    promptVersion,
    turn: runtime.session.turn,
    budgetMs,
    elapsedMs: now() - started,
    attempts: [...attempts],
    groundedFacts,
    playerTendencies
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
    grounding: groundedFacts,
    memory: playerTendencies,
    responseFormat,
    promptVariant: options.promptVariant,
    snapshotId: options.snapshotId,
    playerSkillIds: runtime.session.player.skillIds
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
      json: useJson,
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
      catalog,
      { allowFreeText: responseFormat === "freetext" }
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
