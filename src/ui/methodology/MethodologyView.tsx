import summary from "../data/batch4.robustness.summary.json";

export type MethodologyViewProps = {
  onHome?: () => void;
};

/**
 * Plain-language methodology for recorded Arena evidence vs opt-in live play.
 */
export function MethodologyView({
  onHome
}: MethodologyViewProps): React.JSX.Element {
  const notes = (summary as { notes?: string[] }).notes ?? [];

  return (
    <section
      aria-labelledby="methodology-heading"
      data-testid="methodology-view"
      className="space-y-8"
    >
      <div data-testid="methodology-default">
        <h1
          id="methodology-heading"
          tabIndex={-1}
          className="text-2xl font-semibold text-stone-100"
        >
          How we measure decisions
        </h1>
        <p className="mt-2 text-stone-400">
          How Agent Arena measures decisions from recorded evidence — and what
          live play is not.
        </p>

        <section
          aria-labelledby="method-findings"
          data-testid="batch4-findings"
          className="mt-8"
        >
          <h2
            id="method-findings"
            className="text-lg font-medium text-stone-200"
          >
            Robustness results (this robot battle)
          </h2>
          <p className="mt-2 text-stone-300">
            No measurable effect: rewording, a misleading rumor, and extra facts
            did not change these models&apos; choices on this test set.
          </p>
          <p className="mt-2 text-stone-300">
            The same question asked twice changed 1 of 35 answers for Groq —
            small wobble (1 of 35), from repeat runs or provider changes over
            time.
          </p>
          <p className="mt-2 text-stone-500 text-sm">
            Scoped to this robot battle, this test set, and these two models —
            not a claim about AI systems in general.
          </p>
        </section>

        <section aria-labelledby="method-measured" className="mt-8">
          <h2
            id="method-measured"
            className="text-lg font-medium text-stone-200"
          >
            What we measure
          </h2>
          <p className="mt-2 text-stone-400">
            On fixed battle moments, we record which skill an agent chooses and
            score it against a known best move. Main comparisons use paired
            score differences with a confidence interval — not a live chat
            scoreboard.
          </p>
        </section>

        <section aria-labelledby="method-best" className="mt-8">
          <h2 id="method-best" className="text-lg font-medium text-stone-200">
            Best-move reference
          </h2>
          <p className="mt-2 text-stone-400">
            Each snapshot has a fixed ranking of legal moves. &quot;Best
            move&quot; means best against that fixed player plan — not a claim
            about all possible games.
          </p>
        </section>

        <section aria-labelledby="method-suites" className="mt-8">
          <h2 id="method-suites" className="text-lg font-medium text-stone-200">
            Test sets
          </h2>
          <p className="mt-2 text-stone-400">
            Primary evidence uses a held-out adversarial test set large enough
            for the evidence gate. A smaller secondary arm is always labeled not
            enough evidence. Test sets are never mixed when ranking or grouping
            models.
          </p>
        </section>

        <section aria-labelledby="method-metrics" className="mt-8">
          <h2
            id="method-metrics"
            className="text-lg font-medium text-stone-200"
          >
            Metrics
          </h2>
          <p className="mt-2 text-stone-400">
            Decision claims use average score change with a 95% confidence
            interval. Leaderboard groupings use a separate display interval —
            they are not the primary decision rule.
          </p>
        </section>

        <section aria-labelledby="method-recorded" className="mt-8">
          <h2
            id="method-recorded"
            className="text-lg font-medium text-stone-200"
          >
            Recorded vs live
          </h2>
          <p className="mt-2 text-stone-400">
            Watch and Lab show committed, replayable recordings. Opt-in live play
            (bring your own key) is entertainment only: not recorded evidence,
            not on the leaderboard, and answers can change.
          </p>
        </section>

        <section aria-labelledby="method-limits" className="mt-8">
          <h2 id="method-limits" className="text-lg font-medium text-stone-200">
            Limitations
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-stone-400">
            <li>
              Most situations in this suite offer two legal moves, so there is
              little room for any manipulation to change a choice.
            </li>
            <li>
              Answers were recorded with no random sampling (fixed decoding).
            </li>
            <li>Evidence comes from a single test suite.</li>
            <li>
              We do not correct for looking at many comparisons at once.
            </li>
            <li>
              One experiment combines three surface changes and cannot say which
              change mattered.
            </li>
            <li>
              For one model, adding facts was expected to look flat because the
              plain and fully-informed prompts already matched.
            </li>
            <li>
              Groq&apos;s base answers were recorded in Batch 2; the new
              versions were recorded later. The 1 of 35 difference may reflect
              changes on the provider&apos;s side over time, not only
              same-session wobble.
            </li>
          </ul>
        </section>
      </div>

      <details className="rounded border border-stone-800 px-4 py-3 text-sm text-stone-400">
        <summary className="cursor-pointer text-stone-300">Advanced</summary>
        <div className="mt-3 space-y-3" data-testid="methodology-advanced">
          <p>
            Pre-registration (Batch 4):{" "}
            <span className="font-mono text-stone-300">
              docs/preregistration-batch4.md
            </span>
          </p>
          <p>
            Bootstrap defaults: seed 0xA11CE, B=2000, alpha=0.05. Recorder
            temperature 0. OpenRouter-only if live play is enabled in the
            browser. Live model allowlist still needs operator verification.
          </p>
          <p>
            Leaderboard groups are connected components of inclusive Wilson
            interval overlap, computed per suite. Live rows are excluded by
            construction. Primary metric is paired Δregret.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
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
