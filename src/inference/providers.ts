import type { EnvMap, ResolvedProvider } from "./types";
import {
  DEFAULT_MAX_PROVIDERS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  OPENROUTER_TEMPLATE,
  readEnv
} from "./openrouter-template";

export { DEFAULT_TIMEOUT_MS, DEFAULT_MAX_PROVIDERS, DEFAULT_MAX_RETRIES };

const DEFAULT_ORDER = ["groq", "cloudflare", "gemini", "mistral", "openrouter"] as const;

type ProviderName = (typeof DEFAULT_ORDER)[number];

interface ProviderTemplate {
  name: ProviderName;
  defaultModel: string;
  requiredEnvVars: readonly string[];
  apiKeyEnvVar: string;
  buildBaseUrl: (env: EnvMap) => string | null;
  extraHeaders?: (env: EnvMap) => Record<string, string> | undefined;
}

function hasAllEnv(env: EnvMap, keys: readonly string[]): boolean {
  return keys.every((key) => readEnv(env, key) !== undefined);
}

function modelEnvKey(name: string): string {
  return `${name.toUpperCase()}_MODEL`;
}

const PROVIDER_TEMPLATES: readonly ProviderTemplate[] = [
  {
    name: "groq",
    defaultModel: "openai/gpt-oss-20b",
    requiredEnvVars: ["GROQ_API_KEY"],
    apiKeyEnvVar: "GROQ_API_KEY",
    buildBaseUrl: () => "https://api.groq.com/openai/v1"
  },
  {
    name: "cloudflare",
    defaultModel: "@cf/meta/llama-3.1-8b-instruct",
    requiredEnvVars: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
    apiKeyEnvVar: "CLOUDFLARE_API_TOKEN",
    buildBaseUrl: (env) => {
      const accountId = readEnv(env, "CLOUDFLARE_ACCOUNT_ID");
      if (accountId === undefined) {
        return null;
      }
      return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;
    }
  },
  {
    name: "gemini",
    defaultModel: "gemini-3.5-flash-lite",
    requiredEnvVars: ["GEMINI_API_KEY"],
    apiKeyEnvVar: "GEMINI_API_KEY",
    buildBaseUrl: () => "https://generativelanguage.googleapis.com/v1beta/openai/"
  },
  {
    name: "mistral",
    defaultModel: "mistral-small-latest",
    requiredEnvVars: ["MISTRAL_API_KEY"],
    apiKeyEnvVar: "MISTRAL_API_KEY",
    buildBaseUrl: () => "https://api.mistral.ai/v1"
  },
  OPENROUTER_TEMPLATE
];

const templateByName = new Map(PROVIDER_TEMPLATES.map((template) => [template.name, template]));

function resolveOrder(env: EnvMap): ProviderName[] {
  const raw = readEnv(env, "INFERENCE_PROVIDER_ORDER");
  if (raw === undefined) {
    return [...DEFAULT_ORDER];
  }

  const names = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

  const known = names.filter((name): name is ProviderName => templateByName.has(name as ProviderName));
  return known.length > 0 ? known : [...DEFAULT_ORDER];
}

/**
 * Returns usable providers in order. Skips any provider missing a required env var.
 * Never returns api keys into logs — callers must not log ResolvedProvider.apiKey.
 */
export function resolveActiveProviders(env: EnvMap = process.env): ResolvedProvider[] {
  const order = resolveOrder(env);
  const resolved: ResolvedProvider[] = [];

  for (const name of order) {
    const template = templateByName.get(name);
    if (template === undefined) {
      continue;
    }

    if (!hasAllEnv(env, template.requiredEnvVars)) {
      continue;
    }

    const baseUrl = template.buildBaseUrl(env);
    const apiKey = readEnv(env, template.apiKeyEnvVar);
    if (baseUrl === null || apiKey === undefined) {
      continue;
    }

    const modelOverride = readEnv(env, modelEnvKey(template.name));
    resolved.push({
      name: template.name,
      baseUrl: baseUrl.replace(/\/$/, ""),
      model: modelOverride ?? template.defaultModel,
      apiKey,
      extraHeaders: template.extraHeaders?.(env)
    });
  }

  return resolved;
}

export function readPositiveIntEnv(
  env: EnvMap,
  key: string,
  fallback: number
): number {
  const raw = readEnv(env, key);
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Like readPositiveIntEnv, but allows 0 (e.g. INFERENCE_MAX_RETRIES=0). */
export function readNonNegativeIntEnv(
  env: EnvMap,
  key: string,
  fallback: number
): number {
  const raw = readEnv(env, key);
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
