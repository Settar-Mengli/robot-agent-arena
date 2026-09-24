import { useState } from "react";

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

/**
 * Phase 1: pack file absent → empty state.
 * Phase 2: switch to `import raw from "../data/leaderboard.v1.json"`.
 */
function loadPackSync(): LeaderboardPackUi | null {
  return null;
}

export type LeaderboardViewProps = {
  onHome?: () => void;
};

export function LeaderboardView({
  onHome
}: LeaderboardViewProps): React.JSX.Element {
  const [pack] = useState<LeaderboardPackUi | null>(() => loadPackSync());

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

      {pack === null || pack.suites.length === 0 ? (
        <p className="mt-6 text-stone-400" data-testid="leaderboard-empty">
          No leaderboard pack is available yet. Recorded results will appear here
          when published.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {pack.suites.map((suite) => {
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
                          <p className="mb-2 text-sm text-amber-200/90">
                            {OVERLAP_LABEL}
                          </p>
                        ) : null}
                        <ul className="space-y-2">
                          {group.map((id) => {
                            const row = byId.get(id);
                            if (row === undefined) {
                              return (
                                <li key={id} className="text-sm text-stone-500">
                                  {id}
                                </li>
                              );
                            }
                            return (
                              <li key={id} className="text-sm text-stone-300">
                                <span className="font-medium text-stone-100">
                                  {row.label ?? row.id}
                                </span>
                                {row.rate !== undefined ? (
                                  <span className="ml-2 text-stone-400">
                                    rate {(row.rate * 100).toFixed(0)}%
                                  </span>
                                ) : null}
                                <span className="ml-2 text-stone-500">
                                  Wilson [{row.wilson.low.toFixed(2)},{" "}
                                  {row.wilson.high.toFixed(2)}] · n={row.n}
                                </span>
                                {row.insufficientEvidence ? (
                                  <span className="ml-2 text-amber-300/80">
                                    insufficient evidence
                                  </span>
                                ) : null}
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
          className="mt-8 min-h-11 rounded border border-stone-600 px-4 py-2 text-stone-200"
          onClick={onHome}
        >
          Home
        </button>
      ) : null}
    </section>
  );
}
