import { describe, expect, it } from "vitest";
import {
  BULWARK,
  DISRUPTOR,
  PLAYER_ARCHETYPES,
  STRIKER,
  buildMatchSuite,
  greedyPlayer,
  mix,
  randomCpuPolicy,
  scenarioStratumKey,
  seededRandomPlayer,
  selectDiverseScenarios
} from "../eval";
import {
  MVP_SKILL_CATALOG,
  MVP_SKILL_SLOT_LIMIT,
  startBattle,
  stepBattle,
  validateAgentConfigInput
} from "../engine";
import { FRACTURE } from "../data/opponents";

describe("eval scenarios", () => {
  it.each(PLAYER_ARCHETYPES)(
    "validates archetype $displayName",
    (archetype) => {
      expect(() =>
        validateAgentConfigInput(archetype, MVP_SKILL_CATALOG)
      ).not.toThrow();
      expect(archetype.skillIds).toHaveLength(MVP_SKILL_SLOT_LIMIT);
    }
  );

  it("exposes the locked archetype ids", () => {
    expect(STRIKER.agentId).toBe("eval-striker");
    expect(DISRUPTOR.agentId).toBe("eval-disruptor");
    expect(BULWARK.agentId).toBe("eval-bulwark");
  });

  it("builds 120 unique scenarios per split", () => {
    const dev = buildMatchSuite("dev");
    const heldout = buildMatchSuite("heldout");

    expect(dev).toHaveLength(120);
    expect(heldout).toHaveLength(120);

    const devIds = new Set(dev.map((s) => s.id));
    const heldoutIds = new Set(heldout.map((s) => s.id));
    expect(devIds.size).toBe(120);
    expect(heldoutIds.size).toBe(120);

    const devSeeds = new Set(dev.map((s) => s.seed));
    const heldoutSeeds = new Set(heldout.map((s) => s.seed));
    for (const seed of devSeeds) {
      expect(heldoutSeeds.has(seed)).toBe(false);
    }

    expect(dev.map((s) => s.id)).toEqual([...dev.map((s) => s.id)].sort());
  });

  it("selectDiverseScenarios yields distinct strata for n=4", () => {
    const dev = buildMatchSuite("dev");
    const picked = selectDiverseScenarios(dev, 4);
    expect(picked).toHaveLength(4);
    const keys = picked.map(scenarioStratumKey);
    expect(new Set(keys).size).toBe(4);

    const again = selectDiverseScenarios(dev, 4);
    expect(again.map((s) => s.id)).toEqual(picked.map((s) => s.id));

    const twelve = selectDiverseScenarios(dev, 12);
    expect(new Set(twelve.map(scenarioStratumKey)).size).toBe(12);
  });
});

describe("eval player policies", () => {
  it("returns an equipped skill id", () => {
    const runtime = startBattle(STRIKER, FRACTURE, 1);
    const greedyId = greedyPlayer(STRIKER)(runtime);
    const randomId = seededRandomPlayer(STRIKER, 1)(runtime);

    expect(STRIKER.skillIds).toContain(greedyId);
    expect(STRIKER.skillIds).toContain(randomId);
  });

  it("is stateless and does not mutate the runtime", () => {
    const runtime = startBattle(STRIKER, FRACTURE, 7);
    const before = structuredClone(runtime);
    const policy = greedyPlayer(STRIKER);
    const first = policy(runtime);

    for (let i = 0; i < 50; i += 1) {
      expect(policy(runtime)).toBe(first);
    }

    expect(runtime).toEqual(before);
  });

  it("seeded-random differs across seeds for at least one state", () => {
    const runtime = startBattle(STRIKER, FRACTURE, 3);
    const ids = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) =>
        seededRandomPlayer(STRIKER, seed)(runtime)
      )
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it("mix is deterministic", () => {
    expect(mix("abc", 3)).toBe(mix("abc", 3));
    expect(mix(1, 0)).not.toBe(mix(2, 0));
  });
});

describe("eval CPU policies", () => {
  it("random policy equals a plain stepBattle", async () => {
    const runtime = startBattle(STRIKER, FRACTURE, "cpu-random-eq");
    const playerSkillId = STRIKER.skillIds[0]!;
    const expected = stepBattle(runtime, playerSkillId);
    const actual = await randomCpuPolicy().decide(runtime, playerSkillId);
    expect(actual.step).toEqual(expected);
  });
});
