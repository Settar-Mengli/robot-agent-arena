/** UI-only friendly labels for variants, providers, and suites (D-054). */

const VARIANT_LABELS: Record<string, string> = {
  base: "Basic prompt",
  grounded: "With facts",
  "base-repeat": "Asked twice",
  perturb: "Reworded",
  advctx: "Misleading rumor",
  "info-partial": "Partial facts",
  freetext: "Free-text"
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  groq: "Groq"
};

const SUITE_LABELS: Record<string, string> = {
  "adversarial-heldout-ext": "Hard test set (35 situations)",
  adversarial: "Small check set (13 situations)",
  "heldout-adversarial": "Small check set (13 situations)"
};

export function variantDisplayName(variant: string): string {
  return VARIANT_LABELS[variant] ?? variant;
}

export function providerDisplayName(provider: string): string {
  const key = provider.toLowerCase();
  return PROVIDER_LABELS[key] ?? provider;
}

export function suiteDisplayName(
  suiteId: string,
  fallbackLabel?: string
): string {
  return SUITE_LABELS[suiteId] ?? fallbackLabel ?? suiteId;
}

/**
 * Parses id "gemini:base" or "gemini:base:secondary"
 * into "Gemini · Basic prompt".
 */
export function leaderboardRowDisplayName(row: {
  id: string;
  label?: string;
}): string {
  const parts = row.id.split(":");
  if (parts.length >= 2) {
    return `${providerDisplayName(parts[0]!)} · ${variantDisplayName(parts[1]!)}`;
  }
  const raw = (row.label ?? row.id).replace(/\s*\(.*?\)\s*$/, "").trim();
  const space = raw.indexOf(" ");
  if (space > 0) {
    const provider = raw.slice(0, space);
    const variant = raw.slice(space + 1).trim().replace(/\s+/g, "-");
    return `${providerDisplayName(provider)} · ${variantDisplayName(variant)}`;
  }
  return raw;
}
