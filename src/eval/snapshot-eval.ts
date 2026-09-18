import { createGreedySelector, playAgentTurn } from "../agent";
import type { DecisionTrace, PlayAgentTurnOptions } from "../agent";
import type { SkillId } from "../engine";
import {
  metricsForChosenMoves,
  randomPolicyExpectation,
  type SnapshotPolicyMetrics
} from "./metrics";
import { regret } from "./oracle";
import type { LlmVariant } from "./policies";
import { variantPromptVersion } from "./policies";
import type { DecisionSnapshot } from "./snapshots";

export type SnapshotDecisionRecord = {
  snapshotId: string;
  promptVersion: string;
  proposedSkillId?: string;
  executedSkillId: string;
  chosenValue: number;
  bestValue: number;
  regret: number;
  optimal: boolean;
  source: string;
  fallbackReason?: string;
  provider?: string;
  model?: string;
  validationCode?: string;
};

export type SnapshotEvalResult = {
  policyId: string;
  metrics: SnapshotPolicyMetrics;
  decisions: SnapshotDecisionRecord[];
};

const NON_LLM_PROMPT_VERSION = "n/a";

function bestValueOf(values: Record<SkillId, number>): number {
  let max = -Infinity;
  for (const value of Object.values(values)) {
    if (value > max) {
      max = value;
    }
  }
  return max;
}

export function decisionRecordFromChoice(
  snap: DecisionSnapshot,
  executedSkillId: SkillId,
  options: {
    promptVersion: string;
    source: string;
    proposedSkillId?: SkillId;
    fallbackReason?: string;
    provider?: string;
    model?: string;
    validationCode?: string;
  }
): SnapshotDecisionRecord {
  const chosenValue = snap.values[executedSkillId];
  if (chosenValue === undefined) {
    throw new TypeError(
      `executedSkillId missing from snapshot values: ${executedSkillId}`
    );
  }
  const bestValue = bestValueOf(snap.values);
  const record: SnapshotDecisionRecord = {
    snapshotId: snap.id,
    promptVersion: options.promptVersion,
    executedSkillId,
    chosenValue,
    bestValue,
    regret: regret(snap.values, executedSkillId),
    optimal: snap.best.includes(executedSkillId),
    source: options.source
  };
  if (options.proposedSkillId !== undefined) {
    record.proposedSkillId = options.proposedSkillId;
  }
  if (options.fallbackReason !== undefined) {
    record.fallbackReason = options.fallbackReason;
  }
  if (options.provider !== undefined) {
    record.provider = options.provider;
  }
  if (options.model !== undefined) {
    record.model = options.model;
  }
  if (options.validationCode !== undefined) {
    record.validationCode = options.validationCode;
  }
  return record;
}

function decisionFromTrace(
  snap: DecisionSnapshot,
  executedSkillId: SkillId,
  trace: DecisionTrace
): SnapshotDecisionRecord {
  return decisionRecordFromChoice(snap, executedSkillId, {
    promptVersion: trace.promptVersion,
    source: trace.source,
    proposedSkillId: trace.proposedSkillId,
    fallbackReason: trace.fallbackReason,
    provider: trace.provider,
    model: trace.model,
    validationCode:
      trace.validation !== undefined && !trace.validation.ok
        ? trace.validation.code
        : undefined
  });
}

export function evalRandomSnapshots(
  snapshots: readonly DecisionSnapshot[]
): SnapshotEvalResult {
  let optimalSum = 0;
  let regretSum = 0;
  let maxRegret = 0;
  let highRegretCount = 0;
  const perSnapMeanRegrets: number[] = [];
  const decisions: SnapshotDecisionRecord[] = [];

  for (const snap of snapshots) {
    const exp = randomPolicyExpectation(snap);
    optimalSum += exp.optimalRate;
    regretSum += exp.meanRegret;
    perSnapMeanRegrets.push(exp.meanRegret);
    if (exp.maxRegret > maxRegret) maxRegret = exp.maxRegret;
    if (exp.maxRegret >= 100) highRegretCount += 1;

    // Representative choice: first catalog-order skill among values for audit shape.
    const executed =
      (Object.keys(snap.values)[0] as SkillId | undefined) ??
      snap.runtime.session.cpu.skillIds[0]!;
    decisions.push(
      decisionRecordFromChoice(snap, executed, {
        promptVersion: NON_LLM_PROMPT_VERSION,
        source: "random"
      })
    );
  }

  const n = snapshots.length;
  const sorted = [...perSnapMeanRegrets].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianRegret =
    n === 0
      ? 0
      : n % 2 === 1
        ? sorted[mid]!
        : (sorted[mid - 1]! + sorted[mid]!) / 2;

  return {
    policyId: "random",
    metrics: {
      n,
      optimalRate: n === 0 ? 0 : optimalSum / n,
      meanRegret: n === 0 ? 0 : regretSum / n,
      medianRegret,
      maxRegret,
      highRegretCount
    },
    decisions
  };
}

