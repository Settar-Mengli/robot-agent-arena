import { variantDisplayName } from "../copy/display-labels";

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
    `Comparing ${input.variantLabel} to ${input.baselineLabel}: lower points worse than the best move on ` +
    `${input.improvedCases} of ${input.n} situations. Average change (variant minus baseline) = ` +
    `${meanText}. ${direction} Not a cause.`;
  if (input.insufficientEvidence) {
    text += " Too little data to rank models.";
  }
  return text;
}

export function plainPolicyLabel(policyKey: string): string {
  if (policyKey === "greedy") return "Simple computer";
  const colon = policyKey.lastIndexOf(":");
  if (colon > 0) {
    const left = policyKey.slice(0, colon);
    const variant = policyKey.slice(colon + 1);
    const provider = left.includes("gemini")
      ? "Gemini"
      : left.includes("groq")
        ? "Groq"
        : left;
    return `${provider} ${variantDisplayName(variant)}`;
  }
  return policyKey;
}
