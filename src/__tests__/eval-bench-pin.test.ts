import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KNOWN_PROVIDERS,
  parseModelsFlag,
  pinnedInferenceEnv,
  pinMismatchMessage
} from "../eval/bench";
import { createMemoryStore } from "../eval";
import { buildMatchSuite } from "../eval/scenarios";

/** Mutable attribution returned by the completeChat stub (CLI guard tests). */
const chatStub = {
  provider: "groq",
  model: "openai/gpt-oss-20b",
  skillId: "skill-override-pulse"
};

vi.mock("../inference", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../inference")>();
  return {
    ...actual,
    completeChat: vi.fn(async () => ({
      text: JSON.stringify({
        skillId: chatStub.skillId,
        reason: "pin-guard-stub"
      }),
      provider: chatStub.provider,
      model: chatStub.model,
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    }))
  };
});

// Import after mock so runLlmMode uses stubbed completeChat.
const { runLlmModeForTest } = await import("../eval/cli");

describe("bench pin helpers", () => {
  it("parseModelsFlag accepts provider:model list", () => {
    expect(parseModelsFlag("gemini:gemini-3.5-flash-lite")).toEqual([
      { provider: "gemini", model: "gemini-3.5-flash-lite" }
    ]);
    expect(parseModelsFlag("groq:llama,mistral:small")).toEqual([
      { provider: "groq", model: "llama" },
      { provider: "mistral", model: "small" }
    ]);
  });

  it("parseModelsFlag fails fast on unknown provider", () => {
    expect(() => parseModelsFlag("nope:model")).toThrow(/known/i);
    expect(() => parseModelsFlag("gemini")).toThrow(/provider:model/);
    for (const p of KNOWN_PROVIDERS) {
      expect(parseModelsFlag(`${p}:x`)[0]!.provider).toBe(p);
    }
  });

  it("pinnedInferenceEnv sets order=1 provider + MODEL + maxProviders 1", () => {
    const env = pinnedInferenceEnv(
      { GEMINI_API_KEY: "live-key", OTHER: "keep" },
      { provider: "gemini", model: "gemini-3.5-flash-lite" }
    );
    expect(env.INFERENCE_PROVIDER_ORDER).toBe("gemini");
    expect(env.INFERENCE_MAX_PROVIDERS).toBe("1");
    expect(env.GEMINI_MODEL).toBe("gemini-3.5-flash-lite");
    expect(env.GEMINI_API_KEY).toBe("live-key");
    expect(env.OTHER).toBe("keep");
  });

  it("pinnedInferenceEnv fills replay placeholders when key missing", () => {
    const env = pinnedInferenceEnv(
      {},
      { provider: "cloudflare", model: "cf-model" }
    );
    expect(env.CLOUDFLARE_API_TOKEN).toMatch(/placeholder/);
    expect(env.CLOUDFLARE_ACCOUNT_ID).toMatch(/placeholder/);
    expect(env.CLOUDFLARE_MODEL).toBe("cf-model");
  });

  it("pinMismatchMessage detects provider/model drift", () => {
    const pin = { provider: "gemini", model: "gemini-3.5-flash-lite" };
    expect(pinMismatchMessage(pin, "gemini", "gemini-3.5-flash-lite")).toBeNull();
    expect(pinMismatchMessage(pin, undefined, undefined)).toBeNull();
    expect(pinMismatchMessage(pin, "groq", "x")).toMatch(/PIN MISMATCH/);
  });

  it("pinMismatchMessage names snapshot or scenario/turn location", () => {
    const pin = { provider: "gemini", model: "gemini-3.5-flash-lite" };
    expect(
      pinMismatchMessage(pin, "groq", "x", "snapshot snap-1")
    ).toBe(
      "PIN MISMATCH: expected gemini/gemini-3.5-flash-lite, but decision used groq/x (snapshot snap-1)"
    );
    expect(
      pinMismatchMessage(pin, "openrouter", "free", "scenario s1 turn 3")
    ).toBe(
      "PIN MISMATCH: expected gemini/gemini-3.5-flash-lite, but decision used openrouter/free (scenario s1 turn 3)"
    );
  });
});