export function evalGreedySnapshots(
  snapshots: readonly DecisionSnapshot[]
): SnapshotEvalResult {
  const chosen: SkillId[] = [];
  const decisions: SnapshotDecisionRecord[] = [];

  for (const snap of snapshots) {
    const select = createGreedySelector(snap.runtime.session.cpu);
    const skillId = select(snap.runtime.cpu, snap.runtime.player);
    chosen.push(skillId);
    decisions.push(
      decisionRecordFromChoice(snap, skillId, {
        promptVersion: NON_LLM_PROMPT_VERSION,
        source: "greedy"
      })
    );
  }

  return {
    policyId: "greedy",
    metrics: metricsForChosenMoves(snapshots, chosen),
    decisions
  };
}

export async function evalLlmSnapshots(
  snapshots: readonly DecisionSnapshot[],
  options: PlayAgentTurnOptions = {},
  policyId = "llm"
): Promise<SnapshotEvalResult> {
  const chosen: SkillId[] = [];
  const invalidFlags: boolean[] = [];
  const decisions: SnapshotDecisionRecord[] = [];

  for (const snap of snapshots) {
    const { step, trace } = await playAgentTurn(
      snap.runtime,
      snap.playerSkillId,
      options
    );
    const executed =
      trace.executedSkillId ??
      step.turnRecord.actions.find((a) => a.actor === "cpu")
        ?.selectedSkillId ??
      snap.runtime.session.cpu.skillIds[0]!;
    chosen.push(executed);
    invalidFlags.push(
      trace.source === "fallback" ||
        (trace.validation !== undefined && !trace.validation.ok)
    );
    decisions.push(decisionFromTrace(snap, executed, trace));
  }

  return {
    policyId,
    metrics: metricsForChosenMoves(snapshots, chosen, { invalidFlags }),
    decisions
  };
}

export function distinctPromptVersions(
  decisions: readonly SnapshotDecisionRecord[]
): string[] {
  const set = new Set<string>();
  for (const d of decisions) {
    set.add(d.promptVersion);
  }
  return [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function formatSnapshotDecisionsDigest(
  variant: string,
  result: SnapshotEvalResult
): string {
  const versions = distinctPromptVersions(result.decisions);
  const m = result.metrics;
  return `snapshots-digest[${variant}]: optimal=${(m.optimalRate * 100).toFixed(2)}% meanRegret=${m.meanRegret.toFixed(2)} medianRegret=${m.medianRegret.toFixed(2)} maxRegret=${m.maxRegret.toFixed(2)} highRegret>=100=${m.highRegretCount} promptVersions=${versions.join(",") || "(none)"}`;
}

/**
 * Returns null if OK; otherwise an error message for exit-2 guard.
 */
export function promptVersionMismatchMessage(
  variant: LlmVariant,
  decisions: readonly SnapshotDecisionRecord[]
): string | null {
  const expected = variantPromptVersion(variant);
  const unexpected = [
    ...new Set(
      decisions
        .map((d) => d.promptVersion)
        .filter((v) => v !== expected)
    )
  ].sort();
  if (unexpected.length === 0) {
    return null;
  }
  return (
    `PROMPT VERSION MISMATCH for variant "${variant}": expected ${expected}, ` +
    `but snapshot decisions recorded: ${unexpected.join(", ")}`
  );
}
