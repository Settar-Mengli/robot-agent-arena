import {
  MAX_DEFENSE,
  MVP_SKILL_CATALOG,
  type AgentConfig,
  type CombatantState,
  type SelectCpuSkillId,
  type SkillCatalog,
  type SkillDefinition,
  type SkillId
} from "../../engine";

export const LOW_HEALTH_RATIO = 0.4;
export const ENERGY_DRAIN_WEIGHT = 0.5;

function requireSkill(
  catalog: SkillCatalog,
  skillId: SkillId
): SkillDefinition {
  const skill = catalog.skills.find((entry) => entry.skillId === skillId);
  if (skill === undefined) {
    throw new TypeError(`skillId missing from catalog: ${skillId}`);
  }
  return skill;
}

function dmg(skill: SkillDefinition, target: CombatantState): number {
  if (skill.effect.category !== "attack" && skill.effect.category !== "disrupt") {
    return 0;
  }
  const basePower = skill.effect.basePower;
  return Math.min(target.health, basePower - Math.min(target.defense, basePower));
}

function drain(skill: SkillDefinition, target: CombatantState): number {
  if (skill.effect.category !== "disrupt") {
    return 0;
  }
  return Math.min(skill.effect.energyDamage, target.energy);
}

function heal(skill: SkillDefinition, self: CombatantState): number {
  if (skill.effect.category !== "recovery") {
    return 0;
  }
  return Math.min(skill.effect.recoveryAmount, self.maxHealth - self.health);
}

function guard(skill: SkillDefinition, self: CombatantState): number {
  if (skill.effect.category !== "defense") {
    return 0;
  }
  return Math.min(skill.effect.defenseAmount, MAX_DEFENSE - self.defense);
}

function pickBest(
  candidates: SkillDefinition[],
  scoreOf: (skill: SkillDefinition) => number
): SkillDefinition | undefined {
  let best: SkillDefinition | undefined;
  let bestScore = -Infinity;

  for (const skill of candidates) {
    const score = scoreOf(skill);
    if (best === undefined) {
      best = skill;
      bestScore = score;
      continue;
    }
    if (score > bestScore) {
      best = skill;
      bestScore = score;
      continue;
    }
    if (score === bestScore) {
      if (skill.energyCost < best.energyCost) {
        best = skill;
        bestScore = score;
      }
      // else keep earlier config order (already in candidates order)
    }
  }

  return best;
}

/**
 * Deterministic greedy CPU selector for evals. Pure: no RNG, clock, or mutation.
 * `self` is the CPU combatant; `target` is the player (selector argument order).
 */
export function createGreedySelector(
  agent: AgentConfig,
  catalog: SkillCatalog = MVP_SKILL_CATALOG
): SelectCpuSkillId {
  return (self, target) => {
    const equipped = agent.skillIds.map((skillId) => requireSkill(catalog, skillId));
    const affordable = equipped.filter((skill) => skill.energyCost <= self.energy);

    if (affordable.length === 0) {
      return equipped[0]!.skillId;
    }

    const lethal = affordable.filter((skill) => dmg(skill, target) >= target.health);
    if (lethal.length > 0) {
      return pickBest(lethal, (skill) => dmg(skill, target))!.skillId;
    }

    const lowHealth = self.health <= Math.floor(self.maxHealth * LOW_HEALTH_RATIO);
    if (lowHealth) {
      const recoveries = affordable.filter((skill) => heal(skill, self) > 0);
      if (recoveries.length > 0) {
        return pickBest(recoveries, (skill) => heal(skill, self))!.skillId;
      }
    }

    const offenseBest = pickBest(affordable, (skill) => {
      return dmg(skill, target) + ENERGY_DRAIN_WEIGHT * drain(skill, target);
    });
    if (offenseBest !== undefined) {
      const offenseScore =
        dmg(offenseBest, target) + ENERGY_DRAIN_WEIGHT * drain(offenseBest, target);
      if (offenseScore > 0) {
        return offenseBest.skillId;
      }
    }

    const guards = affordable.filter((skill) => guard(skill, self) > 0);
    if (guards.length > 0) {
      return pickBest(guards, (skill) => guard(skill, self))!.skillId;
    }

    const heals = affordable.filter((skill) => heal(skill, self) > 0);
    if (heals.length > 0) {
      return pickBest(heals, (skill) => heal(skill, self))!.skillId;
    }

    return pickBest(affordable, () => 0)!.skillId;
  };
}
