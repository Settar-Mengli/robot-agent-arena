import type {
  DecisionLabPackV3,
  DiagnosticsSummaryV1
} from "../../decision-lab";
import { insufficientEvidence, wilsonInterval } from "../../decision-lab";

export type DiagnosticsPanelProps = {
  pack: DecisionLabPackV3;
  published: DiagnosticsSummaryV1 | null;
};

export function DiagnosticsPanel({
  pack,
  published
}: DiagnosticsPanelProps): React.JSX.Element {
  const d = pack.diagnostics;

  return (
    <section data-testid="lab-diagnostics" className="mt-6 space-y-6">
      <p className="text-sm text-stone-400">
        Batch-8 diagnostics from this pack. Tags are descriptive labels on
        measured suboptimal LLM decisions — not causal. Small n → insufficient
        evidence.
      </p>

      <div>
        <h3 className="text-lg font-medium text-stone-100">Failure clusters</h3>
        <ul className="mt-2 space-y-1 text-sm text-stone-300">
          {d.clusters.map((c) => (
            <li key={c.tag}>
              <code>{c.tag}</code>: {c.count}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-100">Stakes (regret)</h3>
        <ul className="mt-2 space-y-1 text-sm text-stone-300">
          {d.stakes.map((s) => (
            <li key={s.id}>
              {s.label}: {s.count}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-100">What would help</h3>
        {d.helpRanking.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No paired help ranking.</p>
        ) : (
          <ul className="mt-2 space-y-3 text-sm text-stone-300">
            {d.helpRanking.map((h) => (
              <li key={`${h.policyKey}:${h.baselineKey}`}>
                <p>{h.wording}</p>
                {h.insufficientEvidence ? (
                  <p className="text-amber-300/90">insufficient evidence</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-100">Counterexample</h3>
        {d.counterexample === null ? (
          <p className="mt-2 text-sm text-stone-500">None.</p>
        ) : (
          <div className="mt-2 text-sm text-stone-300" data-testid="lab-counterexample">
            <p>
              {d.counterexample.snapshotId} · {d.counterexample.policyKey} ·
              regret {d.counterexample.regret}
            </p>
            <p>Chose {d.counterexample.executedSkillId}; best{" "}
              {d.counterexample.oracleBest.join(", ")}
            </p>
            {d.counterexample.modelReason ? (
              <p className="text-stone-400">
                Model-stated reason: {d.counterexample.modelReason.slice(0, 240)}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {published ? (
        <div
          className="rounded border border-stone-700 bg-stone-900/40 p-4"
          data-testid="lab-vs-published"
        >
          <h3 className="text-lg font-medium text-stone-100">vs published</h3>
          <p className="mt-1 text-xs text-stone-500">
            Read-only strip vs committed diagnostics.summary.json (same artifact
            CI regenerates).
          </p>
          <ul className="mt-3 space-y-2 text-sm text-stone-300">
            {Object.entries(published.optimalRateByPolicy)
              .slice(0, 6)
              .map(([key, row]) => {
                const packRow = packOptimalRate(pack, key);
                const delta =
                  packRow === null ? null : packRow.rate - row.rate;
                return (
                  <li key={key}>
                    <code className="text-xs">{key}</code>: published rate{" "}
                    {(row.rate * 100).toFixed(1)}%
                    {delta !== null
                      ? ` · Δ ${(delta * 100).toFixed(1)} pp`
                      : ""}
                    {row.insufficientEvidence ||
                    (packRow?.insufficientEvidence ?? false)
                      ? " · insufficient evidence"
                      : ""}
                  </li>
                );
              })}
          </ul>
        </div>
      ) : null}

      <ul className="text-xs text-stone-500">
        {d.honesty.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </section>
  );
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
