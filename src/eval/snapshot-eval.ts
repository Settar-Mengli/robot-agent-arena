import { createGreedySelector, playAgentTurn } from "../agent";
import type { PlayAgentTurnOptions } from "../agent";
import type { SkillId } from "../engine";
import {
  metricsForChosenMoves,
  randomPolicyExpectation,
  type SnapshotPolicyMetrics
} from "./metrics";
import type { DecisionSnapshot } from "./snapshots";

export type SnapshotEvalResult = {
  policyId: string;
  metrics: SnapshotPolicyMetrics;
};

export function evalRandomSnapshots(
  snapshots: readonly DecisionSnapshot[]
): SnapshotEvalResult {
  let optimalSum = 0;
  let regretSum = 0;
  let maxRegret = 0;

  for (const snap of snapshots) {
    const exp = randomPolicyExpectation(snap);
    optimalSum += exp.optimalRate;
    regretSum += exp.meanRegret;
    if (exp.maxRegret > maxRegret) maxRegret = exp.maxRegret;
  }

  const n = snapshots.length;
  return {
    policyId: "random",
    metrics: {
      n,
      optimalRate: n === 0 ? 0 : optimalSum / n,
      meanRegret: n === 0 ? 0 : regretSum / n,
      maxRegret
    }
  };
}

export function evalGreedySnapshots(
  snapshots: readonly DecisionSnapshot[]
): SnapshotEvalResult {
  const chosen: SkillId[] = snapshots.map((snap) => {
    const select = createGreedySelector(snap.runtime.session.cpu);
    return select(snap.runtime.cpu, snap.runtime.player);
  });
  return {
    policyId: "greedy",
    metrics: metricsForChosenMoves(snapshots, chosen)
  };
}

export async function evalLlmSnapshots(
  snapshots: readonly DecisionSnapshot[],
  options: PlayAgentTurnOptions = {},
  policyId = "llm"
): Promise<SnapshotEvalResult> {
  const chosen: SkillId[] = [];
  const invalidFlags: boolean[] = [];

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
  }

  return {
    policyId,
    metrics: metricsForChosenMoves(snapshots, chosen, { invalidFlags })
  };
}
