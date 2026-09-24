import type {
  BattleOutcome,
  CombatantState,
  TurnRecord
} from "../../engine";
import { HonestyStrip } from "../HonestyStrip";
import { endLesson } from "./end-lesson";
import { narrateTurn } from "./turn-narration";

export type ResultsViewProps = {
  outcome: BattleOutcome;
  turns: TurnRecord[];
  playerName: string;
  cpuName: string;
  finalPlayer: CombatantState;
  finalCpu: CombatantState;
  onRestart: () => void;
  onReturnHome: () => void;
};

export function ResultsView({
  outcome,
  turns,
  playerName,
  cpuName,
  finalPlayer,
  finalCpu,
  onRestart,
  onReturnHome
}: ResultsViewProps) {
  const winnerName =
    outcome.winnerSide === "player"
      ? playerName
      : outcome.winnerSide === "cpu"
        ? cpuName
        : undefined;
  const lesson = endLesson({ outcome, turns, finalPlayer });

  return (
    <section aria-labelledby="results-heading" data-testid="results-view">
      <h1
        id="results-heading"
        tabIndex={-1}
        className="text-2xl font-semibold text-stone-100"
      >
        Results
      </h1>

      <div className="mt-3">
        <HonestyStrip variant="compact" />
      </div>

      <div
        role="status"
        aria-live="polite"
        className="mt-6 rounded border border-stone-700 bg-stone-900/60 px-4 py-4"
        data-testid="battle-outcome"
      >
        <p className="text-lg font-medium text-stone-100">
          {formatResult(outcome.result)}
        </p>
        {winnerName !== undefined ? (
          <p className="mt-1 text-sm text-stone-400">Winner: {winnerName}</p>
        ) : null}
        <p className="mt-2 text-sm text-stone-300" data-testid="final-hp">
          Final HP: you {finalPlayer.health}/{finalPlayer.maxHealth} · opponent{" "}
          {finalCpu.health}/{finalCpu.maxHealth}
        </p>
        <p className="mt-1 text-sm text-stone-500">{turns.length} turns</p>
        <p className="mt-3 text-sm text-amber-100/90" data-testid="end-lesson">
          {lesson}
        </p>
      </div>

      <div
        className="mt-6 rounded border border-stone-800 px-4 py-3 text-sm text-stone-400"
        data-testid="batch4-findings-results"
      >
        <p className="text-stone-300">
          No measurable effect: rewording, a misleading rumor, and extra facts
          did not change these models&apos; choices on this test set.
        </p>
        <p className="mt-2 text-stone-300">
          The same question asked twice changed 1 of 35 answers for Groq —
          small wobble (1 of 35), from repeat runs or provider changes over
          time.
        </p>
        <p className="mt-2 text-stone-500">
          Scoped to this robot battle, this test set, and these two models —
          not a claim about AI systems in general. Details: Methodology.
        </p>
      </div>

      <div className="mt-8" data-testid="results-history">
        <h3 className="text-sm font-medium text-stone-300">Battle log</h3>
        {turns.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No turns recorded.</p>
        ) : (
          <ol className="mt-3 space-y-3 text-sm text-stone-300">
            {[...turns].reverse().map((turn) => (
              <li
                key={turn.turn}
                className="rounded border border-stone-800 px-3 py-2"
              >
                <p className="font-medium text-stone-200">Turn {turn.turn}</p>
                <ul className="mt-1 space-y-1 text-stone-400">
                  {narrateTurn(turn, playerName, cpuName).map((line, index) => (
                    <li key={`${turn.turn}-${index}`}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-11 rounded bg-amber-600 px-4 py-2 font-medium text-stone-950 hover:bg-amber-500"
          onClick={onRestart}
        >
          Fight again
        </button>
        <button
          type="button"
          className="min-h-11 rounded border border-stone-600 px-4 py-2 text-stone-200 hover:bg-stone-900"
          onClick={onReturnHome}
        >
          Home
        </button>
      </div>
    </section>
  );
}

function formatResult(result: BattleOutcome["result"]): string {
  switch (result) {
    case "player-victory":
      return "You won";
    case "cpu-victory":
      return "Opponent won";
    case "draw":
      return "Draw";
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}
