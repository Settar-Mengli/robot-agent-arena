import {
  DEFAULT_MAX_PROVIDERS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  readNonNegativeIntEnv,
  readPositiveIntEnv,
  resolveActiveProviders
} from "./providers-active";
import type {
  AttemptInfo,
  ChatMessage,
  CompleteChatOptions,
  CompleteChatResult,
  EnvMap,
  ProviderAttemptFailure,
  ResolvedProvider,
  TokenUsage
} from "./types";
import { AllProvidersFailedError } from "./types";
import {
  computeBackoffMs,
  parseRetryAfterMs,
  sleepMs
} from "./rate-limit";

interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: TokenUsage;
}

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function isTransientFailure(reason: string, status?: number): boolean {
  if (status !== undefined && (status === 429 || status >= 500)) {
    return true;
  }
  return (
    reason.includes("network") ||
    reason.includes("timeout") ||
    reason.includes("aborted") ||
    reason.includes("AbortError")
  );
}

/** Fresh read each call — AbortSignal.aborted can change after await. */
function isExternallyAborted(signal: AbortSignal | undefined): boolean {
  return signal !== undefined && signal.aborted;
}

function notifyAttempt(opts: CompleteChatOptions, info: AttemptInfo): void {
  if (opts.onAttempt === undefined) {
    return;
  }
  try {
    opts.onAttempt(info);
  } catch {
    // Hook must never change control flow.
  }
}

async function attemptProvider(
  provider: ResolvedProvider,
  messages: ChatMessage[],
  opts: CompleteChatOptions,
  timeoutMs: number,
  fetchImpl: typeof fetch
): Promise<CompleteChatResult> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const externalSignal = opts.signal;
  const signal =
    externalSignal === undefined
      ? timeoutController.signal
      : AbortSignal.any([timeoutController.signal, externalSignal]);

  const body: Record<string, unknown> = {
    model: provider.model,
    messages
  };
  if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }
  if (opts.json === true) {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetchImpl(chatCompletionsUrl(provider.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        ...(provider.extraHeaders ?? {})
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      throw Object.assign(new Error(`HTTP ${response.status}`), {
        status: response.status,
        ...(retryAfterMs !== undefined ? { retryAfterMs } : {})
      });
    }

    let payload: ChatCompletionsResponse;
    try {
      payload = (await response.json()) as ChatCompletionsResponse;
    } catch {
      throw new Error("unparseable body");
    }

    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("empty content");
    }

    return {
      text,
      provider: provider.name,
      model: provider.model,
      usage: payload.usage
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (isExternallyAborted(externalSignal)) {
        throw new Error("aborted", { cause: error });
      }
      throw new Error("timeout", { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function failureReason(error: unknown): {
  reason: string;
  status?: number;
  retryAfterMs?: number;
} {
  if (error instanceof Error) {
    const status =
      "status" in error && typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : undefined;
    const retryAfterMs =
      "retryAfterMs" in error &&
      typeof (error as { retryAfterMs?: unknown }).retryAfterMs === "number"
        ? (error as { retryAfterMs: number }).retryAfterMs
        : undefined;
    return {
      reason: error.message || "unknown error",
      status,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {})
    };
  }
  return { reason: "unknown error" };
}

/**
 * Multi-provider OpenAI-compatible chat completion with fallback.
 * Does not log API keys or full prompt content.
 */
export async function completeChat(
  messages: ChatMessage[],
  opts: CompleteChatOptions = {}
): Promise<CompleteChatResult> {
  const env: EnvMap = opts.env ?? process.env;
  const fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = opts.timeoutMs ?? readPositiveIntEnv(env, "INFERENCE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const maxProviders =
    opts.maxProviders ?? readPositiveIntEnv(env, "INFERENCE_MAX_PROVIDERS", DEFAULT_MAX_PROVIDERS);
  const maxRetries =
    opts.maxRetries ?? readNonNegativeIntEnv(env, "INFERENCE_MAX_RETRIES", DEFAULT_MAX_RETRIES);
  const externalSignal = opts.signal;

  const providers = resolveActiveProviders(env).slice(0, maxProviders);
  if (providers.length === 0) {
    if (isExternallyAborted(externalSignal)) {
      throw new AllProvidersFailedError([
        { provider: "(none)", reason: "aborted" }
      ]);
    }
    throw new AllProvidersFailedError([
      { provider: "(none)", reason: "no providers with required env vars configured" }
    ]);
  }

  if (isExternallyAborted(externalSignal)) {
    throw new AllProvidersFailedError([
      { provider: "(none)", reason: "aborted" }
    ]);
  }

  const failures: ProviderAttemptFailure[] = [];

  for (const provider of providers) {
    if (isExternallyAborted(externalSignal)) {
      failures.push({ provider: provider.name, model: provider.model, reason: "aborted" });
      throw new AllProvidersFailedError(failures);
    }

    let lastReason = "unknown error";
    let lastStatus: number | undefined;
    let lastDurationMs: number | undefined;
    let lastAttempt = 0;
    const attempts = 1 + maxRetries;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (isExternallyAborted(externalSignal)) {
        failures.push({
          provider: provider.name,
          model: provider.model,
          attempt: attempt + 1,
          reason: "aborted"
        });
        throw new AllProvidersFailedError(failures);
      }

      const attemptNumber = attempt + 1;
      const started = performance.now();
      try {
        const result = await attemptProvider(provider, messages, opts, timeoutMs, fetchImpl);
        const durationMs = performance.now() - started;
        notifyAttempt(opts, {
          provider: provider.name,
          model: provider.model,
          attempt: attemptNumber,
          ok: true,
          durationMs
        });
        return result;
      } catch (error) {
        const durationMs = performance.now() - started;
        const { reason, status, retryAfterMs } = failureReason(error);
        lastReason = reason;
        lastStatus = status;
        lastDurationMs = durationMs;
        lastAttempt = attemptNumber;

        notifyAttempt(opts, {
          provider: provider.name,
          model: provider.model,
          attempt: attemptNumber,
          ok: false,
          durationMs,
          status,
          reason
        });

        if (isExternallyAborted(externalSignal)) {
          failures.push({
            provider: provider.name,
            model: provider.model,
            attempt: attemptNumber,
            status,
            durationMs,
            reason: "aborted"
          });
          throw new AllProvidersFailedError(failures);
        }

        const canRetry =
          attempt < maxRetries &&
          !isExternallyAborted(externalSignal) &&
          isTransientFailure(reason, status);
        if (!canRetry) {
          break;
        }
        const backoff = computeBackoffMs(attempt, {
          retryAfterMs,
          random: opts.random
        });
        await sleepMs(backoff, opts.sleep);
      }
    }

    failures.push({
      provider: provider.name,
      model: provider.model,
      attempt: lastAttempt > 0 ? lastAttempt : undefined,
      status: lastStatus,
      durationMs: lastDurationMs,
      reason: lastReason
    });
  }

  throw new AllProvidersFailedError(failures);
}
