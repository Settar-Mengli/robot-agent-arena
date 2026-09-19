import { describe, expect, it } from "vitest";
import {
  ENERGY_DRAIN_WEIGHT,
  LOW_HEALTH_RATIO,
  createGreedySelector,
  projectSkillEffects
} from "../agent";
import {
  FALLBACK_ACTION_ID,
  MAX_DEFENSE,
  MVP_SKILL_CATALOG,
  isBattleOver,
  startBattle,
  stepBattle
} from "../engine";
import type { AgentConfig, CombatantState, SkillId } from "../engine";

const modules = {
  coreIdentity: "Steady Vanguard",
  memory: "Pattern Recall",
  sigilSecurity: "Aegis Layer",
  rules: "Never Skip Verification",
  strategy: "Measured Pressure"
};

function agent(skillIds: SkillId[]): AgentConfig {
  return {
    agentId: "cpu-greedy",
    displayName: "GREEDY",
    modules,
    skillIds
  };
}

function combatant(
  side: "cpu" | "player",
  overrides: Partial<CombatantState> = {}
): CombatantState {
  return {
    side,
    agentId: side === "cpu" ? "cpu-greedy" : "player-1",
    displayName: side === "cpu" ? "GREEDY" : "PLAYER",
    health: 30,
    maxHealth: 30,
    energy: 6,
    maxEnergy: 10,
    defense: 0,
    ...overrides
  };
}

