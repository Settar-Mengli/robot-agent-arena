import { describe, expect, it } from "vitest";
import {
  buildLiveProfile,
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
});
