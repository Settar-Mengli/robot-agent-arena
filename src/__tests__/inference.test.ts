import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AllProvidersFailedError,
  completeChat,
  extractJson,
  resolveActiveProviders
} from "../inference";

type FetchArgs = [input: string | URL, init?: RequestInit];

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

describe("resolveActiveProviders", () => {
  it("skips providers missing any required env var", () => {
    const providers = resolveActiveProviders({
      GROQ_API_KEY: "groq-key"
      // cloudflare incomplete, others absent
    });

    expect(providers.map((provider) => provider.name)).toEqual(["groq"]);
  });

  it("skips Cloudflare when account id is missing even if token is set", () => {
    const providers = resolveActiveProviders({
      CLOUDFLARE_API_TOKEN: "cf-token"
    });

    expect(providers.find((provider) => provider.name === "cloudflare")).toBeUndefined();
  });

  it("interpolates Cloudflare account id into the base URL when both vars are set", () => {
    const providers = resolveActiveProviders({
      CLOUDFLARE_API_TOKEN: "cf-token",
      CLOUDFLARE_ACCOUNT_ID: "acct-123"
    });

    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("cloudflare");
    expect(providers[0].baseUrl).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct-123/ai/v1"
    );
    expect(providers[0].apiKey).toBe("cf-token");
  });
});

describe("completeChat", () => {
  const messages = [{ role: "user" as const, content: "hi" }];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back from a failing provider to the next success", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(openaiOk("from-b"));

    const result = await completeChat(messages, {
      env: {
        GROQ_API_KEY: "groq-key",
        GEMINI_API_KEY: "gemini-key",
        INFERENCE_PROVIDER_ORDER: "groq,gemini",
        INFERENCE_MAX_PROVIDERS: "2",
        INFERENCE_MAX_RETRIES: "0"
      },
      timeoutMs: 1000
    });

    expect(result.text).toBe("from-b");
    expect(result.provider).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = String(fetchMock.mock.calls[0][0]);
    const secondUrl = String(fetchMock.mock.calls[1][0]);
    expect(firstUrl).toContain("api.groq.com");
    expect(secondUrl).toContain("generativelanguage.googleapis.com");
  });

  it("uses the next provider when the first attempt times out", async () => {
    fetchMock.mockImplementationOnce((_input: string | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("missing abort signal"));
          return;
        }
        if (signal.aborted) {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    fetchMock.mockResolvedValueOnce(openaiOk("after-timeout"));

    const result = await completeChat(messages, {
      env: {
        GROQ_API_KEY: "groq-key",
        MISTRAL_API_KEY: "mistral-key",
        INFERENCE_PROVIDER_ORDER: "groq,mistral",
        INFERENCE_MAX_PROVIDERS: "2",
        INFERENCE_MAX_RETRIES: "0"
      },
      timeoutMs: 50
    });

    expect(result.text).toBe("after-timeout");
    expect(result.provider).toBe("mistral");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws AllProvidersFailedError when every tried provider fails", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "nope" }, 503));

    await expect(
      completeChat(messages, {
        env: {
          GROQ_API_KEY: "groq-key",
          MISTRAL_API_KEY: "mistral-key",
          INFERENCE_PROVIDER_ORDER: "groq,mistral",
          INFERENCE_MAX_PROVIDERS: "2",
          INFERENCE_MAX_RETRIES: "0"
        },
        timeoutMs: 1000
      })
    ).rejects.toBeInstanceOf(AllProvidersFailedError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fetch a provider that is skipped for missing keys", async () => {
    fetchMock.mockResolvedValueOnce(openaiOk("only-gemini"));

    const result = await completeChat(messages, {
      env: {
        // groq missing on purpose
        GEMINI_API_KEY: "gemini-key",
        INFERENCE_PROVIDER_ORDER: "groq,gemini",
        INFERENCE_MAX_PROVIDERS: "3",
        INFERENCE_MAX_RETRIES: "0"
      },
      timeoutMs: 1000
    });

    expect(result.provider).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("api.groq.com");
  });

  it("builds OpenAI chat-completions body with Bearer auth and extra headers", async () => {
    fetchMock.mockResolvedValueOnce(openaiOk('{"ok":true}'));

    await completeChat(messages, {
      json: true,
      temperature: 0.2,
      env: {
        OPENROUTER_API_KEY: "or-key",
        OPENROUTER_HTTP_REFERER: "https://example.test",
        OPENROUTER_X_TITLE: "Arena",
        INFERENCE_PROVIDER_ORDER: "openrouter",
        INFERENCE_MAX_PROVIDERS: "1",
        INFERENCE_MAX_RETRIES: "0"
      },
      timeoutMs: 1000
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as FetchArgs;
    expect(String(url)).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init?.method).toBe("POST");

    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer or-key");
    expect(headers["HTTP-Referer"]).toBe("https://example.test");
    expect(headers["X-Title"]).toBe("Arena");

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.model).toBe("openai/gpt-oss-20b:free");
    expect(body.messages).toEqual(messages);
    expect(body.temperature).toBe(0.2);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("POSTs to the interpolated Cloudflare chat-completions URL", async () => {
    fetchMock.mockResolvedValueOnce(openaiOk("cf-ok"));

    const result = await completeChat(messages, {
      env: {
        CLOUDFLARE_API_TOKEN: "cf-token",
        CLOUDFLARE_ACCOUNT_ID: "acct-xyz",
        INFERENCE_PROVIDER_ORDER: "cloudflare",
        INFERENCE_MAX_PROVIDERS: "1",
        INFERENCE_MAX_RETRIES: "0"
      },
      timeoutMs: 1000
    });

    expect(result.provider).toBe("cloudflare");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct-xyz/ai/v1/chat/completions"
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer cf-token");
  });
});

describe("extractJson", () => {
  it("parses clean JSON", () => {
    expect(extractJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON embedded in prose", () => {
    expect(extractJson<{ skillId: string }>('Sure. {"skillId":"skill-null-pulse"} done.')).toEqual({
      skillId: "skill-null-pulse"
    });
  });

  it("returns null on garbage", () => {
    expect(extractJson("not json at all")).toBeNull();
  });
});
