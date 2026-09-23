export type HelpRankingCopyInput = {
  variantLabel: string;
  baselineLabel: string;
  improvedCases: number;
  n: number;
  meanDeltaRegret: number;
  insufficientEvidence: boolean;
};

/** Plain help-row text. Caller must pass insufficientEvidence from stats. */
export function formatHelpRankingCopy(input: HelpRankingCopyInput): string {
  const mean = input.meanDeltaRegret;
  const meanText = mean.toFixed(2);
  const direction =
    mean > 0
      ? "Positive means the variant did worse."
      : "Negative means the variant did better.";
  let text =
    `Comparing ${input.variantLabel} to ${input.baselineLabel}: lower miss score on ` +
    `${input.improvedCases} of ${input.n} situations. Average change (variant minus baseline) = ` +
    `${meanText}. ${direction} Not a cause.`;
  if (input.insufficientEvidence) {
    text += " Too little data to rank models.";
  }
  return text;
}

export function plainPolicyLabel(policyKey: string): string {
  if (policyKey.includes("gemini") && policyKey.endsWith(":base")) {
    return "Gemini basic";
  }
  if (policyKey.includes("gemini") && policyKey.endsWith(":grounded")) {
    return "Gemini with facts";
  }
  if (policyKey.includes("gemini") && policyKey.endsWith(":freetext")) {
    return "Gemini free-text";
  }
  if (policyKey.includes("groq") && policyKey.endsWith(":base")) {
    return "Groq basic";
  }
  if (policyKey.includes("groq") && policyKey.endsWith(":grounded")) {
    return "Groq with facts";
  }
  if (policyKey.includes("groq") && policyKey.endsWith(":freetext")) {
    return "Groq free-text";
  }
  if (policyKey === "greedy") return "Simple computer";
  return policyKey;
}
