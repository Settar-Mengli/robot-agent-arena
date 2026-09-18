import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  formatLlmSummary,
  resolveCliArgs,
  runLlmModeForTest,
  selectScenariosForLlmMode
} from "../eval/cli";
import { createMemoryStore, scenarioStratumKey } from "../eval";
import { buildMatchSuite } from "../eval/scenarios";

function envWithKeys(): Record<string, string> {
  return {
    GROQ_API_KEY: "test-fake-key-not-real",
    INFERENCE_PROVIDER_ORDER: "groq",
    INFERENCE_MAX_PROVIDERS: "1",
    INFERENCE_MAX_RETRIES: "0"
  };
}

function openaiOk(skillId: string): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({ skillId, reason: "eval" })
          }
        }
      ],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("eval cli args", () => {
  it("defaults suite to dev for record when --suite is omitted", () => {
    const args = resolveCliArgs(["--mode", "record"]);
    expect(args.suite).toBe("dev");
    expect(args.suiteExplicit).toBe(false);
  });

  it("keeps suite all for baseline/replay by default", () => {
    expect(resolveCliArgs(["--mode", "baseline"]).suite).toBe("all");
    expect(resolveCliArgs(["--mode", "replay"]).suite).toBe("all");
  });

  it("honors explicit --suite for record", () => {
    expect(
      resolveCliArgs(["--mode", "record", "--suite", "heldout"]).suite
    ).toBe("heldout");
  });

  it("parses --all-seeds", () => {
    expect(resolveCliArgs(["--mode", "record", "--all-seeds"]).allSeeds).toBe(
      true
    );
    expect(resolveCliArgs(["--mode", "record"]).allSeeds).toBe(false);
  });

  it("record uses stratified selection; replay stays first-N by id", () => {
    const suite = buildMatchSuite("dev");
    const stratified = selectScenariosForLlmMode(suite, 4, "record", false);
    const firstN = selectScenariosForLlmMode(suite, 4, "replay", false);
    const allSeeds = selectScenariosForLlmMode(suite, 4, "record", true);

    expect(new Set(stratified.map(scenarioStratumKey)).size).toBe(4);
    expect(firstN.map((s) => s.id)).toEqual(suite.slice(0, 4).map((s) => s.id));
    expect(allSeeds.map((s) => s.id)).toEqual(firstN.map((s) => s.id));
    expect(stratified.map((s) => s.id)).not.toEqual(firstN.map((s) => s.id));
  });
});

describe("eval cli record summary", () => {
  it("successful record returns 0 and prints expected summary fields", async () => {
    const scenario = buildMatchSuite("dev")[0]!;
    const skillId = scenario.cpuConfig.skillIds[0]!;
    const lines: string[] = [];
    const store = createMemoryStore();
    const realFetch = vi.fn().mockResolvedValue(openaiOk(skillId));
    const outDir = await mkdtemp(join(tmpdir(), "eval-cli-ok-"));

    const code = await runLlmModeForTest(
      [
        "--mode",
        "record",
        "--max-matches",
        "1",
        "--no-snapshots",
        "--budget-ms",
        "5000"
      ],
      {
        fetch: realFetch,
        store,
        env: envWithKeys(),
        outDir,
        fixturesDir: outDir,
        log: (line) => lines.push(line),
        error: (line) => lines.push(line)
      }
    );

    expect(code).toBe(0);
    const summary = lines.join("\n");
    expect(summary).toContain("mode: record");
    expect(summary).toContain("suite: dev");
    expect(summary).toContain("output:");
    expect(summary).toContain("matches:");
    expect(summary).toContain("decisions:");
    expect(summary).toContain("decision-validity:");
    expect(summary).toContain("served from cache:");
    expect(summary).toContain(
      "live latency p50/p95 (non-cached HTTP attempts):"
    );
    expect(summary).toMatch(/scenario: /);
    expect(realFetch.mock.calls.length).toBeGreaterThan(0);
  });

  it("all-fallback record returns exit code 2", async () => {
    const lines: string[] = [];
    const store = createMemoryStore();
    const realFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "down" }), { status: 500 })
    );
    const outDir = await mkdtemp(join(tmpdir(), "eval-cli-fail-"));

    const code = await runLlmModeForTest(
      [
        "--mode",
        "record",
        "--max-matches",
        "1",
        "--no-snapshots",
        "--budget-ms",
        "2000"
      ],
      {
        fetch: realFetch,
        store,
        env: envWithKeys(),
        outDir,
        fixturesDir: outDir,
        log: (line) => lines.push(line),
        error: (line) => lines.push(line)
      }
    );

    expect(code).toBe(2);
    expect(lines.join("\n")).toContain("zero successful LLM decisions");
  });

  it("formatLlmSummary includes suite and cache latency labels", () => {
    const text = formatLlmSummary({
      mode: "record",
      suite: "dev",
      outRel: "evals/out/record.json",
      matches: 1,
      sources: { llm: 2, fallback: 1, skipped: 0, total: 3 },
      llmAgg: {
        decisionValidityRate: 0.5,
        fallbackByReason: { all_providers_failed: 1 },
        fixtureMissCount: 0,
        latencyP50: null,
        latencyP95: null,
        tokenTotals: { prompt: 1, completion: 2, total: 3 }
      },
      recordingStats: {
        hits: 4,
        recorded: 2,
        skippedNon2xx: 1,
        liveLatenciesMs: [10, 20, 30]
      },
      fixtureFileCount: 6
    });
    expect(text).toContain("suite: dev");
    expect(text).toContain("served from cache: 4");
    expect(text).toContain(
      "live latency p50/p95 (non-cached HTTP attempts):"
    );
    expect(text).toContain("fixture files on disk: 6");
  });
});
