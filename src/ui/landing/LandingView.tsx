import { HonestyLine } from "../components/HonestyLine";
import { Button } from "../components/Button";
import { FirstVisitTour } from "../tour/FirstVisitTour";

export type LandingViewProps = {
  onBeatAi: () => void;
  onQuickBattle: () => void;
  onWatch: () => void;
  onBuild: () => void;
  onLiveAi: () => void;
  tourCloseSignal?: number;
};

export const LANDING_SUPPORT =
  "AGENT ARENA checks how AI models choose moves in a small robot battle where the best move can be worked out exactly. See where recorded AI answers missed, and try the same choices yourself.";

export const LANDING_H1 = "How well do AI models choose?";

export function LandingView({
  onBeatAi,
  onQuickBattle,
  onWatch,
  onBuild,
  onLiveAi,
  tourCloseSignal = 0
}: LandingViewProps): React.JSX.Element {
  return (
    <section aria-labelledby="landing-heading" data-testid="landing-view" className="space-y-8">
      <div>
        <h1 id="landing-heading" tabIndex={-1} className="font-semibold tracking-tight text-stone-50">
          {LANDING_H1}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-300" data-testid="landing-support">
          {LANDING_SUPPORT}
        </p>
      </div>

      <div className="rounded-xl border border-amber-700 bg-amber-950/20 p-5 sm:p-7">
        <p className="text-sm font-semibold text-amber-200">Start here · Recorded decision challenge</p>
        <h2 className="mt-2 text-xl font-semibold text-stone-50">Take the AI&apos;s place for one decision.</h2>
        <p className="mt-2 max-w-2xl text-stone-300">Read the moves, make your pick, then see how it compares with the best move and recorded AI answers.</p>
        <Button variant="primary" className="mt-5 px-6 py-3 text-base font-semibold" onClick={onBeatAi} data-testid="cta-beat-ai">
          Can you beat the AI?
        </Button>
        <p className="mt-3 text-sm text-stone-400">No API key needed.</p>
      </div>

      <div
        className="rounded-xl border aa-border bg-stone-900/40 p-5 sm:p-6"
        data-testid="landing-findings"
      >
        <h2 className="text-lg font-semibold text-stone-100">What we found</h2>
        <p className="mt-2 leading-relaxed text-stone-300">
          No measurable effect: rewording, a misleading rumor, and extra facts
          did not change these models&apos; choices on this test set.
        </p>
        <p className="mt-2 leading-relaxed text-stone-300">
          The same question asked twice changed 1 of 35 answers for Groq —
          small wobble (1 of 35), from repeat runs or provider changes over
          time.
        </p>
        <p className="mt-2 text-sm text-stone-400">
          Scoped to this robot battle, the hard test set (35 situations) and
          small check set, and these two models — not a claim about AI systems
          in general.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-stone-100">Explore the arena</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="aa-mode-card">
            <h3 className="font-semibold text-stone-100">Play</h3>
            <p className="mt-2 text-sm text-stone-300">Jump into a battle with a ready-made robot against the simple computer.</p>
            <Button variant="secondary" onClick={onQuickBattle} data-testid="cta-quick-battle">Play a quick battle</Button>
          </div>
          <div className="aa-mode-card">
            <h3 className="font-semibold text-stone-100">Watch</h3>
            <p className="mt-2 text-sm text-stone-300">Step through a recorded AI fight and see what changed each turn.</p>
            <Button variant="secondary" onClick={onWatch} data-testid="cta-watch">Watch a recorded AI battle</Button>
          </div>
        </div>
        <details className="mt-4 rounded-xl border aa-border bg-stone-900/30 px-4 py-3" data-testid="landing-more-ways">
          <summary className="cursor-pointer text-sm font-medium text-stone-200">
            More ways to play
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="aa-mode-card">
              <h3 className="font-semibold text-stone-100">Build</h3>
              <p className="mt-2 text-sm text-stone-300">Name your robot and choose its moves before heading into battle.</p>
              <Button variant="secondary" onClick={onBuild} data-testid="cta-build">Build your own robot →</Button>
            </div>
            <div className="aa-mode-card">
              <h3 className="font-semibold text-stone-100">Try live AI</h3>
              <p className="mt-2 text-sm text-stone-300">Use your own OpenRouter key. Live play is optional and separate from the recorded results.</p>
              <Button variant="secondary" onClick={onLiveAi} data-testid="cta-live-ai">Play a live AI with your own key →</Button>
            </div>
          </div>
        </details>
      </div>
      <HonestyLine honestyMode="home" />
      <FirstVisitTour closeSignal={tourCloseSignal} />
    </section>
  );
}
