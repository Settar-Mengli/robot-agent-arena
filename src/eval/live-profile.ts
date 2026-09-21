/**
 * Build live-only cost/latency/token profile from recording-fetch stats.
 * Excludes fixture cache hits (use liveLatenciesMs / recorded counts only).
 */
import { writeFileSync } from "node:fs";
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
  durationMs: number;
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

export function buildLiveProfile(
  samples: readonly LiveCallSample[],
  options: { recordedFrom: string; recordedTo: string }
): LiveProfile {
  const pricing = loadPricing();
  const groups = new Map<string, LiveCallSample[]>();
  for (const s of samples) {
    const key = `${s.provider}|${s.model}|${s.variant ?? ""}|${s.suite ?? ""}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  const rows: LiveProfileModelRow[] = [];
  for (const [, list] of [...groups.entries()].sort(([a], [b]) =>
    a < b ? -1 : 1
  )) {
    const first = list[0]!;
    const latencies = [...list.map((x) => x.durationMs)].sort((a, b) => a - b);
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
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95)
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
    note: "Built only from live recording calls; fixture cache hits excluded. Replay latency is null and not mixed in.",
    rows
  };
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
