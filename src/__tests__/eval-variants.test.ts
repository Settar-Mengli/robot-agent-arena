import { describe, expect, it } from "vitest";
import {
  assertQuotaWithinCap,
  deltaVsSuiteBaseline,
  llmCpuPolicy,
  llmPolicyIdForVariant,
  parseVariantsList,
  projectQuotaCalls,
  variantPromptVersion,
  variantToPlayOptions,
  QUOTA_CALL_CAP,
  type SnapshotPolicyMetrics
} from "../eval";
import { wilsonInterval } from "../decision-lab";
import { mergeManifest, manifestVariantsFor } from "../eval/manifest";

function metricsStub(
  partial: Partial<SnapshotPolicyMetrics> &
    Pick<SnapshotPolicyMetrics, "optimalRate" | "meanRegret">
): SnapshotPolicyMetrics {
  const n = partial.n ?? 20;
  const optimalRate = partial.optimalRate;
  const meanRegret = partial.meanRegret;
  const successes = Math.round(optimalRate * n);
  return {
    medianRegret: meanRegret,
    maxRegret: meanRegret,
    highRegretCount: 0,
    optimalRateWilson: wilsonInterval(successes, n),
    meanRegretCi: { low: meanRegret, high: meanRegret, mean: meanRegret },
    ...partial,
    n,
    optimalRate,
    meanRegret
  };
}

describe("prompt-variant ablation helpers", () => {
  it("routes variant ids and play options", () => {
    expect(llmPolicyIdForVariant("base")).toBe("llm:base");
    expect(llmPolicyIdForVariant("grounded+memory")).toBe("llm:grounded+memory");
    expect(variantToPlayOptions("base")).toEqual({
      grounding: "off",
      memory: "off"
    });
    expect(variantToPlayOptions("grounded")).toEqual({
      grounding: "facts",
      memory: "off"
    });
    expect(variantToPlayOptions("grounded-v2")).toEqual({
      grounding: "facts-v2",
      memory: "off"
    });
    expect(variantToPlayOptions("memory")).toEqual({
      grounding: "off",
      memory: "match"
    });
    expect(variantToPlayOptions("grounded+memory")).toEqual({
      grounding: "facts",
      memory: "match"
    });
    expect(llmCpuPolicy({ variant: "grounded" }).id).toBe("llm:grounded");
    expect(llmCpuPolicy({ variant: "grounded-v2" }).id).toBe("llm:grounded-v2");
    expect(llmCpuPolicy().id).toBe("llm:base");
    expect(variantPromptVersion("base")).toBe("agent-v1");
    expect(variantPromptVersion("grounded")).toBe("agent-v2-grounded");
    expect(variantPromptVersion("grounded-v2")).toBe("agent-v4-grounded");
  });

  it("parses variants list with defaults and all", () => {
    expect(parseVariantsList(undefined, "record")).toEqual([
      "base",
      "grounded"
    ]);
    expect(parseVariantsList(undefined, "replay")).toEqual(["base"]);
    expect(parseVariantsList("all", "record")).toEqual([
      "base",
      "grounded",
      "grounded-v2",
      "memory",
      "grounded+memory",
      "freetext",
      "base-repeat",
      "perturb",
      "advctx",
      "info-partial"
    ]);
    expect(parseVariantsList("grounded-v2,base,grounded-v2", "live")).toEqual([
      "grounded-v2",
      "base"
    ]);
    expect(() => parseVariantsList("nope", "record")).toThrow(/unknown variant/);
  });

  it("projects quota and refuses over cap unless forced", () => {
    // base,grounded × (20 snaps + 2 matches × 17) = 2 × (20+34) = 108
    expect(projectQuotaCalls(2, 20, 2)).toBe(108);
    expect(() => assertQuotaWithinCap(108, false)).not.toThrow();
    expect(() => assertQuotaWithinCap(QUOTA_CALL_CAP + 1, false)).toThrow(
      /force-quota/
    );
    expect(() => assertQuotaWithinCap(QUOTA_CALL_CAP + 1, true)).not.toThrow();
  });

  it("manifest round-trip merges variants by id with per-variant scenarioIds", () => {
    const a = {
      version: 1 as const,
      splits: {
        dev: {
          scenarioIds: ["s1"],
          snapshots: true,
          providers: ["groq|m"],
          variants: manifestVariantsFor(["base"], {
            scenarioIds: ["s1"],
            snapshots: true
          })
        }
      }
    };
    const b = {
      version: 1 as const,
      splits: {
        dev: {
          scenarioIds: ["s2"],
          snapshots: false,
          providers: ["gemini|m"],
          variants: manifestVariantsFor(["grounded", "base"], {
            scenarioIds: ["s2"],
            snapshots: false
          })
        }
      }
    };
    const merged = mergeManifest(a, b);
    expect(merged.splits.dev!.scenarioIds).toEqual(["s1", "s2"]);
    expect(merged.splits.dev!.snapshots).toBe(true);
    expect(merged.splits.dev!.variants!.map((v) => v.id)).toEqual([
      "base",
      "grounded"
    ]);
    expect(merged.splits.dev!.variants![0]!.promptVersion).toBe("agent-v1");
    // base keeps s1 and gains s2 from the second patch's base entry
    expect(merged.splits.dev!.variants!.find((v) => v.id === "base")!.scenarioIds).toEqual([
      "s1",
      "s2"
    ]);
    expect(
      merged.splits.dev!.variants!.find((v) => v.id === "grounded")!.scenarioIds
    ).toEqual(["s2"]);
  });

  it("aggregates delta vs measured suite baseline", () => {
    const policy = metricsStub({ optimalRate: 0.7, meanRegret: 0.2 });
    const baseline = metricsStub({ optimalRate: 0.5, meanRegret: 0.5 });
    const delta = deltaVsSuiteBaseline(
      "grounded",
      "heldout",
      "greedy",
      policy,
      baseline
    );
    expect(delta.deltaOptimalRate).toBeCloseTo(0.2);
    expect(delta.deltaMeanRegret).toBeCloseTo(-0.3);
    expect(delta.baseline.optimalRate).toBe(0.5);
    expect(delta.suiteLabel).toBe("heldout");
  });
});
