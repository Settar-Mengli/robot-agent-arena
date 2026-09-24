/**
 * Shared OpenRouter provider template + inference defaults.
 * Imported by providers.ts (Node) and providers.browser.ts (Vite client)
 * so the two cannot diverge on OpenRouter fields.
 */
import type { EnvMap } from "./types";

export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_PROVIDERS = 3;
export const DEFAULT_MAX_RETRIES = 1;

export function readEnv(env: EnvMap, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export type OpenRouterTemplate = {
  name: "openrouter";
  defaultModel: string;
  requiredEnvVars: readonly string[];
  apiKeyEnvVar: string;
  buildBaseUrl: (env: EnvMap) => string | null;
  extraHeaders: (env: EnvMap) => Record<string, string> | undefined;
};

export const OPENROUTER_TEMPLATE: OpenRouterTemplate = {
  name: "openrouter",
  defaultModel: "openai/gpt-oss-20b:free",
  requiredEnvVars: ["OPENROUTER_API_KEY"],
  apiKeyEnvVar: "OPENROUTER_API_KEY",
  buildBaseUrl: () => "https://openrouter.ai/api/v1",
  extraHeaders: (env) => {
    const headers: Record<string, string> = {};
    const referer = readEnv(env, "OPENROUTER_HTTP_REFERER");
    const title = readEnv(env, "OPENROUTER_X_TITLE");
    if (referer !== undefined) {
      headers["HTTP-Referer"] = referer;
    }
    if (title !== undefined) {
      headers["X-Title"] = title;
    }
    return Object.keys(headers).length > 0 ? headers : undefined;
  }
};
