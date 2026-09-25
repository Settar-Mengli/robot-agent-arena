import summary from "../data/batch4.robustness.summary.json";
import { Button } from "../components/Button";
import { HonestyLine } from "../components/HonestyLine";

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
      className="aa-prose space-y-8"
    >
      <div data-testid="methodology-default">
        <h1
          id="methodology-heading"
          tabIndex={-1}
          className="text-2xl font-semibold text-stone-100"
        >
          How we measure decisions
        </h1>
        <p className="mt-2 leading-relaxed text-stone-400">
          How we score AI decisions from recorded answers, and how live play
          differs.
        </p>
        <div className="mt-3">
          <HonestyLine honestyMode="recorded" />
        </div>

        <section
          aria-labelledby="method-tested"
          data-testid="batch4-findings"
          className="mt-8 rounded-xl border aa-border bg-stone-900/40 p-5 sm:p-6"
        >
          <h2
            id="method-tested"
            className="text-lg font-medium text-stone-200"
          >
            What we tested
          </h2>
          <p className="mt-2 leading-relaxed text-stone-300">
            No measurable effect: rewording, a misleading rumor, and extra facts
            did not change these models&apos; choices on this test set.
          </p>
          <p className="mt-2 leading-relaxed text-stone-300">
            The same question asked twice changed 1 of 35 answers for Groq —
            small wobble (1 of 35), from repeat runs or provider changes over
            time.
          </p>
          <p className="mt-2 text-stone-400 text-sm">
            Scoped to this robot battle, the hard test set (35 situations) and
            small check set, and these two models — not a claim about AI systems
            in general.
          </p>
        </section>

        <section aria-labelledby="method-scoring" className="mt-8">
          <h2
            id="method-scoring"
            className="text-lg font-medium text-stone-200"
          >
            How scoring works
          </h2>
          <p className="mt-2 leading-relaxed text-stone-400">
            On fixed battle situations, we record which move an agent chooses
            and score it against a known best move versus a fixed player plan.
            We report points worse than the best move. The leaderboard shows
            bands of uncertainty from sample size — overlapping bands are not a
            ranking.
          </p>
        </section>

        <section aria-labelledby="method-recorded" className="mt-8">
          <h2
            id="method-recorded"
            className="text-lg font-medium text-stone-200"
          >
            Recorded vs live
          </h2>
          <p className="mt-2 leading-relaxed text-stone-400">
            Watch, Beat the AI, and the Leaderboard use recorded answers. The
            Arena can also play a live AI with your own OpenRouter key: good for
            trying it yourself, but its answers aren&apos;t recorded evidence and
            can vary.
          </p>
        </section>

        <section aria-labelledby="method-limits" className="mt-8">
          <h2 id="method-limits" className="text-lg font-medium text-stone-200">
            Limits
          </h2>
          <ul className="mt-3 list-disc space-y-3 pl-5 leading-relaxed text-stone-400">
            <li>
              Most situations in this test set offer two legal moves, so there
              is little room for any wording change to flip a choice.
            </li>
            <li>
              Answers were recorded with no random sampling (fixed decoding).
            </li>
            <li>Evidence comes from a single primary test set.</li>
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
              Groq&apos;s base answers were recorded earlier than some retests.
              The 1 of 35 difference may reflect changes on the provider&apos;s
              side over time, not only same-session wobble.
            </li>
            <li>A smaller 13-situation check set is labeled not enough evidence for ranking.</li>
            <li>Window 3 (13-situation set) was not recorded.</li>
          </ul>
        </section>
      </div>

      <details className="rounded-xl border aa-border bg-stone-900/40 px-5 py-4 text-sm leading-relaxed text-stone-400">
        <summary className="cursor-pointer text-stone-300">Advanced</summary>
        <div className="mt-3 space-y-3" data-testid="methodology-advanced">
          <p>
            Pre-registration (Batch 4):{" "}
            <span className="break-words font-mono text-stone-300">
              docs/preregistration-batch4.md
            </span>
          </p>
          <p>
            Bootstrap defaults: seed 0xA11CE, B=2000, alpha=0.05. Recorder
            temperature 0. OpenRouter-only if live play is enabled in the
            browser. Live model allowlist still needs operator verification.
          </p>
          <p>
            A second headless reference task (Resonance Seal) has committed
            baselines in EVAL.md — not a playable Arena mode. Metrics are not
            comparable to the robot battle.
          </p>
          <p>
            Leaderboard groups are connected components of inclusive Wilson
            interval overlap, computed per test set. Live rows are excluded by
            construction. Primary metric is paired Δregret. Internal recording
            labels are not shown on the main pages.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </details>

      {onHome ? (
        <Button variant="secondary" onClick={onHome}>
          Home
        </Button>
      ) : null}
    </section>
  );
}
