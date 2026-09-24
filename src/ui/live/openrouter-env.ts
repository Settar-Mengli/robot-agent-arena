import type { EnvMap } from "../../inference";

/**
 * Build an in-memory EnvMap for OpenRouter BYOK.
 * NEVER reads process.env — key and referer come only from caller args.
 */
export function buildOpenRouterEnv(opts: {
  apiKey: string;
  modelId: string;
  origin?: string;
}): EnvMap {
  const origin =
    opts.origin ??
    (typeof globalThis.location?.origin === "string"
      ? globalThis.location.origin
      : "https://localhost");

  return {
    OPENROUTER_API_KEY: opts.apiKey,
    OPENROUTER_MODEL: opts.modelId,
    INFERENCE_PROVIDER_ORDER: "openrouter",
    INFERENCE_MAX_PROVIDERS: "1",
    INFERENCE_MAX_RETRIES: "0",
    OPENROUTER_HTTP_REFERER: origin,
    OPENROUTER_X_TITLE: "robot-agent-arena"
  };
}
