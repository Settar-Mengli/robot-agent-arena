export type HonestyStripProps = {
  /** Full five-point strip (Home + Lab). Compact = one line + More. */
  variant?: "full" | "compact";
};

const POINTS = [
  "This is a static demo.",
  "AI answers here are recorded, not live.",
  "Small samples cannot rank models.",
  'In the Lab, "best move" means best against a fixed player plan.',
  "When we show an AI reason, it is what the model wrote—not its private thinking."
] as const;

export const HONESTY_ONE_LINE = "Recorded examples, not live AI.";

export function HonestyStrip({
  variant = "full"
}: HonestyStripProps): React.JSX.Element {
  if (variant === "compact") {
    return <HonestyCompact />;
  }

  return (
    <div
      className="rounded border border-stone-700 bg-stone-900/50 px-3 py-2 text-sm text-stone-300"
      role="status"
      data-testid="honesty-strip"
    >
      <ul className="list-disc space-y-1 pl-5">
        {POINTS.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

function HonestyCompact(): React.JSX.Element {
  return (
    <details
      className="text-sm text-stone-400"
      data-testid="honesty-strip-compact"
    >
      <summary className="cursor-pointer list-none">
        <span data-testid="honesty-one-line">{HONESTY_ONE_LINE}</span>
        <span className="ml-2 text-amber-200/90 underline underline-offset-2">
          More
        </span>
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-300">
        {POINTS.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </details>
  );
}
