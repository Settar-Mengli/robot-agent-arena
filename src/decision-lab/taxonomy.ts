/**
 * Taxonomy classification for Decision Lab policy evidence.
 * Pure helpers — no Node/eval/DOM.
 */

import type { DecisionLabTaxonomy } from "./pack-v1";

const INFRA_REASONS = new Set([
  "all_providers_failed",
  "budget_exceeded",
  "cancelled"
]);

export type TaxonomyTraceInput = {
  source?: string;
  fallbackReason?: string;
  validation?: { ok: boolean } | null;
  failures?: readonly { status?: number; reason: string }[];
};

/** Same rule as src/eval/metrics.traceHasFixtureMiss — duplicated to avoid eval import. */
export function traceHasFixtureMissLocal(trace: {
  failures?: readonly { status?: number; reason: string }[];
}): boolean {
  if (trace.failures === undefined) {
    return false;
  }
  for (const failure of trace.failures) {
    if (
      failure.status === 599 ||
      failure.reason.includes("fixture_miss")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Classify recorded (non-miss) LLM/greedy evidence.
 * Callers must handle fixture_miss → unavailable before invoking this.
 */
export function classifyRecordedTaxonomy(input: {
  regret: number;
  source?: string;
  fallbackReason?: string;
  validationOk?: boolean;
}): Exclude<DecisionLabTaxonomy, "unavailable"> {
  if (
    input.source === "fallback" &&
    input.fallbackReason !== undefined &&
    INFRA_REASONS.has(input.fallbackReason)
  ) {
    return "infrastructure_failure";
  }
  if (
    input.fallbackReason === "invalid_output" ||
    input.validationOk === false
  ) {
    return "invalid_output";
  }
  if (input.regret > 0) {
    return "suboptimal";
  }
  return "optimal";
}

export function classifyFromTrace(
  trace: TaxonomyTraceInput,
  regret: number
): DecisionLabTaxonomy {
  if (traceHasFixtureMissLocal(trace)) {
    return "unavailable";
  }
  return classifyRecordedTaxonomy({
    regret,
    source: trace.source,
    fallbackReason: trace.fallbackReason,
    validationOk:
      trace.validation === undefined || trace.validation === null
        ? undefined
        : trace.validation.ok
  });
}
