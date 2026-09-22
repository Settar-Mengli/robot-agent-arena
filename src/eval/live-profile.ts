/**
 * Build live-only cost/latency/token profile from recording-fetch stats.
 * Excludes fixture cache hits (use liveLatenciesMs / recorded counts only).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { percentile } from "./metrics";
import { loadPricing, lookupCostUsd } from "./bench";

export type LiveProfileModelRow = {
  provider: string;
  model: string;
  variant?: string;
  suite?: string;
  n: number;
  latencyMs: { p50: number | null; p95: number | null };
  tokens: {
    prompt: number | null;
    completion: number | null;
    total: number | null;
  };
  costUsd: number | null;
  freeTier?: boolean;
};

export type LiveProfile = {
  label: "live";
  recordedFrom: string;
  recordedTo: string;
  note: string;
  rows: LiveProfileModelRow[];
};

export type LiveCallSample = {
  provider: string;
  model: string;
  variant?: string;
  suite?: string;
  /** Omit or null when latency is not known (e.g. fixture-derived tokens). */
  durationMs?: number | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

/** Infer provider id from recording request host. */
export function providerFromHost(host: string): string {
  const h = host.toLowerCase();
  if (h.includes("groq.com")) return "groq";
  if (h.includes("googleapis.com") || h.includes("gemini")) return "gemini";
  if (h.includes("openrouter.ai")) return "openrouter";
  if (h.includes("mistral")) return "mistral";
  return host;
}

export function liveSamplesFromRecordingCalls(
  calls: readonly {
    host: string;
    model: string;
    durationMs: number;
  }[],
  meta?: { variant?: string; suite?: string }
): LiveCallSample[] {
  return calls.map((c) => ({
    provider: providerFromHost(c.host),
    model: c.model,
    durationMs: c.durationMs,
    ...(meta?.variant !== undefined ? { variant: meta.variant } : {}),
    ...(meta?.suite !== undefined ? { suite: meta.suite } : {})
  }));
}

function rowKey(row: {
  provider: string;
  model: string;
  variant?: string;
  suite?: string;
}): string {
  return `${row.provider}|${row.model}|${row.variant ?? ""}|${row.suite ?? ""}`;
}

