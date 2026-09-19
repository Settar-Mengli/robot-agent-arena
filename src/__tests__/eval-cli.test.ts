import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  deriveReplayEnvFromFixtures,
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

async function writeFixture(
  dir: string,
  name: string,
  host: string,
  model: string
): Promise<void> {
  await writeFile(
    join(dir, name),
    `${JSON.stringify({
      key: name.replace(/\.json$/, ""),
      request: { host, model, messages: [] },
      response: {}
    })}\n`,
    "utf8"
  );
}

describe("eval cli args", () => {
  it("defaults suite to dev for record when --suite is omitted", () => {
    const args = resolveCliArgs(["--mode", "record"]);
    expect(args.suite).toBe("dev");
    expect(args.suiteExplicit).toBe(false);
  });

  it("defaults suite to dev for replay when --suite is omitted", () => {
    const args = resolveCliArgs(["--mode", "replay"]);
    expect(args.suite).toBe("dev");
    expect(args.suiteExplicit).toBe(false);
  });

  it("keeps suite all for baseline by default", () => {
    expect(resolveCliArgs(["--mode", "baseline"]).suite).toBe("all");
  });

  it("honors explicit --suite for record", () => {
    expect(
      resolveCliArgs(["--mode", "record", "--suite", "heldout"]).suite
    ).toBe("heldout");
  });

  it("parses --replay-provider", () => {
    expect(
      resolveCliArgs(["--mode", "replay", "--replay-provider", "Gemini"])
        .replayProvider
    ).toBe("gemini");
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

describe("keyless replay env derivation", () => {
  it("derives env from fixture hosts without real keys", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-replay-env-"));
    await writeFixture(dir, "a.json", "api.groq.com", "openai/gpt-oss-20b");
    await writeFixture(dir, "b.json", "api.groq.com", "openai/gpt-oss-20b");
    await writeFixture(
      dir,
      "c.json",
      "generativelanguage.googleapis.com",
      "gemini-3.5-flash-lite"
    );

    const derived = await deriveReplayEnvFromFixtures(dir);
    expect(derived.provider).toBe("groq");
    expect(derived.model).toBe("openai/gpt-oss-20b");
    expect(derived.env.GROQ_API_KEY).toBeTruthy();
    expect(derived.env.GROQ_API_KEY).not.toMatch(/sk-|gsk_/i);
    expect(derived.env.INFERENCE_PROVIDER_ORDER).toContain("groq");
    expect(derived.env.INFERENCE_PROVIDER_ORDER).toContain("gemini");
    expect(Number(derived.env.INFERENCE_MAX_PROVIDERS)).toBeGreaterThanOrEqual(2);
    expect(derived.providers.length).toBeGreaterThanOrEqual(2);
    expect(derived.env.GROQ_MODEL).toBe("openai/gpt-oss-20b");
    expect(derived.reason).toContain("all providers");
  });

  it("honors --replay-provider override", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-replay-override-"));
    await writeFixture(dir, "a.json", "api.groq.com", "openai/gpt-oss-20b");
    await writeFixture(dir, "b.json", "api.groq.com", "openai/gpt-oss-20b");
    await writeFixture(
      dir,
      "c.json",
      "generativelanguage.googleapis.com",
      "gemini-3.5-flash-lite"
    );

    const derived = await deriveReplayEnvFromFixtures(dir, "gemini");
    expect(derived.provider).toBe("gemini");
    expect(derived.providers).toHaveLength(1);
    expect(derived.model).toBe("gemini-3.5-flash-lite");
    expect(derived.env.GEMINI_API_KEY).toBeTruthy();
    expect(derived.env.INFERENCE_MAX_PROVIDERS).toBe("1");
    expect(derived.reason).toContain("--replay-provider");
  });

  it("errors on empty fixtures dir", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-replay-empty-"));
    await mkdir(join(dir, "nested"), { recursive: true });
    await expect(deriveReplayEnvFromFixtures(dir)).rejects.toThrow(
      /run npm run eval:record first/
    );
  });

  it("includes cloudflare account placeholder when host appears", async () => {
    const dir = await mkdtemp(join(tmpdir(), "eval-replay-cf-"));
    await writeFixture(
      dir,
      "a.json",
      "api.cloudflare.com",
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
    );
    const derived = await deriveReplayEnvFromFixtures(dir);
    expect(derived.provider).toBe("cloudflare");
    expect(derived.env.CLOUDFLARE_API_TOKEN).toBeTruthy();
    expect(derived.env.CLOUDFLARE_ACCOUNT_ID).toBeTruthy();
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
    expect(summary).toContain("matches: 1");
    expect(summary).toContain("decisions:");
    expect(summary).toContain("decision-validity: 100.00%");
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
        tokenTotals: { prompt: 1, completion: 2, total: 3 },
        byProvider: {
          "gemini|gemini-3.5-flash-lite": {
            decisions: 2,
            validOk: 1,
            validated: 2,
            decisionValidityRate: 0.5,
            fallbackCount: 1,
            latencyP50: 100,
            latencyP95: 200,
            tokenTotals: { prompt: 1, completion: 2, total: 3 },
            attemptsOk: 2,
            attemptsFailByStatus: { "429": 3 }
          },
          "groq|openai/gpt-oss-20b": {
            decisions: 1,
            validOk: 1,
            validated: 1,
            decisionValidityRate: 1,
            fallbackCount: 0,
            latencyP50: 50,
            latencyP95: 50,
            tokenTotals: null,
            attemptsOk: 1,
            attemptsFailByStatus: {}
          },
          "openrouter|free-model": {
            decisions: 0,
            validOk: 0,
            validated: 0,
            decisionValidityRate: null,
            fallbackCount: 0,
            latencyP50: null,
            latencyP95: null,
            tokenTotals: null,
            attemptsOk: 0,
            attemptsFailByStatus: { none: 1 }
          }
        }
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
    expect(text).toContain("providers:");
    expect(text).toContain("gemini|gemini-3.5-flash-lite:");
    expect(text).toContain("fail429=3");
    expect(text).toContain("groq|openai/gpt-oss-20b:");
    expect(text).toContain("openrouter|free-model:");
    expect(text).toContain("failnone=1");
  });
});
