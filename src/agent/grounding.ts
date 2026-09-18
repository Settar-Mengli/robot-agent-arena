import {
  MAX_DEFENSE,
  MVP_SKILL_CATALOG,
  TURN_ENERGY_RECOVERY,
  type AgentConfig,
  type CombatantState,
  type SkillCatalog,
  type SkillDefinition,
  type SkillId
} from "../engine";

/**
 * Engine-derived facts for the agent prompt. Pure: no RNG, clock, or mutation.
 * Arithmetic mirrors combat resolution (applyDamage / heal / drain / defense).
 */

export type GroundedSkillFact = {
  skillId: SkillId;
  energyCost: number;
  affordable: boolean;
  damageAfterDefense: number;
  lethal: boolean;
  defenseGained: number;
  healAmount: number;
  energyDrained: number;
};

export type GroundedThreatSkillFact = {
  skillId: SkillId;
  energyCost: number;
  affordableNextTurn: boolean;
  damageAfterDefense: number;
  lethal: boolean;
};

export type GroundedFacts = {
  turn: number;
  turnsRemaining: number;
  cpuSkills: GroundedSkillFact[];
  threat: {
    playerNextTurnEnergy: number;
    playerSkills: GroundedThreatSkillFact[];
    maxIncomingDamage: number;
    diesNextTurn: boolean;
  };
};

function requireSkill(catalog: SkillCatalog, skillId: SkillId): SkillDefinition {
  const skill = catalog.skills.find((entry) => entry.skillId === skillId);
  if (skill === undefined) {
    throw new TypeError(`skillId missing from catalog: ${skillId}`);
  }
  return skill;
}

/** Damage after defense absorption — same formula as engine applyDamage. */
export function damageAfterDefense(
  basePower: number,
  target: CombatantState
): number {
  return Math.min(
    target.health,
    basePower - Math.min(target.defense, basePower)
  );
}

export function projectSkillEffects(
  skill: SkillDefinition,
  actor: CombatantState,
  target: CombatantState
): {
  damageAfterDefense: number;
  lethal: boolean;
  defenseGained: number;
  healAmount: number;
  energyDrained: number;
} {
  let damage = 0;
  let defenseGained = 0;
  let healAmount = 0;
  let energyDrained = 0;

  switch (skill.effect.category) {
    case "attack":
      damage = damageAfterDefense(skill.effect.basePower, target);
      break;
    case "disrupt":
      damage = damageAfterDefense(skill.effect.basePower, target);
      energyDrained = Math.min(skill.effect.energyDamage, target.energy);
      break;
    case "defense":
      defenseGained = Math.min(
        skill.effect.defenseAmount,
        MAX_DEFENSE - actor.defense
      );
      break;
    case "recovery":
      healAmount = Math.min(
        skill.effect.recoveryAmount,
        actor.maxHealth - actor.health
      );
      break;
    default:
      break;
  }

  return {
    damageAfterDefense: damage,
    lethal: damage >= target.health && damage > 0,
    defenseGained,
    healAmount,
    energyDrained
  };
}

/**
 * @param observation - Post-player combatant states (CPU about to act).
 * @param cpuConfig - CPU agent (equipped skills for this turn).
 * @param playerSkillIds - Player equipped skills (threat side).
 * @param turn - Current turn number.
 * @param maxTurns - Session max turns.
 * @param catalog - Skill catalog (defaults to MVP).
 *
 * CPU affordability uses **pre-regen** energy (CPU acts now).
 * Threat affordability uses **next-turn** player energy =
 * `min(player.energy + TURN_ENERGY_RECOVERY, maxEnergy)` because regen
 * runs after the CPU acts when the battle continues.
 */
export function computeGroundedFacts(
  observation: { readonly cpu: CombatantState; readonly player: CombatantState },
  cpuConfig: AgentConfig,
  playerSkillIds: readonly SkillId[],
  turn: number,
  maxTurns: number,
  catalog: SkillCatalog = MVP_SKILL_CATALOG
): GroundedFacts {
  const { cpu, player } = observation;

  const cpuSkills: GroundedSkillFact[] = cpuConfig.skillIds.map((skillId) => {
    const skill = requireSkill(catalog, skillId);
    const affordable = skill.energyCost <= cpu.energy;
    const effects = projectSkillEffects(skill, cpu, player);
    return {
      skillId,
      energyCost: skill.energyCost,
      affordable,
      damageAfterDefense: effects.damageAfterDefense,
      lethal: effects.lethal,
      defenseGained: effects.defenseGained,
      healAmount: effects.healAmount,
      energyDrained: effects.energyDrained
    };
  });

  const playerNextTurnEnergy = Math.min(
    player.energy + TURN_ENERGY_RECOVERY,
    player.maxEnergy
  );

  const playerSkills: GroundedThreatSkillFact[] = playerSkillIds.map((skillId) => {
    const skill = requireSkill(catalog, skillId);
    const affordableNextTurn = skill.energyCost <= playerNextTurnEnergy;
    const effects = projectSkillEffects(skill, player, cpu);
    return {
      skillId,
      energyCost: skill.energyCost,
      affordableNextTurn,
      damageAfterDefense: effects.damageAfterDefense,
      lethal: effects.lethal
    };
  });

  let maxIncomingDamage = 0;
  for (const fact of playerSkills) {
    if (fact.affordableNextTurn && fact.damageAfterDefense > maxIncomingDamage) {
      maxIncomingDamage = fact.damageAfterDefense;
    }
  }

  return {
    turn,
    turnsRemaining: Math.max(0, maxTurns - turn),
    cpuSkills,
    threat: {
      playerNextTurnEnergy,
      playerSkills,
      maxIncomingDamage,
      diesNextTurn: maxIncomingDamage >= cpu.health && maxIncomingDamage > 0
    }
  };
}
