import { useState } from "react";
import pack from "../data/leaderboard.v1.json";

/** UI-local mirror of LeaderboardV1 (ui must not import eval). */
export type LeaderboardPackUi = {
  version: 1;
  generatedAt?: string;
  suites: Array<{
    suiteId: string;
    label?: string;
    groups: string[][];
    rows: Array<{
      id: string;
      label?: string;
      n: number;
      rate?: number;
      wilson: { low: number; high: number };
      insufficientEvidence: boolean;
    }>;
  }>;
};

const OVERLAP_LABEL = "Can't be separated with this data";

function loadPackSync(): LeaderboardPackUi {
  return pack as LeaderboardPackUi;
}

export type LeaderboardViewProps = {
  onHome?: () => void;
};

export function LeaderboardView({
  onHome
}: LeaderboardViewProps): React.JSX.Element {
  const [board] = useState<LeaderboardPackUi>(() => loadPackSync());

  return (
    <section aria-labelledby="leaderboard-heading" data-testid="leaderboard-view">
      <h1
        id="leaderboard-heading"
        tabIndex={-1}
        className="text-2xl font-semibold text-stone-100"
      >
        Leaderboard
      </h1>
      <p className="mt-2 text-stone-400">
        Recorded measurements in this robot battle only. Compared only within the
        same suite. Live AI play is never ranked here.
      </p>
      <p className="mt-2 text-stone-400 text-sm">
        These numbers are for this test set and these models — not a general claim
        about every robot battle or every AI.
      </p>

      {board.suites.length === 0 ? (
        <p className="mt-6 text-stone-400" data-testid="leaderboard-empty">
          No leaderboard pack is available yet. Recorded results will appear here
          when published.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {board.suites.map((suite) => {
            const byId = new Map(suite.rows.map((r) => [r.id, r]));
            return (
              <div
                key={suite.suiteId}
                data-testid={`leaderboard-suite-${suite.suiteId}`}
              >
                <h2 className="text-lg font-medium text-stone-200">
                  {suite.label ?? suite.suiteId}
                </h2>
                <ul className="mt-4 space-y-4">
                  {suite.groups.map((group, gi) => {
                    const multi = group.length > 1;
                    return (
                      <li
                        key={`${suite.suiteId}-${gi}`}
                        className="border-l border-stone-700 pl-4"
                        data-testid="leaderboard-group"
                      >
                        {multi ? (
                          <p className="text-sm text-amber-200/90">
                            {OVERLAP_LABEL}
                          </p>
                        ) : null}
                        <ul className="mt-1 space-y-1">
                          {group.map((id) => {
                            const row = byId.get(id);
                            if (row === undefined) {
                              return null;
                            }
                            const pct =
                              row.rate === undefined
                                ? "—"
                                : `${(row.rate * 100).toFixed(1)}%`;
                            return (
                              <li
                                key={id}
                                className="text-stone-300"
                                data-testid="leaderboard-row"
                              >
                                <span className="text-stone-100">
                                  {row.label ?? row.id}
                                </span>
                                <span className="text-stone-400">
                                  {" "}
                                  · best-move rate {pct}
                                  {row.insufficientEvidence
                                    ? " · not enough evidence"
                                    : ""}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {onHome ? (
        <button
          type="button"
          className="mt-10 min-h-11 rounded border border-stone-600 px-4 py-2 text-stone-200"
          onClick={onHome}
        >
          Home
        </button>
      ) : null}
    </section>
  );
}
