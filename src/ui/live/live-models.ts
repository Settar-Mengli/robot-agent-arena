/**
 * UNVERIFIED catalog candidates (operator may promote after local BYOK verify).
 * Catalog churns; do not claim these work.
 */
export const LIVE_MODEL_CANDIDATES_UNVERIFIED = [
  "openrouter/free",
  "google/gemma-3-4b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "qwen/qwen3-4b:free"
] as const;

/**
 * Active Arena allowlist (UI dropdown).
 * Every id here is still UNVERIFIED until the operator completes local BYOK
 * model verification — including the default `openrouter/free` placeholder.
 * Do not treat allowlist membership as proof the model works.
 */
export const LIVE_MODEL_IDS = ["openrouter/free"] as const;

export type LiveModelId = (typeof LIVE_MODEL_IDS)[number];

export const DEFAULT_LIVE_MODEL_ID: LiveModelId = LIVE_MODEL_IDS[0];
