import type { EnvMap } from "../inference";

/** Mirrors inference DEFAULT_ORDER — do not import from providers (scope fence). */
export const KNOWN_PROVIDERS = [
  "groq",
  "cloudflare",
  "gemini",
  "mistral",
  "openrouter"
] as const;

export type KnownProvider = (typeof KNOWN_PROVIDERS)[number];

export type ModelPin = {
  provider: string;
  model: string;
};

const PROVIDER_API_KEY_ENV: Readonly<Record<string, string>> = {
  groq: "GROQ_API_KEY",
  cloudflare: "CLOUDFLARE_API_TOKEN",
  gemini: "GEMINI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openrouter: "OPENROUTER_API_KEY"
};

const REPLAY_PLACEHOLDER_KEY = "replay-placeholder-key-not-real";
const REPLAY_PLACEHOLDER_ACCOUNT = "replay-placeholder-account";

function isKnownProvider(name: string): name is KnownProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(name);
}

/**
 * Parse `--models provider:model,provider:model`.
 * Fails fast listing valid providers.
 */
export function parseModelsFlag(raw: string): ModelPin[] {
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    throw new Error(
      `--models requires at least one provider:model (known providers: ${KNOWN_PROVIDERS.join(", ")})`
    );
  }
  const pins: ModelPin[] = [];
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon <= 0 || colon === part.length - 1) {
      throw new Error(
        `Invalid --models entry '${part}' (expected provider:model; known providers: ${KNOWN_PROVIDERS.join(", ")})`
      );
    }
    const provider = part.slice(0, colon).trim().toLowerCase();
    const model = part.slice(colon + 1).trim();
    if (!isKnownProvider(provider)) {
      throw new Error(
        `Unknown provider '${provider}' in --models (known: ${KNOWN_PROVIDERS.join(", ")})`
      );
    }
    if (model.length === 0) {
      throw new Error(`Empty model in --models entry '${part}'`);
    }
    pins.push({ provider, model });
  }
  return pins;
}

/**
 * Pin inference to a single provider+model with failover disabled.
 * Ensures API key env is present (replay placeholders or process.env).
 */
export function pinnedInferenceEnv(
  baseEnv: EnvMap,
  pin: ModelPin
): Record<string, string> {
  const apiKeyEnv = PROVIDER_API_KEY_ENV[pin.provider];
  if (apiKeyEnv === undefined) {
    throw new Error(`No API key env mapping for provider '${pin.provider}'`);
  }

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(baseEnv)) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }

  out.INFERENCE_PROVIDER_ORDER = pin.provider;
  out.INFERENCE_MAX_PROVIDERS = "1";
  out[`${pin.provider.toUpperCase()}_MODEL`] = pin.model;

  const existingKey = out[apiKeyEnv];
  if (existingKey === undefined || existingKey.length === 0) {
    out[apiKeyEnv] = REPLAY_PLACEHOLDER_KEY;
  }

  if (pin.provider === "cloudflare") {
    if (
      out.CLOUDFLARE_ACCOUNT_ID === undefined ||
      out.CLOUDFLARE_ACCOUNT_ID.length === 0
    ) {
      out.CLOUDFLARE_ACCOUNT_ID = REPLAY_PLACEHOLDER_ACCOUNT;
    }
  }

  return out;
}

export function pinMismatchMessage(
  pin: ModelPin,
  provider: string | undefined,
  model: string | undefined
): string | null {
  if (provider === undefined || model === undefined) {
    return null;
  }
  if (provider === pin.provider && model === pin.model) {
    return null;
  }
  return (
    `PIN MISMATCH: expected ${pin.provider}/${pin.model}, ` +
    `but decision used ${provider}/${model}`
  );
}
