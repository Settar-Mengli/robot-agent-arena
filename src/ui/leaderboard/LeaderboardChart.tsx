import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import {
  leaderboardRowDisplayName,
  suiteDisplayName
} from "../copy/display-labels";
import type { LeaderboardPackUi } from "./LeaderboardView";

type Suite = LeaderboardPackUi["suites"][number];
type Row = Suite["rows"][number];

export type LeaderboardChartProps = {
  suite: Suite;
};

const TICKS = [0, 25, 50, 75, 100] as const;

export function LeaderboardChart({
  suite
}: LeaderboardChartProps): React.JSX.Element {
  const byId = new Map(suite.rows.map((r) => [r.id, r]));
  const title = suiteDisplayName(suite.suiteId, suite.label);

  return (
    <div data-testid="leaderboard-chart">
      <h2
        className="text-lg font-medium text-stone-200"
        id={`suite-${suite.suiteId}`}
      >
        {title}
      </h2>
      <p className="mt-2 text-sm text-stone-400">
        Bars show uncertainty from sample size. Overlapping bars are not a
        ranking.
      </p>

      <ScaleAxis />

      <div className="mt-4 space-y-4">
        {suite.groups.map((group, gi) => {
          const multi = group.length > 1;
          const rows = group
            .map((id) => byId.get(id))
            .filter((r): r is Row => r !== undefined);
          return (
            <Card
              key={`${suite.suiteId}-${gi}`}
              className={
                multi
                  ? "border-amber-900/40 bg-amber-950/20 px-3 py-3"
                  : "border-transparent bg-transparent px-1 py-1 shadow-none"
              }
              data-testid="leaderboard-group"
            >
              {multi ? (
                <div className="mb-2">
                  <Badge tone="caution">
                    {"Can't be separated with this data"}
                  </Badge>
                </div>
              ) : null}
              <ul className="space-y-3">
                {rows.map((row) => (
                  <li key={row.id} data-testid="leaderboard-row">
                    <RowWhisker row={row} />
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      <table className="sr-only" data-testid="leaderboard-table">
        <caption>{title} best-move rates</caption>
        <thead>
          <tr>
            <th>Model and prompt</th>
            <th>Best-move rate</th>
            <th>Low</th>
            <th>High</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {suite.rows.map((row) => (
            <tr key={row.id}>
              <td>{leaderboardRowDisplayName(row)}</td>
              <td>
                {row.rate === undefined
                  ? "—"
                  : `${(row.rate * 100).toFixed(1)}%`}
              </td>
              <td>{`${(row.wilson.low * 100).toFixed(1)}%`}</td>
              <td>{`${(row.wilson.high * 100).toFixed(1)}%`}</td>
              <td>
                {row.insufficientEvidence ? "not enough evidence" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScaleAxis(): React.JSX.Element {
  return (
    <div className="mt-4 w-full max-w-full" data-testid="leaderboard-axis">
      <svg
        className="aa-chart-border block h-8 w-full"
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {TICKS.map((t) => (
          <line
            key={`g-${t}`}
            x1={t}
            y1="0"
            x2={t}
            y2="20"
            stroke="currentColor"
            strokeWidth="0.35"
            opacity="0.35"
          />
        ))}
        <line
          x1="0"
          y1="16"
          x2="100"
          y2="16"
          stroke="currentColor"
          strokeWidth="0.5"
        />
      </svg>
      <div className="flex justify-between text-xs text-stone-400">
        {TICKS.map((t) => (
          <span key={t}>{t}%</span>
        ))}
      </div>
    </div>
  );
}

function RowWhisker({ row }: { row: Row }): React.JSX.Element {
  const low = Math.max(0, Math.min(100, row.wilson.low * 100));
  const high = Math.max(0, Math.min(100, row.wilson.high * 100));
  const mid =
    row.rate === undefined
      ? (low + high) / 2
      : Math.max(0, Math.min(100, row.rate * 100));
  const label = leaderboardRowDisplayName(row);
  const pct =
    row.rate === undefined ? "—" : `${(row.rate * 100).toFixed(1)}%`;

  return (
    <div className="w-full max-w-full">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-stone-100">{label}</span>
        <span className="text-stone-400">
          best-move rate {pct}
          {row.insufficientEvidence ? " · not enough evidence" : ""}
        </span>
      </div>
      <svg
        className="aa-chart-border mt-1 block h-6 w-full"
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-testid="leaderboard-whisker"
        data-low={low.toFixed(1)}
        data-high={high.toFixed(1)}
        data-mid={mid.toFixed(1)}
      >
        {TICKS.map((t) => (
          <line
            key={`rg-${t}`}
            x1={t}
            y1="0"
            x2={t}
            y2="12"
            stroke="currentColor"
            strokeWidth="0.25"
            opacity="0.25"
          />
        ))}
        <line
          x1="0"
          y1="6"
          x2="100"
          y2="6"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <line
          x1={low}
          y1="6"
          x2={high}
          y2="6"
          stroke="currentColor"
          className="aa-muted"
          strokeWidth="2"
          data-whisker-span="true"
        />
        <circle
          cx={mid}
          cy="6"
          r="2.2"
          fill="currentColor"
          className="aa-accent"
          data-whisker-dot="true"
        />
      </svg>
    </div>
  );
}
