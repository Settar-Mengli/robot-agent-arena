import { describe, expect, it } from "vitest";
import {
  computeGroundedFacts,
  computeGroundedFactsV2,
  projectSkillEffects
} from "../agent/grounding";
import {
  COMBATANT_MAX_ENERGY,
  COMBATANT_MAX_HEALTH,
  FALLBACK_ACTION_ID,
  FALLBACK_DEFENSE_GAIN,
  FALLBACK_ENERGY_RECOVERY,
  MVP_SKILL_CATALOG,
  TURN_ENERGY_RECOVERY,
  resolveAction,
  startBattle,
  stepBattle,
  type AgentConfig,
  type CombatantState,
  type SkillCatalog,
  type SkillDefinition,
  type SkillId
} from "../engine";

const modules = {
  coreIdentity: "id",
  memory: "mem",
  sigilSecurity: "sig",
  rules: "rules",
  strategy: "strat"
};

function makeAgent(agentId: string, skillIds: SkillId[]): AgentConfig {
  return {
    agentId,
    displayName: agentId,
    modules,
    skillIds
  };
}

const HEALTH_LEVELS = [5, 15, COMBATANT_MAX_HEALTH] as const;
const ENERGY_LEVELS = [0, 5, COMBATANT_MAX_ENERGY] as const;
const DEFENSE_LEVELS = [0, 6, 12] as const;

