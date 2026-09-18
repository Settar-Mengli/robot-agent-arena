import { describe, expect, it } from "vitest";
import {
  assertQuotaWithinCap,
  deltaVsGreedyHeldoutBaseline,
  llmCpuPolicy,
  llmPolicyIdForVariant,
  parseVariantsList,
  projectQuotaCalls,
  variantPromptVersion,
  variantToPlayOptions,
  QUOTA_CALL_CAP
} from "../eval";
import { mergeManifest, manifestVariantsFor } from "../eval/manifest";

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
    expect(variantToPlayOptions("memory")).toEqual({
      grounding: "off",
      memory: "match"
    });
    expect(variantToPlayOptions("grounded+memory")).toEqual({
      grounding: "facts",
      memory: "match"
    });
    expect(llmCpuPolicy({ variant: "grounded" }).id).toBe("llm:grounded");
    expect(llmCpuPolicy().id).toBe("llm:base");
    expect(variantPromptVersion("base")).toBe("agent-v1");
    expect(variantPromptVersion("grounded")).toBe("agent-v2-grounded");
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
      "memory",
      "grounded+memory"
    ]);
    expect(parseVariantsList("grounded,base,grounded", "live")).toEqual([
      "grounded",
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

  it("manifest round-trip merges variants by id", () => {
    const a = {
      version: 1 as const,
      splits: {
        dev: {
          scenarioIds: ["s1"],
          snapshots: true,
          providers: ["groq|m"],
          variants: manifestVariantsFor(["base"])
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
          variants: manifestVariantsFor(["grounded", "base"])
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
  });

  it("aggregates delta vs greedy heldout baseline", () => {
    const delta = deltaVsGreedyHeldoutBaseline("grounded", 0.7, 0.2);
    expect(delta.deltaOptimalRate).toBeCloseTo(0.2);
    expect(delta.deltaMeanRegret).toBeCloseTo(-0.3);
  });
});
