import type { BattleOutcome, CombatantState, TurnRecord } from "../../engine";

export type EndLessonInput = {
  outcome: BattleOutcome;
  turns: TurnRecord[];
  finalPlayer: CombatantState;
};

const FALLBACK_TIP =
  "Tip: moves cost energy. If you can't pay, your robot switches to a safe stabilize.";

const CHALLENGE_TIP =
  "Free play is practice. For scored checks against the best move, try Can you beat the AI?";

/** First-match end-of-game tip from engine data only. */
export function endLesson(input: EndLessonInput): string {
  const hadFallback = input.turns.some((t) =>
    t.actions.some((a) => a.fallback)
  );
  if (hadFallback) {
    return FALLBACK_TIP;
  }
  void input.outcome;
  void input.finalPlayer;
  return CHALLENGE_TIP;
}

export const END_LESSON_STRINGS = [FALLBACK_TIP, CHALLENGE_TIP] as const;
