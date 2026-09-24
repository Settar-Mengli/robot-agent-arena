/**
 * Browser-only provider table for the Vite client build.
 * OpenRouter is the only Arena BYOK path — other provider base URLs must not
 * appear in dist. Node recorder keeps src/inference/providers.ts unchanged.
 */
import type { EnvMap, ResolvedProvider } from "./types";

export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_PROVIDERS = 3;
export const DEFAULT_MAX_RETRIES = 1;

const DEFAULT_ORDER = ["openrouter"] as const;

type ProviderName = (typeof DEFAULT_ORDER)[number];

interface ProviderTemplate {
  name: ProviderName;
  defaultModel: string;
  requiredEnvVars: readonly string[];
  apiKeyEnvVar: string;
  buildBaseUrl: (env: EnvMap) => string | null;
  extraHeaders?: (env: EnvMap) => Record<string, string> | undefined;
}

function readEnv(env: EnvMap, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function hasAllEnv(env: EnvMap, keys: readonly string[]): boolean {
  return keys.every((key) => readEnv(env, key) !== undefined);
}

function modelEnvKey(name: string): string {
  return `${name.toUpperCase()}_MODEL`;
}

const PROVIDER_TEMPLATES: readonly ProviderTemplate[] = [
  {
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
  }
];

const templateByName = new Map(
  PROVIDER_TEMPLATES.map((template) => [template.name, template])
);

function resolveOrder(env: EnvMap): ProviderName[] {
  const raw = readEnv(env, "INFERENCE_PROVIDER_ORDER");
  if (raw === undefined) {
    return [...DEFAULT_ORDER];
  }

  const names = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

  const known = names.filter((name): name is ProviderName =>
    templateByName.has(name as ProviderName)
  );
  return known.length > 0 ? known : [...DEFAULT_ORDER];
}

/**
 * Returns usable providers in order. Browser build: OpenRouter only.
 */
export function resolveActiveProviders(
  env: EnvMap = process.env
): ResolvedProvider[] {
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
