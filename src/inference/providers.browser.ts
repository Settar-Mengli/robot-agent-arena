/**
 * Browser-only provider table for the Vite client build.
 * OpenRouter is the only Arena BYOK path — other provider base URLs must not
 * appear in dist. Node recorder keeps src/inference/providers.ts unchanged.
 */
import type { EnvMap, ResolvedProvider } from "./types";
import {
  DEFAULT_MAX_PROVIDERS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  OPENROUTER_TEMPLATE,
  readEnv
} from "./openrouter-template";

export { DEFAULT_TIMEOUT_MS, DEFAULT_MAX_PROVIDERS, DEFAULT_MAX_RETRIES };

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

function hasAllEnv(env: EnvMap, keys: readonly string[]): boolean {
  return keys.every((key) => readEnv(env, key) !== undefined);
}

function modelEnvKey(name: string): string {
  return `${name.toUpperCase()}_MODEL`;
}

const PROVIDER_TEMPLATES: readonly ProviderTemplate[] = [OPENROUTER_TEMPLATE];

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
