import {
  FALLBACK_DEFENSE_GAIN,
  FALLBACK_ENERGY_RECOVERY,
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

export type ProjectedSkillEffects = {
  damageAfterDefense: number;
  lethal: boolean;
  defenseGained: number;
  healAmount: number;
  energyDrained: number;
  /** Set when effect.category is not modelled — zeros plus this marker (not a throw). */
  unmodelledCategory?: string;
};

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

export type GroundedSkillFactV2 = {
  skillId: SkillId;
  energyCost: number;
  affordable: boolean;
  resolvedVia: "skill" | "fallback";
  damageAfterDefense: number;
  lethal: boolean;
  defenseGained: number;
  healAmount: number;
  energyDrained: number;
  /** True if max next-turn player damage kills CPU after this candidate's defense/heal. */
  diesNextTurnAfterMove: boolean;
};

export type GroundedFactsV2 = {
  factsVersion: 2;
  turn: number;
  turnsRemaining: number;
  cpuSkills: GroundedSkillFactV2[];
  threat: {
    playerNextTurnEnergy: number;
    playerSkills: GroundedThreatSkillFact[];
    maxIncomingDamage: number;
    /** Pre-action lethality (same formula as GroundedFacts.threat.diesNextTurn). */
    diesNextTurnPreAction: boolean;
  };
};

export type AnyGroundedFacts = GroundedFacts | GroundedFactsV2;

export function isGroundedFactsV2(
  facts: AnyGroundedFacts | undefined
): facts is GroundedFactsV2 {
  return (
    facts !== undefined &&
    "factsVersion" in facts &&
    facts.factsVersion === 2
  );
}

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
): ProjectedSkillEffects {
  let damage = 0;
  let defenseGained = 0;
  let healAmount = 0;
  let energyDrained = 0;
  let unmodelledCategory: string | undefined;

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
    default: {
      const category = (skill.effect as { category: string }).category;
      unmodelledCategory = String(category);
      break;
    }
  }

  return {
    damageAfterDefense: damage,
    lethal: damage >= target.health && damage > 0,
    defenseGained,
    healAmount,
    energyDrained,
    ...(unmodelledCategory !== undefined ? { unmodelledCategory } : {})
  };
}

function projectFallbackStabilize(actor: CombatantState): {
  defenseGained: number;
  energyRecovered: number;
  nextActor: CombatantState;
} {
  const nextEnergy = Math.min(
    actor.energy + FALLBACK_ENERGY_RECOVERY,
    actor.maxEnergy
  );
  const nextDefense = Math.min(actor.defense + FALLBACK_DEFENSE_GAIN, MAX_DEFENSE);
  return {
    defenseGained: nextDefense - actor.defense,
    energyRecovered: nextEnergy - actor.energy,
    nextActor: {
      ...actor,
      energy: nextEnergy,
      defense: nextDefense
    }
  };
}

