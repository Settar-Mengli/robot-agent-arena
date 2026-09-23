import type { BattleOutcome, CombatantState, TurnRecord } from "../../engine";

export type EndLessonInput = {
  outcome: BattleOutcome;
  turns: TurnRecord[];
  finalPlayer: CombatantState;
};

/** First-match end-of-game tip from engine data only. */
export function endLesson(input: EndLessonInput): string {
  const hadFallback = input.turns.some((t) =>
    t.actions.some((a) => a.fallback)
  );
  if (hadFallback) {
    return "Tip: moves cost energy. If you can't pay, your robot switches to a safe stabilize.";
  }

  const result = input.outcome.result;
  if (result === "cpu-victory") {
    return "Tip: defense moves can soften the foe's biggest hits. Try adding one.";
  }
  if (result === "draw") {
    return "Even match. Try a different pair of moves.";
  }
  if (result === "player-victory") {
    const ratio =
      input.finalPlayer.maxHealth <= 0
        ? 1
        : input.finalPlayer.health / input.finalPlayer.maxHealth;
    if (ratio < 0.4) {
      return "Close fight. Using defense earlier could have kept more HP.";
    }
    return "Clean win. Try the other opponent next.";
  }
  return "Even match. Try a different pair of moves.";
}

export const END_LESSON_STRINGS = [
  "Tip: moves cost energy. If you can't pay, your robot switches to a safe stabilize.",
  "Tip: defense moves can soften the foe's biggest hits. Try adding one.",
  "Close fight. Using defense earlier could have kept more HP.",
  "Clean win. Try the other opponent next.",
  "Even match. Try a different pair of moves."
] as const;
