import { describe, expect, it } from "vitest";
import { classifyFailureTags, buildDiagnosticsReport } from "../decision-lab/diagnostics";
import type { DecisionLabObservation } from "../decision-lab/pack-v1";

const obs = (
  cpuHealth: number,
  maxHealth = 30
): DecisionLabObservation => ({
  cpu: {
    displayName: "CPU",
    health: cpuHealth,
    maxHealth,
    energy: 6,
    maxEnergy: 10,
    defense: 0
  },
  player: {
    displayName: "P",
    health: 10,
    maxHealth: 30,
    energy: 6,
    maxEnergy: 10,
    defense: 0
  }
});

const afford = [
  { skillId: "skill-logic-storm", energyCost: 5, affordable: true },
  { skillId: "skill-override-pulse", energyCost: 4, affordable: true },
  { skillId: "skill-null-pulse", energyCost: 2, affordable: true },
  { skillId: "skill-core-identity", energyCost: 1, affordable: true }
];

describe("classifyFailureTags", () => {
  it("tags missed_lethal", () => {
    const tags = classifyFailureTags({
      taxonomy: "suboptimal",
      regret: 50,
      executedSkillId: "skill-null-pulse",
      oracleBest: ["skill-logic-storm"],
      affordability: afford,
      observation: obs(30),
      lethalBySkill: {
        "skill-logic-storm": true,
        "skill-null-pulse": false
      },
      diesNextTurnPreAction: false,
      diesNextTurnAfterChosen: false,
      chosenCategory: "defense"
    });
    expect(tags).toContain("missed_lethal");
  });

  it("tags ignored_incoming_threat", () => {
    const tags = classifyFailureTags({
      taxonomy: "suboptimal",
      regret: 20,
      executedSkillId: "skill-override-pulse",
      oracleBest: ["skill-null-pulse"],
      affordability: afford,
      observation: obs(5),
      lethalBySkill: { "skill-override-pulse": false },
      diesNextTurnPreAction: true,
      diesNextTurnAfterChosen: true,
      chosenCategory: "attack"
    });
    expect(tags).toContain("ignored_incoming_threat");
  });

  it("tags wasted_energy when chosen costs more than affordable best", () => {
    const tags = classifyFailureTags({
      taxonomy: "suboptimal",
      regret: 10,
      executedSkillId: "skill-logic-storm",
      oracleBest: ["skill-override-pulse"],
      affordability: afford,
      observation: obs(20),
      lethalBySkill: {},
      diesNextTurnPreAction: false,
      diesNextTurnAfterChosen: false,
      chosenCategory: "attack"
    });
    expect(tags).toContain("wasted_energy");
  });

  it("tags over_defending at full health", () => {
    const tags = classifyFailureTags({
      taxonomy: "suboptimal",
      regret: 15,
      executedSkillId: "skill-core-identity",
      oracleBest: ["skill-override-pulse"],
      affordability: afford,
      observation: obs(30, 30),
      lethalBySkill: {},
      diesNextTurnPreAction: false,
      diesNextTurnAfterChosen: false,
      chosenCategory: "defense"
    });
    expect(tags).toContain("over_defending");
  });

  it("falls back to other_suboptimal", () => {
    const tags = classifyFailureTags({
      taxonomy: "suboptimal",
      regret: 5,
      executedSkillId: "skill-override-pulse",
      oracleBest: ["skill-logic-storm"],
      affordability: afford,
      observation: obs(20),
      lethalBySkill: {},
      diesNextTurnPreAction: false,
      diesNextTurnAfterChosen: false,
      chosenCategory: "attack"
    });
    expect(tags).toEqual(["other_suboptimal"]);
  });

  it("allows multi-tag", () => {
    const tags = classifyFailureTags({
      taxonomy: "suboptimal",
      regret: 40,
      executedSkillId: "skill-logic-storm",
      oracleBest: ["skill-override-pulse"],
      affordability: afford,
      observation: obs(30, 30),
      lethalBySkill: { "skill-override-pulse": true, "skill-logic-storm": false },
      diesNextTurnPreAction: true,
      diesNextTurnAfterChosen: true,
      chosenCategory: "defense"
    });
    expect(tags).toEqual(
      expect.arrayContaining([
        "missed_lethal",
        "ignored_incoming_threat",
        "wasted_energy",
        "over_defending"
      ])
    );
  });

  it("returns empty for non-suboptimal", () => {
    expect(
      classifyFailureTags({
        taxonomy: "optimal",
        regret: 0,
        executedSkillId: "skill-logic-storm",
        oracleBest: ["skill-logic-storm"],
        affordability: afford,
        observation: obs(30),
        lethalBySkill: { "skill-logic-storm": true },
        diesNextTurnPreAction: false,
        diesNextTurnAfterChosen: false,
        chosenCategory: "attack"
      })
    ).toEqual([]);
  });
});

