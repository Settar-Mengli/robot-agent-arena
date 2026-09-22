/**
 * Decision Lab pack v3 — pack v2 + diagnostics + optional failureTags.
 */
import type { DecisionLabCaseV2, DecisionLabPackV2 } from "./pack-v2";
import type { DecisionLabPolicyEvidence } from "./pack-v1";
import type { DiagnosticsReport, FailureTag } from "./diagnostics";
import {
  assertDecisionLabPackV2,
  DECISION_LAB_SCHEMA_VERSION_V2
} from "./pack-v2";

export const DECISION_LAB_SCHEMA_VERSION_V3 = 3 as const;

export type DecisionLabRecordedPolicyV3 = Extract<
  DecisionLabPolicyEvidence,
  { status: "recorded" }
> & {
  failureTags?: FailureTag[];
};

export type DecisionLabPolicyEvidenceV3 =
  | DecisionLabRecordedPolicyV3
  | Extract<DecisionLabPolicyEvidence, { status: "unavailable" }>;

export type DecisionLabCaseV3 = Omit<DecisionLabCaseV2, "policies"> & {
  policies: Record<string, DecisionLabPolicyEvidenceV3>;
};

export type DecisionLabPackV3 = Omit<
  DecisionLabPackV2,
  "schemaVersion" | "cases"
> & {
  schemaVersion: typeof DECISION_LAB_SCHEMA_VERSION_V3;
  cases: DecisionLabCaseV3[];
  diagnostics: DiagnosticsReport;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new TypeError(`DecisionLabPackV3 ${path}: ${message}`);
}

/**
 * Validate v3 by checking schemaVersion=3, diagnostics shape, then
 * projecting to a temporary v2 shape for field reuse.
 */
export function assertDecisionLabPackV3(raw: unknown): DecisionLabPackV3 {
  if (!isPlainObject(raw)) {
    fail("", "expected object");
  }
  if (raw.schemaVersion !== DECISION_LAB_SCHEMA_VERSION_V3) {
    fail("schemaVersion", "expected 3");
  }
  if (!isPlainObject(raw.diagnostics)) {
    fail("diagnostics", "expected object");
  }
  const d = raw.diagnostics;
  if (d.schemaVersion !== 1) {
    fail("diagnostics.schemaVersion", "expected 1");
  }
  if (typeof d.nCases !== "number") {
    fail("diagnostics.nCases", "expected number");
  }
  if (!Array.isArray(d.clusters)) {
    fail("diagnostics.clusters", "expected array");
  }
  if (!Array.isArray(d.stakes)) {
    fail("diagnostics.stakes", "expected array");
  }
  if (!Array.isArray(d.helpRanking)) {
    fail("diagnostics.helpRanking", "expected array");
  }
  if (!Array.isArray(d.honesty)) {
    fail("diagnostics.honesty", "expected array");
  }
  if (!("counterexample" in d)) {
    fail("diagnostics.counterexample", "expected field");
  }
  if (!Array.isArray(raw.cases)) {
    fail("cases", "expected array");
  }

  const asV2 = {
    ...raw,
    schemaVersion: DECISION_LAB_SCHEMA_VERSION_V2
  };
  const { diagnostics: _d, ...rest } = asV2 as Record<string, unknown>;
  void _d;
  assertDecisionLabPackV2({ ...rest, schemaVersion: 2 });

  return raw as unknown as DecisionLabPackV3;
}
