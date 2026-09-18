import { describe, expect, it } from "vitest";
import { bestResponse, regret, greedyPlayer, seededRandomPlayer } from "../eval";
import { isBattleOver, startBattle, stepBattle } from "../engine";
import type { BattleRuntime, SkillId } from "../engine";
import { STRIKER } from "../eval/scenarios";
import { FRACTURE } from "../data/opponents";

function bruteForceValue(
  runtime: BattleRuntime,
  playerSkillId: SkillId,
  playerPolicy: (r: BattleRuntime) => SkillId,
  cpuSkillId: SkillId
): number {
  const { runtime: next, outcome } = stepBattle(
    runtime,
    playerSkillId,
    () => cpuSkillId
  );
  if (outcome !== undefined || isBattleOver(next.session)) {
    const o =
      outcome ??
      next.turns[next.turns.length - 1]?.outcome;
    let base = 0;
    if (o?.result === "cpu-victory") base = 1000;
    else if (o?.result === "player-victory") base = -1000;
    return base + (next.cpu.health - next.player.health);
  }

  let best = -Infinity;
  const pSkill = playerPolicy(next);
  for (const c of next.session.cpu.skillIds) {
    const value = bruteForceValue(next, pSkill, playerPolicy, c);
    if (value > best) best = value;
  }
  return best;
}

function advanceToLateGame(): {
  runtime: BattleRuntime;
  playerSkillId: SkillId;
} {
  const playerPolicy = greedyPlayer(STRIKER);
  let runtime = startBattle(STRIKER, FRACTURE, "oracle-late-1", 20);
  const greedy = (cpu: { energy: number }, player: unknown) => {
    void player;
    // force low-energy path by picking first skill always via injection
    return FRACTURE.skillIds[0]!;
  };
  void greedy;

  // Play until few turns remain / low HP
  while (!isBattleOver(runtime.session) && runtime.session.turn < 15) {
    const playerSkillId = playerPolicy(runtime);
    runtime = stepBattle(
      runtime,
      playerSkillId,
      (self) => {
        // prefer first affordable
        for (const id of FRACTURE.skillIds) {
          if (id === "skill-override-pulse" && self.energy >= 3) return id;
          if (id === "skill-signal-exposure" && self.energy >= 2) return id;
        }
        return FRACTURE.skillIds[0]!;
      }
    ).runtime;
  }

  if (isBattleOver(runtime.session)) {
    // restart with short max turns near end differently
    runtime = startBattle(STRIKER, FRACTURE, "oracle-late-2", 3);
    while (!isBattleOver(runtime.session) && runtime.session.turn < 2) {
      runtime = stepBattle(
        runtime,
        playerPolicy(runtime),
        () => FRACTURE.skillIds[0]!
      ).runtime;
    }
  }

  return { runtime, playerSkillId: playerPolicy(runtime) };
}

describe("bestResponse oracle", () => {
  it("matches brute-force on small late-game states", () => {
    const playerPolicy = greedyPlayer(STRIKER);
    const cases: Array<{ runtime: BattleRuntime; playerSkillId: SkillId }> = [];

    for (const seed of ["bf-a", "bf-b", "bf-c"]) {
      let runtime = startBattle(STRIKER, FRACTURE, seed, 4);
      while (!isBattleOver(runtime.session) && runtime.session.turn < 3) {
        runtime = stepBattle(
          runtime,
          playerPolicy(runtime),
          () => FRACTURE.skillIds[0]!
        ).runtime;
      }
      if (!isBattleOver(runtime.session)) {
        cases.push({ runtime, playerSkillId: playerPolicy(runtime) });
      }
    }

    expect(cases.length).toBeGreaterThanOrEqual(3);

    for (const { runtime, playerSkillId } of cases.slice(0, 3)) {
      const before = structuredClone(runtime);
      const result = bestResponse(runtime, playerSkillId, playerPolicy);
      expect(result.exact).toBe(true);
      expect(runtime).toEqual(before);

      for (const cpuSkillId of runtime.session.cpu.skillIds) {
        const brute = bruteForceValue(
          runtime,
          playerSkillId,
          playerPolicy,
          cpuSkillId
        );
        expect(result.values[cpuSkillId]).toBe(brute);
      }
    }
  });

  it("returns exact:false when node cap is hit", () => {
    const runtime = startBattle(STRIKER, FRACTURE, "cap-1", 20);
    const playerPolicy = greedyPlayer(STRIKER);
    const result = bestResponse(
      runtime,
      playerPolicy(runtime),
      playerPolicy,
      { maxNodes: 1 }
    );
    expect(result.exact).toBe(false);
    expect(result.nodes).toBeGreaterThan(0);
  });

  it("regret is 0 for best moves", () => {
    const runtime = startBattle(STRIKER, FRACTURE, "regret-1", 8);
    const playerPolicy = greedyPlayer(STRIKER);
    const playerSkillId = playerPolicy(runtime);
    const result = bestResponse(runtime, playerSkillId, playerPolicy);
    expect(result.exact).toBe(true);
    for (const bestId of result.best) {
      expect(regret(result.values, bestId)).toBe(0);
    }
  });

  it("does not mutate the input runtime", () => {
    const { runtime, playerSkillId } = advanceToLateGame();
    if (isBattleOver(runtime.session)) {
      return;
    }
    const before = structuredClone(runtime);
    bestResponse(runtime, playerSkillId, greedyPlayer(STRIKER));
    expect(runtime).toEqual(before);
  });

  it("throws when MemoScope is reused with a different identity", () => {
    const runtime = startBattle(STRIKER, FRACTURE, "memo-id-1", 6);
    const greedy = greedyPlayer(STRIKER);
    const random = seededRandomPlayer(STRIKER, 1);
    const scope = {
      identity: "greedy|fracture",
      map: new Map<string, number>()
    };
    bestResponse(runtime, greedy(runtime), greedy, { memo: scope });
    scope.identity = "seeded|fracture";
    expect(() =>
      bestResponse(runtime, random(runtime), random, { memo: scope })
    ).toThrow(/MemoScope reused with different identity/);
  });

  it("reuses MemoScope within one identity and reduces node counts", () => {
    const runtime = startBattle(STRIKER, FRACTURE, "memo-reuse", 8);
    const playerPolicy = greedyPlayer(STRIKER);
    const playerSkillId = playerPolicy(runtime);
    const scope = {
      identity: "greedy|fracture|reuse",
      map: new Map<string, number>()
    };
    const first = bestResponse(runtime, playerSkillId, playerPolicy, {
      memo: scope
    });
    const second = bestResponse(runtime, playerSkillId, playerPolicy, {
      memo: scope
    });
    expect(first.exact).toBe(true);
    expect(second.exact).toBe(true);
    expect(second.nodes).toBeLessThan(first.nodes);
    expect(second.values).toEqual(first.values);
  });
});
