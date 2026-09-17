import {
  DEFAULT_MAX_PROVIDERS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  readNonNegativeIntEnv,
  readPositiveIntEnv,
  resolveActiveProviders
} from "./providers";
import type {
  ChatMessage,
  CompleteChatOptions,
  CompleteChatResult,
  EnvMap,
  ProviderAttemptFailure,
  ResolvedProvider,
  TokenUsage
} from "./types";
import { AllProvidersFailedError } from "./types";

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

async function attemptProvider(
  provider: ResolvedProvider,
  messages: ChatMessage[],
  opts: CompleteChatOptions,
  timeoutMs: number,
  fetchImpl: typeof fetch
): Promise<CompleteChatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

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
      signal: controller.signal
    });

    if (!response.ok) {
      throw Object.assign(new Error(`HTTP ${response.status}`), {
        status: response.status
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
      throw new Error("timeout", { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function failureReason(error: unknown): { reason: string; status?: number } {
  if (error instanceof Error) {
    const status =
      "status" in error && typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : undefined;
    return { reason: error.message || "unknown error", status };
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

  const providers = resolveActiveProviders(env).slice(0, maxProviders);
  if (providers.length === 0) {
    throw new AllProvidersFailedError([
      { provider: "(none)", reason: "no providers with required env vars configured" }
    ]);
  }

  const failures: ProviderAttemptFailure[] = [];

  for (const provider of providers) {
    let lastReason = "unknown error";
    const attempts = 1 + maxRetries;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await attemptProvider(provider, messages, opts, timeoutMs, fetchImpl);
      } catch (error) {
        const { reason, status } = failureReason(error);
        lastReason = reason;

        const canRetry = attempt < maxRetries && isTransientFailure(reason, status);
        if (!canRetry) {
          break;
        }
      }
    }

    failures.push({ provider: provider.name, reason: lastReason });
  }

  throw new AllProvidersFailedError(failures);
}
