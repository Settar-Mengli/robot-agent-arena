/**
 * Decision Lab pack v1 — shared types + assert.
 * No Node, eval, React, or DOM imports (usable from src/eval and src/ui).
 */

export const DECISION_LAB_SCHEMA_VERSION = 1 as const;

export const PROMPT_TEMPLATE_FILES = [
  "src/agent/prompt.ts",
  "src/engine/skills.ts",
  "src/agent/grounding.ts"
] as const;

export type DecisionLabTaxonomy =
  | "unavailable"
  | "infrastructure_failure"
  | "invalid_output"
  | "suboptimal"
  | "optimal";

export type DecisionLabHorizon = {
  turn: number;
  maxTurns: number;
  turnsRemaining: number;
};

export type DecisionLabOracle = {
  perspective: "cpu";
  fixedPlayerPolicy: string;
  horizon: DecisionLabHorizon;
  values: Record<string, number>;
  best: string[];
  ties: boolean;
  exact: boolean;
};

export type DecisionLabAffordability = {
  skillId: string;
  energyCost: number;
  affordable: boolean;
};

export type DecisionLabObservation = {
  cpu: {
    displayName: string;
    health: number;
    maxHealth: number;
    energy: number;
    maxEnergy: number;
    defense: number;
  };
  player: {
    displayName: string;
    health: number;
    maxHealth: number;
    energy: number;
    maxEnergy: number;
    defense: number;
  };
};

export type DecisionLabSanitizedTrace = {
  messages: Array<{ role: string; content: string }>;
  rawText?: string;
  provider?: string;
  model?: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  validation?: unknown;
  source: string;
  failures?: Array<{
    provider: string;
    reason: string;
    model?: string;
    attempt?: number;
    status?: number;
    durationMs?: number;
  }>;
};

export type DecisionLabRecordedPolicy = {
  status: "recorded";
  source: "greedy" | "llm";
  promptVersion: string;
  proposedSkillId?: string;
  executedSkillId: string;
  resolvedSkillId?: string;
  optimal: boolean;
  regret: number;
  chosenValue: number;
  bestValue: number;
  taxonomy: Exclude<DecisionLabTaxonomy, "unavailable">;
  fallbackReason?: string;
  validationCode?: string;
  trace?: DecisionLabSanitizedTrace;
};

export type DecisionLabUnavailablePolicy = {
  status: "unavailable";
  reason: "fixture_miss";
  taxonomy: "unavailable";
  detail: string;
};

export type DecisionLabPolicyEvidence =
  | DecisionLabRecordedPolicy
  | DecisionLabUnavailablePolicy;

export type DecisionLabCase = {
  snapshotId: string;
  scenarioId: string;
  turn: number;
  observation: DecisionLabObservation;
  equippedSkillIds: string[];
  affordability: DecisionLabAffordability[];
  oracle: DecisionLabOracle;
  policies: {
    greedy: DecisionLabPolicyEvidence;
    "llm:base": DecisionLabPolicyEvidence;
    "llm:grounded": DecisionLabPolicyEvidence;
  };
};

export type DecisionLabInputHashes = {
  suite: string;
  fixtureManifest: string;
  promptTemplates: {
    files: string[];
    sha256: string;
  };
  skillCatalog: string;
  oracleSource: string;
};

export type DecisionLabPackV1 = {
  schemaVersion: typeof DECISION_LAB_SCHEMA_VERSION;
  inputHashes: DecisionLabInputHashes;
  suite: {
    split: string;
    kind: string;
    path: string;
    snapshotCount: number;
  };
  oracleDefaults: {
    perspective: "cpu";
    fixedPlayerPolicy: string;
    kind: "best_response_fixed_player_policy";
  };
  modelPin: {
    provider: string;
    model: string;
  };
  cases: DecisionLabCase[];
  limitations: string[];
  reproduce: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new TypeError(`DecisionLabPackV1 ${path}: ${message}`);
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    fail(path, "expected string");
  }
  return value;
}

function assertNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "expected finite number");
  }
  return value;
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    fail(path, "expected boolean");
  }
  return value;
}

function assertStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    fail(path, "expected string[]");
  }
  return value as string[];
}

const TAXONOMIES: ReadonlySet<string> = new Set([
  "unavailable",
  "infrastructure_failure",
  "invalid_output",
  "suboptimal",
  "optimal"
]);

