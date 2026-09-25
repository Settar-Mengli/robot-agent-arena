/** Tokens forbidden on the default (non-Advanced) player path. */
export const FORBIDDEN_DEFAULT_PATH: readonly RegExp[] = [
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  /\bskill-[a-z0-9-]+\b/i,
  /\bllm:/i,
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  /\bregret\b/i,
  /\boracle\b/i,
  /\bschema\b/i,
  /\bquota\b/i,
  /\bserialize\b/i,
  /\bpack\b/i,
  /\barms\b/i,
  /\bpolicy\b/i,
  /\bWilson\b/,
  /\bbootstrap\b/i,
  /Δ|\bdelta regret\b/i,
  /__/,
  /_s\d+\b/i,
  /\bgreedy\b/i,
  /\bn\s*=/i,
  /\bdeterministic\b/i,
  /\bfictional\b/i,
  /\d+\.\d*00\b/,
  /\bfoe\b/i,
  /\bSeed\b/,
  /\bseed\b/i,
  /agent around its declared/i,
  /declared purpose/i
] as const;

export function findForbiddenTechnicalText(text: string): string | null {
  for (const pattern of FORBIDDEN_DEFAULT_PATH) {
    const match = text.match(pattern);
    if (match !== null) {
      return match[0] ?? pattern.source;
    }
  }
  return null;
}

export function assertNoForbiddenTechnicalText(text: string): void {
  const hit = findForbiddenTechnicalText(text);
  if (hit !== null) {
    throw new Error(`Forbidden technical text on default path: ${hit}`);
  }
}
