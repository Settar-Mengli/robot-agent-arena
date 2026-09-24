export type MethodologyViewProps = {
  onHome?: () => void;
};

/**
 * Plain-language methodology for recorded Arena evidence vs opt-in live play.
 */
export function MethodologyView({
  onHome
}: MethodologyViewProps): React.JSX.Element {
  return (
    <section
      aria-labelledby="methodology-heading"
      data-testid="methodology-view"
      className="space-y-8"
    >
      <div>
        <h1
          id="methodology-heading"
          tabIndex={-1}
          className="text-2xl font-semibold text-stone-100"
        >
          Methodology
        </h1>
        <p className="mt-2 text-stone-400">
          How Agent Arena measures decisions from recorded evidence — and what
          live play is not.
        </p>
      </div>

      <section aria-labelledby="method-measured">
        <h2 id="method-measured" className="text-lg font-medium text-stone-200">
          What we measure
        </h2>
        <p className="mt-2 text-stone-400">
          On fixed battle snapshots, we record which skill an agent chooses and
          score it against a known best move (oracle). Primary comparisons use
          paired regret differences with a seeded bootstrap confidence interval —
          not a live chat scoreboard.
        </p>
      </section>

      <section aria-labelledby="method-oracle">
        <h2 id="method-oracle" className="text-lg font-medium text-stone-200">
          Oracle
        </h2>
        <p className="mt-2 text-stone-400">
          The oracle is a fixed, deterministic ranking of legal moves for each
          snapshot. &quot;Best move&quot; means best against that fixed player
          plan — not a claim about all possible games.
        </p>
      </section>

      <section aria-labelledby="method-suites">
        <h2 id="method-suites" className="text-lg font-medium text-stone-200">
          Suites
        </h2>
        <p className="mt-2 text-stone-400">
          Primary evidence uses a held-out adversarial suite with n≥30. A
          secondary n=13 arm is always labeled insufficient evidence. Suites are
          never mixed when ranking or grouping models.
        </p>
      </section>

      <section aria-labelledby="method-metrics">
        <h2 id="method-metrics" className="text-lg font-medium text-stone-200">
          Metrics
        </h2>
        <p className="mt-2 text-stone-400">
          Decision claims use mean Δregret with a 95% bootstrap CI. Wilson
          intervals on optimal rate are for display and overlap grouping on the
          leaderboard — they are not the primary decision criterion.
        </p>
      </section>

      <section aria-labelledby="method-recorded">
        <h2 id="method-recorded" className="text-lg font-medium text-stone-200">
          Recorded vs live
        </h2>
        <p className="mt-2 text-stone-400">
          Watch and Lab show committed, replayable recordings. Opt-in OpenRouter
          live play (bring your own key) is entertainment only: not recorded
          evidence, not on the leaderboard, and answers can change.
        </p>
      </section>

      <section aria-labelledby="method-limits">
        <h2 id="method-limits" className="text-lg font-medium text-stone-200">
          Limitations
        </h2>
        <p className="mt-2 text-stone-400">
          Small samples cannot rank models. Overlapping confidence intervals mean
          models cannot be separated with this data. Family-wise error is not
          controlled across the pre-registered comparison set.
        </p>
      </section>

      <details className="rounded border border-stone-800 px-4 py-3 text-sm text-stone-400">
        <summary className="cursor-pointer text-stone-300">Advanced</summary>
        <div className="mt-3 space-y-3">
          <p>
            Pre-registration (Batch 4):{" "}
            <span className="font-mono text-stone-300">
              docs/preregistration-batch4.md
            </span>
          </p>
          <p>
            Bootstrap defaults: seed 0xA11CE, B=2000, alpha=0.05
            (decision-lab stats). Recorder temperature 0; OpenRouter-only if live
            play is enabled in the browser.
          </p>
          <p>
            Leaderboard groups are connected components of inclusive Wilson
            interval overlap, computed per suite. Live rows are excluded by
            construction.
          </p>
        </div>
      </details>

      {onHome ? (
        <button
          type="button"
          className="min-h-11 rounded border border-stone-600 px-4 py-2 text-stone-200"
          onClick={onHome}
        >
          Home
        </button>
      ) : null}
    </section>
  );
}
