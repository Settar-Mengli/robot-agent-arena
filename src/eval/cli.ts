import { readdir, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveActiveProviders, type EnvMap } from "../inference";
import { buildMatchSuite, selectDiverseScenarios, scenarioStratumKey, type EvalSplit, type MatchScenario } from "./scenarios";
import {
  greedyCpuPolicy,
  llmCpuPolicy,
  parseVariantsList,
  projectQuotaCalls,
  assertQuotaWithinCap,
  llmPolicyIdForVariant,
  variantToPlayOptions,
  randomCpuPolicy,
  type LlmVariant
} from "./policies";
import { runSuite, type MatchResult } from "./match";
import {
  aggregateLlm,
  aggregateMatches,
  deltaVsSuiteBaseline,
  percentile,
  type MatchAggregate,
  type SnapshotPolicyMetrics,
  type SuiteBaselineDelta
} from "./metrics";
import {
  evalGreedySnapshots,
  evalLlmSnapshots,
  evalRandomSnapshots,
  formatSnapshotDecisionsDigest,
  promptVersionMismatchMessage,
  type SnapshotEvalResult
} from "./snapshot-eval";
import type { DecisionSnapshot } from "./snapshots";
import { createDirStore } from "./dir-store";
import {
  createRecordingFetch,
  createReplayFetch,
  type FixtureStore,
  type RecordingFetch,
  type RecordingFetchStats
} from "./transport";
import {
  buildEvalMarkdownShell,
  renderBaselineBlock,
  upsertBaselineBlock,
  type BaselineReport,
  type BaselineSplitReport
} from "./report";
import {
  assertScenarioIdsInSuite,
  mergeManifest,
  manifestVariantsFor,
  readManifest,
  resolveVariantRun,
  selectScenariosByIds,
  variantsFromManifestSplit,
  writeManifest,
  type FixtureManifest
} from "./manifest";
import {
  formatDiscriminationSummary,
  runDiscriminationReport,
  summarizeDiscriminationReport
} from "./discriminate";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

type Mode = "baseline" | "replay" | "record" | "live" | "discriminate";
type SuiteChoice = "dev" | "heldout" | "all";

type CliArgs = {
  mode: Mode;
  suite: SuiteChoice;
  suiteExplicit: boolean;
  maxMatches?: number;
  maxMatchesExplicit: boolean;
  budgetMs: number;
  writeReport: boolean;
  snapshots: boolean;
  allSeeds: boolean;
  replayProvider?: string;
  variantsRaw?: string;
  forceQuota: boolean;
  snapshotSuite: "standard" | "pivotal" | "adversarial" | "both" | "all";
};

const REPLAY_PLACEHOLDER_KEY = "replay-placeholder-key-not-real";
const REPLAY_PLACEHOLDER_ACCOUNT = "replay-placeholder-account";

const FIXTURE_HOST_TO_PROVIDER: Readonly<Record<string, string>> = {
  "generativelanguage.googleapis.com": "gemini",
  "api.groq.com": "groq",
  "api.mistral.ai": "mistral",
  "openrouter.ai": "openrouter",
  "api.cloudflare.com": "cloudflare"
};

const PROVIDER_API_KEY_ENV: Readonly<Record<string, string>> = {
  groq: "GROQ_API_KEY",
  cloudflare: "CLOUDFLARE_API_TOKEN",
  gemini: "GEMINI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openrouter: "OPENROUTER_API_KEY"
};

export type ReplayEnvDerivation = {
  env: Record<string, string>;
  /** Ordered providers enabled for keyless replay (most fixtures first). */
  providers: Array<{ provider: string; model: string }>;
  /** Primary (first) provider — for log lines. */
  provider: string;
  model: string;
  reason: string;
};

