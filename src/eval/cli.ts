import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveActiveProviders } from "../inference";
import { buildMatchSuite, type EvalSplit, type MatchScenario } from "./scenarios";
import {
  greedyCpuPolicy,
  llmCpuPolicy,
  randomCpuPolicy
} from "./policies";
import { runSuite, type MatchResult } from "./match";
import { aggregateLlm, aggregateMatches, type MatchAggregate } from "./metrics";
import {
  evalGreedySnapshots,
  evalRandomSnapshots
} from "./snapshot-eval";
import type { DecisionSnapshot } from "./snapshots";
import { createDirStore } from "./dir-store";
import { createRecordingFetch, createReplayFetch } from "./transport";
import {
  buildEvalMarkdownShell,
  renderBaselineBlock,
  upsertBaselineBlock,
  type BaselineReport,
  type BaselineSplitReport
} from "./report";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

type Mode = "baseline" | "replay" | "record" | "live";

type CliArgs = {
  mode: Mode;
  suite: "dev" | "heldout" | "all";
  maxMatches?: number;
  budgetMs: number;
  writeReport: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    mode: "baseline",
    suite: "all",
    budgetMs: 10000,
    writeReport: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    const next = argv[i + 1];
    if (flag === "--mode" && next) {
      args.mode = next as Mode;
      i += 1;
    } else if (flag === "--suite" && next) {
      args.suite = next as CliArgs["suite"];
      i += 1;
    } else if (flag === "--max-matches" && next) {
      args.maxMatches = Number(next);
      i += 1;
    } else if (flag === "--budget-ms" && next) {
      args.budgetMs = Number(next);
      i += 1;
    } else if (flag === "--write-report") {
      args.writeReport = true;
    }
  }

  return args;
}

function splitsFor(suite: CliArgs["suite"]): EvalSplit[] {
  if (suite === "all") return ["dev", "heldout"];
  return [suite];
}

function withByOpponent(
  results: MatchResult[]
): MatchAggregate & { byOpponent: Record<string, MatchAggregate> } {
  const byOpponent: Record<string, MatchAggregate> = {};
  const groups = new Map<string, MatchResult[]>();
  for (const result of results) {
    const list = groups.get(result.opponentId) ?? [];
    list.push(result);
    groups.set(result.opponentId, list);
  }
  for (const [id, group] of [...groups.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : 1
  )) {
    byOpponent[id] = aggregateMatches(group);
  }
  return { ...aggregateMatches(results), byOpponent };
}

function limitScenarios(
  scenarios: MatchScenario[],
  maxMatches?: number
): MatchScenario[] {
  if (maxMatches === undefined) return scenarios;
  return scenarios.slice(0, maxMatches);
}

async function loadCommittedSnapshots(
  split: EvalSplit
): Promise<DecisionSnapshot[]> {
  const path = join(ROOT, "evals/suites", `snapshots.${split}.json`);
  const raw = JSON.parse(await readFile(path, "utf8")) as {
    snapshots: DecisionSnapshot[];
  };
  return raw.snapshots;
}

async function runBaseline(args: CliArgs): Promise<BaselineReport> {
  const splits: BaselineSplitReport[] = [];

  for (const split of splitsFor(args.suite)) {
    const scenarios = limitScenarios(buildMatchSuite(split), args.maxMatches);

    const randomResults = await runSuite(scenarios, randomCpuPolicy());

    const greedyResults: MatchResult[] = [];
    for (const scenario of scenarios) {
      const [one] = await runSuite(
        [scenario],
        greedyCpuPolicy(scenario.cpuConfig)
      );
      greedyResults.push(one!);
    }

    const snapshots = await loadCommittedSnapshots(split);
    const randomSnap = evalRandomSnapshots(snapshots);
    const greedySnap = evalGreedySnapshots(snapshots);

    splits.push({
      split,
      matches: {
        random: withByOpponent(randomResults),
        greedy: withByOpponent(greedyResults)
      },
      snapshots: {
        random: randomSnap.metrics,
        greedy: greedySnap.metrics
      }
    });
  }

  return { splits };
}

async function writeBaselineOutputs(
  report: BaselineReport,
  writeReport: boolean
): Promise<void> {
  const outDir = join(ROOT, "evals/out");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, "baseline.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  if (!writeReport) {
    return;
  }

  const evalPath = join(ROOT, "EVAL.md");
  let existing: string;
  try {
    existing = await readFile(evalPath, "utf8");
  } catch {
    existing = buildEvalMarkdownShell();
  }

  if (!existing.includes("<!-- baseline:start -->")) {
    existing = buildEvalMarkdownShell();
  }

  const block = renderBaselineBlock(report);
  const next = upsertBaselineBlock(existing, block);
  await writeFile(evalPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
}

function tryLoadEnvFile(): void {
  try {
    process.loadEnvFile();
  } catch {
    // optional .env
  }
}

async function runLlmMode(args: CliArgs, record: boolean): Promise<number> {
  if (process.env.CI) {
    console.error("record/live modes refuse to run under CI");
    return 1;
  }

  tryLoadEnvFile();
  const providers = resolveActiveProviders(process.env);
  if (providers.length === 0) {
    console.error("No providers configured (need at least one API key)");
    return 1;
  }

  console.log(
    "Providers:",
    providers.map((p) => `${p.name}/${p.model}`).join(", ")
  );
  console.log(
    "Quota warning: free-tier providers may rate-limit or drop requests."
  );

  const store = createDirStore(join(ROOT, "evals/fixtures"));
  const fetchImpl = record
    ? createRecordingFetch(globalThis.fetch.bind(globalThis), store)
    : createReplayFetch(store);

  const maxMatches = args.maxMatches ?? 4;
  const allResults: MatchResult[] = [];

  for (const split of splitsFor(args.suite)) {
    const scenarios = limitScenarios(buildMatchSuite(split), maxMatches);
    for (const scenario of scenarios) {
      const results = await runSuite(
        [scenario],
        llmCpuPolicy({
          budgetMs: args.budgetMs,
          inference: {
            fetch: fetchImpl,
            temperature: 0
          }
        })
      );
      allResults.push(...results);
    }
  }

  const outDir = join(ROOT, "evals/out");
  await mkdir(outDir, { recursive: true });
  const payload = {
    results: allResults,
    llm: aggregateLlm(allResults, { replayMode: !record })
  };
  await writeFile(
    join(outDir, record ? "record.json" : "replay.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8"
  );

  if (!record && payload.llm.fixtureMissCount > 0) {
    console.error(`fixture_miss count: ${payload.llm.fixtureMissCount}`);
    return 1;
  }

  return 0;
}

/** Exported for drift-guard tests. */
export async function computeBaselineReport(
  options: {
    suite?: CliArgs["suite"];
    maxMatches?: number;
  } = {}
): Promise<BaselineReport> {
  return runBaseline({
    mode: "baseline",
    suite: options.suite ?? "all",
    maxMatches: options.maxMatches,
    budgetMs: 10000,
    writeReport: false
  });
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);

  try {
    if (args.mode === "baseline") {
      const report = await runBaseline(args);
      await writeBaselineOutputs(report, args.writeReport);
      return 0;
    }

    if (args.mode === "replay") {
      return await runLlmMode(args, false);
    }

    if (args.mode === "record" || args.mode === "live") {
      return await runLlmMode(args, args.mode === "record");
    }

    console.error(`unknown mode: ${args.mode}`);
    return 1;
  } catch (error) {
    console.error(error);
    return 1;
  }
}