describe("computeGroundedFacts / projectSkillEffects", () => {
  it("grid parity: projected effects match resolveAction (engine skill resolution)", () => {
    let combinations = 0;

    for (const skill of MVP_SKILL_CATALOG.skills) {
      const cpuConfig = makeAgent("cpu-1", [skill.skillId]);
      const playerConfig = makeAgent("player-1", ["skill-core-identity"]);

      for (const health of HEALTH_LEVELS) {
        for (const energy of ENERGY_LEVELS) {
          for (const defense of DEFENSE_LEVELS) {
            combinations += 1;

            const actor: CombatantState = {
              side: "cpu",
              agentId: "cpu-1",
              displayName: "cpu-1",
              health,
              maxHealth: COMBATANT_MAX_HEALTH,
              energy: Math.max(energy, skill.energyCost),
              maxEnergy: COMBATANT_MAX_ENERGY,
              defense
            };
            const target: CombatantState = {
              side: "player",
              agentId: "player-1",
              displayName: "player-1",
              health,
              maxHealth: COMBATANT_MAX_HEALTH,
              energy,
              maxEnergy: COMBATANT_MAX_ENERGY,
              defense
            };

            const projected = projectSkillEffects(skill, actor, target);
            const resolved = resolveAction(
              actor,
              target,
              { actor: "cpu", skillId: skill.skillId },
              cpuConfig
            );

            expect(resolved.resolvedAction.fallback).toBe(false);
            expect(resolved.resolvedAction.resolvedSkillId).toBe(skill.skillId);
            expect(resolved.resolvedAction.damageDealt).toBe(
              projected.damageAfterDefense
            );
            expect(resolved.resolvedAction.healthRecovered).toBe(projected.healAmount);
            expect(resolved.resolvedAction.energyReduced).toBe(projected.energyDrained);
            expect(resolved.resolvedAction.defenseGained).toBe(projected.defenseGained);

            const lethal =
              projected.damageAfterDefense >= target.health &&
              projected.damageAfterDefense > 0;
            expect(projected.lethal).toBe(lethal);
            if (lethal) {
              expect(resolved.target.health).toBe(0);
            }

            const facts = computeGroundedFacts(
              { cpu: actor, player: target },
              cpuConfig,
              playerConfig.skillIds,
              1,
              20
            );
            const cpuFact = facts.cpuSkills[0]!;
            expect(cpuFact.damageAfterDefense).toBe(projected.damageAfterDefense);
            expect(cpuFact.lethal).toBe(projected.lethal);
            expect(cpuFact.healAmount).toBe(projected.healAmount);
            expect(cpuFact.energyDrained).toBe(projected.energyDrained);
            expect(cpuFact.defenseGained).toBe(projected.defenseGained);
          }
        }
      }
    }

    // 8 skills × 3 health × 3 energy × 3 defense
    expect(combinations).toBe(8 * 3 * 3 * 3);
  });

  it("diesNextTurn: lethal player skill unaffordable now, affordable after regen", () => {
    // skill-logic-storm costs 5, power 9. Player energy 3 → unaffordable now;
    // after TURN_ENERGY_RECOVERY → affordable. CPU health 8 → dies.
    const playerConfig = makeAgent("player-1", [
      "skill-core-identity",
      "skill-logic-storm"
    ]);
    // CPU non-lethal attack (no energy drain on player): keeps regen path clean.
    const cpuConfig = makeAgent("cpu-1", ["skill-override-pulse"]);

    const runtime0 = startBattle(playerConfig, cpuConfig, "dies-next", 10);
    const playerEnergyNow = 5 - TURN_ENERGY_RECOVERY;
    const observation = {
      cpu: {
        ...runtime0.cpu,
        health: 8,
        energy: 10,
        defense: 0
      },
      player: {
        ...runtime0.player,
        health: 30,
        energy: playerEnergyNow,
        defense: 0
      }
    };

    expect(observation.player.energy).toBeLessThan(5);
    expect(
      observation.player.energy + TURN_ENERGY_RECOVERY
    ).toBeGreaterThanOrEqual(5);

    const facts = computeGroundedFacts(
      observation,
      cpuConfig,
      playerConfig.skillIds,
      runtime0.session.turn,
      runtime0.session.maxTurns
    );

    expect(facts.threat.playerNextTurnEnergy).toBe(
      Math.min(
        observation.player.energy + TURN_ENERGY_RECOVERY,
        observation.player.maxEnergy
      )
    );
    expect(facts.threat.diesNextTurn).toBe(true);
    expect(facts.threat.maxIncomingDamage).toBeGreaterThanOrEqual(8);

    // stepBattle: energy 4 → core (cost 1) → 3 + TURN_ENERGY_RECOVERY → 5, then storm.
    const pre = {
      ...runtime0,
      cpu: { ...observation.cpu },
      player: {
        ...observation.player,
        energy: 4
      }
    };
    const afterN = stepBattle(pre, "skill-core-identity", () => "skill-override-pulse");
    expect(afterN.outcome).toBeUndefined();
    expect(afterN.runtime.player.energy).toBeGreaterThanOrEqual(5);
    expect(afterN.runtime.cpu.health).toBeGreaterThan(0);
    expect(afterN.runtime.cpu.defense).toBe(0);

    const afterKill = stepBattle(
      afterN.runtime,
      "skill-logic-storm",
      () => "skill-override-pulse"
    );
    expect(afterKill.runtime.cpu.health).toBe(0);
    expect(afterKill.outcome?.result).toBe("player-victory");
  });

  it("CPU skill affordability uses pre-regen energy", () => {
    const cpuConfig = makeAgent("cpu-1", ["skill-logic-storm"]);
    const playerConfig = makeAgent("player-1", ["skill-core-identity"]);
    const runtime = startBattle(playerConfig, cpuConfig, "afford", 5);
    const observation = {
      cpu: { ...runtime.cpu, energy: 4 },
      player: { ...runtime.player }
    };
    const facts = computeGroundedFacts(
      observation,
      cpuConfig,
      playerConfig.skillIds,
      1,
      20
    );
    expect(facts.cpuSkills[0]!.affordable).toBe(false);
    expect(facts.cpuSkills[0]!.energyCost).toBe(5);
  });

  it("projectSkillEffects marks unknown categories without throwing", () => {
    const synthetic = {
      skillId: "skill-synthetic-unmodelled",
      displayName: "Synthetic",
      module: "strategy",
      summary: "test",
      energyCost: 1,
      effect: { category: "mystery-beam", basePower: 99 }
    } as unknown as SkillDefinition;
    const actor: CombatantState = {
      side: "cpu",
      agentId: "cpu-1",
      displayName: "cpu",
      health: 20,
      maxHealth: 30,
      energy: 10,
      maxEnergy: 10,
      defense: 0
    };
    const target: CombatantState = { ...actor, side: "player", agentId: "p" };
    const projected = projectSkillEffects(synthetic, actor, target);
    expect(projected.unmodelledCategory).toBe("mystery-beam");
    expect(projected.damageAfterDefense).toBe(0);
    expect(projected.defenseGained).toBe(0);
    expect(projected.healAmount).toBe(0);
    expect(projected.energyDrained).toBe(0);
  });

  it("computeGroundedFactsV2 throws when a candidate is unmodelled", () => {
    const synthetic = {
      skillId: "skill-synthetic-unmodelled",
      displayName: "Synthetic",
      module: "strategy",
      summary: "test",
      energyCost: 1,
      effect: { category: "mystery-beam", basePower: 99 }
    } as unknown as SkillDefinition;
    const catalog: SkillCatalog = {
      skills: [...MVP_SKILL_CATALOG.skills, synthetic]
    };
    const cpuConfig = makeAgent("cpu-1", ["skill-synthetic-unmodelled" as SkillId]);
    const observation = {
      cpu: {
        side: "cpu" as const,
        agentId: "cpu-1",
        displayName: "cpu",
        health: 20,
        maxHealth: 30,
        energy: 10,
        maxEnergy: 10,
        defense: 0
      },
      player: {
        side: "player" as const,
        agentId: "player-1",
        displayName: "player",
        health: 30,
        maxHealth: 30,
        energy: 5,
        maxEnergy: 10,
        defense: 0
      }
    };
    expect(() =>
      computeGroundedFactsV2(
        observation,
        cpuConfig,
        ["skill-core-identity"],
        1,
        20,
        catalog
      )
    ).toThrow(/unmodelled effect category/);
  });

  it("V2 unaffordable candidate projects fallback; stepBattle matches", () => {
    const cpuConfig = makeAgent("cpu-1", ["skill-logic-storm"]);
    const playerConfig = makeAgent("player-1", ["skill-core-identity"]);
    const runtime = startBattle(playerConfig, cpuConfig, "v2-fallback", 5);
    const observation = {
      cpu: { ...runtime.cpu, energy: 0, defense: 0, health: 20 },
      player: { ...runtime.player, health: 30, defense: 0 }
    };
    const facts = computeGroundedFactsV2(
      observation,
      cpuConfig,
      playerConfig.skillIds,
      1,
      20
    );
    const fact = facts.cpuSkills[0]!;
    expect(fact.affordable).toBe(false);
    expect(fact.resolvedVia).toBe("fallback");
    expect(fact.damageAfterDefense).toBe(0);
    expect(fact.defenseGained).toBe(FALLBACK_DEFENSE_GAIN);
    expect(fact.healAmount).toBe(0);

    const resolved = resolveAction(
      observation.cpu,
      observation.player,
      { actor: "cpu", skillId: "skill-logic-storm" },
      cpuConfig
    );
    expect(resolved.resolvedAction.fallback).toBe(true);
    expect(resolved.resolvedAction.resolvedSkillId).toBe(FALLBACK_ACTION_ID);
    expect(resolved.resolvedAction.defenseGained).toBe(fact.defenseGained);
    expect(resolved.resolvedAction.energyRecovered).toBe(FALLBACK_ENERGY_RECOVERY);

    const stepped = stepBattle(
      {
        ...runtime,
        cpu: { ...observation.cpu },
        player: { ...observation.player }
      },
      "skill-core-identity",
      () => "skill-logic-storm"
    );
    const cpuAction = stepped.turnRecord.actions.find((a) => a.actor === "cpu");
    expect(cpuAction?.resolvedSkillId).toBe(FALLBACK_ACTION_ID);
    expect(stepped.runtime.cpu.defense).toBe(FALLBACK_DEFENSE_GAIN);
    // fallback +2 then turn regen +TURN_ENERGY_RECOVERY
    expect(stepped.runtime.cpu.energy).toBe(
      FALLBACK_ENERGY_RECOVERY + TURN_ENERGY_RECOVERY
    );
  });

  it("V2 diesNextTurnAfterMove false when defense blocks lethal threat", () => {
    // Pre-action: storm (9) kills CPU health 8. After null-pulse (+5 def), storm deals 4.
    const cpuConfig = makeAgent("cpu-1", ["skill-null-pulse"]);
    const playerConfig = makeAgent("player-1", [
      "skill-core-identity",
      "skill-logic-storm"
    ]);
    const runtime = startBattle(playerConfig, cpuConfig, "v2-guard", 10);
    const playerEnergyNow = 5 - TURN_ENERGY_RECOVERY;
    const observation = {
      cpu: { ...runtime.cpu, health: 8, energy: 10, defense: 0 },
      player: {
        ...runtime.player,
        health: 30,
        energy: playerEnergyNow,
        defense: 0
      }
    };
    expect(observation.player.energy + TURN_ENERGY_RECOVERY).toBeGreaterThanOrEqual(5);

    const facts = computeGroundedFactsV2(
      observation,
      cpuConfig,
      playerConfig.skillIds,
      runtime.session.turn,
      runtime.session.maxTurns
    );
    expect(facts.threat.diesNextTurnPreAction).toBe(true);
    expect(facts.cpuSkills[0]!.resolvedVia).toBe("skill");
    expect(facts.cpuSkills[0]!.defenseGained).toBe(5);
    expect(facts.cpuSkills[0]!.diesNextTurnAfterMove).toBe(false);

    const afterGuard = stepBattle(
      {
        ...runtime,
        cpu: { ...observation.cpu },
        player: { ...observation.player, energy: 4 }
      },
      "skill-core-identity",
      () => "skill-null-pulse"
    );
    expect(afterGuard.runtime.cpu.defense).toBe(5);
    expect(afterGuard.runtime.cpu.health).toBe(8);
    expect(afterGuard.runtime.player.energy).toBeGreaterThanOrEqual(5);

    const afterStorm = stepBattle(
      afterGuard.runtime,
      "skill-logic-storm",
      () => "skill-null-pulse"
    );
    expect(afterStorm.runtime.cpu.health).toBeGreaterThan(0);
    expect(afterStorm.outcome).toBeUndefined();
  });

  it("V2 diesNextTurnAfterMove false when candidate is lethal this turn", () => {
    const cpuConfig = makeAgent("cpu-1", ["skill-logic-storm"]);
    const playerConfig = makeAgent("player-1", ["skill-logic-storm"]);
    const runtime = startBattle(playerConfig, cpuConfig, "v2-lethal", 10);
    const observation = {
      cpu: { ...runtime.cpu, health: 5, energy: 10, defense: 0 },
      player: {
        ...runtime.player,
        health: 5,
        energy: 5 - TURN_ENERGY_RECOVERY,
        defense: 0
      }
    };
    const facts = computeGroundedFactsV2(
      observation,
      cpuConfig,
      playerConfig.skillIds,
      runtime.session.turn,
      runtime.session.maxTurns
    );
    const storm = facts.cpuSkills[0]!;
    expect(storm.lethal).toBe(true);
    expect(storm.diesNextTurnAfterMove).toBe(false);
  });

  it("V2 diesNextTurnAfterMove false on last turn", () => {
    const cpuConfig = makeAgent("cpu-1", ["skill-sigil-rule"]);
    const playerConfig = makeAgent("player-1", ["skill-logic-storm"]);
    const maxTurns = 5;
    const runtime = startBattle(playerConfig, cpuConfig, "v2-last", maxTurns);
    const observation = {
      cpu: { ...runtime.cpu, health: 5, energy: 10, defense: 0 },
      player: {
        ...runtime.player,
        health: 30,
        energy: 5 - TURN_ENERGY_RECOVERY,
        defense: 0
      }
    };
    const facts = computeGroundedFactsV2(
      observation,
      cpuConfig,
      playerConfig.skillIds,
      maxTurns,
      maxTurns
    );
    expect(facts.turnsRemaining).toBe(0);
    expect(facts.threat.diesNextTurnPreAction).toBe(true);
    expect(facts.cpuSkills[0]!.diesNextTurnAfterMove).toBe(false);
  });

  it("V2 diesNextTurnAfterMove false when disrupt makes storm unaffordable", () => {
    const cpuConfig = makeAgent("cpu-1", ["skill-signal-breach"]);
    const playerConfig = makeAgent("player-1", ["skill-logic-storm"]);
    const runtime = startBattle(playerConfig, cpuConfig, "v2-drain", 10);
    // Without drain: energy 3 + regen 2 = 5 → storm OK. After drain 2: 1+2=3 → not OK.
    const observation = {
      cpu: { ...runtime.cpu, health: 5, energy: 10, defense: 0 },
      player: {
        ...runtime.player,
        health: 30,
        energy: 3,
        defense: 0
      }
    };
    expect(observation.player.energy + TURN_ENERGY_RECOVERY).toBe(5);
    expect(observation.player.energy - 2 + TURN_ENERGY_RECOVERY).toBe(3);

    const facts = computeGroundedFactsV2(
      observation,
      cpuConfig,
      playerConfig.skillIds,
      runtime.session.turn,
      runtime.session.maxTurns
    );
    expect(facts.threat.diesNextTurnPreAction).toBe(true);
    const breach = facts.cpuSkills[0]!;
    expect(breach.energyDrained).toBe(2);
    expect(breach.diesNextTurnAfterMove).toBe(false);
  });
});
