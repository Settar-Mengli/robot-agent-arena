import { describe, expect, it, vi } from "vitest";
import { SENTINEL_X } from "../../data/opponents";
import { startBattle, stepBattle } from "../../engine";
import type { AgentConfig, BattleRuntime } from "../../engine";
import { createGreedySelector } from "../../agent";
import { createLivePlayTurn } from "./createLivePlayTurn";
import { buildOpenRouterEnv } from "./openrouter-env";
import { LIVE_ERROR } from "./live-errors";

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

function runtimeFor(seed = "live-1"): BattleRuntime {
  return startBattle(playerConfig, SENTINEL_X, seed, 5);
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

function greedyStep(runtime: BattleRuntime, skillId: "skill-logic-storm") {
  const select = createGreedySelector(runtime.session.cpu);
  return stepBattle(runtime, skillId, select);
}

describe("buildOpenRouterEnv", () => {
  it("builds EnvMap from in-memory key only (never process.env)", () => {
    const prev = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "must-not-leak";
    try {
      const env = buildOpenRouterEnv({
        apiKey: "sk-test-memory",
        modelId: "openrouter/free",
        origin: "https://example.test"
      });
      expect(env.OPENROUTER_API_KEY).toBe("sk-test-memory");
      expect(env.OPENROUTER_MODEL).toBe("openrouter/free");
      expect(env.INFERENCE_PROVIDER_ORDER).toBe("openrouter");
      expect(env.INFERENCE_MAX_PROVIDERS).toBe("1");
      expect(env.OPENROUTER_HTTP_REFERER).toBe("https://example.test");
      expect(env.OPENROUTER_X_TITLE).toBe("robot-agent-arena");
      expect(env).not.toHaveProperty("GROQ_API_KEY");
    } finally {
      if (prev === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = prev;
      }
    }
  });
});

describe("createLivePlayTurn", () => {
  it("uses live LLM on mocked fetch success and injects OpenRouter env", async () => {
    const runtime = runtimeFor("live-ok");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      openaiOk('{"skillId":"skill-null-pulse","reason":"guard"}')
    );
    const notices: Array<string | null> = [];

    const playTurn = createLivePlayTurn({
      apiKey: "sk-live",
      modelId: "openrouter/free",
      origin: "https://arena.test",
      fetch: fetchMock,
      onNotice: (m) => notices.push(m)
    });

    const { step, trace } = await playTurn(runtime, "skill-logic-storm");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [
      unknown,
      { headers?: Record<string, string>; body?: string }
    ];
    expect(init?.headers?.Authorization).toBe("Bearer sk-live");
    expect(init?.headers?.["HTTP-Referer"]).toBe("https://arena.test");
    expect(init?.headers?.["X-Title"]).toBe("robot-agent-arena");
    const body = JSON.parse(String(init?.body)) as { model: string; temperature: number };
    expect(body.model).toBe("openrouter/free");
    expect(body.temperature).toBe(0);

    expect(trace?.source).toBe("llm");
    expect(trace?.proposedSkillId).toBe("skill-null-pulse");
    expect(step.turnRecord.actions.find((a) => a.actor === "cpu")?.selectedSkillId).toBe(
      "skill-null-pulse"
    );
    expect(notices).toEqual([null]);
  });

  it("falls back to greedy on 429 and surfaces rate-limit copy", async () => {
    const runtime = runtimeFor("live-429");
    const expected = greedyStep(runtime, "skill-logic-storm");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "rate" }), { status: 429 })
    );
    const notices: Array<string | null> = [];

    const playTurn = createLivePlayTurn({
      apiKey: "sk-live",
      modelId: "openrouter/free",
      fetch: fetchMock,
      onNotice: (m) => notices.push(m)
    });

    const { step, trace } = await playTurn(runtime, "skill-logic-storm");

    expect(step).toEqual(expected);
    expect(trace).toBeUndefined();
    expect(notices).toContain(LIVE_ERROR.rateLimit);
  });

  it("falls back to greedy on network failure", async () => {
    const runtime = runtimeFor("live-net");
    const expected = greedyStep(runtime, "skill-logic-storm");
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const notices: Array<string | null> = [];

    const playTurn = createLivePlayTurn({
      apiKey: "sk-live",
      modelId: "openrouter/free",
      fetch: fetchMock,
      onNotice: (m) => notices.push(m)
    });

    const { step, trace } = await playTurn(runtime, "skill-logic-storm");

    expect(step).toEqual(expected);
    expect(trace).toBeUndefined();
    expect(notices.length).toBe(1);
    expect(
      notices[0] === LIVE_ERROR.networkBlocked ||
        notices[0] === LIVE_ERROR.unreachable
    ).toBe(true);
  });

  it("clears notice on later LLM success", async () => {
    const runtime = runtimeFor("live-recover");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(
        openaiOk('{"skillId":"skill-null-pulse","reason":"ok"}')
      );
    const notices: Array<string | null> = [];

    const playTurn = createLivePlayTurn({
      apiKey: "sk-live",
      modelId: "openrouter/free",
      fetch: fetchMock,
      onNotice: (m) => notices.push(m)
    });

    await playTurn(runtime, "skill-logic-storm");
    expect(notices[notices.length - 1]).toBe(LIVE_ERROR.rateLimit);

    const next = startBattle(playerConfig, SENTINEL_X, "live-recover-2", 5);
    await playTurn(next, "skill-logic-storm");
    expect(notices[notices.length - 1]).toBeNull();
  });

  it("skips onNotice when isNoticeCurrent is false", async () => {
    const runtime = runtimeFor("live-stale-notice");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "rate" }), { status: 429 })
    );
    const notices: Array<string | null> = [];
    let current = true;

    const playTurn = createLivePlayTurn({
      apiKey: "sk-live",
      modelId: "openrouter/free",
      fetch: fetchMock,
      isNoticeCurrent: () => current,
      onNotice: (m) => notices.push(m)
    });

    current = false;
    await playTurn(runtime, "skill-logic-storm");
    expect(notices).toEqual([]);
  });

  it("passes external AbortSignal to fetch", async () => {
    const runtime = runtimeFor("live-abort-sig");
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(
      (_url: unknown, init?: { signal?: AbortSignal }) => {
        expect(init?.signal).toBe(controller.signal);
        return Promise.resolve(
          openaiOk('{"skillId":"skill-null-pulse","reason":"ok"}')
        );
      }
    );

    const playTurn = createLivePlayTurn({
      apiKey: "sk-live",
      modelId: "openrouter/free",
      fetch: fetchMock,
      signal: controller.signal
    });

    await playTurn(runtime, "skill-logic-storm");
    expect(fetchMock).toHaveBeenCalled();
  });
});
