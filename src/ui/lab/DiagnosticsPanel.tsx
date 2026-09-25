import type {
  DecisionLabPackV3,
  DiagnosticsSummaryV1
} from "../../decision-lab";
import { insufficientEvidence, wilsonInterval } from "../../decision-lab";
import { InfoTip } from "../components/InfoTip";
import { skillLabel } from "../copy/skill-label";
import {
  formatHelpRankingCopy,
  plainPolicyLabel
} from "./help-ranking-copy";

export type DiagnosticsPanelProps = {
  pack: DecisionLabPackV3;
  published: DiagnosticsSummaryV1 | null;
};

const STAKE_BANDS: Record<string, string> = {
  zero: "Best move (0 points)",
  low: "Up to 10 points worse",
  mid: "More than 10, under 100 points worse",
  high: "100+ points worse"
};

function stakeBandLabel(id: string): string {
  return STAKE_BANDS[id] ?? id;
}

export function DiagnosticsPanel({
  pack,
  published
}: DiagnosticsPanelProps): React.JSX.Element {
  const d = pack.diagnostics;

  return (
    <section data-testid="lab-diagnostics" className="mt-6 space-y-6">
      <p className="aa-prose text-sm leading-relaxed text-stone-400">
        Labels describe measured mistakes on recorded answers — not causes.
        Small samples cannot rank models.
        <InfoTip termId="smallSample" />
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="rounded-xl border aa-border bg-stone-900/40 p-5">
          <h3 className="text-lg font-medium text-stone-100">Mistake labels</h3>
          <p
            className="aa-prose mt-2 text-sm leading-relaxed text-stone-300"
            data-testid="cluster-honesty"
          >
            On this recorded set, all 68 labeled mistakes match &quot;spent more
            energy than a cheaper best move.&quot; Other labels (missed finishing
            blow, ignored incoming threat, over-defending) matched 0 times. Labels
            describe what was measured—not why the model chose it.
          </p>
          <dl className="mt-4 divide-y divide-stone-500/40 text-sm">
            {d.clusters.map((c) => (
              <div
                key={c.tag}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <dt className="text-stone-300">{plainTag(c.tag)}</dt>
                <dd className="shrink-0 text-lg font-semibold tabular-nums text-stone-100">
                  {c.count}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border aa-border bg-stone-900/40 p-5">
          <h3 className="text-lg font-medium text-stone-100">
            How costly the mistakes were
          </h3>
          <p className="mt-2 text-sm text-stone-400">
            Recorded answers, grouped by points worse than the best move.
          </p>
          <dl className="mt-4 divide-y divide-stone-500/40 text-sm">
            {d.stakes.map((s) => (
              <div
                key={s.id}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <dt className="text-stone-300">{stakeBandLabel(s.id)}</dt>
                <dd className="shrink-0 text-lg font-semibold tabular-nums text-stone-100">
                  {s.count}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-100">
          Variant comparison
        </h3>
        {d.helpRanking.length === 0 ? (
          <p className="mt-2 text-sm text-stone-400">No paired comparison.</p>
        ) : (
          <ul className="mt-2 space-y-3 text-sm text-stone-300">
            {d.helpRanking.map((h) => {
              const insuff =
                h.insufficientEvidence === true ||
                insufficientEvidence({ n: h.n, wilson: h.wilson });
              const text = formatHelpRankingCopy({
                variantLabel: plainPolicyLabel(h.policyKey),
                baselineLabel: plainPolicyLabel(h.baselineKey),
                improvedCases: h.improvedCases,
                n: h.n,
                meanDeltaRegret: h.meanDeltaRegret,
                insufficientEvidence: insuff
              });
              return (
                <li
                  key={`${h.policyKey}:${h.baselineKey}`}
                  className="rounded-lg border aa-border bg-stone-900/40 p-4"
                >
                  <p className="aa-prose leading-relaxed" data-testid="help-ranking-row">
                    {text}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-100">
          Clearest mistake example
        </h3>
        {d.counterexample === null ? (
          <p className="mt-2 text-sm text-stone-400">None.</p>
        ) : (
          <div
            className="aa-prose mt-3 space-y-3 rounded-xl border aa-border bg-stone-900/40 p-5 text-sm leading-relaxed text-stone-300"
            data-testid="lab-counterexample"
          >
            <p>
              {plainPolicyLabel(d.counterexample.policyKey)} · Points vs best{" "}
              {d.counterexample.regret}
            </p>
            <p>
              Chose {skillLabel(d.counterexample.executedSkillId)}; best{" "}
              {d.counterexample.oracleBest.map(skillLabel).join(", ")}
            </p>
            {d.counterexample.modelReason ? (
              <p className="text-stone-400">
                What the AI wrote:{" "}
                {d.counterexample.modelReason.slice(0, 240)}
                <InfoTip termId="modelReason" />
              </p>
            ) : null}
          </div>
        )}
      </div>

      {published ? (
        <div
          className="rounded-xl border aa-border bg-stone-900/40 p-5"
          data-testid="lab-vs-published"
        >
          <h3 className="text-lg font-medium text-stone-100">
            Matches the published results
          </h3>
          <ul className="mt-3 divide-y divide-stone-500/40 text-sm leading-relaxed text-stone-300">
            {Object.entries(published.optimalRateByPolicy)
              .slice(0, 6)
              .map(([key, row]) => {
                const packRow = packOptimalRate(pack, key);
                const delta =
                  packRow === null ? null : packRow.rate - row.rate;
                return (
                  <li key={key} className="py-3">
                    <span className="font-medium text-stone-100">
                      {plainPolicyLabel(key)}
                    </span>: published best-move rate{" "}
                    {(row.rate * 100).toFixed(1)}%
                    {delta !== null
                      ? ` · change ${(delta * 100).toFixed(1)} points`
                      : ""}
                    {row.insufficientEvidence ||
                    (packRow?.insufficientEvidence ?? false)
                      ? " · Too little data to rank models"
                      : ""}
                  </li>
                );
              })}
          </ul>
        </div>
      ) : null}

      <ul className="aa-prose space-y-2 text-sm leading-relaxed text-stone-400">
        <li>
          Best move is measured against a fixed player plan — not a full-game
          equilibrium.
        </li>
        <li>Mistake labels are descriptions of measurements — not causes.</li>
        <li>Recorded answers are not live AI.</li>
        <li>
          Small samples or wide confidence ranges → too little data to rank
          models.
        </li>
      </ul>
    </section>
  );
}

function plainTag(tag: string): string {
  switch (tag) {
    case "wasted_energy":
      return "Spent more energy than a cheaper best move";
    case "missed_lethal":
      return "Missed finishing blow";
    case "ignored_incoming_threat":
      return "Ignored incoming threat";
    case "over_defending":
      return "Over-defending";
    case "other_suboptimal":
      return "Other miss";
    default:
      return tag;
  }
}

function packOptimalRate(
  pack: DecisionLabPackV3,
  policyKey: string
): { rate: number; insufficientEvidence: boolean } | null {
  let n = 0;
  let optimal = 0;
  for (const c of pack.cases) {
    const p = c.policies[policyKey];
    if (p === undefined || p.status !== "recorded" || p.source !== "llm") {
      continue;
    }
    n += 1;
    if (p.optimal) optimal += 1;
  }
  if (n === 0) return null;
  const wilson = wilsonInterval(optimal, n);
  return {
    rate: optimal / n,
    insufficientEvidence: insufficientEvidence({ n, wilson })
  };
}
