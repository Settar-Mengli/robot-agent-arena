import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findSkillDefinition,
  MVP_SKILL_CATALOG
} from "../engine";
import {
  aggregateLlm,
  percentile,
  randomPolicyExpectation,
  wilsonInterval,
  evalGreedySnapshots,
  evalRandomSnapshots
} from "../eval";
import type { DecisionSnapshot, MatchResult, SnapshotSuite } from "../eval";
import type { DecisionTrace } from "../agent";

const suite = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../evals/suites/snapshots.dev.json"
    ),
    "utf8"
  )
) as SnapshotSuite;

function makeTrace(
  partial: Partial<DecisionTrace> &
    Pick<DecisionTrace, "provider" | "model" | "source">
): DecisionTrace {
  return {
    promptVersion: "test",
    turn: 1,
    budgetMs: 1000,
    elapsedMs: partial.elapsedMs ?? 100,
    observation: null,
    messages: [],
    attempts: partial.attempts ?? [],
    provider: partial.provider,
    model: partial.model,
    usage: partial.usage,
    validation: partial.validation,
    source: partial.source,
    fallbackReason: partial.fallbackReason,
    failures: partial.failures
  };
}

function makeResult(traces: DecisionTrace[]): MatchResult {
  return {
    scenarioId: "test",
    seed: 1,
    playerPolicy: "greedy",
    cpuPolicyId: "llm",
    opponentId: "cpu-fracture",
    turns: traces.map((trace, i) => ({
      turn: i + 1,
      playerSkillId: "skill-override-pulse",
      cpuSource: trace.source,
      trace
    })),
    outcome: { result: "draw", reason: "turn-limit" },
    totalTurns: traces.length,
    finalHpMargin: 0
  };
}

describe("eval metrics", () => {
  it("Wilson CI matches known values", () => {
    const { low, high } = wilsonInterval(50, 100);
    expect(low).toBeCloseTo(0.4038, 3);
    expect(high).toBeCloseTo(0.5962, 3);
  });

  it("percentiles", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([], 50)).toBeNull();
  });

  it("random-policy expectation matches brute-force averaging", () => {
    const snap = suite.snapshots[0]!;
    const exp = randomPolicyExpectation(snap);

    const energy = snap.runtime.cpu.energy;
    const skillIds = snap.runtime.session.cpu.skillIds;
    const affordable = skillIds.filter((id) => {
      const skill = findSkillDefinition(MVP_SKILL_CATALOG, id);
      return skill !== undefined && skill.energyCost <= energy;
    });
    const candidates = affordable.length > 0 ? affordable : [skillIds[0]!];
    const best = new Set(snap.best);
    const optimalRate =
      candidates.filter((id) => best.has(id)).length / candidates.length;
    expect(exp.optimalRate).toBe(optimalRate);
  });

  it("greedy and random snapshot evals return finite metrics", () => {
    const snapshots: DecisionSnapshot[] = suite.snapshots.slice(0, 5);
    const random = evalRandomSnapshots(snapshots);
    const greedy = evalGreedySnapshots(snapshots);
    expect(random.metrics.n).toBe(5);
    expect(greedy.metrics.optimalRate).toBeGreaterThanOrEqual(0);
    expect(greedy.metrics.optimalRate).toBeLessThanOrEqual(1);
  });

  it("aggregateLlm rolls up per provider|model decisions and attempts", () => {
    const results = [
      makeResult([
        makeTrace({
          provider: "gemini",
          model: "gemini-3.5-flash-lite",
          source: "llm",
          elapsedMs: 200,
          validation: { ok: true, skillId: "skill-override-pulse", affordable: true },
          usage: {
            prompt_tokens: 10,
            completion_tokens: 2,
            total_tokens: 12
          },
          attempts: [
            {
              provider: "gemini",
              model: "gemini-3.5-flash-lite",
              attempt: 1,
              ok: false,
              durationMs: 50,
              status: 429
            },
            {
              provider: "gemini",
              model: "gemini-3.5-flash-lite",
              attempt: 2,
              ok: true,
              durationMs: 150
            }
          ]
        }),
        makeTrace({
          provider: "groq",
          model: "openai/gpt-oss-20b",
          source: "llm",
          elapsedMs: 80,
          validation: { ok: true, skillId: "skill-override-pulse", affordable: true },
          usage: {
            prompt_tokens: 5,
            completion_tokens: 1,
            total_tokens: 6
          },
          attempts: [
            {
              provider: "groq",
              model: "openai/gpt-oss-20b",
              attempt: 1,
              ok: true,
              durationMs: 80
            }
          ]
        }),
        makeTrace({
          provider: "openrouter",
          model: "free-model",
          source: "fallback",
          elapsedMs: 300,
          validation: {
            ok: false,
            code: "no_json",
            detail: "invalid_output"
          },
          fallbackReason: "invalid_output",
          attempts: [
            {
              provider: "openrouter",
              model: "free-model",
              attempt: 1,
              ok: false,
              durationMs: 40
            },
            {
              provider: "openrouter",
              model: "free-model",
              attempt: 2,
              ok: true,
              durationMs: 260
            }
          ]
        })
      ])
    ];

    const agg = aggregateLlm(results);
    expect(Object.keys(agg.byProvider)).toEqual([
      "gemini|gemini-3.5-flash-lite",
      "groq|openai/gpt-oss-20b",
      "openrouter|free-model"
    ]);
    expect(agg.decisionValidityRate).toBeCloseTo(2 / 3);
    expect(agg.tokenTotals).toEqual({
      prompt: 15,
      completion: 3,
      total: 18
    });

    const gemini = agg.byProvider["gemini|gemini-3.5-flash-lite"]!;
    expect(gemini.decisions).toBe(1);
    expect(gemini.decisionValidityRate).toBe(1);
    expect(gemini.fallbackCount).toBe(0);
    expect(gemini.attemptsOk).toBe(1);
    expect(gemini.attemptsFailByStatus).toEqual({ "429": 1 });
    expect(gemini.tokenTotals).toEqual({
      prompt: 10,
      completion: 2,
      total: 12
    });

    const groq = agg.byProvider["groq|openai/gpt-oss-20b"]!;
    expect(groq.decisions).toBe(1);
    expect(groq.attemptsOk).toBe(1);
    expect(groq.attemptsFailByStatus).toEqual({});

    const openrouter = agg.byProvider["openrouter|free-model"]!;
    expect(openrouter.decisions).toBe(1);
    expect(openrouter.fallbackCount).toBe(1);
    expect(openrouter.attemptsOk).toBe(1);
    expect(openrouter.attemptsFailByStatus).toEqual({ none: 1 });
  });
});
