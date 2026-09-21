import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createReplayFetch,
  type FixtureRecord,
  type FixtureStore
} from "../eval/transport";
import { evalLlmSnapshots } from "../eval/snapshot-eval";
import { buildDecisionLabPack } from "../eval/lab-pack";
import type { DecisionSnapshot } from "../eval/snapshots";

function memoryStore(map: Map<string, FixtureRecord> = new Map()): FixtureStore {
  return {
    read: async (key) => map.get(key),
    write: async (key, record) => {
      map.set(key, record);
    }
  };
}

describe("evalLlmSnapshots onDecision seam", () => {
  it("omitting onDecision leaves metrics/decisions unchanged vs no-op", async () => {
    const suite = JSON.parse(
      await readFile(
        join(process.cwd(), "evals/suites/snapshots.adversarial.heldout.json"),
        "utf8"
      )
    ) as { snapshots: DecisionSnapshot[] };
    const snaps = suite.snapshots.slice(0, 1);
    const replay = createReplayFetch(memoryStore());
    const opts = {
      inference: {
        env: {
          GEMINI_API_KEY: "x",
          INFERENCE_PROVIDER_ORDER: "gemini",
          INFERENCE_MAX_PROVIDERS: "1",
          INFERENCE_MAX_RETRIES: "0",
          INFERENCE_GEMINI_MODEL: "gemini-3.5-flash-lite"
        },
        fetch: replay
      },
      now: () => 0,
      budgetMs: 5000
    } as const;

    const without = await evalLlmSnapshots(snaps, opts, "p");
    const withNoop = await evalLlmSnapshots(snaps, opts, "p", {
      onDecision: () => undefined
    });
    expect(JSON.stringify(withNoop.metrics)).toBe(JSON.stringify(without.metrics));
    expect(JSON.stringify(withNoop.decisions)).toBe(
      JSON.stringify(without.decisions)
    );
    expect(withNoop.fixtureMissCount).toBe(without.fixtureMissCount);
  });

  it("onDecision receives primary PlayAgentTurnResult once per snapshot", async () => {
    const suite = JSON.parse(
      await readFile(
        join(process.cwd(), "evals/suites/snapshots.adversarial.heldout.json"),
        "utf8"
      )
    ) as { snapshots: DecisionSnapshot[] };
    const snaps = suite.snapshots.slice(0, 2);
    const replay = createReplayFetch(memoryStore());
    const seen: string[] = [];
    await evalLlmSnapshots(
      snaps,
      {
        inference: {
          env: {
            GEMINI_API_KEY: "x",
            INFERENCE_PROVIDER_ORDER: "gemini",
            INFERENCE_MAX_PROVIDERS: "1",
            INFERENCE_MAX_RETRIES: "0",
            INFERENCE_GEMINI_MODEL: "gemini-3.5-flash-lite"
          },
          fetch: replay
        },
        now: () => 0,
        budgetMs: 5000
      },
      "p",
      {
        onDecision: (snap, primary) => {
          seen.push(snap.id);
          expect(primary.trace).toBeDefined();
        }
      }
    );
    expect(seen).toEqual(snaps.map((s) => s.id));
  });
});

describe("lab-pack replay safety", () => {
  it("fixture miss never reaches globalThis.fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("global fetch must not be called");
    });
    try {
      const emptyReplay = createReplayFetch(memoryStore());
      const { pack } = await buildDecisionLabPack({
        fetch: emptyReplay,
        dryRun: true
      });
      expect(pack.cases).toHaveLength(13);
      for (const c of pack.cases) {
        expect(c.policies["llm:base"].status).toBe("unavailable");
        expect(c.policies["llm:grounded"].status).toBe("unavailable");
        expect("executedSkillId" in c.policies["llm:base"]).toBe(false);
        expect("executedSkillId" in c.policies["llm:grounded"]).toBe(false);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("regen is byte-identical to committed decision-lab.v1.json", async () => {
    const committed = await readFile(
      join(process.cwd(), "src/ui/lab/pack/decision-lab.v1.json"),
      "utf8"
    );
    const { json } = await buildDecisionLabPack({ dryRun: true });
    expect(json).toBe(committed);
  });

  it("two dryRun exports are byte-identical", async () => {
    const a = await buildDecisionLabPack({ dryRun: true });
    const b = await buildDecisionLabPack({ dryRun: true });
    expect(a.json).toBe(b.json);
  });
});