export function buildLiveProfile(
  samples: readonly LiveCallSample[],
  options: { recordedFrom: string; recordedTo: string; note?: string }
): LiveProfile {
  const pricing = loadPricing();
  const groups = new Map<string, LiveCallSample[]>();
  for (const s of samples) {
    const key = rowKey(s);
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  const rows: LiveProfileModelRow[] = [];
  for (const [, list] of [...groups.entries()].sort(([a], [b]) =>
    a < b ? -1 : 1
  )) {
    const first = list[0]!;
    const latencies = list
      .map((x) => x.durationMs)
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
      .sort((a, b) => a - b);
    let prompt = 0;
    let completion = 0;
    let total = 0;
    let usageSeen = false;
    for (const s of list) {
      if (
        s.promptTokens !== undefined ||
        s.completionTokens !== undefined ||
        s.totalTokens !== undefined
      ) {
        usageSeen = true;
        prompt += s.promptTokens ?? 0;
        completion += s.completionTokens ?? 0;
        total += s.totalTokens ?? 0;
      }
    }
    const cost = lookupCostUsd(
      pricing,
      first.provider,
      first.model,
      prompt,
      completion
    );
    const entry = pricing.entries[`${first.provider}:${first.model}`];
    rows.push({
      provider: first.provider,
      model: first.model,
      variant: first.variant,
      suite: first.suite,
      n: list.length,
      latencyMs: {
        p50: latencies.length > 0 ? percentile(latencies, 50) : null,
        p95: latencies.length > 0 ? percentile(latencies, 95) : null
      },
      tokens: usageSeen
        ? { prompt, completion, total }
        : { prompt: null, completion: null, total: null },
      costUsd: cost,
      ...(entry?.freeTier === true ? { freeTier: true } : {})
    });
  }

  return {
    label: "live",
    recordedFrom: options.recordedFrom,
    recordedTo: options.recordedTo,
    note:
      options.note ??
      "Built only from live recording calls; fixture cache hits excluded. Replay latency is null and not mixed in.",
    rows
  };
}

/**
 * Merge two live profiles by row key. Sums n and tokens; latency percentiles
 * are kept only when both sides have latency (otherwise null — do not invent).
 */
export function mergeLiveProfiles(
  left: LiveProfile,
  right: LiveProfile
): LiveProfile {
  const byKey = new Map<string, LiveProfileModelRow>();
  for (const row of [...left.rows, ...right.rows]) {
    const key = rowKey(row);
    const prev = byKey.get(key);
    if (prev === undefined) {
      byKey.set(key, { ...row });
      continue;
    }
    const prompt =
      prev.tokens.prompt !== null && row.tokens.prompt !== null
        ? prev.tokens.prompt + row.tokens.prompt
        : prev.tokens.prompt ?? row.tokens.prompt;
    const completion =
      prev.tokens.completion !== null && row.tokens.completion !== null
        ? prev.tokens.completion + row.tokens.completion
        : prev.tokens.completion ?? row.tokens.completion;
    const total =
      prev.tokens.total !== null && row.tokens.total !== null
        ? prev.tokens.total + row.tokens.total
        : prev.tokens.total ?? row.tokens.total;
    const bothHaveLatency =
      prev.latencyMs.p50 !== null && row.latencyMs.p50 !== null;
    byKey.set(key, {
      provider: prev.provider,
      model: prev.model,
      variant: prev.variant ?? row.variant,
      suite: prev.suite ?? row.suite,
      n: prev.n + row.n,
      latencyMs: bothHaveLatency
        ? {
            // Cannot recompute true p50/p95 without raw samples; mark unavailable.
            p50: null,
            p95: null
          }
        : { p50: null, p95: null },
      tokens: {
        prompt: prompt ?? null,
        completion: completion ?? null,
        total: total ?? null
      },
      costUsd:
        prev.costUsd !== null && row.costUsd !== null
          ? prev.costUsd + row.costUsd
          : (prev.costUsd ?? row.costUsd),
      ...(prev.freeTier === true || row.freeTier === true
        ? { freeTier: true }
        : {})
    });
  }

  const recordedFrom =
    left.recordedFrom <= right.recordedFrom
      ? left.recordedFrom
      : right.recordedFrom;
  const recordedTo =
    left.recordedTo >= right.recordedTo ? left.recordedTo : right.recordedTo;

  return {
    label: "live",
    recordedFrom,
    recordedTo,
    note: "Accumulated across record runs; fixture cache hits excluded. Latency may be null when samples were merged or unavailable.",
    rows: [...byKey.values()].sort((a, b) => {
      const ka = rowKey(a);
      const kb = rowKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    })
  };
}

export function readLiveProfile(path: string): LiveProfile | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LiveProfile;
  } catch {
    return undefined;
  }
}

/**
 * Truthful token profile from committed fixtures (no fabricated latency).
 * Filters to known bench pins when `pins` is provided.
 */
export function buildTokenProfileFromFixtures(
  fixturesDir: string,
  options: {
    recordedFrom: string;
    recordedTo: string;
    pins?: ReadonlyArray<{ provider: string; model: string }>;
  }
): LiveProfile {
  const pinSet =
    options.pins === undefined
      ? undefined
      : new Set(options.pins.map((p) => `${p.provider}|${p.model}`));
  const samples: LiveCallSample[] = [];
  for (const name of readdirSync(fixturesDir)) {
    if (!name.endsWith(".json") || name === "manifest.json") continue;
    const raw = JSON.parse(
      readFileSync(join(fixturesDir, name), "utf8")
    ) as {
      request?: { host?: string; model?: unknown };
      response?: {
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
    };
    const host = raw.request?.host;
    const model =
      typeof raw.request?.model === "string"
        ? raw.request.model
        : String(raw.request?.model ?? "");
    if (host === undefined || model.length === 0) continue;
    const provider = providerFromHost(host);
    if (pinSet !== undefined && !pinSet.has(`${provider}|${model}`)) continue;
    const usage = raw.response?.usage;
    samples.push({
      provider,
      model,
      durationMs: null,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens
    });
  }
  return buildLiveProfile(samples, {
    recordedFrom: options.recordedFrom,
    recordedTo: options.recordedTo,
    note: "Token totals derived from recorded fixture usage fields only. Latency unavailable (per-run live latencies were overwritten and are not reconstructed)."
  });
}

export function writeLiveProfile(
  profile: LiveProfile,
  relPath = "evals/out-committed/bench.live-profile.json"
): void {
  writeFileSync(
    join(process.cwd(), relPath),
    `${JSON.stringify(profile, null, 2)}\n`,
    "utf8"
  );
}
