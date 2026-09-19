import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decisionRecordFromChoice,
  distinctPromptVersions,
  evalGreedySnapshots,
  formatSnapshotDecisionsDigest,
  promptVersionMismatchMessage
} from "../eval";
import type { DecisionSnapshot } from "../eval/snapshots";

const root = join(import.meta.dirname, "../..");

function loadDevSnapshots(): DecisionSnapshot[] {
  const raw = JSON.parse(
    readFileSync(join(root, "evals/suites/snapshots.dev.json"), "utf8")
  ) as { snapshots: DecisionSnapshot[] };
  return raw.snapshots;
}

describe("auditable snapshot decisions", () => {
  it("greedy decisions array matches snapshot order and shape", () => {
    const snapshots = loadDevSnapshots().slice(0, 3);
    const result = evalGreedySnapshots(snapshots);
    expect(result.decisions).toHaveLength(3);
    for (let i = 0; i < 3; i += 1) {
      const d = result.decisions[i]!;
      expect(d.snapshotId).toBe(snapshots[i]!.id);
      expect(d.promptVersion).toBe("n/a");
      expect(typeof d.executedSkillId).toBe("string");
      expect(typeof d.chosenValue).toBe("number");
      expect(typeof d.bestValue).toBe("number");
      expect(typeof d.regret).toBe("number");
      expect(typeof d.optimal).toBe("boolean");
      expect(d.source).toBe("greedy");
      expect(d).not.toHaveProperty("messages");
    }
    const again = evalGreedySnapshots(snapshots);
    expect(again.decisions).toEqual(result.decisions);
  });

  it("decisionRecordFromChoice is deterministic", () => {
    const snap = loadDevSnapshots()[0]!;
    const skillId = snap.best[0]!;
    const a = decisionRecordFromChoice(snap, skillId, {
      promptVersion: "agent-v1",
      source: "llm"
    });
    const b = decisionRecordFromChoice(snap, skillId, {
      promptVersion: "agent-v1",
      source: "llm"
    });
    expect(a).toEqual(b);
    expect(a.optimal).toBe(true);
    expect(a.regret).toBe(0);
  });

  it("prompt-version mismatch guard fires", () => {
    const snap = loadDevSnapshots()[0]!;
    const skillId = snap.best[0]!;
    const decisions = [
      decisionRecordFromChoice(snap, skillId, {
        promptVersion: "agent-v1",
        source: "llm"
      })
    ];
    expect(promptVersionMismatchMessage("grounded", decisions)).toMatch(
      /PROMPT VERSION MISMATCH/
    );
    expect(promptVersionMismatchMessage("grounded", decisions)).toMatch(
      /agent-v2-grounded/
    );
    expect(promptVersionMismatchMessage("grounded-v2", decisions)).toMatch(
      /PROMPT VERSION MISMATCH/
    );
    expect(promptVersionMismatchMessage("grounded-v2", decisions)).toMatch(
      /agent-v4-grounded/
    );
    expect(
      promptVersionMismatchMessage("base", decisions)
    ).toBeNull();
    const v2Decisions = [
      decisionRecordFromChoice(snap, skillId, {
        promptVersion: "agent-v4-grounded",
        source: "llm"
      })
    ];
    expect(promptVersionMismatchMessage("grounded-v2", v2Decisions)).toBeNull();
  });

  it("digest lists distinct prompt versions", () => {
    const snap = loadDevSnapshots()[0]!;
    const skillId = snap.best[0]!;
    const result = {
      policyId: "llm:base",
      metrics: {
        n: 1,
        optimalRate: 1,
        meanRegret: 0,
        medianRegret: 0,
        maxRegret: 0,
        highRegretCount: 0
      },
      decisions: [
        decisionRecordFromChoice(snap, skillId, {
          promptVersion: "agent-v1",
          source: "llm"
        }),
        decisionRecordFromChoice(snap, skillId, {
          promptVersion: "agent-v1",
          source: "llm"
        })
      ],
      fixtureMissCount: 0
    };
    expect(distinctPromptVersions(result.decisions)).toEqual(["agent-v1"]);
    expect(formatSnapshotDecisionsDigest("base/dev", result)).toContain(
      "promptVersions=agent-v1"
    );
  });
});
