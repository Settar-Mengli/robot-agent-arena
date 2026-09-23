import { useEffect, useState } from "react";

const TOUR_KEY = "agent-arena.tour.v1";

const STEPS = [
  {
    title: "Play",
    body: "Fight a simple computer foe with a ready-made or custom robot."
  },
  {
    title: "Watch",
    body: "Step through a recorded AI fight — not a live model call."
  },
  {
    title: "Lab",
    body: "Try the same decisions yourself and see where the AI missed."
  }
] as const;

function persistDismiss(): void {
  try {
    globalThis.localStorage?.setItem(TOUR_KEY, "1");
  } catch {
    /* ignore */
  }
}

export type FirstVisitTourProps = {
  /** Increment to dismiss (e.g. when a landing CTA is clicked). */
  closeSignal?: number;
};

export function FirstVisitTour({
  closeSignal = 0
}: FirstVisitTourProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (globalThis.localStorage?.getItem(TOUR_KEY) !== "1") {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (closeSignal > 0 && open) {
      persistDismiss();
      setOpen(false);
    }
  }, [closeSignal, open]);

  if (!open) return null;

  const current = STEPS[step]!;

  function dismiss() {
    persistDismiss();
    setOpen(false);
  }

  return (
    <div
      className="mt-8 rounded border border-amber-900/50 bg-stone-900/80 p-4"
      data-testid="first-visit-tour"
      role="region"
      aria-label="First visit tour"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-amber-100">
            {current.title} ({step + 1}/{STEPS.length})
          </p>
          <p className="mt-1 text-sm text-stone-300">{current.body}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="min-h-11 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-stone-950"
              onClick={() => setStep((s) => s + 1)}
              data-testid="tour-next"
            >
              Next
            </button>
          ) : null}
          <button
            type="button"
            className="min-h-11 rounded border border-stone-600 px-4 py-2 text-sm text-stone-200"
            onClick={dismiss}
            data-testid="tour-dismiss"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export { TOUR_KEY, STEPS };
