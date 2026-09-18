import { describe, expect, it } from "vitest";
import {
  computeGroundedFacts,
  projectSkillEffects
} from "../agent/grounding";
import {
  COMBATANT_MAX_ENERGY,
  COMBATANT_MAX_HEALTH,
  MVP_SKILL_CATALOG,
  TURN_ENERGY_RECOVERY,
  resolveAction,
  startBattle,
  stepBattle,
  type AgentConfig,
  type CombatantState,
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
});
