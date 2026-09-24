import { describe, expect, it } from "vitest";
import {
  buildLeaderboardV1,
  exportLeaderboardStub,
  wilsonOverlapGroups
} from "../eval/leaderboard-pack";

describe("wilsonOverlapGroups", () => {
  it("groups pairwise overlapping intervals", () => {
    const groups = wilsonOverlapGroups([
      { id: "a", wilson: { low: 0.1, high: 0.3 } },
      { id: "b", wilson: { low: 0.25, high: 0.5 } }
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sort()).toEqual(["a", "b"]);
  });

  it("chains A∩B and B∩C into one component even when A∩C=∅", () => {
    // A=[0,0.2], B=[0.15,0.35], C=[0.3,0.5] — A and C disjoint, but chain via B
    const groups = wilsonOverlapGroups([
      { id: "a", wilson: { low: 0.0, high: 0.2 } },
      { id: "b", wilson: { low: 0.15, high: 0.35 } },
      { id: "c", wilson: { low: 0.3, high: 0.5 } }
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sort()).toEqual(["a", "b", "c"]);
  });

  it("keeps disjoint intervals in separate components", () => {
    const groups = wilsonOverlapGroups([
      { id: "a", wilson: { low: 0.0, high: 0.1 } },
      { id: "b", wilson: { low: 0.5, high: 0.6 } }
    ]);
    expect(groups).toHaveLength(2);
    const sorted = groups.map((g) => g.slice().sort()).sort((x, y) =>
      x[0]!.localeCompare(y[0]!)
    );
    expect(sorted).toEqual([["a"], ["b"]]);
  });

  it("treats inclusive endpoint touch as overlap", () => {
    const groups = wilsonOverlapGroups([
      { id: "a", wilson: { low: 0.0, high: 0.2 } },
      { id: "b", wilson: { low: 0.2, high: 0.4 } }
    ]);
    expect(groups).toHaveLength(1);
  });
});

describe("buildLeaderboardV1", () => {
  it("groups per suite never across suites and marks n=13 insufficient", () => {
    const pack = buildLeaderboardV1({
      suites: [
        {
          suiteId: "primary",
          rows: [
            {
              id: "m1",
              n: 35,
              wilson: { low: 0.4, high: 0.6 }
            },
            {
              id: "m2",
              n: 35,
              wilson: { low: 0.55, high: 0.7 }
            }
          ]
        },
        {
          suiteId: "secondary",
          rows: [
            {
              id: "m1",
              n: 13,
              wilson: { low: 0.4, high: 0.6 }
            },
            {
              id: "live-skip",
              n: 35,
              wilson: { low: 0.1, high: 0.9 },
              live: true
            }
          ]
        }
      ]
    });

    expect(pack.version).toBe(1);
    expect(pack.suites).toHaveLength(2);
    expect(pack.suites[0]!.groups).toHaveLength(1);
    expect(pack.suites[0]!.groups[0]!.sort()).toEqual(["m1", "m2"]);
    expect(pack.suites[1]!.rows).toHaveLength(1);
    expect(pack.suites[1]!.rows[0]!.insufficientEvidence).toBe(true);
    expect(pack.suites[1]!.rows.some((r) => r.id === "live-skip")).toBe(false);
  });

  it("exporter stub returns stub kind without throwing", () => {
    const pack = buildLeaderboardV1({ suites: [] });
    const stub = exportLeaderboardStub(pack);
    expect(stub.kind).toBe("stub");
    expect(stub.bytes).toBeGreaterThan(0);
  });
});