describe("bench pin CLI guard", () => {
  const scenario = buildMatchSuite("dev")[0]!;

  beforeEach(() => {
    chatStub.skillId = scenario.cpuConfig.skillIds[0]!;
    chatStub.provider = "groq";
    chatStub.model = "openai/gpt-oss-20b";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function runPinnedRecord(modelsFlag: string | undefined): Promise<{
    code: number;
    lines: string[];
  }> {
    const lines: string[] = [];
    const store = createMemoryStore();
    const outDir = await mkdtemp(join(tmpdir(), "eval-pin-guard-"));
    const argv = [
      "--mode",
      "record",
      "--variants",
      "base",
      "--max-matches",
      "1",
      "--all-seeds",
      "--no-snapshots",
      "--budget-ms",
      "5000",
      ...(modelsFlag !== undefined ? ["--models", modelsFlag] : [])
    ];
    const code = await runLlmModeForTest(argv, {
      store,
      env: {
        GROQ_API_KEY: "test-fake-key-not-real",
        INFERENCE_PROVIDER_ORDER: "groq",
        INFERENCE_MAX_PROVIDERS: "1",
        INFERENCE_MAX_RETRIES: "0"
      },
      outDir,
      fixturesDir: outDir,
      log: (line) => lines.push(line),
      error: (line) => lines.push(line)
    });
    return { code, lines };
  }

  it("pinned run with mismatched provider exits 2 and names the mismatch", async () => {
    chatStub.provider = "openrouter";
    chatStub.model = "wrong-model";
    const { code, lines } = await runPinnedRecord("groq:openai/gpt-oss-20b");
    const text = lines.join("\n");
    expect(code).toBe(2);
    expect(text).toContain(
      "PIN MISMATCH: expected groq/openai/gpt-oss-20b, but decision used openrouter/wrong-model"
    );
    expect(text).toMatch(/scenario .+ turn \d+/);
  });

  it("pinned run with matching provider exits 0", async () => {
    chatStub.provider = "groq";
    chatStub.model = "openai/gpt-oss-20b";
    const { code, lines } = await runPinnedRecord("groq:openai/gpt-oss-20b");
    expect(code).toBe(0);
    expect(lines.join("\n")).not.toContain("PIN MISMATCH");
    expect(lines.join("\n")).toContain("pinned model: groq/openai/gpt-oss-20b");
  });

  it("unpinned run does not fire the pin guard", async () => {
    chatStub.provider = "openrouter";
    chatStub.model = "anything";
    const { code, lines } = await runPinnedRecord(undefined);
    expect(code).toBe(0);
    expect(lines.join("\n")).not.toContain("PIN MISMATCH");
    expect(lines.join("\n")).not.toContain("pinned model:");
    expect(lines.join("\n")).toContain(
      "warning: single-variant run is unpinned; results are not comparable across runs"
    );
  });

  it("multi-variant record without --models exits 1 with attribution message", async () => {
    const lines: string[] = [];
    const outDir = await mkdtemp(join(tmpdir(), "eval-pin-multi-"));
    const code = await runLlmModeForTest(
      [
        "--mode",
        "record",
        "--variants",
        "base,grounded",
        "--max-matches",
        "1",
        "--no-snapshots",
        "--budget-ms",
        "2000"
      ],
      {
        store: createMemoryStore(),
        env: {
          GROQ_API_KEY: "test-fake-key-not-real",
          INFERENCE_PROVIDER_ORDER: "groq",
          INFERENCE_MAX_PROVIDERS: "1",
          INFERENCE_MAX_RETRIES: "0"
        },
        outDir,
        fixturesDir: outDir,
        log: (line) => lines.push(line),
        error: (line) => lines.push(line)
      }
    );
    expect(code).toBe(1);
    expect(lines.join("\n")).toContain(
      "Multi-variant comparison cannot be attributed when failover can reassign providers"
    );
    expect(lines.join("\n")).toContain("--models");
  });

  it("multi-variant record with --models proceeds past the pin requirement", async () => {
    chatStub.provider = "groq";
    chatStub.model = "openai/gpt-oss-20b";
    const lines: string[] = [];
    const outDir = await mkdtemp(join(tmpdir(), "eval-pin-multi-ok-"));
    const code = await runLlmModeForTest(
      [
        "--mode",
        "record",
        "--variants",
        "base,grounded",
        "--models",
        "groq:openai/gpt-oss-20b",
        "--max-matches",
        "1",
        "--all-seeds",
        "--no-snapshots",
        "--budget-ms",
        "5000"
      ],
      {
        store: createMemoryStore(),
        env: {
          GROQ_API_KEY: "test-fake-key-not-real",
          INFERENCE_PROVIDER_ORDER: "groq",
          INFERENCE_MAX_PROVIDERS: "1",
          INFERENCE_MAX_RETRIES: "0"
        },
        outDir,
        fixturesDir: outDir,
        log: (line) => lines.push(line),
        error: (line) => lines.push(line)
      }
    );
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("pinned model: groq/openai/gpt-oss-20b");
    expect(lines.join("\n")).not.toContain(
      "Multi-variant comparison cannot be attributed"
    );
  });

  it("ablation snapshot pin mismatch exits 2", async () => {
    chatStub.provider = "openrouter";
    chatStub.model = "wrong-model";
    chatStub.skillId = scenario.cpuConfig.skillIds[0]!;
    const lines: string[] = [];
    const outDir = await mkdtemp(join(tmpdir(), "eval-pin-snap-"));
    const code = await runLlmModeForTest(
      [
        "--mode",
        "record",
        "--variants",
        "base",
        "--models",
        "groq:openai/gpt-oss-20b",
        "--max-matches",
        "0",
        "--snapshot-suite",
        "adversarial",
        "--suite",
        "dev",
        "--budget-ms",
        "5000"
      ],
      {
        store: createMemoryStore(),
        env: {
          GROQ_API_KEY: "test-fake-key-not-real",
          INFERENCE_PROVIDER_ORDER: "groq",
          INFERENCE_MAX_PROVIDERS: "1",
          INFERENCE_MAX_RETRIES: "0"
        },
        outDir,
        fixturesDir: outDir,
        log: (line) => lines.push(line),
        error: (line) => lines.push(line)
      }
    );
    expect(code).toBe(2);
    expect(lines.join("\n")).toContain("PIN MISMATCH");
    expect(lines.join("\n")).toMatch(/snapshot /);
  });

  it("multi-variant live without --models exits 1 with attribution message", async () => {
    const lines: string[] = [];
    const outDir = await mkdtemp(join(tmpdir(), "eval-pin-live-multi-"));
    const code = await runLlmModeForTest(
      [
        "--mode",
        "live",
        "--variants",
        "base,grounded",
        "--max-matches",
        "1",
        "--no-snapshots",
        "--budget-ms",
        "2000"
      ],
      {
        store: createMemoryStore(),
        env: {
          GROQ_API_KEY: "test-fake-key-not-real",
          INFERENCE_PROVIDER_ORDER: "groq",
          INFERENCE_MAX_PROVIDERS: "1",
          INFERENCE_MAX_RETRIES: "0"
        },
        outDir,
        fixturesDir: outDir,
        log: (line) => lines.push(line),
        error: (line) => lines.push(line)
      }
    );
    expect(code).toBe(1);
    expect(lines.join("\n")).toContain(
      "Multi-variant comparison cannot be attributed when failover can reassign providers"
    );
    expect(lines.join("\n")).toContain("--models");
  });

  it("CLI pin disagreeing with manifest pin fails end-to-end via runLlmMode", async () => {
    const { writeFile } = await import("node:fs/promises");
    const lines: string[] = [];
    const outDir = await mkdtemp(join(tmpdir(), "eval-pin-disagree-"));
    await writeFile(
      join(outDir, "manifest.json"),
      `${JSON.stringify(
        {
          version: 1,
          splits: {
            dev: {
              scenarioIds: ["s1"],
              snapshots: false,
              providers: [],
              variants: [
                {
                  id: "base",
                  promptVersion: "agent-v1",
                  scenarioIds: ["s1"],
                  snapshots: false,
                  provider: "groq",
                  model: "openai/gpt-oss-20b"
                }
              ]
            }
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const code = await runLlmModeForTest(
      [
        "--mode",
        "replay",
        "--variants",
        "base",
        "--models",
        "gemini:gemini-3.5-flash-lite",
        "--max-matches",
        "0",
        "--no-snapshots",
        "--suite",
        "dev",
        "--budget-ms",
        "2000"
      ],
      {
        store: createMemoryStore(),
        env: {},
        outDir,
        fixturesDir: outDir,
        log: (line) => lines.push(line),
        error: (line) => lines.push(line)
      }
    );
    expect(code).toBe(1);
    expect(lines.join("\n")).toContain("PIN MISMATCH");
    expect(lines.join("\n")).toContain("gemini:gemini-3.5-flash-lite");
    expect(lines.join("\n")).toContain("groq/openai/gpt-oss-20b");
  });

  it("legacy unpinned multi-variant replay exits 0, withholds comparative deltas", async () => {
    const { readFile, writeFile } = await import("node:fs/promises");
    chatStub.provider = "groq";
    chatStub.model = "openai/gpt-oss-20b";
    const store = createMemoryStore();
    const outDir = await mkdtemp(join(tmpdir(), "eval-pin-withhold-"));
    const env = {
      GROQ_API_KEY: "test-fake-key-not-real",
      INFERENCE_PROVIDER_ORDER: "groq",
      INFERENCE_MAX_PROVIDERS: "1",
      INFERENCE_MAX_RETRIES: "0"
    };
    const recordCode = await runLlmModeForTest(
      [
        "--mode",
        "record",
        "--variants",
        "base,grounded",
        "--models",
        "groq:openai/gpt-oss-20b",
        "--max-matches",
        "0",
        "--snapshot-suite",
        "adversarial",
        "--suite",
        "dev",
        "--budget-ms",
        "15000"
      ],
      {
        store,
        env,
        outDir,
        fixturesDir: outDir,
        log: () => {},
        error: () => {}
      }
    );
    expect(recordCode).toBe(0);

    const manifestPath = join(outDir, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      splits: Record<
        string,
        {
          variants?: Array<{
            provider?: string;
            model?: string;
            [key: string]: unknown;
          }>;
        }
      >;
    };
    for (const split of Object.values(manifest.splits)) {
      for (const v of split.variants ?? []) {
        delete v.provider;
        delete v.model;
        delete v.models;
      }
    }
    await writeFile(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );

    const lines: string[] = [];
    const code = await runLlmModeForTest(
      [
        "--mode",
        "replay",
        "--variants",
        "base,grounded",
        "--max-matches",
        "0",
        "--snapshot-suite",
        "adversarial",
        "--suite",
        "dev",
        "--budget-ms",
        "15000"
      ],
      {
        store,
        env,
        outDir,
        fixturesDir: outDir,
        log: (line) => lines.push(line),
        error: (line) => lines.push(line)
      }
    );
    const text = lines.join("\n");
    expect(code).toBe(0);
    expect(text).toContain("comparison withheld:");
    expect(text).toContain("not comparable");
    expect(text).not.toContain("Δoptimal=");
    expect(text).not.toMatch(/vs greedy/);
    expect(text).toContain("variant:base (not comparable)");
    expect(text).toContain("variant:grounded (not comparable)");

    const replayPayload = JSON.parse(
      await readFile(join(outDir, "replay.json"), "utf8")
    ) as {
      variants: Record<string, Record<string, unknown>>;
    };
    for (const [variantId, entry] of Object.entries(replayPayload.variants)) {
      expect(entry, variantId).not.toHaveProperty("baselineDelta");
    }
  });
});