function assertPolicy(
  value: unknown,
  path: string
): DecisionLabPolicyEvidence {
  if (!isPlainObject(value)) {
    fail(path, "expected object");
  }
  const status = assertString(value.status, `${path}.status`);
  const taxonomy = assertString(value.taxonomy, `${path}.taxonomy`);
  if (!TAXONOMIES.has(taxonomy)) {
    fail(`${path}.taxonomy`, `unknown taxonomy ${taxonomy}`);
  }
  if (status === "unavailable") {
    if (taxonomy !== "unavailable") {
      fail(`${path}.taxonomy`, "unavailable status requires taxonomy unavailable");
    }
    if (value.reason !== "fixture_miss") {
      fail(`${path}.reason`, "expected fixture_miss");
    }
    return {
      status: "unavailable",
      reason: "fixture_miss",
      taxonomy: "unavailable",
      detail: assertString(value.detail, `${path}.detail`)
    };
  }
  if (status !== "recorded") {
    fail(`${path}.status`, "expected recorded or unavailable");
  }
  if (taxonomy === "unavailable") {
    fail(`${path}.taxonomy`, "recorded status cannot be unavailable");
  }
  const source = assertString(value.source, `${path}.source`);
  if (source !== "greedy" && source !== "llm") {
    fail(`${path}.source`, "expected greedy|llm");
  }
  const recorded: DecisionLabRecordedPolicy = {
    status: "recorded",
    source,
    promptVersion: assertString(value.promptVersion, `${path}.promptVersion`),
    executedSkillId: assertString(
      value.executedSkillId,
      `${path}.executedSkillId`
    ),
    optimal: assertBoolean(value.optimal, `${path}.optimal`),
    regret: assertNumber(value.regret, `${path}.regret`),
    chosenValue: assertNumber(value.chosenValue, `${path}.chosenValue`),
    bestValue: assertNumber(value.bestValue, `${path}.bestValue`),
    taxonomy: taxonomy as Exclude<DecisionLabTaxonomy, "unavailable">
  };
  if (value.proposedSkillId !== undefined) {
    recorded.proposedSkillId = assertString(
      value.proposedSkillId,
      `${path}.proposedSkillId`
    );
  }
  if (value.resolvedSkillId !== undefined) {
    recorded.resolvedSkillId = assertString(
      value.resolvedSkillId,
      `${path}.resolvedSkillId`
    );
  }
  if (value.fallbackReason !== undefined) {
    recorded.fallbackReason = assertString(
      value.fallbackReason,
      `${path}.fallbackReason`
    );
  }
  if (value.validationCode !== undefined) {
    recorded.validationCode = assertString(
      value.validationCode,
      `${path}.validationCode`
    );
  }
  if (value.trace !== undefined) {
    if (!isPlainObject(value.trace)) {
      fail(`${path}.trace`, "expected object");
    }
    recorded.trace = value.trace as DecisionLabSanitizedTrace;
  }
  return recorded;
}

function assertOracle(value: unknown, path: string): DecisionLabOracle {
  if (!isPlainObject(value)) {
    fail(path, "expected object");
  }
  if (value.perspective !== "cpu") {
    fail(`${path}.perspective`, "expected cpu");
  }
  const horizonRaw = value.horizon;
  if (!isPlainObject(horizonRaw)) {
    fail(`${path}.horizon`, "expected object");
  }
  const best = assertStringArray(value.best, `${path}.best`);
  const ties = assertBoolean(value.ties, `${path}.ties`);
  if (ties !== best.length > 1) {
    fail(`${path}.ties`, "ties must equal best.length > 1");
  }
  if (!isPlainObject(value.values)) {
    fail(`${path}.values`, "expected object");
  }
  return {
    perspective: "cpu",
    fixedPlayerPolicy: assertString(
      value.fixedPlayerPolicy,
      `${path}.fixedPlayerPolicy`
    ),
    horizon: {
      turn: assertNumber(horizonRaw.turn, `${path}.horizon.turn`),
      maxTurns: assertNumber(horizonRaw.maxTurns, `${path}.horizon.maxTurns`),
      turnsRemaining: assertNumber(
        horizonRaw.turnsRemaining,
        `${path}.horizon.turnsRemaining`
      )
    },
    values: value.values as Record<string, number>,
    best,
    ties,
    exact: assertBoolean(value.exact, `${path}.exact`)
  };
}

/**
 * Validate an unknown value as DecisionLabPackV1.
 * Throws TypeError with an actionable path message on mismatch.
 */
