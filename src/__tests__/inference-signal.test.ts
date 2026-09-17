import { describe, expect, it, vi } from "vitest";
import {
  AllProvidersFailedError,
  completeChat
} from "../inference";
import type { AttemptInfo } from "../inference";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function openaiOk(content: string): Response {
  return jsonResponse({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
  });
}

const messages = [{ role: "user" as const, content: "hi" }];

const twoProvidersEnv = {
  GROQ_API_KEY: "groq-key",
  MISTRAL_API_KEY: "mistral-key",
  INFERENCE_PROVIDER_ORDER: "groq,mistral",
  INFERENCE_MAX_PROVIDERS: "2"
};

describe("completeChat external signal and onAttempt", () => {
  it("throws when the signal is already aborted and never calls fetch", async () => {
    const fetchMock = vi.fn();
    const signal = AbortSignal.abort();

    let caught: unknown;
    try {
      await completeChat(messages, {
        env: twoProvidersEnv,
        fetch: fetchMock,
        signal,
        timeoutMs: 1000
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AllProvidersFailedError);
    expect(fetchMock).not.toHaveBeenCalled();
    const failures = (caught as AllProvidersFailedError).failures;
    expect(failures[failures.length - 1]?.reason).toBe("aborted");
  });

  it("treats mid-request external abort as terminal: one fetch, no retry, no next provider", async () => {
    const controller = new AbortController();
    let fetchCalls = 0;
    const fetchMock: typeof fetch = (_input, init) => {
      fetchCalls += 1;
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("missing abort signal"));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
        queueMicrotask(() => controller.abort());
      });
    };

    const started = performance.now();
    let caught: unknown;
    try {
      await completeChat(messages, {
        env: {
          ...twoProvidersEnv,
          INFERENCE_MAX_RETRIES: "1"
        },
        fetch: fetchMock,
        signal: controller.signal,
        timeoutMs: 8000
      });
    } catch (error) {
      caught = error;
    }
    const elapsed = performance.now() - started;

    expect(caught).toBeInstanceOf(AllProvidersFailedError);
    expect(fetchCalls).toBe(1);
    expect(elapsed).toBeLessThan(2000);
    const failures = (caught as AllProvidersFailedError).failures;
    expect(failures[failures.length - 1]?.reason).toBe("aborted");
  });

  it("retries per-attempt timeout without an external signal (reason stays timeout)", async () => {
    let call = 0;
    const fetchMock: typeof fetch = (_input, init) => {
      call += 1;
      if (call === 1) {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("missing abort signal"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        });
      }
      return Promise.resolve(openaiOk("recovered"));
    };

    const attempts: AttemptInfo[] = [];
    const result = await completeChat(messages, {
      env: {
        GROQ_API_KEY: "groq-key",
        INFERENCE_PROVIDER_ORDER: "groq",
        INFERENCE_MAX_PROVIDERS: "1",
        INFERENCE_MAX_RETRIES: "1"
      },
      fetch: fetchMock,
      timeoutMs: 50,
      onAttempt: (info) => attempts.push(info)
    });

    expect(result.text).toBe("recovered");
    expect(call).toBe(2);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.ok).toBe(false);
    expect(attempts[0]?.reason).toBe("timeout");
    expect(attempts[1]?.ok).toBe(true);
  });

  it("fires onAttempt once per attempt with provider/model/attempt/ok/status and finite durationMs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(openaiOk("ok"));

    const attempts: AttemptInfo[] = [];
    const result = await completeChat(messages, {
      env: {
        ...twoProvidersEnv,
        INFERENCE_MAX_RETRIES: "0"
      },
      fetch: fetchMock,
      timeoutMs: 1000,
      onAttempt: (info) => attempts.push({ ...info })
    });

    expect(result.text).toBe("ok");
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({
      provider: "groq",
      model: "openai/gpt-oss-20b",
      attempt: 1,
      ok: false,
      status: 500
    });
    expect(Number.isFinite(attempts[0]!.durationMs)).toBe(true);
    expect(attempts[0]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(attempts[1]).toMatchObject({
      provider: "mistral",
      model: "mistral-small-latest",
      attempt: 1,
      ok: true
    });
    expect(Number.isFinite(attempts[1]!.durationMs)).toBe(true);
  });

  it("swallows a throwing onAttempt and still returns success", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(openaiOk("still-ok"));

    const result = await completeChat(messages, {
      env: {
        GROQ_API_KEY: "groq-key",
        INFERENCE_PROVIDER_ORDER: "groq",
        INFERENCE_MAX_PROVIDERS: "1",
        INFERENCE_MAX_RETRIES: "0"
      },
      fetch: fetchMock,
      timeoutMs: 1000,
      onAttempt: () => {
        throw new Error("hook boom");
      }
    });

    expect(result.text).toBe("still-ok");
  });

  it("populates optional model/attempt/status/durationMs on failure entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "nope" }, 503));

    try {
      await completeChat(messages, {
        env: {
          GROQ_API_KEY: "groq-key",
          INFERENCE_PROVIDER_ORDER: "groq",
          INFERENCE_MAX_PROVIDERS: "1",
          INFERENCE_MAX_RETRIES: "0"
        },
        fetch: fetchMock,
        timeoutMs: 1000
      });
      expect.unreachable("expected AllProvidersFailedError");
    } catch (error) {
      expect(error).toBeInstanceOf(AllProvidersFailedError);
      const failure = (error as AllProvidersFailedError).failures[0];
      expect(failure?.provider).toBe("groq");
      expect(failure?.model).toBe("openai/gpt-oss-20b");
      expect(failure?.attempt).toBe(1);
      expect(failure?.status).toBe(503);
      expect(failure?.durationMs).toBeGreaterThanOrEqual(0);
      expect(failure?.reason).toContain("HTTP 503");
    }
  });
});
