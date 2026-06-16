import {
  COMBATANT_MAX_ENERGY,
  COMBATANT_MAX_HEALTH,
  COMBATANT_STARTING_ENERGY,
  FALLBACK_ACTION_ID,
  FALLBACK_DEFENSE_GAIN,
  FALLBACK_ENERGY_RECOVERY,
  MAX_DEFENSE,
  TURN_ENERGY_RECOVERY
} from "./constants";
import { MVP_SKILL_CATALOG } from "./skills";
import type {
  AgentConfig,
  BattleAction,
  CombatantSide,
  CombatantState,
  ResolvedAction,
  SkillCatalog,
  SkillDefinition
} from "./types";
import { validateAgentSkillIdInput, validateSkillCatalogInput } from "./validation";

export function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampHealth(value: number, combatant: CombatantState): number {
  return clampValue(value, 0, combatant.maxHealth);
}

function clampEnergy(value: number, combatant: CombatantState): number {
  return clampValue(value, 0, combatant.maxEnergy);
}

function clampDefense(value: number): number {
  return clampValue(value, 0, MAX_DEFENSE);
}

export function createInitialCombatantState(
  agent: AgentConfig,
  side: CombatantSide
): CombatantState {
  return {
    side,
    agentId: agent.agentId,
    displayName: agent.displayName,
    health: COMBATANT_MAX_HEALTH,
    maxHealth: COMBATANT_MAX_HEALTH,
    energy: COMBATANT_STARTING_ENERGY,
    maxEnergy: COMBATANT_MAX_ENERGY,
    defense: 0
  };
}

export function findSkillDefinition(
  catalog: SkillCatalog,
  skillId: string
): SkillDefinition | undefined {
  return catalog.skills.find((skill) => skill.skillId === skillId);
}

function requireSkillDefinition(catalog: SkillCatalog, skillId: string): SkillDefinition {
  const skill = findSkillDefinition(catalog, skillId);
  if (skill === undefined) {
    throw new TypeError(`skillId must reference a known skill ID: ${skillId}.`);
  }

  return skill;
}

function applyDamage(
  target: CombatantState,
  basePower: number
): {
  target: CombatantState;
  damageDealt: number;
  defenseReduced: number;
} {
  const defenseReduced = Math.min(target.defense, basePower);
  const damageDealt = Math.min(target.health, basePower - defenseReduced);

  return {
    target: {
      ...target,
      defense: clampDefense(target.defense - defenseReduced),
      health: clampHealth(target.health - damageDealt, target)
    },
    damageDealt,
    defenseReduced
  };
}

function createResolvedAction(
  action: BattleAction,
  target: CombatantState,
  overrides: Partial<ResolvedAction>
): ResolvedAction {
  return {
    actor: action.actor,
    target: target.side,
    selectedSkillId: action.skillId,
    resolvedSkillId: action.skillId,
    effectCategory: "attack",
    fallback: false,
    energySpent: 0,
    damageDealt: 0,
    defenseReduced: 0,
    defenseGained: 0,
    healthRecovered: 0,
    energyRecovered: 0,
    energyReduced: 0,
    ...overrides
  };
}

function resolveFallback(
  actor: CombatantState,
  target: CombatantState,
  action: BattleAction
): {
  actor: CombatantState;
  target: CombatantState;
  resolvedAction: ResolvedAction;
} {
  const nextEnergy = clampEnergy(actor.energy + FALLBACK_ENERGY_RECOVERY, actor);
  const nextDefense = clampDefense(actor.defense + FALLBACK_DEFENSE_GAIN);

  const nextActor = {
    ...actor,
    energy: nextEnergy,
    defense: nextDefense
  };

  return {
    actor: nextActor,
    target,
    resolvedAction: createResolvedAction(action, target, {
      resolvedSkillId: FALLBACK_ACTION_ID,
      effectCategory: "fallback",
      fallback: true,
      energyRecovered: nextEnergy - actor.energy,
      defenseGained: nextDefense - actor.defense
    })
  };
}

export function resolveAction(
  actor: CombatantState,
  target: CombatantState,
  action: BattleAction,
  actorConfig: AgentConfig,
  catalog: SkillCatalog = MVP_SKILL_CATALOG
): {
  actor: CombatantState;
  target: CombatantState;
  resolvedAction: ResolvedAction;
} {
  validateSkillCatalogInput(catalog);

  if (action.actor !== actor.side) {
    throw new TypeError("battleAction.actor must match the acting combatant side.");
  }

  if (actor.agentId !== actorConfig.agentId) {
    throw new TypeError("actorConfig.agentId must match the acting combatant.");
  }

  validateAgentSkillIdInput(actorConfig, action.skillId, "battleAction.skillId");

  const skill = requireSkillDefinition(catalog, action.skillId);
  if (actor.energy < skill.energyCost) {
    return resolveFallback(actor, target, action);
  }

  let nextActor: CombatantState = {
    ...actor,
    energy: clampEnergy(actor.energy - skill.energyCost, actor)
  };
  let nextTarget = target;
  let damageDealt = 0;
  let defenseReduced = 0;
  let defenseGained = 0;
  let healthRecovered = 0;
  let energyReduced = 0;

  switch (skill.effect.category) {
    case "attack": {
      const damageResult = applyDamage(nextTarget, skill.effect.basePower);
      nextTarget = damageResult.target;
      damageDealt = damageResult.damageDealt;
      defenseReduced = damageResult.defenseReduced;
      break;
    }
    case "defense": {
      const nextDefense = clampDefense(nextActor.defense + skill.effect.defenseAmount);
      defenseGained = nextDefense - nextActor.defense;
      nextActor = {
        ...nextActor,
        defense: nextDefense
      };
      break;
    }
    case "recovery": {
      const nextHealth = clampHealth(nextActor.health + skill.effect.recoveryAmount, nextActor);
      healthRecovered = nextHealth - nextActor.health;
      nextActor = {
        ...nextActor,
        health: nextHealth
      };
      break;
    }
    case "disrupt": {
      const damageResult = applyDamage(nextTarget, skill.effect.basePower);
      const nextEnergy = clampEnergy(damageResult.target.energy - skill.effect.energyDamage, target);
      nextTarget = {
        ...damageResult.target,
        energy: nextEnergy
      };
      damageDealt = damageResult.damageDealt;
      defenseReduced = damageResult.defenseReduced;
      energyReduced = damageResult.target.energy - nextEnergy;
      break;
    }
  }

  return {
    actor: nextActor,
    target: nextTarget,
    resolvedAction: createResolvedAction(action, target, {
      effectCategory: skill.effect.category,
      energySpent: actor.energy - nextActor.energy,
      damageDealt,
      defenseReduced,
      defenseGained,
      healthRecovered,
      energyReduced
    })
  };
}

export function applyTurnEnergyRecovery(combatant: CombatantState): CombatantState {
  return {
    ...combatant,
    energy: clampEnergy(combatant.energy + TURN_ENERGY_RECOVERY, combatant)
  };
}