export type LlmModeDeps = {
  fetch?: typeof fetch;
  store?: FixtureStore;
  env?: EnvMap;
  outDir?: string;
  fixturesDir?: string;
  log?: (line: string) => void;
  error?: (line: string) => void;
  /** Skip CI / provider banner guards for unit tests. */
  skipGuards?: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    mode: "baseline",
    suite: "all",
    suiteExplicit: false,
    maxMatchesExplicit: false,
    budgetMs: 10000,
    writeReport: false,
    snapshots: true,
    allSeeds: false,
    forceQuota: false,
    snapshotSuite: "standard"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;
    const next = argv[i + 1];
    if (flag === "--mode" && next) {
      args.mode = next as Mode;
      i += 1;
    } else if (flag === "--suite" && next) {
      args.suite = next as SuiteChoice;
      args.suiteExplicit = true;
      i += 1;
    } else if (flag === "--max-matches" && next) {
      args.maxMatches = Number(next);
      args.maxMatchesExplicit = true;
      i += 1;
    } else if (flag === "--budget-ms" && next) {
      args.budgetMs = Number(next);
      i += 1;
    } else if (flag === "--write-report") {
      args.writeReport = true;
    } else if (flag === "--snapshots") {
      if (next === "false" || next === "0") {
        args.snapshots = false;
        i += 1;
      } else if (next === "true" || next === "1") {
        args.snapshots = true;
        i += 1;
      } else {
        args.snapshots = true;
      }
    } else if (flag === "--no-snapshots") {
      args.snapshots = false;
    } else if (flag === "--all-seeds") {
      args.allSeeds = true;
    } else if (flag === "--replay-provider" && next) {
      args.replayProvider = next.trim().toLowerCase();
      i += 1;
    } else if (flag === "--variants" && next) {
      args.variantsRaw = next;
      i += 1;
    } else if (flag === "--force-quota") {
      args.forceQuota = true;
    } else if (flag === "--snapshot-suite" && next) {
      if (
        next !== "standard" &&
        next !== "pivotal" &&
        next !== "adversarial" &&
        next !== "both" &&
        next !== "all"
      ) {
        throw new Error(
          `--snapshot-suite must be standard|pivotal|adversarial|both|all, got ${next}`
        );
      }
      args.snapshotSuite = next;
      i += 1;
    }
  }

  if (
    (args.mode === "record" ||
      args.mode === "live" ||
      args.mode === "replay") &&
    !args.suiteExplicit
  ) {
    args.suite = "dev";
  }

  return args;
}

function providerModelEnvKey(provider: string): string {
  return `${provider.toUpperCase()}_MODEL`;
}

/**
 * Scan committed fixtures and build a placeholder env so replay needs no API keys.
 * Enables ALL providers found in fixtures (failover cascade). Order: most fixtures
 * first, then alphabetical. `--replay-provider` forces a single provider.
 */
export async function deriveReplayEnvFromFixtures(
  fixturesDir: string,
  replayProvider?: string
): Promise<ReplayEnvDerivation> {
  let names: string[];
  try {
    names = (await readdir(fixturesDir)).filter(
      (n) => n.endsWith(".json") && n !== "manifest.json"
    );
  } catch {
    names = [];
  }

  if (names.length === 0) {
    throw new Error(
      `No fixtures in ${fixturesDir.replace(/\\/g, "/")} — run npm run eval:record first`
    );
  }

  type Agg = { count: number; models: Map<string, number> };
  const byProvider = new Map<string, Agg>();

  for (const name of names) {
    const raw = JSON.parse(
      await readFile(join(fixturesDir, name), "utf8")
    ) as { request?: { host?: unknown; model?: unknown } };
    const host =
      typeof raw.request?.host === "string" ? raw.request.host : undefined;
    const model =
      typeof raw.request?.model === "string" ? raw.request.model : undefined;
    if (host === undefined || model === undefined) {
      continue;
    }
    const provider = FIXTURE_HOST_TO_PROVIDER[host];
    if (provider === undefined) {
      continue;
    }
    let agg = byProvider.get(provider);
    if (agg === undefined) {
      agg = { count: 0, models: new Map() };
      byProvider.set(provider, agg);
    }
    agg.count += 1;
    agg.models.set(model, (agg.models.get(model) ?? 0) + 1);
  }

  if (byProvider.size === 0) {
    throw new Error(
      `No recognizable provider hosts in fixtures under ${fixturesDir.replace(/\\/g, "/")} — run npm run eval:record first`
    );
  }

  const ranked = [...byProvider.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) {
      return b[1].count - a[1].count;
    }
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });

  const pickModel = (agg: Agg): string =>
    [...agg.models.entries()].sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    })[0]![0];

  let selectedNames: string[];
  let reason: string;
  if (replayProvider !== undefined && replayProvider.length > 0) {
    if (!byProvider.has(replayProvider)) {
      const available = [...byProvider.keys()].sort().join(", ");
      throw new Error(
        `Unknown or unavailable --replay-provider '${replayProvider}' (fixtures have: ${available})`
      );
    }
    selectedNames = [replayProvider];
    reason = `--replay-provider ${replayProvider}`;
  } else {
    selectedNames = ranked.map(([name]) => name);
    reason = `all providers by fixture count then alphabetical (${selectedNames.join(", ")})`;
  }

  const providers = selectedNames.map((name) => ({
    provider: name,
    model: pickModel(byProvider.get(name)!)
  }));

  const env: Record<string, string> = {
    INFERENCE_PROVIDER_ORDER: selectedNames.join(","),
    INFERENCE_MAX_PROVIDERS: String(selectedNames.length)
  };

  for (const row of providers) {
    const apiKeyEnv = PROVIDER_API_KEY_ENV[row.provider];
    if (apiKeyEnv === undefined) {
      throw new Error(`No API key env mapping for provider '${row.provider}'`);
    }
    env[apiKeyEnv] = REPLAY_PLACEHOLDER_KEY;
    env[providerModelEnvKey(row.provider)] = row.model;
    if (row.provider === "cloudflare") {
      env.CLOUDFLARE_ACCOUNT_ID = REPLAY_PLACEHOLDER_ACCOUNT;
    }
  }

  const primary = providers[0]!;
  return {
    env,
    providers,
    provider: primary.provider,
    model: primary.model,
    reason
  };
}

