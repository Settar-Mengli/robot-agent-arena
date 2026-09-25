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
    <section
      aria-labelledby="landing-heading"
      data-testid="landing-view"
      className="space-y-8"
    >
      <div>
        <h1
          id="landing-heading"
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight text-stone-50 sm:text-3xl"
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
        <Button
          variant="primary"
          className="px-6 py-3 text-base font-semibold"
          onClick={onBeatAi}
          data-testid="cta-beat-ai"
        >
          Can you beat the AI?
        </Button>
        <Button
          variant="secondary"
          className="border-amber-800/80 bg-amber-950/40 px-5 py-3 text-base font-medium text-amber-100 hover:bg-amber-950/70"
          onClick={onQuickBattle}
          data-testid="cta-quick-battle"
        >
          Play a quick battle
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
        <button
          type="button"
          className="min-h-11 text-amber-100 underline underline-offset-4 hover:text-amber-50"
          onClick={onWatch}
          data-testid="cta-watch"
        >
          Watch a recorded AI battle
        </button>
        <span className="text-stone-500" aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          className="min-h-11 text-amber-100 underline underline-offset-4 hover:text-amber-50"
          onClick={onBuild}
          data-testid="cta-build"
        >
          Build your own robot →
        </button>
        <span className="text-stone-500" aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          className="min-h-11 text-amber-100 underline underline-offset-4 hover:text-amber-50"
          onClick={onLiveAi}
          data-testid="cta-live-ai"
        >
          Play a live AI with your own key →
        </button>
      </div>

      <HonestyLine />

      <FirstVisitTour closeSignal={tourCloseSignal} />
    </section>
  );
}
