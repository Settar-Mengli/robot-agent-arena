import { isBattleOver, startBattle } from "../engine";
import type { BattleOutcome, SkillId } from "../engine";
import type { DecisionTrace } from "../agent";
import type { CpuPolicy } from "./policies";
import { resolvePlayerPolicy } from "./policies";
import type { MatchScenario } from "./scenarios";

export type MatchTurnRecord = {
  turn: number;
  playerSkillId: SkillId;
  cpuSource: string;
  trace?: DecisionTrace;
};

export type MatchResult = {
  scenarioId: string;
  seed: MatchScenario["seed"];
  playerPolicy: MatchScenario["playerPolicy"];
  cpuPolicyId: CpuPolicy["id"];
  opponentId: string;
  turns: MatchTurnRecord[];
  outcome: BattleOutcome;
  totalTurns: number;
  finalHpMargin: number;
};

export async function runMatch(
  scenario: MatchScenario,
  cpuPolicy: CpuPolicy
): Promise<MatchResult> {
  const playerPolicy = resolvePlayerPolicy(scenario);
  let runtime = startBattle(
    scenario.playerConfig,
    scenario.cpuConfig,
    scenario.seed
  );
  const turns: MatchTurnRecord[] = [];

  while (!isBattleOver(runtime.session)) {
    const playerSkillId = playerPolicy(runtime);
    const turn = runtime.session.turn;
    const { step, trace } = await cpuPolicy.decide(runtime, playerSkillId);
    runtime = step.runtime;

    const cpuSource =
      trace?.source ??
      (cpuPolicy.id === "random"
        ? "random"
        : cpuPolicy.id === "greedy"
          ? "greedy"
          : "unknown");

    turns.push({
      turn,
      playerSkillId,
      cpuSource,
      ...(trace !== undefined ? { trace } : {})
    });
  }

  const last = runtime.turns[runtime.turns.length - 1];
  const outcome = last?.outcome;
  if (outcome === undefined) {
    throw new Error(`match ${scenario.id} ended without an outcome`);
  }

  return {
    scenarioId: scenario.id,
    seed: scenario.seed,
    playerPolicy: scenario.playerPolicy,
    cpuPolicyId: cpuPolicy.id,
    opponentId: scenario.cpuConfig.agentId,
    turns,
    outcome,
    totalTurns: runtime.turns.length,
    finalHpMargin: runtime.cpu.health - runtime.player.health
  };
}

export type RunSuiteOptions = {
  concurrency?: number;
};

export async function runSuite(
  scenarios: readonly MatchScenario[],
  cpuPolicy: CpuPolicy,
  options: RunSuiteOptions = {}
): Promise<MatchResult[]> {
  const concurrency = options.concurrency ?? 1;
  if (concurrency !== 1) {
    throw new Error("runSuite currently supports concurrency=1 only");
  }

  const results: MatchResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runMatch(scenario, cpuPolicy));
  }
  return results;
}
