import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AEGIS,
  BULWARK,
  DISRUPTOR,
  HELDOUT_ARCHETYPES,
  MNEMONIC,
  PLAYER_ARCHETYPES,
  STRIKER,
  TEMPEST,
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

function loadoutPairKey(skillIds: readonly string[]): string {
  return [...skillIds].sort().join(",");
}

function hasDamagePotential(skillIds: readonly string[]): boolean {
  return skillIds.some((skillId) => {
    const skill = MVP_SKILL_CATALOG.skills.find((s) => s.skillId === skillId);
    if (skill === undefined) {
      return false;
    }
    const effect = skill.effect;
    return (
      (effect.category === "attack" || effect.category === "disrupt") &&
      "basePower" in effect &&
      effect.basePower > 0
    );
  });
}

/** sha256 of sorted buildMatchSuite("dev") ids joined by newline — byte-stable lock. */
const DEV_SUITE_IDS_SHA256 =
  "6556ee62815cef861dabbbae38bce93f6d7caa47aaafe76045d2cde5bdd929af";

describe("eval scenarios", () => {
  it.each([...PLAYER_ARCHETYPES, ...HELDOUT_ARCHETYPES])(
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
    expect(AEGIS.agentId).toBe("eval-aegis");
    expect(TEMPEST.agentId).toBe("eval-tempest");
    expect(MNEMONIC.agentId).toBe("eval-mnemonic");
  });

  it("locks buildMatchSuite(dev) scenario ids", () => {
    const ids = buildMatchSuite("dev").map((s) => s.id);
    expect(ids).toHaveLength(120);
    expect(ids[0]).toBe("bulwark__greedy__fracture__s1");
    expect(ids[ids.length - 1]).toBe(
      "striker__seeded-random__sentinel-x__s9"
    );
    expect(
      createHash("sha256").update(ids.join("\n")).digest("hex")
    ).toBe(DEV_SUITE_IDS_SHA256);
  });

  it("heldout loadout pairs are disjoint from every dev loadout pair", () => {
    const devPairs = new Set(
      PLAYER_ARCHETYPES.map((a) => loadoutPairKey(a.skillIds))
    );
    for (const archetype of HELDOUT_ARCHETYPES) {
      expect(devPairs.has(loadoutPairKey(archetype.skillIds))).toBe(false);
    }
  });

  it("every archetype in both splits has damage potential", () => {
    for (const archetype of [...PLAYER_ARCHETYPES, ...HELDOUT_ARCHETYPES]) {
      expect(hasDamagePotential(archetype.skillIds)).toBe(true);
    }
  });

  it("dev vs heldout stratum key sets are disjoint", () => {
    const devKeys = new Set(buildMatchSuite("dev").map(scenarioStratumKey));
    const heldoutKeys = new Set(
      buildMatchSuite("heldout").map(scenarioStratumKey)
    );
    for (const key of heldoutKeys) {
      expect(devKeys.has(key)).toBe(false);
    }
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

    for (const scenario of heldout) {
      expect(
        HELDOUT_ARCHETYPES.some(
          (a) => a.agentId === scenario.playerConfig.agentId
        )
      ).toBe(true);
    }
  });

  it("selectDiverseScenarios is archetype-first for n=3/4/6", () => {
    const dev = buildMatchSuite("dev");
    const heldout = buildMatchSuite("heldout");

    for (const suite of [dev, heldout]) {
      const n3 = selectDiverseScenarios(suite, 3);
      expect(n3).toHaveLength(3);
      expect(new Set(n3.map((s) => s.playerConfig.agentId)).size).toBe(3);
      expect(new Set(n3.map((s) => s.playerPolicy)).size).toBe(1);
      expect(n3.every((s) => s.playerPolicy === "greedy")).toBe(true);

      const n4 = selectDiverseScenarios(suite, 4);
      expect(n4).toHaveLength(4);
      expect(new Set(n4.map((s) => s.playerConfig.agentId)).size).toBe(3);
      expect(new Set(n4.map((s) => s.playerPolicy)).size).toBe(2);

      const n6 = selectDiverseScenarios(suite, 6);
      expect(n6).toHaveLength(6);
      expect(new Set(n6.map((s) => s.playerConfig.agentId)).size).toBe(3);
      expect(new Set(n6.map((s) => s.playerPolicy)).size).toBe(2);
      expect(
        n6.filter((s) => s.playerPolicy === "greedy")
      ).toHaveLength(3);
      expect(
        n6.filter((s) => s.playerPolicy === "seeded-random")
      ).toHaveLength(3);

      const again = selectDiverseScenarios(suite, 6);
      expect(again.map((s) => s.id)).toEqual(n6.map((s) => s.id));
    }

    const twelve = selectDiverseScenarios(dev, 12);
    expect(new Set(twelve.map(scenarioStratumKey)).size).toBe(12);
  });

  it("selectDiverseScenarios yields distinct strata for n=4", () => {
    const dev = buildMatchSuite("dev");
    const picked = selectDiverseScenarios(dev, 4);
    expect(picked).toHaveLength(4);
    const keys = picked.map(scenarioStratumKey);
    expect(new Set(keys).size).toBe(4);

    const again = selectDiverseScenarios(dev, 4);
    expect(again.map((s) => s.id)).toEqual(picked.map((s) => s.id));
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
