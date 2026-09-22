/**
 * Decision Lab pack v2 — multi-model / multi-suite evidence.
 * No Node, eval, React, or DOM imports.
 */
import {
  assertDecisionLabPackV1,
  DECISION_LAB_SCHEMA_VERSION,
  type DecisionLabCase,
  type DecisionLabInputHashes,
  type DecisionLabPackV1,
  type DecisionLabPolicyEvidence
} from "./pack-v1";

export const DECISION_LAB_SCHEMA_VERSION_V2 = 2 as const;

export type DecisionLabModelPin = {
  provider: string;
  model: string;
};

export type DecisionLabSuiteRef = {
  id: string;
  split: string;
  kind: string;
  path: string;
  snapshotCount: number;
};

export type DecisionLabCaseV2 = Omit<DecisionLabCase, "policies"> & {
  suiteId: string;
  policies: Record<string, DecisionLabPolicyEvidence>;
};

export type DecisionLabPackV2 = {
  schemaVersion: typeof DECISION_LAB_SCHEMA_VERSION_V2;
  inputHashes: DecisionLabInputHashes;
  suites: DecisionLabSuiteRef[];
  modelPins: DecisionLabModelPin[];
  variants: string[];
  cases: DecisionLabCaseV2[];
  limitations: string[];
  reproduce: string[];
};

export function llmPolicyKey(
  provider: string,
  model: string,
  variant: string
): string {
  return `llm:${provider}:${model}:${variant}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new TypeError(`DecisionLabPackV2 ${path}: ${message}`);
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    fail(path, "expected string");
  }
  return value;
}

/**
 * Validate a v2 pack. Each case is checked by projecting greedy + two LLM arms
 * into a temporary v1 pack (reuses assertDecisionLabPackV1 field rules).
 */
export function assertDecisionLabPackV2(raw: unknown): DecisionLabPackV2 {
  if (!isPlainObject(raw)) {
    fail("", "expected object");
  }
  if (raw.schemaVersion !== DECISION_LAB_SCHEMA_VERSION_V2) {
    fail("schemaVersion", "expected 2");
  }
  if (!isPlainObject(raw.inputHashes)) {
    fail("inputHashes", "expected object");
  }
  if (!Array.isArray(raw.suites) || raw.suites.length === 0) {
    fail("suites", "expected non-empty array");
  }
  if (!Array.isArray(raw.modelPins) || raw.modelPins.length === 0) {
    fail("modelPins", "expected non-empty array");
  }
  if (!Array.isArray(raw.variants) || raw.variants.length === 0) {
    fail("variants", "expected non-empty array");
  }
  if (!Array.isArray(raw.cases)) {
    fail("cases", "expected array");
  }
  if (!Array.isArray(raw.limitations) || !Array.isArray(raw.reproduce)) {
    fail("limitations|reproduce", "expected arrays");
  }

  const suiteIds = new Set<string>();
  const suites: DecisionLabSuiteRef[] = [];
  for (let i = 0; i < raw.suites.length; i += 1) {
    const s = raw.suites[i];
    if (!isPlainObject(s)) {
      fail(`suites[${i}]`, "expected object");
    }
    const id = assertString(s.id, `suites[${i}].id`);
    suiteIds.add(id);
    suites.push({
      id,
      split: assertString(s.split, `suites[${i}].split`),
      kind: assertString(s.kind, `suites[${i}].kind`),
      path: assertString(s.path, `suites[${i}].path`),
      snapshotCount: Number(s.snapshotCount)
    });
  }

  const modelPins: DecisionLabModelPin[] = [];
  for (let i = 0; i < raw.modelPins.length; i += 1) {
    const p = raw.modelPins[i];
    if (!isPlainObject(p)) {
      fail(`modelPins[${i}]`, "expected object");
    }
    modelPins.push({
      provider: assertString(p.provider, `modelPins[${i}].provider`),
      model: assertString(p.model, `modelPins[${i}].model`)
    });
  }

  const variants = raw.variants.map((v, i) =>
    assertString(v, `variants[${i}]`)
  );

  const primary = modelPins[0]!;
  const cases: DecisionLabCaseV2[] = [];

  for (let i = 0; i < raw.cases.length; i += 1) {
    const c = raw.cases[i];
    if (!isPlainObject(c)) {
      fail(`cases[${i}]`, "expected object");
    }
    const suiteId = assertString(c.suiteId, `cases[${i}].suiteId`);
    if (!suiteIds.has(suiteId)) {
      fail(`cases[${i}].suiteId`, "unknown suite id");
    }
    if (!isPlainObject(c.policies) || c.policies.greedy === undefined) {
      fail(`cases[${i}].policies`, "expected greedy policy");
    }
    const policies = c.policies as Record<string, DecisionLabPolicyEvidence>;
    const baseKey = llmPolicyKey(primary.provider, primary.model, "base");
    const groundedKey = llmPolicyKey(
      primary.provider,
      primary.model,
      "grounded"
    );
    const base =
      policies[baseKey] ??
      policies["llm:base"] ??
      ({
        status: "unavailable",
        reason: "fixture_miss",
        taxonomy: "unavailable",
        detail: "missing base arm"
      } as DecisionLabPolicyEvidence);
    const grounded =
      policies[groundedKey] ??
      policies["llm:grounded"] ??
      ({
        status: "unavailable",
        reason: "fixture_miss",
        taxonomy: "unavailable",
        detail: "missing grounded arm"
      } as DecisionLabPolicyEvidence);

    const v1Case: DecisionLabCase = {
      snapshotId: assertString(c.snapshotId, `cases[${i}].snapshotId`),
      scenarioId: assertString(c.scenarioId, `cases[${i}].scenarioId`),
      turn: Number(c.turn),
      observation: c.observation as DecisionLabCase["observation"],
      equippedSkillIds: c.equippedSkillIds as string[],
      affordability: c.affordability as DecisionLabCase["affordability"],
      oracle: c.oracle as DecisionLabCase["oracle"],
      policies: {
        greedy: policies.greedy,
        "llm:base": base,
        "llm:grounded": grounded
      }
    };

    const mini: DecisionLabPackV1 = {
      schemaVersion: DECISION_LAB_SCHEMA_VERSION,
      inputHashes: raw.inputHashes as DecisionLabInputHashes,
      suite: {
        split: suites[0]!.split,
        kind: suites[0]!.kind,
        path: suites[0]!.path,
        snapshotCount: 1
      },
      oracleDefaults: {
        perspective: "cpu",
        fixedPlayerPolicy: "x",
        kind: "best_response_fixed_player_policy"
      },
      modelPin: primary,
      cases: [v1Case],
      limitations: ["x"],
      reproduce: ["y"]
    };
    assertDecisionLabPackV1(mini);

    cases.push({
      ...v1Case,
      suiteId,
      policies
    });
  }

  return {
    schemaVersion: 2,
    inputHashes: raw.inputHashes as DecisionLabInputHashes,
    suites,
    modelPins,
    variants,
    cases,
    limitations: [...(raw.limitations as string[])].sort((a, b) =>
      a < b ? -1 : 1
    ),
    reproduce: [...(raw.reproduce as string[])].sort((a, b) =>
      a < b ? -1 : 1
    )
  };
}
