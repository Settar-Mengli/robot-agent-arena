import {
  MVP_SKILL_CATALOG,
  type AgentConfig,
  type CombatantState,
  type SelectCpuSkillId,
  type SkillCatalog,
  type SkillDefinition,
  type SkillId
} from "../../engine";
import { projectSkillEffects } from "../grounding";

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

function dmg(
  skill: SkillDefinition,
  self: CombatantState,
  target: CombatantState
): number {
  return projectSkillEffects(skill, self, target).damageAfterDefense;
}

function drain(
  skill: SkillDefinition,
  self: CombatantState,
  target: CombatantState
): number {
  return projectSkillEffects(skill, self, target).energyDrained;
}

function heal(skill: SkillDefinition, self: CombatantState): number {
  return projectSkillEffects(skill, self, self).healAmount;
}

function guard(skill: SkillDefinition, self: CombatantState): number {
  return projectSkillEffects(skill, self, self).defenseGained;
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
 * Combat arithmetic is projected via grounding (proven choice-identical on committed suites).
 */
export function createGreedySelector(
  agent: AgentConfig,
  catalog: SkillCatalog = MVP_SKILL_CATALOG
): SelectCpuSkillId {
  return (self, target) => {
    const equipped = agent.skillIds.map((skillId) => requireSkill(catalog, skillId));
    const isEvaluable = (skill: SkillDefinition): boolean =>
      projectSkillEffects(skill, self, target).unmodelledCategory === undefined;

    const affordable = equipped.filter((skill) => skill.energyCost <= self.energy);
    const evaluableAffordable = affordable.filter(isEvaluable);

    if (evaluableAffordable.length === 0) {
      // Empty energy or only unmodelled options — last-resort without throwing.
      return (affordable[0] ?? equipped[0]!).skillId;
    }

    const lethal = evaluableAffordable.filter(
      (skill) => dmg(skill, self, target) >= target.health
    );
    if (lethal.length > 0) {
      return pickBest(lethal, (skill) => dmg(skill, self, target))!.skillId;
    }

    const lowHealth = self.health <= Math.floor(self.maxHealth * LOW_HEALTH_RATIO);
    if (lowHealth) {
      const recoveries = evaluableAffordable.filter((skill) => heal(skill, self) > 0);
      if (recoveries.length > 0) {
        return pickBest(recoveries, (skill) => heal(skill, self))!.skillId;
      }
    }

    const offenseBest = pickBest(evaluableAffordable, (skill) => {
      return (
        dmg(skill, self, target) +
        ENERGY_DRAIN_WEIGHT * drain(skill, self, target)
      );
    });
    if (offenseBest !== undefined) {
      const offenseScore =
        dmg(offenseBest, self, target) +
        ENERGY_DRAIN_WEIGHT * drain(offenseBest, self, target);
      if (offenseScore > 0) {
        return offenseBest.skillId;
      }
    }

    const guards = evaluableAffordable.filter((skill) => guard(skill, self) > 0);
    if (guards.length > 0) {
      return pickBest(guards, (skill) => guard(skill, self))!.skillId;
    }

    const heals = evaluableAffordable.filter((skill) => heal(skill, self) > 0);
    if (heals.length > 0) {
      return pickBest(heals, (skill) => heal(skill, self))!.skillId;
    }

    return pickBest(evaluableAffordable, () => 0)!.skillId;
  };
}