/** Exported for tests. */
export function resolveCliArgs(argv: string[]): CliArgs {
  return parseArgs(argv);
}

function splitsFor(suite: SuiteChoice): EvalSplit[] {
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

/**
 * Select scenarios for an LLM mode run.
 * - record/live: stratified by default (`selectDiverseScenarios`); `--all-seeds` → first-N by id.
 * - replay: always first-N by id so committed fixtures (recorded under first-N) stay green
 *   until a stratified record run is committed and fixtures are regenerated.
 */
export function selectScenariosForLlmMode(
  suite: MatchScenario[],
  maxMatches: number,
  mode: Mode,
  allSeeds: boolean
): MatchScenario[] {
  if (mode === "replay" || allSeeds) {
    // Replay must stay first-N-by-id until stratified fixtures are committed.
    return suite.slice(0, maxMatches);
  }
  if (mode === "record" || mode === "live") {
    return selectDiverseScenarios(suite, maxMatches);
  }
  return suite.slice(0, maxMatches);
}

export function countDistinctMatchups(
  scenarios: readonly MatchScenario[]
): number {
  return new Set(scenarios.map(scenarioStratumKey)).size;
}

export function identicalOutcomeWarning(
  results: readonly MatchResult[]
): string | undefined {
  if (results.length === 0) {
    return undefined;
  }
  const first = results[0]!;
  const same = results.every(
    (r) =>
      r.outcome.result === first.outcome.result &&
      r.totalTurns === first.totalTurns
  );
  if (!same) {
    return undefined;
  }
  return `warning: all ${results.length} matches ended identically (${first.outcome.result}, ${first.totalTurns} turns) — this sample may not discriminate between policies`;
}

type SnapshotSuiteKind = "standard" | "pivotal" | "adversarial";

async function loadCommittedSnapshots(
  split: EvalSplit,
  kind: SnapshotSuiteKind = "standard",
  root: string = ROOT
): Promise<DecisionSnapshot[]> {
  const file =
    kind === "pivotal"
      ? `snapshots.pivotal.${split}.json`
      : kind === "adversarial"
        ? `snapshots.adversarial.${split}.json`
        : `snapshots.${split}.json`;
  const path = join(root, "evals/suites", file);
  const raw = JSON.parse(await readFile(path, "utf8")) as {
    snapshots: DecisionSnapshot[];
  };
  return raw.snapshots;
}

function resolveSnapshotKinds(
  args: CliArgs,
  split: EvalSplit,
  manifest: FixtureManifest | undefined
): SnapshotSuiteKind[] {
  if (args.mode === "replay" && args.snapshotSuite === "standard") {
    const fromManifest = manifest?.splits[split]?.snapshotSuite;
    if (
      fromManifest === "pivotal" ||
      fromManifest === "standard" ||
      fromManifest === "adversarial"
    ) {
      return [fromManifest];
    }
  }
  if (args.snapshotSuite === "both") {
    return ["standard", "pivotal"];
  }
  if (args.snapshotSuite === "all") {
    return ["standard", "pivotal", "adversarial"];
  }
  return [args.snapshotSuite];
}

function snapshotResultKey(split: EvalSplit, kind: SnapshotSuiteKind): string {
  return kind === "standard" ? split : `${split}:${kind}`;
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

function countSources(results: readonly MatchResult[]): {
  llm: number;
  fallback: number;
  skipped: number;
  total: number;
} {
  let llm = 0;
  let fallback = 0;
  let skipped = 0;
  for (const result of results) {
    for (const turn of result.turns) {
      const source = turn.trace?.source;
      if (source === "llm") llm += 1;
      else if (source === "fallback") fallback += 1;
      else if (source === "skipped") skipped += 1;
    }
  }
  return { llm, fallback, skipped, total: llm + fallback + skipped };
}

function snapshotLlmSuccesses(metrics: SnapshotPolicyMetrics): number {
  const invalidRate = metrics.invalidDecisionRate;
  if (invalidRate === undefined) {
    return 0;
  }
  return Math.round(metrics.n * (1 - invalidRate));
}

async function countFixtureFiles(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir);
    return entries.filter((name) => name.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

function formatPct(rate: number | null): string {
  if (rate === null) return "n/a";
  return `${(Math.round(rate * 10000) / 100).toFixed(2)}%`;
}

function formatMs(value: number | null): string {
  if (value === null) return "n/a";
  return `${Math.round(value)}ms`;
}

export function formatLlmSummary(input: {
  mode: Mode;
  suite: SuiteChoice;
  outRel: string;
  matches: number;
  sources: { llm: number; fallback: number; skipped: number; total: number };
  llmAgg: ReturnType<typeof aggregateLlm>;
  recordingStats?: RecordingFetchStats;
  fixtureFileCount?: number;
  snapshots?: Record<string, SnapshotEvalResult>;
}): string {
  const lines: string[] = [
    "--- eval summary ---",
    `mode: ${input.mode}`,
    `suite: ${input.suite}`,
    `output: ${input.outRel}`,
    `matches: ${input.matches}`,
    `decisions: ${input.sources.total} (llm=${input.sources.llm}, fallback=${input.sources.fallback}, skipped=${input.sources.skipped})`,
    `decision-validity: ${formatPct(input.llmAgg.decisionValidityRate)}`,
    `fixture_miss: ${input.llmAgg.fixtureMissCount}`
  ];

  const reasons = Object.entries(input.llmAgg.fallbackByReason).sort((a, b) =>
    a[0] < b[0] ? -1 : 1
  );
  if (reasons.length > 0) {
    lines.push(
      `fallback reasons: ${reasons.map(([k, v]) => `${k}=${v}`).join(", ")}`
    );
  } else {
    lines.push("fallback reasons: (none)");
  }

  if (input.recordingStats !== undefined) {
    const live = [...input.recordingStats.liveLatenciesMs].sort(
      (a, b) => a - b
    );
    const p50 = percentile(live, 50);
    const p95 = percentile(live, 95);
    lines.push(
      `served from cache: ${input.recordingStats.hits}`,
      `newly recorded: ${input.recordingStats.recorded}`,
      `skipped non-2xx: ${input.recordingStats.skippedNon2xx}`,
      `live latency p50/p95 (non-cached HTTP attempts): ${formatMs(p50)} / ${formatMs(p95)}`
    );
    if (input.fixtureFileCount !== undefined) {
      lines.push(`fixture files on disk: ${input.fixtureFileCount}`);
    }
  }

  if (input.llmAgg.tokenTotals !== null) {
    const t = input.llmAgg.tokenTotals;
    lines.push(
      `tokens: prompt=${t.prompt} completion=${t.completion} total=${t.total}`
    );
  }

  const providerKeys = Object.keys(input.llmAgg.byProvider).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  if (providerKeys.length > 0) {
    lines.push("providers:");
    for (const key of providerKeys) {
      const row = input.llmAgg.byProvider[key]!;
      const failParts = Object.entries(row.attemptsFailByStatus)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([status, count]) => `fail${status}=${count}`);
      const attemptsPart =
        failParts.length > 0
          ? `attempts ok=${row.attemptsOk} ${failParts.join(" ")}`
          : `attempts ok=${row.attemptsOk}`;
      const tokensPart =
        row.tokenTotals === null
          ? "tokens=—"
          : `tokens=${row.tokenTotals.prompt}/${row.tokenTotals.completion}/${row.tokenTotals.total}`;
      lines.push(
        `  ${key}: decisions=${row.decisions} validity=${formatPct(row.decisionValidityRate)} fallback=${row.fallbackCount} ${attemptsPart} latency p50/p95=${formatMs(row.latencyP50)} / ${formatMs(row.latencyP95)} ${tokensPart}`
      );
    }
  }

  if (input.snapshots !== undefined) {
    for (const split of Object.keys(input.snapshots).sort()) {
      const snap = input.snapshots[split]!;
      const m = snap.metrics;
      lines.push(
        `snapshots[${split}]: n=${m.n} optimal=${formatPct(m.optimalRate)} meanRegret=${m.meanRegret.toFixed(2)} invalid=${formatPct(m.invalidDecisionRate ?? null)}`
      );
    }
  }

  lines.push("-------------------");
  return lines.join("\n");
}

async function runLlmMode(
  args: CliArgs,
  record: boolean,
  deps: LlmModeDeps = {}
): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line));
  const error = deps.error ?? ((line: string) => console.error(line));

  if (!deps.skipGuards) {
    if (process.env.CI && args.mode !== "replay") {
      error("record/live modes refuse to run under CI");
      return 1;
    }
    if (args.mode !== "replay") {
      tryLoadEnvFile();
    }
  }

  const fixturesDir = deps.fixturesDir ?? join(ROOT, "evals/fixtures");
  let env: EnvMap = deps.env ?? process.env;

  if (args.mode === "replay" && deps.env === undefined) {
    try {
      const derived = await deriveReplayEnvFromFixtures(
        fixturesDir,
        args.replayProvider
      );
      env = { ...process.env, ...derived.env };
      log(
        `replay providers: ${derived.providers.map((p) => `${p.provider}/${p.model}`).join(", ")} (${derived.reason})`
      );
      log("replay is keyless: API keys are placeholders derived from fixtures");
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      return 1;
    }
  } else if (!deps.skipGuards) {
    const providers = resolveActiveProviders(env);
    if (providers.length === 0) {
      error("No providers configured (need at least one API key)");
      return 1;
    }
    log(
      `Providers: ${providers.map((p) => `${p.name}/${p.model}`).join(", ")}`
    );
    log("Quota warning: free-tier providers may rate-limit or drop requests.");
  }

  const store = deps.store ?? createDirStore(fixturesDir);

  let recordingFetch: RecordingFetch | undefined;
  let fetchImpl: typeof fetch;

  if (record) {
    const realFetch = deps.fetch ?? globalThis.fetch.bind(globalThis);
    recordingFetch = createRecordingFetch(realFetch, store, { force: false });
    fetchImpl = recordingFetch;
  } else if (args.mode === "live") {
    fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis);
  } else {
    fetchImpl = deps.fetch ?? createReplayFetch(store);
  }

  const maxMatches =
    args.maxMatchesExplicit && args.maxMatches !== undefined
      ? args.maxMatches
      : args.mode === "record" || args.mode === "live"
        ? 2
        : 4;

  const inference = {
    fetch: fetchImpl,
    temperature: 0 as const,
    env
  };

  const baseTurnOptions = {
    budgetMs: args.budgetMs,
    inference,
    ...(deps.skipGuards ? { now: () => 0 } : {})
  };

  const manifestFile = join(fixturesDir, "manifest.json");
  const existingManifest =
    args.mode === "replay" || record || args.mode === "live"
      ? await readManifest(manifestFile)
      : undefined;

  if (args.mode === "replay") {
    if (existingManifest === undefined) {
      log(
        "manifest missing: falling back to first-N-by-id scenario selection"
      );
    } else {
      log(`manifest: ${manifestFile.replace(/\\/g, "/")}`);
    }
  }

  let variants: LlmVariant[] = parseVariantsList(args.variantsRaw, args.mode);
  if (args.mode === "replay" && args.variantsRaw === undefined) {
    const fromManifest: LlmVariant[] = [];
    for (const split of splitsFor(args.suite)) {
      const ids = variantsFromManifestSplit(existingManifest?.splits[split]);
      if (ids !== undefined) {
        for (const id of ids) {
          if (!fromManifest.includes(id)) {
            fromManifest.push(id);
          }
        }
      }
    }
    if (fromManifest.length > 0) {
      variants = fromManifest;
      log(`manifest variants: ${variants.join(",")}`);
    } else {
      log("manifest has no variants; replaying base only");
    }
  } else {
    log(`variants: ${variants.join(",")}`);
  }

  // Per (variant, split) scenario lists — replay uses resolveVariantRun so
  // grounded does not inherit base's longer scenarioIds (#21).
  const selectedByVariantSplit: Record<
    string,
    Partial<Record<EvalSplit, MatchScenario[]>>
  > = {};
  const expectedMatchCounts: Array<{
    split: EvalSplit;
    variant: LlmVariant;
    expected: number;
  }> = [];

  for (const variant of variants) {
    selectedByVariantSplit[variant] = {};
    for (const split of splitsFor(args.suite)) {
      const suite = buildMatchSuite(split);
      let scenarios: MatchScenario[];
      let expected: number;

      if (
        args.mode === "replay" &&
        existingManifest?.splits[split] !== undefined
      ) {
        const entry = existingManifest.splits[split]!;
        const resolved = resolveVariantRun(entry, variant);
        assertScenarioIdsInSuite(split, resolved.scenarioIds);
        scenarios = selectScenariosByIds(suite, resolved.scenarioIds);
        if (args.maxMatchesExplicit && args.maxMatches !== undefined) {
          scenarios = selectDiverseScenarios(scenarios, args.maxMatches);
        }
        expected = scenarios.length;
      } else {
        scenarios = selectScenariosForLlmMode(
          suite,
          maxMatches,
          args.mode,
          args.allSeeds
        );
        expected = scenarios.length;
      }

      selectedByVariantSplit[variant]![split] = scenarios;
      expectedMatchCounts.push({ split, variant, expected });
    }
  }

  let totalMatchCount = 0;
  for (const bySplit of Object.values(selectedByVariantSplit)) {
    for (const scenarios of Object.values(bySplit)) {
      if (scenarios) totalMatchCount += scenarios.length;
    }
  }

  let totalSnapshotCount = 0;
  if (args.snapshots) {
    for (const variant of variants) {
      for (const split of splitsFor(args.suite)) {
        const entry = existingManifest?.splits[split];
        const resolved =
          args.mode === "replay" && entry !== undefined
            ? resolveVariantRun(entry, variant)
            : {
                snapshots: true,
                snapshotSuite: args.snapshotSuite as
                  | "standard"
                  | "pivotal"
                  | "adversarial"
                  | undefined
              };
        if (args.mode === "replay" && resolved.snapshots === false) {
          continue;
        }
        for (const kind of resolveSnapshotKinds(
          args,
          split,
          existingManifest
        )) {
          const snapshots = await loadCommittedSnapshots(split, kind);
          totalSnapshotCount += snapshots.length;
        }
      }
    }
  }

  if (args.mode === "record" || args.mode === "live") {
    const projected = projectQuotaCalls(
      variants.length,
      // snapshot count was multiplied by variants above; undo for projection
      // which already multiplies by variantCount
      Math.round(totalSnapshotCount / Math.max(1, variants.length)),
      Math.round(totalMatchCount / Math.max(1, variants.length))
    );
    log(
      `quota projection: variants=${variants.length} snapshots=${Math.round(totalSnapshotCount / Math.max(1, variants.length))} matches=${Math.round(totalMatchCount / Math.max(1, variants.length))} × ~17 → ${projected} calls (cap 300)`
    );
    try {
      assertQuotaWithinCap(projected, args.forceQuota);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      return 1;
    }
  }

  type VariantBundle = {
    results: MatchResult[];
    llm: ReturnType<typeof aggregateLlm>;
    snapshots?: Record<string, SnapshotEvalResult>;
    baselineDelta?: Record<
      string,
      { greedy: SuiteBaselineDelta; random: SuiteBaselineDelta }
    >;
  };

  const byVariant: Record<string, VariantBundle> = {};
  const allResults: MatchResult[] = [];
  const actualMatchCounts: Array<{
    split: EvalSplit;
    variant: LlmVariant;
    actual: number;
  }> = [];

  let snapshotLlm = 0;
  const suiteBaselines: Record<
    string,
    { greedy: SnapshotEvalResult; random: SnapshotEvalResult }
  > = {};

  for (const variant of variants) {
    log(`--- variant: ${variant} (${llmPolicyIdForVariant(variant)}) ---`);
    const turnOptions = {
      ...baseTurnOptions,
      ...variantToPlayOptions(variant),
      variant
    };
    const policy = llmCpuPolicy(turnOptions);
    const variantResults: MatchResult[] = [];

    for (const split of splitsFor(args.suite)) {
      const scenarios = selectedByVariantSplit[variant]?.[split] ?? [];
      actualMatchCounts.push({
        split,
        variant,
        actual: scenarios.length
      });
      for (const scenario of scenarios) {
        log(`scenario: ${scenario.id} [${variant}]`);
        const results = await runSuite([scenario], policy);
        variantResults.push(...results);
        allResults.push(...results);
      }
    }

    const snapshotResults: Record<string, SnapshotEvalResult> = {};
    if (args.snapshots) {
      for (const split of splitsFor(args.suite)) {
        const entry = existingManifest?.splits[split];
        const resolved =
          args.mode === "replay" && entry !== undefined
            ? resolveVariantRun(entry, variant)
            : { snapshots: true as boolean };
        if (args.mode === "replay" && resolved.snapshots === false) {
          log(`snapshots: ${split} skipped (variant.snapshots=false)`);
          continue;
        }
        for (const kind of resolveSnapshotKinds(
          args,
          split,
          existingManifest
        )) {
          const key = snapshotResultKey(split, kind);
          log(`snapshots: ${key} [${variant}]`);
          const snapshots = await loadCommittedSnapshots(split, kind);
          if (suiteBaselines[key] === undefined) {
            suiteBaselines[key] = {
              greedy: evalGreedySnapshots(snapshots),
              random: evalRandomSnapshots(snapshots)
            };
          }
          const evaluated = await evalLlmSnapshots(
            snapshots,
            turnOptions,
            llmPolicyIdForVariant(variant)
          );
          snapshotResults[key] = evaluated;
          snapshotLlm += snapshotLlmSuccesses(evaluated.metrics);
        }
      }
    }

    const llmAgg = aggregateLlm(variantResults, {
      replayMode: args.mode === "replay"
    });
    const baselineDelta: Record<
      string,
      { greedy: SuiteBaselineDelta; random: SuiteBaselineDelta }
    > = {};
    for (const [suiteKey, snap] of Object.entries(snapshotResults)) {
      const baselines = suiteBaselines[suiteKey]!;
      baselineDelta[suiteKey] = {
        greedy: deltaVsSuiteBaseline(
          variant,
          suiteKey,
          "greedy",
          snap.metrics,
          baselines.greedy.metrics
        ),
        random: deltaVsSuiteBaseline(
          variant,
          suiteKey,
          "random",
          snap.metrics,
          baselines.random.metrics
        )
      };
    }

    byVariant[variant] = {
      results: variantResults,
      llm: llmAgg,
      ...(args.snapshots ? { snapshots: snapshotResults, baselineDelta } : {})
    };

    log(
      formatLlmSummary({
        mode:
          args.mode === "live" ? "live" : record ? "record" : "replay",
        suite: args.suite,
        outRel: `variant:${variant}`,
        matches: variantResults.length,
        sources: countSources(variantResults),
        llmAgg,
        snapshots: args.snapshots ? snapshotResults : undefined
      })
    );
    if (args.snapshots) {
      for (const [split, snap] of Object.entries(snapshotResults)) {
        log(formatSnapshotDecisionsDigest(`${variant}/${split}`, snap));
        const mismatch = promptVersionMismatchMessage(variant, snap.decisions);
        if (mismatch !== null) {
          error(mismatch);
          return 2;
        }
      }
    }
    for (const [suiteKey, deltas] of Object.entries(baselineDelta)) {
      for (const delta of [deltas.greedy, deltas.random]) {
        const m = delta.policy;
        const b = delta.baseline;
        log(
          `vs ${delta.baselineId} [${suiteKey}]: Δoptimal=${(delta.deltaOptimalRate * 100).toFixed(1)}pp Δregret=${delta.deltaMeanRegret.toFixed(2)} | policy mean/median/max/high>=100=${m.meanRegret.toFixed(2)}/${m.medianRegret.toFixed(2)}/${m.maxRegret.toFixed(2)}/${m.highRegretCount} | baseline mean/median/max/high>=100=${b.meanRegret.toFixed(2)}/${b.medianRegret.toFixed(2)}/${b.maxRegret.toFixed(2)}/${b.highRegretCount}`
        );
      }
    }
  }

  // EXPECTED vs ACTUAL match counts per (split, variant)
  let matchCountMismatch = false;
  for (const exp of expectedMatchCounts) {
    const act = actualMatchCounts.find(
      (a) => a.split === exp.split && a.variant === exp.variant
    );
    const actual = act?.actual ?? -1;
    log(
      `match counts [${exp.split}/${exp.variant}]: EXPECTED=${exp.expected} ACTUAL=${actual}`
    );
    if (actual !== exp.expected) {
      matchCountMismatch = true;
      error(
        `match count mismatch [${exp.split}/${exp.variant}]: EXPECTED=${exp.expected} ACTUAL=${actual}`
      );
    }
  }
  if (matchCountMismatch) {
    return 1;
  }

  if (record || args.mode === "live") {
    const providerKeys = new Set<string>();
    for (const result of allResults) {
      for (const turn of result.turns) {
        const trace = turn.trace;
        if (trace?.provider !== undefined && trace.model !== undefined) {
          providerKeys.add(`${trace.provider}|${trace.model}`);
        }
        for (const attempt of trace?.attempts ?? []) {
          providerKeys.add(`${attempt.provider}|${attempt.model}`);
        }
      }
    }
    let merged = existingManifest;
    for (const variant of variants) {
      const patch: FixtureManifest = { version: 1, splits: {} };
      for (const split of splitsFor(args.suite)) {
        const selected = selectedByVariantSplit[variant]?.[split] ?? [];
        const kinds = resolveSnapshotKinds(args, split, existingManifest);
        const primaryKind: SnapshotSuiteKind =
          kinds.includes("pivotal") && !kinds.includes("standard")
            ? "pivotal"
            : kinds.includes("adversarial") && !kinds.includes("standard")
              ? "adversarial"
              : kinds[0] ?? "standard";
        patch.splits[split] = {
          scenarioIds: selected.map((s) => s.id),
          snapshots: args.snapshots,
          providers: [...providerKeys].sort(),
          variants: manifestVariantsFor([variant], {
            scenarioIds: selected.map((s) => s.id),
            snapshots: args.snapshots,
            snapshotSuite: primaryKind
          }),
          snapshotSuite: primaryKind
        };
      }
      merged = mergeManifest(merged, patch);
    }
    await writeManifest(manifestFile, merged!);
    log(`manifest updated: ${manifestFile.replace(/\\/g, "/")}`);
  }

  const outDir = deps.outDir ?? join(ROOT, "evals/out");
  await mkdir(outDir, { recursive: true });
  const outName = record ? "record.json" : args.mode === "live" ? "live.json" : "replay.json";
  const outPath = join(outDir, outName);
  const llmAgg = aggregateLlm(allResults, { replayMode: args.mode === "replay" });
  const payload = {
    variants: byVariant,
    results: allResults,
    llm: llmAgg
  };
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const sources = countSources(allResults);
  const recordingStats = recordingFetch?.stats();
  const fixtureFileCount = record
    ? await countFixtureFiles(fixturesDir)
    : undefined;
  const outRel = relative(ROOT, outPath).replace(/\\/g, "/");

  const summaryMode: Mode =
    args.mode === "live" ? "live" : record ? "record" : "replay";

  log(
    formatLlmSummary({
      mode: summaryMode,
      suite: args.suite,
      outRel,
      matches: allResults.length,
      sources,
      llmAgg,
      recordingStats,
      fixtureFileCount
    })
  );

  const selectedScenarios: MatchScenario[] = [];
  for (const bySplit of Object.values(selectedByVariantSplit)) {
    for (const scenarios of Object.values(bySplit)) {
      if (scenarios) selectedScenarios.push(...scenarios);
    }
  }
  const distinct = countDistinctMatchups(selectedScenarios);
  log(
    `distinct matchups: ${distinct} of ${selectedScenarios.length} selected scenarios`
  );
  const identical = identicalOutcomeWarning(allResults);
  if (identical !== undefined) {
    error(identical);
  }

  if (args.mode === "replay" && llmAgg.fixtureMissCount > 0) {
    error(`fixture_miss count: ${llmAgg.fixtureMissCount}`);
    return 1;
  }

  const llmSuccesses = sources.llm + snapshotLlm;
  if (
    (args.mode === "record" || args.mode === "live") &&
    llmSuccesses === 0
  ) {
    error(
      "warning: record/live produced zero successful LLM decisions (all fallback/skip) — refusing to report success"
    );
    return 2;
  }

  return 0;
}

