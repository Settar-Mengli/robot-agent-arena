import { describe, expect, it } from "vitest";
import {
  KNOWN_PROVIDERS,
  parseModelsFlag,
  pinnedInferenceEnv,
  pinMismatchMessage
} from "../eval/bench";

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
});