describe("createGreedySelector", () => {
  it("exports named constants", () => {
    expect(LOW_HEALTH_RATIO).toBe(0.4);
    expect(ENERGY_DRAIN_WEIGHT).toBe(0.5);
  });

  it("rule 0: empty affordable set returns E[0] which resolves to fallback-stabilize", () => {
    const config = agent(["skill-logic-storm", "skill-null-pulse"]);
    const selector = createGreedySelector(config);
    const self = combatant("cpu", { energy: 0 });
    const target = combatant("player");
    expect(selector(self, target)).toBe("skill-logic-storm");

    const playerConfig = agent(["skill-core-identity"]);
    playerConfig.agentId = "player-1";
    const runtime = startBattle(playerConfig, config, "greedy-rule0", 3);
    runtime.cpu = { ...runtime.cpu, energy: 0 };
    const stepped = stepBattle(runtime, "skill-core-identity", selector);
    const cpuAction = stepped.turnRecord.actions.find((action) => action.actor === "cpu");
    expect(cpuAction?.selectedSkillId).toBe("skill-logic-storm");
    expect(cpuAction?.resolvedSkillId).toBe(FALLBACK_ACTION_ID);
  });

  it("rule 1: prefers lethal max damage", () => {
    const selector = createGreedySelector(
      agent(["skill-override-pulse", "skill-logic-storm"])
    );
    const self = combatant("cpu", { energy: 10 });
    const target = combatant("player", { health: 8 });
    // override pulse: 7, logic storm: 9 — storm is lethal and max dmg
    expect(selector(self, target)).toBe("skill-logic-storm");
  });

  it("rule 1 tie-break: lower energyCost then config order", () => {
    // health 3: both lethals; breach dmg=3 > exposure dmg=2 → max dmg wins
    const maxDmg = createGreedySelector(
      agent(["skill-signal-exposure", "skill-signal-breach"])
    );
    expect(
      maxDmg(combatant("cpu", { energy: 10 }), combatant("player", { health: 3 }))
    ).toBe("skill-signal-breach");

    // health 1: both lethals with equal clamped dmg=1; cheaper energyCost wins
    const equal = createGreedySelector(
      agent(["skill-signal-breach", "skill-signal-exposure"])
    );
    expect(
      equal(combatant("cpu", { energy: 10 }), combatant("player", { health: 1 }))
    ).toBe("skill-signal-exposure");
  });

  it("rule 2: low health prefers max heal when recovery is affordable", () => {
    const selector = createGreedySelector(
      agent(["skill-override-pulse", "skill-logic-drift"])
    );
    const threshold = Math.floor(30 * LOW_HEALTH_RATIO);
    const self = combatant("cpu", { health: threshold, energy: 10 });
    const target = combatant("player", { health: 30 });
    expect(selector(self, target)).toBe("skill-logic-drift");
  });

  it("rule 3: offense score = dmg + weight * drain", () => {
    const selector = createGreedySelector(
      agent(["skill-signal-exposure", "skill-sigil-rule"])
    );
    const self = combatant("cpu", { energy: 10, health: 30 });
    const target = combatant("player", { health: 30, energy: 10 });
    // exposure score = 2 + 0.5*2 = 3; sigil guard later — offense wins
    expect(selector(self, target)).toBe("skill-signal-exposure");
  });

  it("rule 4: max guard when no offense score", () => {
    const selector = createGreedySelector(
      agent(["skill-core-identity", "skill-null-pulse"])
    );
    const self = combatant("cpu", { energy: 10, defense: 0 });
    const target = combatant("player");
    expect(selector(self, target)).toBe("skill-null-pulse"); // +5 > +3
  });

  it("rule 5: max heal when no guard available", () => {
    const selector = createGreedySelector(agent(["skill-logic-drift"]));
    const self = combatant("cpu", {
      health: 20,
      energy: 10,
      defense: MAX_DEFENSE
    });
    const target = combatant("player");
    expect(selector(self, target)).toBe("skill-logic-drift");
  });

  it("rule 6: cheapest affordable otherwise", () => {
    // Full health + max defense: no offense from defense skills, guard=0, no heal needed path.
    const full = createGreedySelector(
      agent(["skill-null-pulse", "skill-core-identity"])
    );
    const self = combatant("cpu", {
      health: 30,
      energy: 10,
      defense: MAX_DEFENSE
    });
    expect(full(self, combatant("player"))).toBe("skill-core-identity");
  });

  it("treats energy exactly equal to cost as affordable; one below is not", () => {
    const selector = createGreedySelector(
      agent(["skill-logic-storm", "skill-null-pulse"])
    );
    expect(
      selector(combatant("cpu", { energy: 5 }), combatant("player", { health: 30 }))
    ).toBe("skill-logic-storm");
    expect(
      selector(combatant("cpu", { energy: 4 }), combatant("player", { health: 30 }))
    ).toBe("skill-null-pulse");
  });

  it("is deterministic and does not mutate inputs", () => {
    const selector = createGreedySelector(
      agent(["skill-override-pulse", "skill-null-pulse"])
    );
    const self = combatant("cpu", { energy: 10 });
    const target = combatant("player", { health: 20 });
    const selfBefore = structuredClone(self);
    const targetBefore = structuredClone(target);
    const first = selector(self, target);
    for (let i = 0; i < 100; i += 1) {
      expect(selector(self, target)).toBe(first);
    }
    expect(self).toEqual(selfBefore);
    expect(target).toEqual(targetBefore);
  });

  it("always returns an equipped skill across loadout subsets and state grid", () => {
    const allIds = MVP_SKILL_CATALOG.skills.map((skill) => skill.skillId);
    const healths = [1, 15, 30];
    const energies = [0, 3, 10];
    const defenses = [0, 6, MAX_DEFENSE];

    for (let mask = 1; mask < 1 << allIds.length; mask += 1) {
      const skillIds = allIds.filter((_, index) => (mask & (1 << index)) !== 0);
      const selector = createGreedySelector(agent(skillIds));
      for (const health of healths) {
        for (const energy of energies) {
          for (const defense of defenses) {
            const self = combatant("cpu", { health, energy, defense });
            const target = combatant("player", {
              health: healths[(health + 1) % healths.length]!,
              energy: energies[(energy + 1) % energies.length]!,
              defense: defenses[(defense + 1) % defenses.length]!
            });
            const chosen = selector(self, target);
            expect(skillIds).toContain(chosen);
          }
        }
      }
    }
  });

  it("agrees with grounding projections on a broad state grid", () => {
    const allIds = MVP_SKILL_CATALOG.skills.map((skill) => skill.skillId);
    const healths = [1, 12, 30];
    const energies = [0, 2, 6, 10];
    const defenses = [0, 4, MAX_DEFENSE];

    function groundingBacked(
      cfg: AgentConfig
    ): (self: CombatantState, target: CombatantState) => SkillId {
      return (self, target) => {
        const equipped = cfg.skillIds.map(
          (id) => MVP_SKILL_CATALOG.skills.find((s) => s.skillId === id)!
        );
        const affordable = equipped.filter((s) => s.energyCost <= self.energy);
        if (affordable.length === 0) {
          return equipped[0]!.skillId;
        }
        const dmg = (skill: (typeof equipped)[0]) =>
          projectSkillEffects(skill, self, target).damageAfterDefense;
        const drainAmt = (skill: (typeof equipped)[0]) =>
          projectSkillEffects(skill, self, target).energyDrained;
        const healAmt = (skill: (typeof equipped)[0]) =>
          projectSkillEffects(skill, self, self).healAmount;
        const guardAmt = (skill: (typeof equipped)[0]) =>
          projectSkillEffects(skill, self, self).defenseGained;

        const pick = (
          candidates: typeof equipped,
          scoreOf: (s: (typeof equipped)[0]) => number
        ) => {
          let best = candidates[0]!;
          let bestScore = scoreOf(best);
          for (let i = 1; i < candidates.length; i += 1) {
            const skill = candidates[i]!;
            const score = scoreOf(skill);
            if (
              score > bestScore ||
              (score === bestScore && skill.energyCost < best.energyCost)
            ) {
              best = skill;
              bestScore = score;
            }
          }
          return best.skillId;
        };

        const lethal = affordable.filter((s) => dmg(s) >= target.health);
        if (lethal.length > 0) {
          return pick(lethal, dmg);
        }
        if (self.health <= Math.floor(self.maxHealth * LOW_HEALTH_RATIO)) {
          const recoveries = affordable.filter((s) => healAmt(s) > 0);
          if (recoveries.length > 0) {
            return pick(recoveries, healAmt);
          }
        }
        const offense = pick(
          affordable,
          (s) => dmg(s) + ENERGY_DRAIN_WEIGHT * drainAmt(s)
        );
        const offenseSkill = equipped.find((s) => s.skillId === offense)!;
        if (
          dmg(offenseSkill) + ENERGY_DRAIN_WEIGHT * drainAmt(offenseSkill) >
          0
        ) {
          return offense;
        }
        const guards = affordable.filter((s) => guardAmt(s) > 0);
        if (guards.length > 0) {
          return pick(guards, guardAmt);
        }
        const heals = affordable.filter((s) => healAmt(s) > 0);
        if (heals.length > 0) {
          return pick(heals, healAmt);
        }
        return pick(affordable, () => 0);
      };
    }

    // Representative loadouts (not full 2^8 — covered by differential proof)
    const loadouts: SkillId[][] = [
      ["skill-override-pulse", "skill-signal-exposure"],
      ["skill-null-pulse", "skill-logic-storm"],
      ["skill-core-identity", "skill-sigil-rule"],
      allIds.slice(0, 2),
      allIds.slice(2, 4),
      allIds.slice(4, 6),
      allIds.slice(6, 8)
    ];

    for (const skillIds of loadouts) {
      const cfg = agent(skillIds);
      const greedy = createGreedySelector(cfg);
      const grounded = groundingBacked(cfg);
      for (const health of healths) {
        for (const energy of energies) {
          for (const defense of defenses) {
            const self = combatant("cpu", { health, energy, defense });
            const target = combatant("player", {
              health: 30 - health + 1,
              energy: (energy + 3) % 11,
              defense: (defense + 2) % (MAX_DEFENSE + 1)
            });
            expect(greedy(self, target)).toBe(grounded(self, target));
          }
        }
      }
    }
  });

  it("integrates with stepBattle deterministically across seeds", () => {
    const player = agent(["skill-override-pulse", "skill-logic-storm"]);
    player.agentId = "agent-player-1";
    const cpu = agent(["skill-null-pulse", "skill-logic-storm"]);
    const selector = createGreedySelector(cpu);
    const sequence: SkillId[] = [
      "skill-logic-storm",
      "skill-override-pulse",
      "skill-logic-storm",
      "skill-override-pulse",
      "skill-logic-storm"
    ];

    for (const seed of ["g-seed-a", "g-seed-b", "g-seed-c"]) {
      const run = (): ReturnType<typeof startBattle> => {
        let runtime = startBattle(player, cpu, seed, 10);
        for (const skillId of sequence) {
          if (isBattleOver(runtime.session)) {
            break;
          }
          runtime = stepBattle(runtime, skillId, selector).runtime;
        }
        return runtime;
      };

      const first = run();
      const second = run();
      expect(second).toEqual(first);
    }
  });
});
