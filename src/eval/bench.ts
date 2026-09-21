import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { EnvMap } from "../inference";
import type { SkillId } from "../engine";
import { regret } from "./oracle";
import type { DecisionSnapshot } from "./snapshots";
import type {
  SnapshotPolicyMetrics,
  SuiteBaselineDelta
} from "./metrics";
import { deltaVsSuiteBaseline, percentile } from "./metrics";
import { QUOTA_CALL_CAP, QUOTA_DECISIONS_PER_MATCH } from "./policies";

/** Mirrors inference DEFAULT_ORDER — do not import from providers (scope fence). */
export const KNOWN_PROVIDERS = [
  "groq",
  "cloudflare",
  "gemini",
  "mistral",
  "openrouter"
] as const;

export type KnownProvider = (typeof KNOWN_PROVIDERS)[number];

export type ModelPin = {
  provider: string;
  model: string;
};

const PROVIDER_API_KEY_ENV: Readonly<Record<string, string>> = {
  groq: "GROQ_API_KEY",
  cloudflare: "CLOUDFLARE_API_TOKEN",
  gemini: "GEMINI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openrouter: "OPENROUTER_API_KEY"
};

const REPLAY_PLACEHOLDER_KEY = "replay-placeholder-key-not-real";
const REPLAY_PLACEHOLDER_ACCOUNT = "replay-placeholder-account";

function isKnownProvider(name: string): name is KnownProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(name);
}

/**
 * Parse `--models provider:model,provider:model`.
 * Fails fast listing valid providers.
 */
export function parseModelsFlag(raw: string): ModelPin[] {
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    throw new Error(
      `--models requires at least one provider:model (known providers: ${KNOWN_PROVIDERS.join(", ")})`
    );
  }
  const pins: ModelPin[] = [];
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon <= 0 || colon === part.length - 1) {
      throw new Error(
        `Invalid --models entry '${part}' (expected provider:model; known providers: ${KNOWN_PROVIDERS.join(", ")})`
      );
    }
    const provider = part.slice(0, colon).trim().toLowerCase();
    const model = part.slice(colon + 1).trim();
    if (!isKnownProvider(provider)) {
      throw new Error(
        `Unknown provider '${provider}' in --models (known: ${KNOWN_PROVIDERS.join(", ")})`
      );
    }
    if (model.length === 0) {
      throw new Error(`Empty model in --models entry '${part}'`);
    }
    pins.push({ provider, model });
  }
  return pins;
}

/**
 * Pin inference to a single provider+model with failover disabled.
 * Ensures API key env is present (replay placeholders or process.env).
 */
export function pinnedInferenceEnv(
  baseEnv: EnvMap,
  pin: ModelPin
): Record<string, string> {
  const apiKeyEnv = PROVIDER_API_KEY_ENV[pin.provider];
  if (apiKeyEnv === undefined) {
    throw new Error(`No API key env mapping for provider '${pin.provider}'`);
  }

  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(baseEnv)) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }

  out.INFERENCE_PROVIDER_ORDER = pin.provider;
  out.INFERENCE_MAX_PROVIDERS = "1";
  out[`${pin.provider.toUpperCase()}_MODEL`] = pin.model;

  const existingKey = out[apiKeyEnv];
  if (existingKey === undefined || existingKey.length === 0) {
    out[apiKeyEnv] = REPLAY_PLACEHOLDER_KEY;
  }

  if (pin.provider === "cloudflare") {
    if (
      out.CLOUDFLARE_ACCOUNT_ID === undefined ||
      out.CLOUDFLARE_ACCOUNT_ID.length === 0
    ) {
      out.CLOUDFLARE_ACCOUNT_ID = REPLAY_PLACEHOLDER_ACCOUNT;
    }
  }

  return out;
}

export function pinMismatchMessage(
  pin: ModelPin,
  provider: string | undefined,
  model: string | undefined,
  where?: string
): string | null {
  if (provider === undefined || model === undefined) {
    return null;
  }
  if (provider === pin.provider && model === pin.model) {
    return null;
  }
  const location = where !== undefined && where.length > 0 ? ` (${where})` : "";
  return (
    `PIN MISMATCH: expected ${pin.provider}/${pin.model}, ` +
    `but decision used ${provider}/${model}${location}`
  );
}

// --- Quota / pricing / aggregations (commit 3) ---

export type PricingEntry = {
  promptPer1M: number;
  completionPer1M: number;
  source: string;
  freeTier?: boolean;
};

