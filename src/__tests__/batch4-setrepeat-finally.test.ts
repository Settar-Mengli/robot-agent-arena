import { describe, expect, it } from "vitest";
import { evalLlmSnapshots } from "../eval/snapshot-eval";
import type { DecisionSnapshot } from "../eval";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const suite = JSON.parse(
  readFileSync(
    join(process.cwd(), "evals/suites/snapshots.adversarial.heldout-ext.json"),
    "utf8"
  )
) as { snapshots: DecisionSnapshot[] };

describe("evalLlmSnapshots setRepeat finally", () => {
  it("restores setRepeat(0) when setRepeat throws mid-call", async () => {
    const slots: number[] = [];
    let threw = false;
    const setRepeat = (n: number): void => {
      slots.push(n);
      if (n === 1 && !threw) {
        threw = true;
        throw new Error("forced mid-call failure");
      }
    };
    const snaps = suite.snapshots.slice(0, 1);

    await expect(
      evalLlmSnapshots(
        snaps,
        {
          inference: {
            env: {
              GROQ_API_KEY: "x",
              INFERENCE_PROVIDER_ORDER: "groq",
              INFERENCE_MAX_PROVIDERS: "1",
              INFERENCE_MAX_RETRIES: "0"
            },
            fetch: async () => new Response("{}", { status: 599 })
          },
          now: () => 0,
          budgetMs: 5000
        },
        "test",
        { fixtureRepeatOffset: 1, setRepeat }
      )
    ).rejects.toThrow(/forced mid-call failure/);

    expect(slots[slots.length - 1]).toBe(0);
    expect(slots).toContain(1);
  });
});
