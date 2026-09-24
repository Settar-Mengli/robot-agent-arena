/**
 * Placeholder allowlist of free OpenRouter model ids.
 * UNKNOWN until an operator verifies which free ids actually work.
 * Do not treat these as production-validated.
 */
export const LIVE_MODEL_IDS = [
  // Placeholder — replace after operator verification of free OpenRouter ids.
  "openrouter/free"
] as const;

export type LiveModelId = (typeof LIVE_MODEL_IDS)[number];

export const DEFAULT_LIVE_MODEL_ID: LiveModelId = LIVE_MODEL_IDS[0];
