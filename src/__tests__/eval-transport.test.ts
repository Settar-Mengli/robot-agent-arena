import { describe, expect, it, vi } from "vitest";
import {
  createMemoryStore,
  createRecordingFetch,
  createReplayFetch,
  fixtureKey,
  llmCpuPolicy,
  runMatch,
  buildMatchSuite,
  aggregateLlm
} from "../eval";
import { startBattle } from "../engine";
import { playAgentTurn } from "../agent";

function envWithKeys(): Record<string, string> {
  return {
    GROQ_API_KEY: "test-fake-key-not-real",
    INFERENCE_PROVIDER_ORDER: "groq",
    INFERENCE_MAX_PROVIDERS: "1",
    INFERENCE_MAX_RETRIES: "0"
  };
}

function openaiOk(skillId: string): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({ skillId, reason: "eval" })
          }
        }
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("recorded LLM transport", () => {
  it("fixtureKey is stable and changes with the prompt", () => {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const bodyA = {
      model: "m",
      messages: [{ role: "user", content: "a" }],
      temperature: 0
    };
    const bodyB = {
      model: "m",
      messages: [{ role: "user", content: "b" }],
      temperature: 0
    };
    expect(fixtureKey(url, bodyA)).toBe(fixtureKey(url, bodyA));
    expect(fixtureKey(url, bodyA)).not.toBe(fixtureKey(url, bodyB));
  });

  it("replay known fixture → source llm; unknown → fallback + fixture_miss", async () => {
    const scenario = buildMatchSuite("dev").find(
      (s) => s.cpuConfig.skillIds.includes("skill-null-pulse")
    )!;
    const store = createMemoryStore();

    const realFetch = vi.fn().mockResolvedValue(
      openaiOk(scenario.cpuConfig.skillIds[0]!)
    );
    const recording = createRecordingFetch(realFetch, store);

    const runtime = startBattle(
      scenario.playerConfig,
      scenario.cpuConfig,
      scenario.seed
    );
    await playAgentTurn(runtime, scenario.playerConfig.skillIds[0]!, {
      inference: { env: envWithKeys(), fetch: recording },
      now: () => 0
    });

    expect(store.map.size).toBeGreaterThan(0);

    const replay = createReplayFetch(store);
    const { trace: hit } = await playAgentTurn(
      runtime,
      scenario.playerConfig.skillIds[0]!,
      {
        inference: { env: envWithKeys(), fetch: replay },
        now: () => 0
      }
    );
    expect(hit.source).toBe("llm");

    const emptyReplay = createReplayFetch(createMemoryStore());
    const match = await runMatch(
      scenario,
      llmCpuPolicy({
        inference: { env: envWithKeys(), fetch: emptyReplay },
        now: () => 0,
        budgetMs: 5000
      })
    );
    const llmAgg = aggregateLlm([match]);
    expect(match.turns.some((t) => t.trace?.source === "fallback")).toBe(true);
    expect(llmAgg.fixtureMissCount).toBeGreaterThan(0);
  });

  it("sanitize-on-record strips junk fields but keeps content and usage", async () => {
    const store = createMemoryStore();
    const realFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "chatcmpl-volatile",
          created: 1_700_000_000,
          choices: [
            {
              message: {
                content: JSON.stringify({
                  skillId: "skill-override-pulse",
                  reason: "eval"
                }),
                extra_content: { google: { thought_signature: "sig" } }
              },
              thought_signature: "top-sig"
            }
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          extra_content: { noise: true }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const recording = createRecordingFetch(realFetch, store);
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const init = {
      method: "POST",
      body: JSON.stringify({
        model: "m",
        messages: [{ role: "user", content: "sanitize-me" }]
      })
    };

    const live = await recording(url, init);
    const liveBody = (await live.json()) as Record<string, unknown>;
    expect(liveBody.id).toBe("chatcmpl-volatile");

    const stored = [...store.map.values()][0]!;
    const storedText = JSON.stringify(stored.response);
    expect(storedText).not.toContain("chatcmpl-volatile");
    expect(storedText).not.toContain("thought_signature");
    expect(storedText).not.toContain("extra_content");
    expect(storedText).not.toMatch(/"created"/);
    expect(storedText).not.toMatch(/"id"/);

    const replayed = (await (
      await createReplayFetch(store)(url, init)
    ).json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { total_tokens: number };
    };
    expect(replayed.choices[0]!.message.content).toContain("skill-override-pulse");
    expect(replayed.usage.total_tokens).toBe(15);
  });

  it("recording fetch never persists headers or secrets", async () => {
    const store = createMemoryStore();
    const fakeKey = "sk-secret-Bearer-authorization-value";
    const realFetch = vi.fn().mockImplementation(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toContain("Bearer");
      return openaiOk("skill-override-pulse");
    });
    const recording = createRecordingFetch(realFetch, store);
    await recording("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fakeKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "m",
        messages: [{ role: "user", content: "hi" }]
      })
    });

    const stored = [...store.map.values()][0]!;
    const text = JSON.stringify(stored);
    expect(text.toLowerCase()).not.toContain("authorization");
    expect(text).not.toContain("Bearer");
    expect(text).not.toContain(fakeKey);
  });

  it("serves a second identical request from the store without calling realFetch", async () => {
    const store = createMemoryStore();
    const realFetch = vi.fn().mockResolvedValue(openaiOk("skill-override-pulse"));
    const recording = createRecordingFetch(realFetch, store);
    const init = {
      method: "POST",
      body: JSON.stringify({
        model: "m",
        messages: [{ role: "user", content: "cache-me" }],
        temperature: 0
      })
    };
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const first = await recording(url, init);
    expect(first.status).toBe(200);
    const second = await recording(url, init);
    expect(second.status).toBe(200);

    expect(realFetch).toHaveBeenCalledTimes(1);
    const stats = recording.stats();
    expect(stats.hits).toBe(1);
    expect(stats.recorded).toBe(1);
    expect(stats.liveLatenciesMs).toHaveLength(1);
  });

  it("force: true bypasses the cache and overwrites", async () => {
    const store = createMemoryStore();
    const realFetch = vi
      .fn()
      .mockResolvedValueOnce(openaiOk("skill-override-pulse"))
      .mockResolvedValueOnce(openaiOk("skill-null-pulse"));
    const recording = createRecordingFetch(realFetch, store, { force: true });
    const init = {
      method: "POST",
      body: JSON.stringify({
        model: "m",
        messages: [{ role: "user", content: "force-me" }]
      })
    };
    const url = "https://api.groq.com/openai/v1/chat/completions";

    await recording(url, init);
    await recording(url, init);

    expect(realFetch).toHaveBeenCalledTimes(2);
    expect(recording.stats().hits).toBe(0);
    expect(recording.stats().recorded).toBe(2);
    expect(recording.stats().liveLatenciesMs).toHaveLength(2);

    const body = (await (await createReplayFetch(store)(url, init)).json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    expect(body.choices[0]!.message.content).toContain("skill-null-pulse");
  });

  it("does not store non-2xx responses", async () => {
    const store = createMemoryStore();
    const realFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "quota" }), { status: 429 })
    );
    const recording = createRecordingFetch(realFetch, store);
    const res = await recording(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify({ model: "m", messages: [] })
      }
    );
    expect(res.status).toBe(429);
    expect(store.map.size).toBe(0);
    expect(recording.stats().skippedNon2xx).toBe(1);
    expect(recording.stats().recorded).toBe(0);
    expect(recording.stats().liveLatenciesMs).toHaveLength(1);
  });

  it("repeat 0 / absent ≡ legacy key; repeat 1 differs", () => {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const body = {
      model: "m",
      messages: [{ role: "user", content: "a" }],
      temperature: 0,
      response_format: { type: "json_object" }
    };
    const legacy = fixtureKey(url, body);
    expect(fixtureKey(url, body, 0)).toBe(legacy);
    expect(fixtureKey(url, body, undefined)).toBe(legacy);
    expect(fixtureKey(url, body, 1)).not.toBe(legacy);
  });

  it("reconstructs committed fixture key at repeat 0", async () => {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const key =
      "037aafcc80c818a19572015c4519d7ea8b755a29e72d8d15ba46b2b94371d277";
    const record = JSON.parse(
      await readFile(join("evals/fixtures", `${key}.json`), "utf8")
    ) as {
      key: string;
      request: { host: string; model: string; messages: unknown };
    };
    const url = `https://${record.request.host}/v1beta/openai/chat/completions`;
    const body = {
      model: record.request.model,
      messages: record.request.messages,
      temperature: 0,
      response_format: { type: "json_object" }
    };
    expect(fixtureKey(url, body, 0)).toBe(record.key);
    expect(fixtureKey(url, body, 1)).not.toBe(record.key);
  });

  it("cache hit/miss is per-repeat; recording stores separate entries", async () => {
    const store = createMemoryStore();
    const realFetch = vi
      .fn()
      .mockResolvedValueOnce(openaiOk("skill-override-pulse"))
      .mockResolvedValueOnce(openaiOk("skill-null-pulse"));
    const recording = createRecordingFetch(realFetch, store);
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const init = {
      method: "POST",
      body: JSON.stringify({
        model: "m",
        messages: [{ role: "user", content: "repeat-body" }],
        temperature: 0
      })
    };

    recording.setRepeat(0);
    await recording(url, init);
    recording.setRepeat(1);
    await recording(url, init);

    expect(realFetch).toHaveBeenCalledTimes(2);
    expect(store.map.size).toBe(2);
    expect(recording.stats().recorded).toBe(2);

    const replay = createReplayFetch(store);
    replay.setRepeat(0);
    const r0 = (await (await replay(url, init)).json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    expect(r0.choices[0]!.message.content).toContain("skill-override-pulse");

    replay.setRepeat(1);
    const r1 = (await (await replay(url, init)).json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    expect(r1.choices[0]!.message.content).toContain("skill-null-pulse");

    // realFetch never sees repeat — only body fields
    for (const call of realFetch.mock.calls) {
      const body = JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
      expect(body.repeat).toBeUndefined();
      expect(Object.keys(body).sort()).toEqual(
        ["messages", "model", "temperature"].sort()
      );
    }
  });
});
