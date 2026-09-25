import type { OpponentMode } from "../arena/opponent-mode";

export type HonestyMode = "home" | "cpu" | "live" | "recorded";

export type HonestyLineProps = {
  /** Compact (default) = one line + More. Full kept for rare callers. */
  variant?: "full" | "compact";
  /**
   * Explicit surface mode (preferred). When omitted, falls back to
   * opponentMode mapping or "recorded".
   */
  honestyMode?: HonestyMode;
  /**
   * Arena/Results/Setup: live | live-fallback → live; cpu → cpu.
   * Ignored when honestyMode is set.
   */
  opponentMode?: OpponentMode;
};

/** Recorded surfaces (Watch, Beat the AI, Leaderboard, How it works). */
export const POINTS = [
  "This is a static demo.",
  "AI answers here are recorded, not live.",
  "Small samples cannot rank models.",
  'In Beat the AI, "best move" means best against a fixed player plan.',
  "When we show an AI reason, it is what the model wrote—not its private thinking."
] as const;

export const HONESTY_ONE_LINE = "Recorded examples, not live AI.";

export const HOME_HONESTY_ONE_LINE =
  "Watch, Beat the AI, and the Leaderboard use recorded answers.";

export const CPU_HONESTY_ONE_LINE =
  "You're playing a simple computer opponent, not an AI.";

export const CPU_POINTS = [
  "The simple computer follows fixed rules.",
  "Recorded AI examples are in Watch, Beat the AI, and the Leaderboard.",
  "You can also play a live AI with your own OpenRouter key."
] as const;

export const LIVE_HONESTY_ONE_LINE =
  "This fight uses a live AI with your own key. Answers are not recorded evidence and can vary. Recorded examples (Watch, Beat the AI, leaderboard) are separate.";

export function honestyModeFromOpponent(
  opponentMode: OpponentMode | undefined
): HonestyMode {
  if (opponentMode === "live" || opponentMode === "live-fallback") {
    return "live";
  }
  if (opponentMode === "cpu") {
    return "cpu";
  }
  return "recorded";
}

function resolveMode(
  honestyMode: HonestyMode | undefined,
  opponentMode: OpponentMode | undefined
): HonestyMode {
  if (honestyMode !== undefined) return honestyMode;
  return honestyModeFromOpponent(opponentMode);
}

/** Compact honesty by default (D-054). */
export function HonestyLine({
  variant = "compact",
  honestyMode,
  opponentMode
}: HonestyLineProps): React.JSX.Element {
  const mode = resolveMode(honestyMode, opponentMode);

  if (variant === "full") {
    const points = mode === "cpu" ? CPU_POINTS : POINTS;
    return (
      <div
        className="rounded border aa-border bg-stone-900/50 px-3 py-2 text-sm text-stone-300"
        role="status"
        data-testid="honesty-strip"
      >
        <ul className="list-disc space-y-1 pl-5">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    );
  }

  return <HonestyCompact mode={mode} />;
}

function HonestyCompact({ mode }: { mode: HonestyMode }): React.JSX.Element {
  const oneLine =
    mode === "live"
      ? LIVE_HONESTY_ONE_LINE
      : mode === "cpu"
        ? CPU_HONESTY_ONE_LINE
        : mode === "home"
          ? HOME_HONESTY_ONE_LINE
          : HONESTY_ONE_LINE;

  return (
    <details
      className="text-sm text-stone-400"
      data-testid="honesty-strip-compact"
      data-honesty-mode={mode}
    >
      <summary className="cursor-pointer list-none">
        <span data-testid="honesty-one-line">{oneLine}</span>
        <span className="ml-2 text-amber-200/90 underline underline-offset-2">
          More
        </span>
      </summary>
      {mode === "live" ? (
        <p className="mt-2 text-stone-300" data-testid="honesty-live-detail">
          {LIVE_HONESTY_ONE_LINE}
        </p>
      ) : mode === "cpu" ? (
        <ul
          className="mt-2 list-disc space-y-1 pl-5 text-stone-300"
          data-testid="honesty-cpu-points"
        >
          {CPU_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <ul
          className="mt-2 list-disc space-y-1 pl-5 text-stone-300"
          data-testid="honesty-recorded-points"
        >
          {POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </details>
  );
}
