import type { BattleOutcome, TurnRecord } from "../../engine";

export type ResultsViewProps = {
  outcome: BattleOutcome;
  turns: TurnRecord[];
  onRestart: () => void;
  onReturnToBuilder: () => void;
};

export function ResultsView({
  outcome,
  turns,
  onRestart,
  onReturnToBuilder
}: ResultsViewProps) {
  return (
    <section aria-labelledby="results-heading" data-testid="results-view">
      <h2 id="results-heading" className="text-2xl font-semibold text-stone-100">
        Results
      </h2>

      <div
        role="status"
        className="mt-6 rounded border border-stone-700 bg-stone-900/60 px-4 py-4"
        data-testid="battle-outcome"
      >
        <p className="text-lg font-medium text-stone-100">
          {formatResult(outcome.result)}
        </p>
        <p className="mt-1 text-sm text-stone-400">
          Reason: {outcome.reason}
          {outcome.winnerAgentId
            ? ` · Winner: ${outcome.winnerAgentId}`
            : null}
        </p>
        <p className="mt-1 text-sm text-stone-500">{turns.length} turns</p>
      </div>

      <div className="mt-8" data-testid="results-history">
        <h3 className="text-sm font-medium text-stone-300">Turn history</h3>
        {turns.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No turns recorded.</p>
        ) : (
          <ol className="mt-3 space-y-3 text-sm text-stone-300">
            {turns.map((turn) => (
              <li
                key={turn.turn}
                className="rounded border border-stone-800 px-3 py-2"
              >
                <p className="font-medium text-stone-200">Turn {turn.turn}</p>
                <ul className="mt-1 space-y-1 text-stone-400">
                  {turn.actions.map((action, index) => (
                    <li key={`${turn.turn}-${action.actor}-${index}`}>
                      {action.actor}: {action.selectedSkillId}
                      {action.fallback
                        ? ` → ${action.resolvedSkillId} (fallback)`
                        : ` → ${action.resolvedSkillId}`}
                    </li>
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
          className="rounded bg-amber-600 px-4 py-2 font-medium text-stone-950 hover:bg-amber-500"
          onClick={onRestart}
        >
          Restart battle
        </button>
        <button
          type="button"
          className="rounded border border-stone-600 px-4 py-2 text-stone-200 hover:bg-stone-900"
          onClick={onReturnToBuilder}
        >
          Return to Builder
        </button>
      </div>
    </section>
  );
}

function formatResult(result: BattleOutcome["result"]): string {
  switch (result) {
    case "player-victory":
      return "Player victory";
    case "cpu-victory":
      return "CPU victory";
    case "draw":
      return "Draw";
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}
