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
  /**
   * External abort (App aborts on Home / Leave / Load).
   * When aborted mid-turn, falls back to greedy without surfacing a notice
   * if `isNoticeCurrent` is false.
   */
  signal?: AbortSignal;
  /** When false, `onNotice` is skipped (stale after clear). */
  isNoticeCurrent?: () => boolean;
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

  function emitNotice(message: string | null): void {
    if (opts.isNoticeCurrent !== undefined && !opts.isNoticeCurrent()) {
      return;
    }
    opts.onNotice?.(message);
  }

  return async (runtime, playerSkillId): Promise<UiTurnResult> => {
    try {
      const result = await playAgentTurn(runtime, playerSkillId, {
        signal: opts.signal,
        inference: {
          env,
          fetch: fetchImpl,
          temperature: 0,
          timeoutMs: 10_000
        }
      });

      if (result.trace.source === "llm") {
        emitNotice(null);
        return { step: result.step, trace: result.trace };
      }

      const notice = mapLiveFailure(result.trace.failures);
      emitNotice(notice);
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
      emitNotice(notice);
      return greedy(runtime, playerSkillId);
    }
  };
}
