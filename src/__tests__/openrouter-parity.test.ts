import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_PROVIDERS as browserMaxProviders,
  DEFAULT_MAX_RETRIES as browserMaxRetries,
  DEFAULT_TIMEOUT_MS as browserTimeout,
  resolveActiveProviders as resolveBrowser
} from "../inference/providers.browser";
import {
  DEFAULT_MAX_PROVIDERS as fullMaxProviders,
  DEFAULT_MAX_RETRIES as fullMaxRetries,
  DEFAULT_TIMEOUT_MS as fullTimeout,
  resolveActiveProviders as resolveFull
} from "../inference/providers";
import { OPENROUTER_TEMPLATE } from "../inference/openrouter-template";

describe("OpenRouter provider parity", () => {
  it("shared defaults match across Node and browser modules", () => {
    expect(fullTimeout).toBe(browserTimeout);
    expect(fullMaxProviders).toBe(browserMaxProviders);
    expect(fullMaxRetries).toBe(browserMaxRetries);
    expect(fullTimeout).toBe(8000);
    expect(fullMaxProviders).toBe(3);
    expect(fullMaxRetries).toBe(1);
  });

  it("resolved OpenRouter entries are deep-equal under the same env", () => {
    const env = {
      OPENROUTER_API_KEY: "sk-parity-test",
      OPENROUTER_HTTP_REFERER: "https://example.com/arena",
      OPENROUTER_X_TITLE: "Agent Arena",
      OPENROUTER_MODEL: "openai/gpt-oss-20b:free",
      GROQ_API_KEY: "ignored-in-browser",
      GEMINI_API_KEY: "ignored-in-browser"
    };
    const fromFull = resolveFull(env).find((p) => p.name === "openrouter");
    const fromBrowser = resolveBrowser(env).find((p) => p.name === "openrouter");
    expect(fromFull).toBeDefined();
    expect(fromBrowser).toBeDefined();
    expect(fromBrowser).toEqual(fromFull);
    expect(fromFull!.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(fromFull!.model).toBe("openai/gpt-oss-20b:free");
    expect(fromFull!.extraHeaders).toEqual({
      "HTTP-Referer": "https://example.com/arena",
      "X-Title": "Agent Arena"
    });
    expect(OPENROUTER_TEMPLATE.apiKeyEnvVar).toBe("OPENROUTER_API_KEY");
    expect([...OPENROUTER_TEMPLATE.requiredEnvVars]).toEqual([
      "OPENROUTER_API_KEY"
    ]);
    expect(OPENROUTER_TEMPLATE.defaultModel).toBe("openai/gpt-oss-20b:free");
    expect(OPENROUTER_TEMPLATE.buildBaseUrl(env)).toBe(
      "https://openrouter.ai/api/v1"
    );
  });
});
