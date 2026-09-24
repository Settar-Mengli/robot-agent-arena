import type { WilsonInterval } from "../decision-lab";

/** Static leaderboard pack — recorded evidence only (never live). */
export type LeaderboardV1 = {
  version: 1;
  generatedAt?: string;
  suites: LeaderboardSuiteV1[];
};

export type LeaderboardSuiteV1 = {
  suiteId: string;
  label?: string;
  /** Overlap components of row ids within this suite only. */
  groups: string[][];
  rows: LeaderboardRowV1[];
};

export type LeaderboardRowV1 = {
  id: string;
  label?: string;
  n: number;
  rate?: number;
  wilson: WilsonInterval;
  insufficientEvidence: boolean;
};

export type LeaderboardInputRow = {
  id: string;
  label?: string;
  n: number;
  rate?: number;
  wilson: WilsonInterval;
  /** Rows marked live are dropped — never appear on the board. */
  live?: boolean;
};

export type LeaderboardInputSuite = {
  suiteId: string;
  label?: string;
  rows: LeaderboardInputRow[];
};

/** Inclusive interval overlap (touching endpoints count). */
export function wilsonIntervalsOverlap(
  a: WilsonInterval,
  b: WilsonInterval
): boolean {
  return a.low <= b.high && b.low <= a.high;
}

/**
 * Connected components of the Wilson-interval overlap graph.
 * Chain A∩B and B∩C (even if A∩C=∅) yield one component.
 */
export function wilsonOverlapGroups(
  rows: Array<{ id: string; wilson: WilsonInterval }>
): string[][] {
  const n = rows.length;
  if (n === 0) {
    return [];
  }

  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    let x = i;
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  }

  function union(i: number, j: number): void {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) {
      parent[rj] = ri;
    }
  }

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (wilsonIntervalsOverlap(rows[i]!.wilson, rows[j]!.wilson)) {
        union(i, j);
      }
    }
  }

  const buckets = new Map<number, string[]>();
  for (let i = 0; i < n; i += 1) {
    const root = find(i);
    const list = buckets.get(root) ?? [];
    list.push(rows[i]!.id);
    buckets.set(root, list);
  }

  return [...buckets.values()];
}

const SECONDARY_N = 13;

/**
 * Build a LeaderboardV1 pack. Groups are computed **per suite** (never across).
 * n=13 ⇒ insufficientEvidence true. Live rows are excluded.
 */
export function buildLeaderboardV1(opts: {
  suites: LeaderboardInputSuite[];
  generatedAt?: string;
}): LeaderboardV1 {
  const suites: LeaderboardSuiteV1[] = opts.suites.map((suite) => {
    const rows: LeaderboardRowV1[] = suite.rows
      .filter((r) => r.live !== true)
      .map((r) => ({
        id: r.id,
        label: r.label,
        n: r.n,
        rate: r.rate,
        wilson: r.wilson,
        insufficientEvidence: r.n === SECONDARY_N || r.n < 30
      }));

    return {
      suiteId: suite.suiteId,
      label: suite.label,
      rows,
      groups: wilsonOverlapGroups(rows)
    };
  });

  return {
    version: 1,
    generatedAt: opts.generatedAt,
    suites
  };
}

/**
 * Exporter stub — Phase 1 placeholder for future download / publish hooks.
 * Does not write files or touch the network.
 */
export function exportLeaderboardStub(pack: LeaderboardV1): {
  kind: "stub";
  message: string;
  bytes: number;
} {
  const json = JSON.stringify(pack);
  return {
    kind: "stub",
    message: "Leaderboard export is not available in this build.",
    bytes: json.length
  };
}