/** Test entry: run record/replay/live with injectable deps. */
export async function runLlmModeForTest(
  argv: string[],
  deps: LlmModeDeps
): Promise<number> {
  const args = parseArgs(argv);
  if (args.mode === "replay") {
    return runLlmMode(args, false, { ...deps, skipGuards: true });
  }
  if (args.mode === "record") {
    return runLlmMode(args, true, { ...deps, skipGuards: true });
  }
  if (args.mode === "live") {
    return runLlmMode(args, false, { ...deps, skipGuards: true });
  }
  throw new Error(`runLlmModeForTest expects record/replay/live, got ${args.mode}`);
}

/** Exported for drift-guard tests. */
export async function computeBaselineReport(
  options: {
    suite?: SuiteChoice;
    maxMatches?: number;
  } = {}
): Promise<BaselineReport> {
  return runBaseline({
    mode: "baseline",
    suite: options.suite ?? "all",
    suiteExplicit: true,
    maxMatches: options.maxMatches,
    maxMatchesExplicit: options.maxMatches !== undefined,
    budgetMs: 10000,
    writeReport: false,
    snapshots: true,
    allSeeds: false,
    forceQuota: false,
    snapshotSuite: "standard"
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

    if (args.mode === "discriminate") {
      const report = await runDiscriminationReport((line) => console.log(line));
      const outDir = join(ROOT, "evals/out");
      await mkdir(outDir, { recursive: true });
      const outPath = join(outDir, "discriminate.json");
      await writeFile(
        outPath,
        `${JSON.stringify(report, null, 2)}\n`,
        "utf8"
      );
      const committedDir = join(ROOT, "evals/out-committed");
      await mkdir(committedDir, { recursive: true });
      const summaryPath = join(committedDir, "discriminate.summary.json");
      const summary = summarizeDiscriminationReport(report);
      await writeFile(
        summaryPath,
        `${JSON.stringify(summary, null, 2)}\n`,
        "utf8"
      );
      console.log(formatDiscriminationSummary(report));
      console.log(`wrote ${relative(ROOT, outPath).replace(/\\/g, "/")}`);
      console.log(`wrote ${relative(ROOT, summaryPath).replace(/\\/g, "/")}`);
      return 0;
    }

    if (args.mode === "replay") {
      return await runLlmMode(args, false);
    }

    if (args.mode === "record") {
      return await runLlmMode(args, true);
    }

    if (args.mode === "live") {
      return await runLlmMode(args, false);
    }

    console.error(`unknown mode: ${args.mode}`);
    return 1;
  } catch (error) {
    console.error(error);
    return 1;
  }
}
