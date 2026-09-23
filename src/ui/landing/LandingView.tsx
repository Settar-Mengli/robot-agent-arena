import { HonestyStrip } from "../HonestyStrip";
import { FirstVisitTour } from "../tour/FirstVisitTour";

export type LandingViewProps = {
  onBeatAi: () => void;
  onQuickBattle: () => void;
  onWatch: () => void;
  onBuild: () => void;
  tourCloseSignal?: number;
};

export const LANDING_SUPPORT =
  "AGENT ARENA tests how well AI models make decisions. In a small robot battle, the best move in each situation can be worked out exactly, so every AI choice can be checked. See where the AI chose badly, and try the same choices yourself.";

export const LANDING_H1 = "How well do AI models choose?";

export function LandingView({
  onBeatAi,
  onQuickBattle,
  onWatch,
  onBuild,
  tourCloseSignal = 0
}: LandingViewProps): React.JSX.Element {
  return (
    <section
      aria-labelledby="landing-heading"
      data-testid="landing-view"
      className="space-y-8"
    >
      <div>
        <h1
          id="landing-heading"
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl"
        >
          {LANDING_H1}
        </h1>
        <p
          className="mt-4 max-w-2xl text-base leading-relaxed text-stone-300"
          data-testid="landing-support"
        >
          {LANDING_SUPPORT}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className="min-h-11 rounded bg-amber-600 px-6 py-3 text-base font-semibold text-stone-950 hover:bg-amber-500"
          onClick={onBeatAi}
          data-testid="cta-beat-ai"
        >
          Can you beat the AI?
        </button>
        <button
          type="button"
          className="min-h-11 rounded border border-amber-800/80 bg-amber-950/40 px-5 py-3 text-base font-medium text-amber-100 hover:bg-amber-950/70"
          onClick={onQuickBattle}
          data-testid="cta-quick-battle"
        >
          Play a quick battle
        </button>
        <button
          type="button"
          className="min-h-11 rounded border border-stone-600 px-5 py-3 text-base font-medium text-stone-200 hover:bg-stone-900"
          onClick={onWatch}
          data-testid="cta-watch"
        >
          Watch a recorded AI battle
        </button>
      </div>

      <p>
        <button
          type="button"
          className="min-h-11 text-base text-amber-100 underline underline-offset-4 hover:text-amber-50"
          onClick={onBuild}
          data-testid="cta-build"
        >
          Build your own robot →
        </button>
      </p>

      <HonestyStrip variant="full" />

      <FirstVisitTour closeSignal={tourCloseSignal} />
    </section>
  );
}