export type PricingTable = {
  asOf: string;
  note: string;
  entries: Record<string, PricingEntry>;
};

export function pricingKey(provider: string, model: string): string {
  return `${provider}:${model}`;
}

export function loadPricing(path?: string): PricingTable {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const file = path ?? resolve(root, "evals/pricing.json");
  return JSON.parse(readFileSync(file, "utf8")) as PricingTable;
}

/**
 * USD cost from token counts, or null when unpriced (never invent).
 * Free-tier known models return 0.
 */
export function lookupCostUsd(
  pricing: PricingTable,
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): number | null {
  const entry = pricing.entries[pricingKey(provider, model)];
  if (entry === undefined) {
    return null;
  }
  return (
    (promptTokens / 1_000_000) * entry.promptPer1M +
    (completionTokens / 1_000_000) * entry.completionPer1M
  );
}

/**
 * models × variants × (snapshots + matches×17) × consistency
 */
export function projectBenchQuotaCalls(
  modelCount: number,
  variantCount: number,
  snapshotCount: number,
  matchCount: number,
  consistency: number,
  decisionsPerMatch: number = QUOTA_DECISIONS_PER_MATCH
): number {
  return (
    modelCount *
    variantCount *
    (snapshotCount + matchCount * decisionsPerMatch) *
    Math.max(1, consistency)
  );
}

export function assertBenchQuotaWithinCap(
  projected: number,
  forceQuota: boolean,
  cap: number = QUOTA_CALL_CAP
): void {
  if (projected > cap && !forceQuota) {
    throw new Error(
      `projected bench call count ${projected} exceeds cap ${cap}; pass --force-quota to override`
    );
  }
}

export type FailureTaxonomy = {
  validationCodes: Record<string, number>;
  fallbackReasons: Record<string, number>;
  attemptFailByStatus: Record<string, number>;
};

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function sortCountMap(map: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(map).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    out[key] = map[key]!;
  }
  return out;
}

export function buildFailureTaxonomy(
  decisions: readonly {
    validationCode?: string;
    fallbackReason?: string;
  }[],
  attemptFailByStatus: Record<string, number> = {}
): FailureTaxonomy {
  const validationCodes: Record<string, number> = {};
  const fallbackReasons: Record<string, number> = {};
  for (const d of decisions) {
    if (d.validationCode !== undefined) {
      bump(validationCodes, d.validationCode);
    }
    if (d.fallbackReason !== undefined) {
      bump(fallbackReasons, d.fallbackReason);
    }
  }
  return {
    validationCodes: sortCountMap(validationCodes),
    fallbackReasons: sortCountMap(fallbackReasons),
    attemptFailByStatus: sortCountMap({ ...attemptFailByStatus })
  };
}

export type ConsistencySample = {
  picks: readonly SkillId[];
  regrets: readonly number[];
};

export type ConsistencyMetrics = {
  n: number;
  consistency: number;
  agreeRate: number;
  meanDistinctPicks: number;
  regretSpreadAcrossRepeats: number;
};

export function computeConsistencyMetrics(
  samples: readonly ConsistencySample[]
): ConsistencyMetrics {
  const n = samples.length;
  if (n === 0) {
    return {
      n: 0,
      consistency: 0,
      agreeRate: 0,
      meanDistinctPicks: 0,
      regretSpreadAcrossRepeats: 0
    };
  }
  let agree = 0;
  let distinctSum = 0;
  let spreadSum = 0;
  let consistency = 0;
  for (const sample of samples) {
    consistency = Math.max(consistency, sample.picks.length);
    const distinct = new Set(sample.picks).size;
    distinctSum += distinct;
    if (distinct <= 1) agree += 1;
    const regrets = sample.regrets;
    if (regrets.length > 0) {
      let min = regrets[0]!;
      let max = regrets[0]!;
      for (const r of regrets) {
        if (r < min) min = r;
        if (r > max) max = r;
      }
      spreadSum += max - min;
    }
  }
  return {
    n,
    consistency,
    agreeRate: agree / n,
    meanDistinctPicks: distinctSum / n,
    regretSpreadAcrossRepeats: spreadSum / n
  };
}

export function consistencySampleForSnapshot(
  snapshot: DecisionSnapshot,
  picks: readonly SkillId[]
): ConsistencySample {
  return {
    picks,
    regrets: picks.map((skillId) => regret(snapshot.values, skillId))
  };
}

export type BenchLatency = {
  p50: number | null;
  p95: number | null;
  p99: number | null;
  cacheHits: number;
};

