export type OpponentMode = "cpu" | "live" | "live-fallback";

/** Header / summary line for Arena and Results. */
export function opponentModeLine(
  mode: OpponentMode,
  modelId: string
): string {
  switch (mode) {
    case "cpu":
      return "Opponent: simple computer (not an AI)";
    case "live":
      return `Opponent: live AI (${modelId}). Answers are not recorded evidence and can vary.`;
    case "live-fallback":
      return "This turn: simple computer.";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/** CombatantBars title for the opponent column. */
export function opponentBarTitle(
  mode: OpponentMode,
  modelId: string
): string {
  switch (mode) {
    case "cpu":
      return "Opponent (simple computer)";
    case "live":
      return `Opponent (live AI — ${modelId})`;
    case "live-fallback":
      return "Opponent (this turn: simple computer)";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
