/** Exact user-facing copy for live OpenRouter failures (Batch 4 §D). */
export const LIVE_ERROR = {
  modelUnavailable: "That model isn't available right now.",
  unreachable: "Couldn't reach the live model.",
  rateLimit: "The live model is busy (rate limit).",
  networkBlocked:
    "Live play isn't available in this browser (network blocked)."
} as const;

export type LiveErrorMessage = (typeof LIVE_ERROR)[keyof typeof LIVE_ERROR];

type FailureLike = {
  status?: number;
  reason?: string;
};

/**
 * Map provider failure / thrown error into honesty copy for the Arena notice.
 */
export function mapLiveFailure(
  failures: FailureLike[] | undefined,
  thrown?: unknown
): LiveErrorMessage {
  const candidates: FailureLike[] = [...(failures ?? [])];
  if (
    thrown !== undefined &&
    typeof thrown === "object" &&
    thrown !== null &&
    "failures" in thrown &&
    Array.isArray((thrown as { failures: unknown }).failures)
  ) {
    for (const f of (thrown as { failures: FailureLike[] }).failures) {
      candidates.push(f);
    }
  }

  for (const f of candidates) {
    if (f.status === 429) {
      return LIVE_ERROR.rateLimit;
    }
    if (f.status === 404 || f.status === 400) {
      return LIVE_ERROR.modelUnavailable;
    }
    const reason = (f.reason ?? "").toLowerCase();
    if (
      reason.includes("failed to fetch") ||
      reason.includes("networkerror") ||
      reason.includes("cors") ||
      reason.includes("blocked")
    ) {
      return LIVE_ERROR.networkBlocked;
    }
    if (reason.includes("network") || reason.includes("fetch")) {
      return LIVE_ERROR.unreachable;
    }
  }

  if (thrown instanceof TypeError) {
    return LIVE_ERROR.networkBlocked;
  }
  if (thrown instanceof Error) {
    const msg = thrown.message.toLowerCase();
    if (msg.includes("failed to fetch") || msg.includes("network")) {
      return LIVE_ERROR.unreachable;
    }
  }

  return LIVE_ERROR.unreachable;
}