export function aggregateLiveLatencies(
  liveLatenciesMs: readonly number[],
  cacheHits: number,
  replayMode: boolean
): BenchLatency {
  if (replayMode) {
    return { p50: null, p95: null, p99: null, cacheHits };
  }
  const sorted = [...liveLatenciesMs].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    cacheHits
  };
}

export type BenchRowKey = {
  model: string;
  variant: string;
  split: string;
  snapshotSuite: string;
};

export type BenchRow = BenchRowKey & {
  n: number;
  optimalRate: number;
  meanRegret: number;
  medianRegret: number;
  maxRegret: number;
  highRegret: number;
  validityRate: number | null;
  fallbackCount: number;
  deltaVsGreedy?: SuiteBaselineDelta;
  deltaVsRandom?: SuiteBaselineDelta;
  latency: BenchLatency;
  costUsd: number | null;
  taxonomy: FailureTaxonomy;
  consistency?: ConsistencyMetrics;
  optimalRateWilson?: { low: number; high: number };
  meanRegretCi?: { low: number; high: number; mean: number };
};

export function buildBenchRow(
  key: BenchRowKey,
  metrics: SnapshotPolicyMetrics,
  options: {
    validityRate?: number | null;
    fallbackCount?: number;
    greedyBaseline?: SnapshotPolicyMetrics;
    randomBaseline?: SnapshotPolicyMetrics;
    latency?: BenchLatency;
    costUsd?: number | null;
    taxonomy?: FailureTaxonomy;
    consistency?: ConsistencyMetrics;
  } = {}
): BenchRow {
  const row: BenchRow = {
    ...key,
    n: metrics.n,
    optimalRate: metrics.optimalRate,
    meanRegret: metrics.meanRegret,
    medianRegret: metrics.medianRegret,
    maxRegret: metrics.maxRegret,
    highRegret: metrics.highRegretCount,
    validityRate:
      options.validityRate !== undefined
        ? options.validityRate
        : metrics.invalidDecisionRate !== undefined
          ? 1 - metrics.invalidDecisionRate
          : null,
    fallbackCount: options.fallbackCount ?? 0,
    latency: options.latency ?? {
      p50: null,
      p95: null,
      p99: null,
      cacheHits: 0
    },
    costUsd: options.costUsd ?? null,
    taxonomy: options.taxonomy ?? {
      validationCodes: {},
      fallbackReasons: {},
      attemptFailByStatus: {}
    },
    optimalRateWilson: metrics.optimalRateWilson,
    meanRegretCi: metrics.meanRegretCi
  };
  if (options.greedyBaseline !== undefined) {
    row.deltaVsGreedy = deltaVsSuiteBaseline(
      key.variant,
      `${key.split}/${key.snapshotSuite}`,
      "greedy",
      metrics,
      options.greedyBaseline
    );
  }
  if (options.randomBaseline !== undefined) {
    row.deltaVsRandom = deltaVsSuiteBaseline(
      key.variant,
      `${key.split}/${key.snapshotSuite}`,
      "random",
      metrics,
      options.randomBaseline
    );
  }
  if (options.consistency !== undefined) {
    row.consistency = options.consistency;
  }
  return row;
}

export type BenchSummary = {
  version: 1;
  singleModelPending: boolean;
  note: string;
  models: string[];
  variants: string[];
  split: string;
  snapshotSuite: string;
  consistency: number;
  rows: BenchRow[];
};

function stableRowKey(row: BenchRow): string {
  return `${row.model}|${row.variant}|${row.split}|${row.snapshotSuite}`;
}

/** Deterministic committed summary: rows only, stable key order, no timestamps. */
export function summarizeBench(options: {
  rows: readonly BenchRow[];
  models: readonly string[];
  variants: readonly string[];
  split: string;
  snapshotSuite: string;
  consistency: number;
  singleModelPending?: boolean;
  note?: string;
}): BenchSummary {
  const rows = [...options.rows].sort((a, b) => {
    const ka = stableRowKey(a);
    const kb = stableRowKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  const singleModelPending =
    options.singleModelPending ?? options.models.length < 2;
  return {
    version: 1,
    singleModelPending,
    note:
      options.note ??
      (singleModelPending
        ? "single-model proof pending operator multi-model record"
        : "multi-model bench summary"),
    models: [...options.models].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    variants: [...options.variants].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0
    ),
    split: options.split,
    snapshotSuite: options.snapshotSuite,
    consistency: options.consistency,
    rows
  };
}
