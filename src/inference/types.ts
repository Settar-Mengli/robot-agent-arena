export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompleteChatOptions {
  json?: boolean;
  temperature?: number;
  timeoutMs?: number;
  maxProviders?: number;
  maxRetries?: number;
  /** Override process.env (tests). */
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /** Override fetch (tests). */
  fetch?: typeof fetch;
}

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface CompleteChatResult {
  text: string;
  provider: string;
  model: string;
  usage?: TokenUsage;
}

export interface ProviderAttemptFailure {
  provider: string;
  reason: string;
}

export class AllProvidersFailedError extends Error {
  readonly failures: ProviderAttemptFailure[];

  constructor(failures: ProviderAttemptFailure[]) {
    const summary = failures
      .map((failure) => `${failure.provider}: ${failure.reason}`)
      .join("; ");
    super(`All providers failed: ${summary}`);
    this.name = "AllProvidersFailedError";
    this.failures = failures;
  }
}

/** Resolved, ready-to-call provider (secrets resolved; never log apiKey). */
export interface ResolvedProvider {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  extraHeaders?: Record<string, string>;
}

export type EnvMap = NodeJS.ProcessEnv | Record<string, string | undefined>;