describe("buildDiagnosticsReport", () => {
  const observation = obs(20);
  function recorded(
    overrides: Partial<{
      executedSkillId: string;
      regret: number;
      optimal: boolean;
      taxonomy: "suboptimal" | "optimal";
      failureTags: import("../decision-lab/diagnostics").FailureTag[];
      source: "llm" | "greedy";
    }> = {}
  ) {
    const regret = overrides.regret ?? 5;
    return {
      status: "recorded" as const,
      source: overrides.source ?? ("llm" as const),
      promptVersion: "t",
      executedSkillId: overrides.executedSkillId ?? "skill-a",
      optimal: overrides.optimal ?? false,
      regret,
      chosenValue: 10 - regret,
      bestValue: 10,
      taxonomy: overrides.taxonomy ?? ("suboptimal" as const),
      ...(overrides.failureTags !== undefined
        ? { failureTags: overrides.failureTags }
        : {})
    };
  }

  it("counts stakes buckets", () => {
    const report = buildDiagnosticsReport([
      {
        snapshotId: "a",
        observation,
        oracleBest: ["skill-a"],
        policies: {
          "llm:x:base": recorded({ regret: 0, taxonomy: "optimal", optimal: true })
        }
      },
      {
        snapshotId: "b",
        observation,
        oracleBest: ["skill-a"],
        policies: { "llm:x:base": recorded({ regret: 5 }) }
      },
      {
        snapshotId: "c",
        observation,
        oracleBest: ["skill-a"],
        policies: { "llm:x:base": recorded({ regret: 50 }) }
      },
      {
        snapshotId: "d",
        observation,
        oracleBest: ["skill-a"],
        policies: { "llm:x:base": recorded({ regret: 100 }) }
      }
    ]);
    expect(report.stakes.map((s) => [s.id, s.count])).toEqual([
      ["zero", 1],
      ["low", 1],
      ["mid", 1],
      ["high", 1]
    ]);
  });

  it("ranks help with Δ, Wilson, insufficientEvidence", () => {
    const cases = [
      {
        snapshotId: "c1",
        observation,
        oracleBest: ["skill-a"],
        policies: {
          "llm:base": recorded({ regret: 10 }),
          "llm:grounded": recorded({ regret: 2 })
        }
      },
      {
        snapshotId: "c2",
        observation,
        oracleBest: ["skill-a"],
        policies: {
          "llm:base": recorded({ regret: 4 }),
          "llm:grounded": recorded({ regret: 8 })
        }
      }
    ];
    const report = buildDiagnosticsReport(cases, {
      helpPairs: [{ policyKey: "llm:grounded", baselineKey: "llm:base" }]
    });
    expect(report.helpRanking).toHaveLength(1);
    const row = report.helpRanking[0]!;
    expect(row.n).toBe(2);
    expect(row.improvedCases).toBe(1);
    expect(row.meanDeltaRegret).toBeCloseTo((-8 + 4) / 2);
    expect(row.wilson.low).toBeLessThanOrEqual(row.wilson.high);
    expect(row.insufficientEvidence).toBe(true);
    expect(row.wording).toMatch(/coincided with lower regret/);
    expect(row.wording).toMatch(/Not a causal claim/);
  });

  it("picks counterexample by max regret then stable ids", () => {
    const report = buildDiagnosticsReport([
      {
        snapshotId: "z-snap",
        observation,
        oracleBest: ["skill-a"],
        policies: { "llm:b": recorded({ regret: 9, executedSkillId: "skill-b" }) }
      },
      {
        snapshotId: "a-snap",
        observation,
        oracleBest: ["skill-a"],
        policies: {
          "llm:b": recorded({ regret: 9, executedSkillId: "skill-c" }),
          "llm:a": recorded({ regret: 9, executedSkillId: "skill-d" })
        }
      }
    ]);
    expect(report.counterexample?.snapshotId).toBe("a-snap");
    expect(report.counterexample?.policyKey).toBe("llm:a");
    expect(report.counterexample?.regret).toBe(9);
  });
});