function maxIncomingDamageVs(
  playerSkills: readonly GroundedThreatSkillFact[],
  cpu: CombatantState,
  player: CombatantState,
  catalog: SkillCatalog,
  /** When set, re-check affordability (e.g. after disrupt drain). */
  playerNextTurnEnergyOverride?: number
): number {
  let max = 0;
  for (const fact of playerSkills) {
    const affordable =
      playerNextTurnEnergyOverride !== undefined
        ? fact.energyCost <= playerNextTurnEnergyOverride
        : fact.affordableNextTurn;
    if (!affordable) {
      continue;
    }
    const skill = requireSkill(catalog, fact.skillId);
    const effects = projectSkillEffects(skill, player, cpu);
    if (effects.unmodelledCategory !== undefined) {
      throw new TypeError(
        `unmodelled effect category in threat projection: ${effects.unmodelledCategory}`
      );
    }
    if (effects.damageAfterDefense > max) {
      max = effects.damageAfterDefense;
    }
  }
  return max;
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

/**
 * Corrected grounded facts (D-034): fallback projection, per-candidate
 * diesNextTurnAfterMove, and refuse unmodelled effect categories.
 */
export function computeGroundedFactsV2(
  observation: { readonly cpu: CombatantState; readonly player: CombatantState },
  cpuConfig: AgentConfig,
  playerSkillIds: readonly SkillId[],
  turn: number,
  maxTurns: number,
  catalog: SkillCatalog = MVP_SKILL_CATALOG
): GroundedFactsV2 {
  const { cpu, player } = observation;
  const turnsRemaining = Math.max(0, maxTurns - turn);

  const playerNextTurnEnergy = Math.min(
    player.energy + TURN_ENERGY_RECOVERY,
    player.maxEnergy
  );

  const playerSkills: GroundedThreatSkillFact[] = playerSkillIds.map((skillId) => {
    const skill = requireSkill(catalog, skillId);
    const affordableNextTurn = skill.energyCost <= playerNextTurnEnergy;
    const effects = projectSkillEffects(skill, player, cpu);
    if (effects.unmodelledCategory !== undefined) {
      throw new TypeError(
        `unmodelled effect category in grounded facts: ${effects.unmodelledCategory}`
      );
    }
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
  const diesNextTurnPreAction =
    maxIncomingDamage >= cpu.health && maxIncomingDamage > 0;

  function diesNextTurnAfterMove(
    nextCpu: CombatantState,
    energyDrained: number,
    lethal: boolean
  ): boolean {
    if (lethal || turnsRemaining === 0) {
      return false;
    }
    const energyAfterDrain = Math.max(0, player.energy - energyDrained);
    const nextTurnEnergy = Math.min(
      energyAfterDrain + TURN_ENERGY_RECOVERY,
      player.maxEnergy
    );
    const incoming = maxIncomingDamageVs(
      playerSkills,
      nextCpu,
      player,
      catalog,
      nextTurnEnergy
    );
    return incoming >= nextCpu.health && incoming > 0;
  }

  const cpuSkills: GroundedSkillFactV2[] = cpuConfig.skillIds.map((skillId) => {
    const skill = requireSkill(catalog, skillId);
    const affordable = skill.energyCost <= cpu.energy;

    if (!affordable) {
      const fallback = projectFallbackStabilize(cpu);
      return {
        skillId,
        energyCost: skill.energyCost,
        affordable: false,
        resolvedVia: "fallback",
        damageAfterDefense: 0,
        lethal: false,
        defenseGained: fallback.defenseGained,
        healAmount: 0,
        energyDrained: 0,
        diesNextTurnAfterMove: diesNextTurnAfterMove(
          fallback.nextActor,
          0,
          false
        )
      };
    }

    const effects = projectSkillEffects(skill, cpu, player);
    if (effects.unmodelledCategory !== undefined) {
      throw new TypeError(
        `unmodelled effect category in grounded facts: ${effects.unmodelledCategory}`
      );
    }

    const nextCpu: CombatantState = {
      ...cpu,
      health: Math.min(cpu.maxHealth, cpu.health + effects.healAmount),
      defense: Math.min(MAX_DEFENSE, cpu.defense + effects.defenseGained)
    };

    return {
      skillId,
      energyCost: skill.energyCost,
      affordable: true,
      resolvedVia: "skill",
      damageAfterDefense: effects.damageAfterDefense,
      lethal: effects.lethal,
      defenseGained: effects.defenseGained,
      healAmount: effects.healAmount,
      energyDrained: effects.energyDrained,
      diesNextTurnAfterMove: diesNextTurnAfterMove(
        nextCpu,
        effects.energyDrained,
        effects.lethal
      )
    };
  });

  return {
    factsVersion: 2,
    turn,
    turnsRemaining,
    cpuSkills,
    threat: {
      playerNextTurnEnergy,
      playerSkills,
      maxIncomingDamage,
      diesNextTurnPreAction
    }
  };
}
