import { describe, expect, it, vi } from "vitest";
import {
  computeBackoffMs,
  parseRetryAfterMs,
  RateLimitStopError,
  sanitizeErrorBody
} from "../inference/rate-limit";
import { createMemoryStore, createRecordingFetch } from "../eval/transport";
import { completeChat } from "../inference/client";

describe("rate-limit helpers", () => {
  it("parses Retry-After seconds and HTTP-date", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
    expect(parseRetryAfterMs("0")).toBe(0);
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfterMs(future, Date.now());
    expect(ms).toBeGreaterThan(4000);
    expect(ms).toBeLessThan(6000);
    expect(parseRetryAfterMs(undefined)).toBeUndefined();
  });

  it("computes exponential backoff with jitter and honors Retry-After floor", () => {
    const fixed = computeBackoffMs(2, {
      baseMs: 100,
      capMs: 10_000,
      random: () => 0.999
    });
    expect(fixed).toBe(400);
    const floored = computeBackoffMs(0, {
      baseMs: 100,
      retryAfterMs: 2500,
      random: () => 0
    });
    expect(floored).toBe(2500);
  });

  it("redacts secrets from error bodies", () => {
    expect(sanitizeErrorBody('Bearer gsk_abc123xyz {"error":"quota"}')).toContain(
      "[redacted"
    );
    expect(sanitizeErrorBody("AIzaSyFakeKeyMaterialHereXXXXXX")).not.toMatch(/AIzaSy/);
  });
});

describe("recording fetch pacing / 429 stop", () => {
  it("delays between live calls but not cache hits", async () => {
    const store = createMemoryStore();
    const sleeps: number[] = [];
    const realFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200
      })
    );
    const recording = createRecordingFetch(realFetch, store, {
      liveDelayMs: 1000,
      sleep: async (ms) => {
        sleeps.push(ms);
      }
    });
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const init = {
      method: "POST",
      body: JSON.stringify({ model: "m", messages: [{ role: "user", content: "a" }] })
    };
    await recording(url, init);
    await recording(url, {
      method: "POST",
      body: JSON.stringify({ model: "m", messages: [{ role: "user", content: "b" }] })
    });
    expect(sleeps.length).toBe(1);
    expect(sleeps[0]).toBeGreaterThan(0);
    // cache hit — no additional live delay wait beyond the prior live gap check
    await recording(url, init);
    expect(realFetch).toHaveBeenCalledTimes(2);
  });

  it("counts fail-by-status and stops after consecutive 429s", async () => {
    const store = createMemoryStore();
    const realFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Resource exhausted" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      })
    );
    const recording = createRecordingFetch(realFetch, store, {
      maxConsecutive429s: 3
    });
    const url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    const call = (n: number) =>
      recording(url, {
        method: "POST",
        body: JSON.stringify({
          model: "gemini-3.5-flash-lite",
          messages: [{ role: "user", content: `x${n}` }]
        })
      });
    await expect(call(1)).resolves.toMatchObject({ status: 429 });
    await expect(call(2)).resolves.toMatchObject({ status: 429 });
    await expect(call(3)).rejects.toBeInstanceOf(RateLimitStopError);
    const stats = recording.stats();
    expect(stats.failByStatus["429"]).toBe(3);
    expect(stats.failBodyByStatus["429"]).toMatch(/Resource exhausted/);
    expect(stats.recorded).toBe(0);
  });
});

describe("completeChat backoff on 429", () => {
  it("sleeps with Retry-After before retry", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "1" }
        });
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok" } }]
        }),
        { status: 200 }
      );
    });
    const result = await completeChat(
      [{ role: "user", content: "hi" }],
      {
        fetch: fetchImpl as unknown as typeof fetch,
        env: {
          GROQ_API_KEY: "test-fake-key-not-real",
          INFERENCE_PROVIDER_ORDER: "groq",
          INFERENCE_MAX_PROVIDERS: "1",
          INFERENCE_MAX_RETRIES: "1"
        },
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        random: () => 0
      }
    );
    expect(result.text).toBe("ok");
    expect(sleeps.length).toBe(1);
    expect(sleeps[0]).toBeGreaterThanOrEqual(1000);
  });
});
