import { describe, expect, it } from "vitest";
import { insufficientEvidence, wilsonInterval } from "../../decision-lab";
import {
  formatHelpRankingCopy,
  plainPolicyLabel
} from "./help-ranking-copy";

describe("helpRankingCopy", () => {
  it("positive meanDelta says worse / negative says better", () => {
    const worse = formatHelpRankingCopy({
      variantLabel: "Gemini with facts",
      baselineLabel: "Gemini basic",
      improvedCases: 0,
      n: 13,
      meanDeltaRegret: 0.15,
      insufficientEvidence: true
    });
    expect(worse).toMatch(/worse/);
    expect(worse).toMatch(/0\.15/);
    expect(worse).toMatch(/Too little data to rank models/);
    expect(worse).not.toMatch(/coincided with lower regret/);

    const better = formatHelpRankingCopy({
      variantLabel: "Groq with facts",
      baselineLabel: "Groq basic",
      improvedCases: 1,
      n: 13,
      meanDeltaRegret: -0.15,
      insufficientEvidence: true
    });
    expect(better).toMatch(/better/);
    expect(better).toMatch(/-0\.15/);
  });

  it("evidence label follows insufficientEvidence", () => {
    const n = 13;
    const wilson = wilsonInterval(0, n);
    const insuff = insufficientEvidence({ n, wilson });
    expect(insuff).toBe(true);
    const withFlag = formatHelpRankingCopy({
      variantLabel: "A",
      baselineLabel: "B",
      improvedCases: 0,
      n,
      meanDeltaRegret: 0,
      insufficientEvidence: insuff
    });
    expect(withFlag).toMatch(/Too little data/);

    const okN = 40;
    const okWilson = wilsonInterval(20, okN);
    const ok = insufficientEvidence({ n: okN, wilson: okWilson });
    expect(ok).toBe(false);
    const without = formatHelpRankingCopy({
      variantLabel: "A",
      baselineLabel: "B",
      improvedCases: 10,
      n: okN,
      meanDeltaRegret: -1,
      insufficientEvidence: ok
    });
    expect(without).not.toMatch(/Too little data/);
    expect(without).toMatch(/Not a cause/);
  });

  it("plainPolicyLabel maps keys", () => {
    expect(
      plainPolicyLabel("llm:gemini:gemini-3.5-flash-lite:base")
    ).toBe("Gemini basic");
  });
});
