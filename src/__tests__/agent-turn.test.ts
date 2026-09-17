import { describe, expect, it, vi } from "vitest";
import { SENTINEL_X } from "../data/opponents";
import { FALLBACK_ACTION_ID, startBattle, stepBattle } from "../engine";
import type { AgentConfig, BattleRuntime } from "../engine";
import { playAgentTurn } from "../agent";

const modules = {
  coreIdentity: "Steady Vanguard",
  memory: "Pattern Recall",
  sigilSecurity: "Aegis Layer",
  rules: "Never Skip Verification",
  strategy: "Measured Pressure"
};

const playerConfig: AgentConfig = {
  agentId: "agent-player-1",
  displayName: "PLAYER-UNIT",
  modules,
  skillIds: ["skill-override-pulse", "skill-logic-storm"]
};

function cloneRuntime(runtime: BattleRuntime): BattleRuntime {
  return JSON.parse(JSON.stringify(runtime)) as BattleRuntime;
}

function openaiOk(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function envWithKeys(): Record<string, string> {
  return {
    GROQ_API_KEY: "groq-key",
    INFERENCE_PROVIDER_ORDER: "groq",
    INFERENCE_MAX_PROVIDERS: "1",
    INFERENCE_MAX_RETRIES: "0"
  };
}

describe("playAgentTurn", () => {
  it("uses a valid LLM proposal (source llm) without consuming RNG", async () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "turn-llm-1", 5);
    const fetchMock = vi.fn().mockResolvedValueOnce(
      openaiOk('{"skillId":"skill-null-pulse","reason":"guard"}')
    );

    const { step, trace } = await playAgentTurn(runtime, "skill-logic-storm", {
      inference: { env: envWithKeys(), fetch: fetchMock, timeoutMs: 1000 }
    });

    expect(trace.source).toBe("llm");
    expect(trace.proposedSkillId).toBe("skill-null-pulse");
    expect(trace.executedSkillId).toBe("skill-null-pulse");
    expect(step.runtime.rng).toEqual(runtime.rng);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to plain stepBattle on invalid JSON (D-015)", async () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "turn-invalid-1", 5);
    const expected = stepBattle(cloneRuntime(runtime), "skill-logic-storm");
    const fetchMock = vi.fn().mockResolvedValueOnce(openaiOk("not-json"));

    const { step, trace } = await playAgentTurn(runtime, "skill-logic-storm", {
      inference: { env: envWithKeys(), fetch: fetchMock, timeoutMs: 1000 }
    });

    expect(trace.source).toBe("fallback");
    expect(trace.fallbackReason).toBe("invalid_output");
    expect(trace.validation).toMatchObject({ ok: false, code: "no_json" });
    expect(step).toEqual(expected);
  });

  it("falls back when the skill is unequipped", async () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "turn-unequipped-1", 5);
    const fetchMock = vi.fn().mockResolvedValueOnce(
      openaiOk('{"skillId":"skill-sigil-rule"}')
    );

    const { trace } = await playAgentTurn(runtime, "skill-logic-storm", {
      inference: { env: envWithKeys(), fetch: fetchMock, timeoutMs: 1000 }
    });

    expect(trace.source).toBe("fallback");
    expect(trace.fallbackReason).toBe("invalid_output");
    expect(trace.validation).toMatchObject({ ok: false, code: "not_equipped" });
  });

  it("falls back on all-providers 500 and records attempts", async () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "turn-500-1", 5);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "nope" }), { status: 500 })
    );

    const { trace } = await playAgentTurn(runtime, "skill-logic-storm", {
      inference: {
        env: {
          GROQ_API_KEY: "groq-key",
          MISTRAL_API_KEY: "mistral-key",
          INFERENCE_PROVIDER_ORDER: "groq,mistral",
          INFERENCE_MAX_PROVIDERS: "2",
          INFERENCE_MAX_RETRIES: "0"
        },
        fetch: fetchMock,
        timeoutMs: 1000
      }
    });

    expect(trace.source).toBe("fallback");
    expect(trace.fallbackReason).toBe("all_providers_failed");
    expect(trace.attempts.length).toBeGreaterThanOrEqual(2);
    expect(trace.failures?.length).toBeGreaterThanOrEqual(2);
  });

  it("respects budgetMs and settles quickly with a single fetch", async () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "turn-budget-1", 5);
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
      });
    };

    const started = performance.now();
    const { trace } = await playAgentTurn(runtime, "skill-logic-storm", {
      budgetMs: 100,
      inference: {
        env: {
          GROQ_API_KEY: "a",
          GEMINI_API_KEY: "b",
          MISTRAL_API_KEY: "c",
          INFERENCE_PROVIDER_ORDER: "groq,gemini,mistral",
          INFERENCE_MAX_PROVIDERS: "3",
          INFERENCE_MAX_RETRIES: "1"
        },
        fetch: fetchMock,
        timeoutMs: 8000
      }
    });
    const elapsed = performance.now() - started;

    expect(trace.source).toBe("fallback");
    expect(trace.fallbackReason).toBe("budget_exceeded");
    expect(fetchCalls).toBe(1);
    expect(elapsed).toBeLessThan(2000);
  });

  it("maps caller abort to cancelled", async () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "turn-cancel-1", 5);
    const controller = new AbortController();
    const fetchMock: typeof fetch = (_input, init) => {
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

    const { trace } = await playAgentTurn(runtime, "skill-logic-storm", {
      signal: controller.signal,
      budgetMs: 10000,
      inference: { env: envWithKeys(), fetch: fetchMock, timeoutMs: 8000 }
    });

    expect(trace.source).toBe("fallback");
    expect(trace.fallbackReason).toBe("cancelled");
  });

  it("skips the LLM on a lethal player move", async () => {
    let runtime = startBattle(playerConfig, SENTINEL_X, "turn-skip-1", 5);
    runtime = cloneRuntime(runtime);
    runtime.cpu = { ...runtime.cpu, health: 1 };
    const fetchMock = vi.fn();

    const { trace } = await playAgentTurn(runtime, "skill-logic-storm", {
      inference: { env: envWithKeys(), fetch: fetchMock, timeoutMs: 1000 }
    });

    expect(trace.source).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps unaffordable LLM proposals as source llm with fallback-stabilize resolution", async () => {
    let runtime = startBattle(playerConfig, SENTINEL_X, "turn-unafford-1", 5);
    runtime = cloneRuntime(runtime);
    runtime.cpu = { ...runtime.cpu, energy: 0 };
    const fetchMock = vi.fn().mockResolvedValueOnce(
      openaiOk('{"skillId":"skill-null-pulse","reason":"try"}')
    );

    const { step, trace } = await playAgentTurn(runtime, "skill-logic-storm", {
      inference: { env: envWithKeys(), fetch: fetchMock, timeoutMs: 1000 }
    });

    expect(trace.source).toBe("llm");
    expect(trace.executedSkillId).toBe("skill-null-pulse");
    expect(trace.resolvedSkillId).toBe(FALLBACK_ACTION_ID);
    const cpuAction = step.turnRecord.actions.find((action) => action.actor === "cpu");
    expect(cpuAction?.fallback).toBe(true);
  });

  it("JSON-serializes the decision trace", async () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "turn-ser-1", 5);
    const fetchMock = vi.fn().mockResolvedValueOnce(
      openaiOk('{"skillId":"skill-null-pulse"}')
    );

    const { trace } = await playAgentTurn(runtime, "skill-logic-storm", {
      inference: { env: envWithKeys(), fetch: fetchMock, timeoutMs: 1000 }
    });

    expect(JSON.parse(JSON.stringify(trace))).toEqual(trace);
  });

  it("falls back with no keys and never fetches", async () => {
    const runtime = startBattle(playerConfig, SENTINEL_X, "turn-nokeys-1", 5);
    const fetchMock = vi.fn();

    const { trace } = await playAgentTurn(runtime, "skill-logic-storm", {
      inference: { env: {}, fetch: fetchMock, timeoutMs: 1000 }
    });

    expect(trace.source).toBe("fallback");
    expect(trace.fallbackReason).toBe("all_providers_failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
