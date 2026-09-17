import type { MatchAggregate, SnapshotPolicyMetrics, WilsonInterval } from "./metrics";

export type BaselineSplitReport = {
  split: "dev" | "heldout";
  matches: {
    random: MatchAggregate & { byOpponent: Record<string, MatchAggregate> };
    greedy: MatchAggregate & { byOpponent: Record<string, MatchAggregate> };
  };
  snapshots: {
    random: SnapshotPolicyMetrics;
    greedy: SnapshotPolicyMetrics;
  };
};

export type BaselineReport = {
  splits: BaselineSplitReport[];
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function fmtRate(n: number): string {
  return `${(round4(n) * 100).toFixed(2)}%`;
}

function fmtWilson(w: WilsonInterval): string {
  return `[${fmtRate(w.low)}, ${fmtRate(w.high)}]`;
}

function fmtAgg(label: string, agg: MatchAggregate): string {
  return [
    `| ${label} | ${agg.n} | ${fmtRate(agg.cpuWinRate)} ${fmtWilson(agg.cpuWinWilson)} | ${fmtRate(agg.drawRate)} | ${fmtRate(agg.lossRate)} | ${round4(agg.meanTurns).toFixed(2)} | ${round4(agg.meanFinalHpMargin).toFixed(2)} |`
  ].join("\n");
}

function renderMatchTable(
  title: string,
  agg: MatchAggregate & { byOpponent: Record<string, MatchAggregate> }
): string {
  const lines = [
    `#### ${title}`,
    "",
    "| slice | n | CPU win (Wilson 95%) | draw | loss | mean turns | mean HP margin (CPU−player) |",
    "| --- | ---: | --- | ---: | ---: | ---: | ---: |",
    fmtAgg("all", agg)
  ];
  const opponents = Object.keys(agg.byOpponent).sort();
  for (const id of opponents) {
    lines.push(fmtAgg(id, agg.byOpponent[id]!));
  }
  return lines.join("\n");
}

function renderSnapshotTable(
  title: string,
  metrics: SnapshotPolicyMetrics
): string {
  return [
    `#### ${title}`,
    "",
    "| n | optimal rate | mean regret | max regret |",
    "| ---: | ---: | ---: | ---: |",
    `| ${metrics.n} | ${fmtRate(metrics.optimalRate)} | ${round4(metrics.meanRegret).toFixed(4)} | ${round4(metrics.maxRegret).toFixed(4)} |`
  ].join("\n");
}

export function renderBaselineBlock(report: BaselineReport): string {
  const parts: string[] = ["<!-- baseline:start -->"];

  for (const split of report.splits) {
    parts.push(`### Split: ${split.split}`, "");
    parts.push(renderMatchTable("Matches — random CPU", split.matches.random));
    parts.push("");
    parts.push(renderMatchTable("Matches — greedy CPU", split.matches.greedy));
    parts.push("");
    parts.push(
      renderSnapshotTable("Snapshots — random expectation", split.snapshots.random)
    );
    parts.push("");
    parts.push(
      renderSnapshotTable("Snapshots — greedy", split.snapshots.greedy)
    );
    parts.push("");
  }

  parts.push("<!-- baseline:end -->");
  return parts.join("\n");
}

export function upsertBaselineBlock(
  markdown: string,
  block: string
): string {
  const start = "<!-- baseline:start -->";
  const end = "<!-- baseline:end -->";
  const startIdx = markdown.indexOf(start);
  const endIdx = markdown.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("EVAL.md missing baseline markers");
  }
  return (
    markdown.slice(0, startIdx) +
    block +
    markdown.slice(endIdx + end.length)
  );
}

export function extractBaselineBlock(markdown: string): string {
  const start = "<!-- baseline:start -->";
  const end = "<!-- baseline:end -->";
  const startIdx = markdown.indexOf(start);
  const endIdx = markdown.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("EVAL.md missing baseline markers");
  }
  return markdown.slice(startIdx, endIdx + end.length);
}

export function buildEvalMarkdownShell(): string {
  return `# EVAL

Deterministic eval harness for AGENT ARENA (D-018, D-020).

## Purpose

Measure CPU policies (random, greedy, LLM) on fixed match and decision-snapshot suites without requiring API keys on the committed path.

## How to run

\`\`\`bash
npm run eval              # baseline (random + greedy), writes evals/out/baseline.json
npm run eval:report       # baseline + regenerate EVAL.md baseline block
npm run eval:replay       # LLM via recorded fixtures (fails on fixture_miss)
npm run eval:record       # local only: call providers and write fixtures
\`\`\`

## Metric definitions

- **Match outcomes:** CPU win / draw / loss rates with Wilson 95% CI on the win rate; mean turns; mean final HP margin (CPU − player).
- **Oracle / snapshots:** at discriminative CPU decision points, an exact memoized **best response vs a fixed player policy** (not a game-theoretic equilibrium). Optimal-move rate = chosen skill ∈ oracle \`best\`; regret = max value − chosen value.
- **Random snapshot expectation:** analytical uniform average over affordable equipped skills (else \`skillIds[0]\`), matching the engine picker.
- **LLM:** decision-validity %, fallback reasons, fixture_miss count; latency percentiles are null in replay mode.

## Baseline

<!-- baseline:start -->
_Pending — run \`npm run eval:report\`._
<!-- baseline:end -->

## LLM results

<!-- llm:start -->
Pending — run \`npm run eval:record\` locally with keys, then \`npm run eval:replay\`.

Fields to be reported: CPU win/draw/loss with Wilson CI (per split / opponent), snapshot optimal rate and regret, decision-validity %, fallback rates, fixture_miss count, token totals. Latency p50/p95 are omitted in replay mode.
<!-- llm:end -->

## Limitations

- Oracle is a fixed-policy best response, not an equilibrium.
- Snapshot suites are small (n=20 per split).
- Snapshots are drawn from **greedy-CPU play**, so they reflect states that greedy reaches (not the full state space).
- Free-tier model volatility can change live/record results.
- Replay latency is not meaningful.
- Fictional environment vocabulary only.
`;
}
