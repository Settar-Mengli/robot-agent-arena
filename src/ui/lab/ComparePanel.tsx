import { useMemo, useState } from "react";
import {
  insufficientEvidence,
  llmPolicyKey,
  wilsonInterval,
  type DecisionLabPackV3,
  type DecisionLabPolicyEvidence
} from "../../decision-lab";
import { InfoTip } from "../components/InfoTip";
import { variantDisplayName } from "../copy/display-labels";
import { plainPolicyLabel } from "./help-ranking-copy";

export type ComparePanelProps = {
  pack: DecisionLabPackV3;
  suiteId: string;
  /** Test seam: force evidence banner on/off. */
  forceInsufficientEvidence?: boolean;
};

type CompareMode = "same-model" | "cross-model";

function isRecorded(
  p: DecisionLabPolicyEvidence | undefined
): p is Extract<DecisionLabPolicyEvidence, { status: "recorded" }> {
  return p !== undefined && p.status === "recorded";
}

export function ComparePanel({
  pack,
  suiteId,
  forceInsufficientEvidence
}: ComparePanelProps): React.JSX.Element {
  const [mode, setMode] = useState<CompareMode>("same-model");
  const [pinIndex, setPinIndex] = useState(0);
  const [variantA, setVariantA] = useState<"base" | "grounded" | "freetext">(
    "base"
  );
  const [variantB, setVariantB] = useState<"base" | "grounded" | "freetext">(
    "grounded"
  );
  const [crossVariant, setCrossVariant] = useState<
    "base" | "grounded" | "freetext"
  >("base");

  const pin = pack.modelPins[pinIndex] ?? pack.modelPins[0]!;
  const gemini = pack.modelPins.find((p) => p.provider === "gemini")!;
  const groq = pack.modelPins.find((p) => p.provider === "groq")!;

  const { keyA, keyB, labelA, labelB } = useMemo(() => {
    if (mode === "same-model") {
      return {
        keyA: llmPolicyKey(pin.provider, pin.model, variantA),
        keyB: llmPolicyKey(pin.provider, pin.model, variantB),
        labelA: plainPolicyLabel(
          llmPolicyKey(pin.provider, pin.model, variantA)
        ),
        labelB: plainPolicyLabel(
          llmPolicyKey(pin.provider, pin.model, variantB)
        )
      };
    }
    return {
      keyA: llmPolicyKey(gemini.provider, gemini.model, crossVariant),
      keyB: llmPolicyKey(groq.provider, groq.model, crossVariant),
      labelA: plainPolicyLabel(
        llmPolicyKey(gemini.provider, gemini.model, crossVariant)
      ),
      labelB: plainPolicyLabel(
        llmPolicyKey(groq.provider, groq.model, crossVariant)
      )
    };
  }, [mode, pin, variantA, variantB, crossVariant, gemini, groq]);

  const cohort = pack.cases.filter(
    (c) =>
      c.suiteId === suiteId &&
      isRecorded(c.policies[keyA]) &&
      isRecorded(c.policies[keyB])
  );
  const excluded =
    pack.cases.filter((c) => c.suiteId === suiteId).length - cohort.length;

  let changed = 0;
  let regretA = 0;
  let regretB = 0;
  let optimalA = 0;
  let optimalB = 0;

  for (const c of cohort) {
    const a = c.policies[keyA] as Extract<
      DecisionLabPolicyEvidence,
      { status: "recorded" }
    >;
    const b = c.policies[keyB] as Extract<
      DecisionLabPolicyEvidence,
      { status: "recorded" }
    >;
    regretA += a.regret;
    regretB += b.regret;
    if (a.optimal) optimalA += 1;
    if (b.optimal) optimalB += 1;
    if (a.executedSkillId !== b.executedSkillId) changed += 1;
  }

  const n = cohort.length;
  const wilsonA = wilsonInterval(optimalA, n);
  const wilsonB = wilsonInterval(optimalB, n);
  const thin =
    forceInsufficientEvidence !== undefined
      ? forceInsufficientEvidence
      : insufficientEvidence({ n, wilson: wilsonA }) ||
        insufficientEvidence({ n, wilson: wilsonB });

  const sameVariantBlocked = mode === "same-model" && variantA === variantB;

  return (
    <div className="mt-8" data-testid="lab-compare">
      <h3 className="text-lg font-medium text-stone-100">
        Compare recorded answers
      </h3>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid content-start gap-2 text-stone-400">
          Mode{" "}
          <select
            className="min-h-11 w-full min-w-0 rounded-lg border aa-border bg-stone-900 px-3 py-2"
            value={mode}
            onChange={(e) => setMode(e.target.value as CompareMode)}
            data-testid="compare-mode"
          >
            <option value="same-model">Same model</option>
            <option value="cross-model">Across models</option>
          </select>
        </label>
        {mode === "same-model" ? (
          <>
            <label className="grid content-start gap-2 text-stone-400">
              Model{" "}
              <select
                className="min-h-11 w-full min-w-0 rounded-lg border aa-border bg-stone-900 px-3 py-2"
                value={pinIndex}
                onChange={(e) => setPinIndex(Number(e.target.value))}
                data-testid="compare-model"
              >
                {pack.modelPins.map((p, i) => (
                  <option key={`${p.provider}:${p.model}`} value={i}>
                    {p.provider === "gemini" ? "Gemini" : "Groq"}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid content-start gap-2 text-stone-400">
              First prompt (A){" "}
              <select
                className="min-h-11 w-full min-w-0 rounded-lg border aa-border bg-stone-900 px-3 py-2"
                value={variantA}
                onChange={(e) =>
                  setVariantA(e.target.value as typeof variantA)
                }
                data-testid="compare-variant-a"
              >
                <option value="base" disabled={variantB === "base"}>
                  {variantDisplayName("base")}
                </option>
                <option value="grounded" disabled={variantB === "grounded"}>
                  {variantDisplayName("grounded")}
                </option>
                <option value="freetext" disabled={variantB === "freetext"}>
                  {variantDisplayName("freetext")}
                </option>
              </select>
            </label>
            <label className="grid content-start gap-2 text-stone-400">
              Second prompt (B){" "}
              <select
                className="min-h-11 w-full min-w-0 rounded-lg border aa-border bg-stone-900 px-3 py-2"
                value={variantB}
                onChange={(e) =>
                  setVariantB(e.target.value as typeof variantB)
                }
                data-testid="compare-variant-b"
              >
                <option value="base" disabled={variantA === "base"}>
                  {variantDisplayName("base")}
                </option>
                <option value="grounded" disabled={variantA === "grounded"}>
                  {variantDisplayName("grounded")}
                </option>
                <option value="freetext" disabled={variantA === "freetext"}>
                  {variantDisplayName("freetext")}
                </option>
              </select>
            </label>
          </>
        ) : (
          <label className="grid content-start gap-2 text-stone-400">
            Variant{" "}
            <select
              className="min-h-11 w-full min-w-0 rounded-lg border aa-border bg-stone-900 px-3 py-2"
              value={crossVariant}
              onChange={(e) =>
                setCrossVariant(e.target.value as typeof crossVariant)
              }
              data-testid="compare-cross-variant"
            >
              <option value="base">{variantDisplayName("base")}</option>
              <option value="grounded">{variantDisplayName("grounded")}</option>
              <option value="freetext">{variantDisplayName("freetext")}</option>
            </select>
          </label>
        )}
      </div>

      {sameVariantBlocked ? (
        <p className="mt-4 text-stone-400" data-testid="compare-same-variant">
          Pick two different variants.
        </p>
      ) : (
        <>
          <p
            className="aa-prose mt-5 text-sm leading-relaxed text-stone-400"
            role="status"
          >
            Comparing {labelA} to {labelB}. Compared on {n} situations.
            Excluded: {excluded}. No universal rankings.
            {thin ? (
              <span
                className="mt-1 block text-amber-200/90"
                data-testid="lab-insufficient-evidence"
              >
                Too little data to rank models ({n} situations).
                <InfoTip termId="smallSample" />
              </span>
            ) : null}
          </p>
          {n === 0 ? (
            <p className="mt-4 text-stone-400">No comparable recorded pairs.</p>
          ) : (
            <dl className="mt-5 grid gap-4 text-sm text-stone-300 sm:grid-cols-2">
              <div className="aa-metric" data-testid="compare-matched">
                <dt className="text-stone-400">Situations matched:</dt>{" "}
                <dd className="mt-2 text-2xl font-semibold tabular-nums text-stone-100">
                  {n}
                </dd>
                <dd className="mt-2 text-stone-400">
                  Recorded answers available on both sides.
                </dd>
              </div>
              <div className="aa-metric" data-testid="compare-changed">
                <dt className="text-stone-400">Decisions changed:</dt>{" "}
                <dd className="mt-2 text-2xl font-semibold tabular-nums text-stone-100">
                  {changed} / {n}
                </dd>
                <dd className="mt-2 text-stone-400">
                  Different choices do not necessarily mean better choices.
                </dd>
              </div>
              <div className="aa-metric" data-testid="compare-mean">
                <dt className="text-stone-400">
                  Average points worse than the best move:
                </dt>{" "}
                <dd className="mt-2 text-2xl font-semibold tabular-nums text-stone-100">
                  {(regretA / n).toFixed(2)} → {(regretB / n).toFixed(2)}
                </dd>
                <dd className="mt-2 text-stone-400">
                  Lower is better. Values follow the comparison order above.
                </dd>
              </div>
              <div className="aa-metric">
                <dt className="text-stone-400">Best-move rate:</dt>{" "}
                <dd className="mt-2 text-2xl font-semibold tabular-nums text-stone-100">
                  {((optimalA / n) * 100).toFixed(1)}% →{" "}
                  {((optimalB / n) * 100).toFixed(1)}%
                </dd>
                <dd className="mt-2 text-stone-400">
                  Higher is better. Values follow the comparison order above.
                </dd>
              </div>
            </dl>
          )}
        </>
      )}
    </div>
  );
}
