import { useState } from "react";
import pack from "../data/leaderboard.v1.json";
import { Button } from "../components/Button";
import { HonestyLine } from "../components/HonestyLine";
import { LeaderboardChart } from "./LeaderboardChart";

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
      <p
        className="mt-2 text-base font-medium text-amber-200"
        data-testid="leaderboard-not-ranking"
      >
        Overlapping uncertainty bands are not a ranking.
      </p>
      <p className="mt-2 text-stone-400">
        Recorded measurements in this robot battle only. Compared only within the
        same test set. Live AI play is never ranked here.
      </p>
      <div className="mt-3">
        <HonestyLine honestyMode="recorded" />
      </div>
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
          {board.suites.map((suite) => (
            <div
              key={suite.suiteId}
              data-testid={`leaderboard-suite-${suite.suiteId}`}
            >
              <LeaderboardChart suite={suite} />
            </div>
          ))}
        </div>
      )}

      {onHome ? (
        <Button
          variant="secondary"
          className="mt-10"
          onClick={onHome}
        >
          Home
        </Button>
      ) : null}
    </section>
  );
}
