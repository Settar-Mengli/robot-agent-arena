import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeBench, type BenchRow, type BenchSummary } from "../eval/bench";
import { resolveCliArgs, runBenchMode } from "../eval/cli";

const COMMITTED = join(
  process.cwd(),
  "evals/out-committed/bench.summary.json"
);

function readCommitted(): BenchSummary {
  return JSON.parse(readFileSync(COMMITTED, "utf8")) as BenchSummary;
}

describe("bench mode / committed summary", () => {
  it("cli defaults for --mode bench", () => {
    const args = resolveCliArgs([
      "--mode",
      "bench",
      "--models",
      "gemini:gemini-3.5-flash-lite"
    ]);
    expect(args.mode).toBe("bench");
    expect(args.suite).toBe("heldout");
    expect(args.maxMatches).toBe(0);
    expect(args.snapshotSuite).toBe("adversarial");
    expect(args.variantsRaw).toBe("base,grounded");
    expect(args.consistency).toBe(1);
  });

  it("committed bench.summary.json has stable schema", () => {
    const summary = readCommitted();
    expect(summary.version).toBe(1);
    expect(typeof summary.singleModelPending).toBe("boolean");
    expect(typeof summary.note).toBe("string");
    expect(Array.isArray(summary.models)).toBe(true);
    expect(Array.isArray(summary.variants)).toBe(true);
    expect(summary.split).toBe("heldout");
    expect(summary.snapshotSuite).toBe("adversarial");
    expect(Array.isArray(summary.rows)).toBe(true);
    expect(summary.rows.length).toBeGreaterThan(0);
    for (const row of summary.rows) {
      expect(row.model).toMatch(/:/);
      expect(row.n).toBeGreaterThan(0);
      expect(row.latency.p50).toBeNull();
      expect(row).not.toHaveProperty("timestamp");
      expect(row).not.toHaveProperty("path");
      expect(row).not.toHaveProperty("host");
    }
    // stable row order
    const keys = summary.rows.map(
      (r) => `${r.model}|${r.variant}|${r.split}|${r.snapshotSuite}`
    );
    expect(keys).toEqual([...keys].sort());
  });

  it("EVAL.md bench table strings ⊆ committed summary", () => {
    const summary = readCommitted();
    const evalMd = readFileSync(join(process.cwd(), "EVAL.md"), "utf8");
    expect(evalMd).toContain("## Bench (M-BENCH)");
    expect(evalMd).toContain("evals/out-committed/bench.summary.json");
    for (const row of summary.rows) {
      expect(evalMd).toContain(row.model);
      expect(evalMd).toContain(`${(row.optimalRate * 100).toFixed(1)}%`);
    }
  });

  it("summarizeBench is deterministic", () => {
    const row: BenchRow = {
      model: "gemini:gemini-3.5-flash-lite",
      variant: "base",
      split: "heldout",
      snapshotSuite: "adversarial",
      n: 20,
      optimalRate: 0.05,
      meanRegret: 4.25,
      medianRegret: 5,
      maxRegret: 5,
      highRegret: 0,
      validityRate: 1,
      fallbackCount: 0,
      latency: { p50: null, p95: null, p99: null, cacheHits: 0 },
      costUsd: 0,
      taxonomy: {
        validationCodes: {},
        fallbackReasons: {},
        attemptFailByStatus: {}
      }
    };
    const a = summarizeBench({
      rows: [row],
      models: ["gemini:gemini-3.5-flash-lite"],
      variants: ["base"],
      split: "heldout",
      snapshotSuite: "adversarial",
      consistency: 1
    });
    const b = summarizeBench({
      rows: [row],
      models: ["gemini:gemini-3.5-flash-lite"],
      variants: ["base"],
      split: "heldout",
      snapshotSuite: "adversarial",
      consistency: 1
    });
    expect(a).toEqual(b);
    expect(a.singleModelPending).toBe(true);
  });

  it.skipIf(process.env.SNAPSHOT_DRIFT !== "1")(
    "drift-guard: keyless gemini bench regen ≡ committed (SNAPSHOT_DRIFT=1)",
    async () => {
      const before = readCommitted();
      const code = await runBenchMode(
        resolveCliArgs([
          "--mode",
          "bench",
          "--models",
          "gemini:gemini-3.5-flash-lite",
          "--variants",
          "base,grounded"
        ]),
        {
          skipGuards: true,
          env: {
            GEMINI_API_KEY: "replay-placeholder-key-not-real",
            INFERENCE_PROVIDER_ORDER: "gemini",
            INFERENCE_MAX_PROVIDERS: "1",
            GEMINI_MODEL: "gemini-3.5-flash-lite"
          },
          log: () => {},
          error: () => {}
        }
      );
      expect(code).toBe(0);
      const after = readCommitted();
      expect(after.rows.map((r) => ({
        model: r.model,
        variant: r.variant,
        n: r.n,
        optimalRate: r.optimalRate,
        meanRegret: r.meanRegret
      }))).toEqual(
        before.rows.map((r) => ({
          model: r.model,
          variant: r.variant,
          n: r.n,
          optimalRate: r.optimalRate,
          meanRegret: r.meanRegret
        }))
      );
    }
  );
});
