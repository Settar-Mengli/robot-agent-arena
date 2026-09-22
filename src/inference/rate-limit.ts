/**
 * Shared helpers for record pacing / 429 backoff (no new packages).
 * Lives under inference so eval can import without inverting layers.
 */

export function parseRetryAfterMs(
  header: string | null | undefined,
  nowMs: number = Date.now()
): number | undefined {
  if (header === undefined || header === null) return undefined;
  const trimmed = header.trim();
  if (trimmed.length === 0) return undefined;
  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds * 1000);
  }
  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    return Math.max(0, Math.round(asDate - nowMs));
  }
  return undefined;
}

/** Exponential backoff with full jitter: U(0, min(cap, base * 2^attempt)). */
export function computeBackoffMs(
  attemptIndex: number,
  options: {
    baseMs?: number;
    capMs?: number;
    retryAfterMs?: number;
    random?: () => number;
  } = {}
): number {
  const baseMs = options.baseMs ?? 500;
  const capMs = options.capMs ?? 30_000;
  const random = options.random ?? Math.random;
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attemptIndex));
  const jittered = Math.floor(random() * (exp + 1));
  const retryAfter = options.retryAfterMs ?? 0;
  return Math.max(jittered, retryAfter);
}

export function sleepMs(
  ms: number,
  sleepImpl: (ms: number) => Promise<void> = defaultSleep
): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return sleepImpl(ms);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Strip obvious secrets from provider error bodies before logging. */
export function sanitizeErrorBody(raw: string, maxLen = 240): string {
  let text = raw.replace(/\s+/g, " ").trim();
  text = text.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
  text = text.replace(/AIza[0-9A-Za-z\-_]{20,}/g, "[redacted-key]");
  text = text.replace(/gsk_[0-9A-Za-z]{20,}/g, "[redacted-key]");
  text = text.replace(/sk-[0-9A-Za-z]{20,}/g, "[redacted-key]");
  if (text.length > maxLen) {
    return `${text.slice(0, maxLen)}…`;
  }
  return text;
}

export class RateLimitStopError extends Error {
  readonly consecutive429s: number;

  constructor(consecutive429s: number) {
    super(
      `RECORD STOPPED: ${consecutive429s} consecutive HTTP 429 responses. ` +
        `Resume the same command later (fixture cache skips completed keys).`
    );
    this.name = "RateLimitStopError";
    this.consecutive429s = consecutive429s;
  }
}
