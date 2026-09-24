import { playAgentTurn } from "../../agent";
import type { PlayTurnFn, UiTurnResult } from "../store/battle-view";
import { createGreedyPlayTurn } from "../play/cpu-turn";
import { buildOpenRouterEnv } from "./openrouter-env";
import { mapLiveFailure } from "./live-errors";

export type CreateLivePlayTurnOptions = {
  apiKey: string;
  modelId: string;
  /** Injected fetch (tests). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Optional origin override for OPENROUTER_HTTP_REFERER. */
  origin?: string;
  /** Called when live fails (message) or recovers (null). */
  onNotice?: (message: string | null) => void;
};

/**
 * Opt-in live OpenRouter PlayTurnFn.
 * Injects in-memory env only (never process.env). Temperature 0.
 * On failure: greedy fallback via createGreedyPlayTurn + notice.
 */
export function createLivePlayTurn(
  opts: CreateLivePlayTurnOptions
): PlayTurnFn {
  const greedy = createGreedyPlayTurn();
  const env = buildOpenRouterEnv({
    apiKey: opts.apiKey,
    modelId: opts.modelId,
    origin: opts.origin
  });
  const fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);

  return async (runtime, playerSkillId): Promise<UiTurnResult> => {
    const controller = new AbortController();
    try {
      const result = await playAgentTurn(runtime, playerSkillId, {
        signal: controller.signal,
        inference: {
          env,
          fetch: fetchImpl,
          temperature: 0,
          timeoutMs: 10_000
        }
      });

      if (result.trace.source === "llm") {
        opts.onNotice?.(null);
        return { step: result.step, trace: result.trace };
      }

      const notice = mapLiveFailure(result.trace.failures);
      opts.onNotice?.(notice);
      return greedy(runtime, playerSkillId);
    } catch (err) {
      const failures =
        err !== null &&
        typeof err === "object" &&
        "failures" in err &&
        Array.isArray((err as { failures: unknown }).failures)
          ? (err as { failures: Array<{ status?: number; reason?: string }> })
              .failures
          : undefined;
      const notice = mapLiveFailure(failures, err);
      opts.onNotice?.(notice);
      return greedy(runtime, playerSkillId);
    }
  };
}