export function assertDecisionLabPackV1(value: unknown): DecisionLabPackV1 {
  if (!isPlainObject(value)) {
    fail("", "expected object");
  }
  if (value.schemaVersion !== DECISION_LAB_SCHEMA_VERSION) {
    fail(
      "schemaVersion",
      `expected ${DECISION_LAB_SCHEMA_VERSION}, got ${String(value.schemaVersion)}`
    );
  }
  const hashes = value.inputHashes;
  if (!isPlainObject(hashes)) {
    fail("inputHashes", "expected object");
  }
  const promptTemplates = hashes.promptTemplates;
  if (!isPlainObject(promptTemplates)) {
    fail("inputHashes.promptTemplates", "expected object");
  }
  const files = assertStringArray(
    promptTemplates.files,
    "inputHashes.promptTemplates.files"
  );
  if (files.length !== PROMPT_TEMPLATE_FILES.length) {
    fail(
      "inputHashes.promptTemplates.files",
      `expected ${PROMPT_TEMPLATE_FILES.length} files`
    );
  }
  for (let i = 0; i < PROMPT_TEMPLATE_FILES.length; i += 1) {
    if (files[i] !== PROMPT_TEMPLATE_FILES[i]) {
      fail(
        "inputHashes.promptTemplates.files",
        `expected ${PROMPT_TEMPLATE_FILES[i]} at index ${i}`
      );
    }
  }

  const suite = value.suite;
  if (!isPlainObject(suite)) {
    fail("suite", "expected object");
  }
  const oracleDefaults = value.oracleDefaults;
  if (!isPlainObject(oracleDefaults)) {
    fail("oracleDefaults", "expected object");
  }
  const modelPin = value.modelPin;
  if (!isPlainObject(modelPin)) {
    fail("modelPin", "expected object");
  }
  if (!Array.isArray(value.cases)) {
    fail("cases", "expected array");
  }

  const cases: DecisionLabCase[] = [];
  for (let i = 0; i < value.cases.length; i += 1) {
    const c = value.cases[i];
    const path = `cases[${i}]`;
    if (!isPlainObject(c)) {
      fail(path, "expected object");
    }
    if (!isPlainObject(c.observation)) {
      fail(`${path}.observation`, "expected object");
    }
    if (!isPlainObject(c.policies)) {
      fail(`${path}.policies`, "expected object");
    }
    cases.push({
      snapshotId: assertString(c.snapshotId, `${path}.snapshotId`),
      scenarioId: assertString(c.scenarioId, `${path}.scenarioId`),
      turn: assertNumber(c.turn, `${path}.turn`),
      observation: c.observation as DecisionLabObservation,
      equippedSkillIds: assertStringArray(
        c.equippedSkillIds,
        `${path}.equippedSkillIds`
      ),
      affordability: c.affordability as DecisionLabAffordability[],
      oracle: assertOracle(c.oracle, `${path}.oracle`),
      policies: {
        greedy: assertPolicy(c.policies.greedy, `${path}.policies.greedy`),
        "llm:base": assertPolicy(
          c.policies["llm:base"],
          `${path}.policies.llm:base`
        ),
        "llm:grounded": assertPolicy(
          c.policies["llm:grounded"],
          `${path}.policies.llm:grounded`
        )
      }
    });
  }

  return {
    schemaVersion: DECISION_LAB_SCHEMA_VERSION,
    inputHashes: {
      suite: assertString(hashes.suite, "inputHashes.suite"),
      fixtureManifest: assertString(
        hashes.fixtureManifest,
        "inputHashes.fixtureManifest"
      ),
      promptTemplates: {
        files,
        sha256: assertString(
          promptTemplates.sha256,
          "inputHashes.promptTemplates.sha256"
        )
      },
      skillCatalog: assertString(hashes.skillCatalog, "inputHashes.skillCatalog"),
      oracleSource: assertString(hashes.oracleSource, "inputHashes.oracleSource")
    },
    suite: {
      split: assertString(suite.split, "suite.split"),
      kind: assertString(suite.kind, "suite.kind"),
      path: assertString(suite.path, "suite.path"),
      snapshotCount: assertNumber(suite.snapshotCount, "suite.snapshotCount")
    },
    oracleDefaults: {
      perspective: "cpu",
      fixedPlayerPolicy: assertString(
        oracleDefaults.fixedPlayerPolicy,
        "oracleDefaults.fixedPlayerPolicy"
      ),
      kind: "best_response_fixed_player_policy"
    },
    modelPin: {
      provider: assertString(modelPin.provider, "modelPin.provider"),
      model: assertString(modelPin.model, "modelPin.model")
    },
    cases,
    limitations: assertStringArray(value.limitations, "limitations"),
    reproduce: assertStringArray(value.reproduce, "reproduce")
  };
}
