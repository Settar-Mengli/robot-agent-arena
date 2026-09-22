import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildLiveProfile,
  buildTokenProfileFromFixtures,
  mergeLiveProfiles,
  providerFromHost
} from "../eval/live-profile";

describe("live-profile (live-only)", () => {
  it("maps known hosts to provider ids", () => {
    expect(providerFromHost("api.groq.com")).toBe("groq");
    expect(providerFromHost("generativelanguage.googleapis.com")).toBe(
      "gemini"
    );
    expect(providerFromHost("openrouter.ai")).toBe("openrouter");
  });

  it("aggregates only the live samples passed in (no cache hits)", () => {
    const profile = buildLiveProfile(
      [
        {
          provider: "groq",
          model: "openai/gpt-oss-20b",
          durationMs: 100
        },
        {
          provider: "groq",
          model: "openai/gpt-oss-20b",
          durationMs: 200
        },
        {
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
          durationMs: 50
        }
      ],
      { recordedFrom: "2026-09-21", recordedTo: "2026-09-21" }
    );
    expect(profile.label).toBe("live");
    expect(profile.note).toMatch(/fixture cache hits excluded/i);
    expect(profile.rows).toHaveLength(2);
    const groq = profile.rows.find((r) => r.provider === "groq")!;
    expect(groq.n).toBe(2);
    expect(groq.latencyMs.p50).toBe(100);
    expect(groq.latencyMs.p95).toBe(200);
  });

  it("mergeLiveProfiles accumulates n/tokens across runs and does not invent latency", () => {
    const a = buildLiveProfile(
      [
        {
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
          suite: "adversarial",
          durationMs: 80,
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15
        }
      ],
      { recordedFrom: "2026-09-20", recordedTo: "2026-09-20" }
    );
    const b = buildLiveProfile(
      [
        {
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
          suite: "adversarial",
          durationMs: 120,
          promptTokens: 20,
          completionTokens: 8,
          totalTokens: 28
        },
        {
          provider: "groq",
          model: "openai/gpt-oss-20b",
          suite: "adversarial-heldout-ext",
          durationMs: 90,
          promptTokens: 12,
          completionTokens: 4,
          totalTokens: 16
        }
      ],
      { recordedFrom: "2026-09-21", recordedTo: "2026-09-21" }
    );
    const merged = mergeLiveProfiles(a, b);
    expect(merged.label).toBe("live");
    expect(merged.recordedFrom).toBe("2026-09-20");
    expect(merged.recordedTo).toBe("2026-09-21");
    expect(merged.rows).toHaveLength(2);
    const gemini = merged.rows.find((r) => r.provider === "gemini")!;
    expect(gemini.n).toBe(2);
    expect(gemini.tokens.prompt).toBe(30);
    expect(gemini.tokens.completion).toBe(13);
    expect(gemini.tokens.total).toBe(43);
    // Merged rows cannot recompute percentiles without raw samples.
    expect(gemini.latencyMs.p50).toBeNull();
    expect(gemini.latencyMs.p95).toBeNull();
    const groq = merged.rows.find((r) => r.provider === "groq")!;
    expect(groq.n).toBe(1);
    expect(groq.latencyMs.p50).toBe(90);
  });

  it("buildTokenProfileFromFixtures derives tokens only (latency null)", () => {
    const dir = mkdtempSync(join(tmpdir(), "live-profile-fx-"));
    writeFileSync(
      join(dir, "abc.json"),
      JSON.stringify({
        request: { host: "generativelanguage.googleapis.com", model: "gemini-3.5-flash-lite" },
        response: {
          usage: { prompt_tokens: 11, completion_tokens: 3, total_tokens: 14 }
        }
      }),
      "utf8"
    );
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({ version: 1 }),
      "utf8"
    );
    const profile = buildTokenProfileFromFixtures(dir, {
      recordedFrom: "2026-09-21",
      recordedTo: "2026-09-21",
      pins: [{ provider: "gemini", model: "gemini-3.5-flash-lite" }]
    });
    expect(profile.label).toBe("live");
    expect(profile.note).toMatch(/latency unavailable/i);
    expect(profile.rows).toHaveLength(1);
    expect(profile.rows[0]!.n).toBe(1);
    expect(profile.rows[0]!.tokens.prompt).toBe(11);
    expect(profile.rows[0]!.latencyMs.p50).toBeNull();
    expect(profile.rows[0]!.latencyMs.p95).toBeNull();
  });
});
