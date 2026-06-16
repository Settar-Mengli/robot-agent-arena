import { describe, expect, it } from "vitest";
import {
  COMBATANT_MAX_ENERGY,
  COMBATANT_MAX_HEALTH,
  COMBATANT_STARTING_ENERGY,
  FALLBACK_ACTION_ID,
  MAX_DEFENSE,
  createInitialCombatantState,
  applyTurnEnergyRecovery,
  resolveAction
} from "../engine";
import type { AgentConfig, BattleAction, CombatantState, SkillId } from "../engine";

const baseModules = {
  coreIdentity: "Steady Vanguard",
  memory: "Pattern Recall",
  sigilSecurity: "Aegis Layer",
  rules: "Never Skip Verification",
  strategy: "Measured Pressure"
};

function agentWithSkills(agentId: string, skillIds: SkillId[]): AgentConfig {
  return {
    agentId,
    displayName: agentId.toUpperCase(),
    modules: baseModules,
    skillIds
  };
}

const playerConfig = agentWithSkills("agent-player-1", [
  "skill-core-identity",
  "skill-null-pulse"
]);

const cpuConfig = agentWithSkills("agent-cpu-1", [
  "skill-sigil-rule",
  "skill-logic-storm"
]);

function action(skillId: SkillId, actor: "player" | "cpu" = "player"): BattleAction {
  return {
    actor,
    skillId
  };
}

function playerState(overrides: Partial<CombatantState> = {}): CombatantState {
  return {
    ...createInitialCombatantState(playerConfig, "player"),
    ...overrides
  };
}

function cpuState(overrides: Partial<CombatantState> = {}): CombatantState {
  return {
    ...createInitialCombatantState(cpuConfig, "cpu"),
    ...overrides
  };
}

describe("combat state", () => {
  it("creates initial combatant health and energy", () => {
    const combatant = createInitialCombatantState(playerConfig, "player");

    expect(combatant.health).toBe(COMBATANT_MAX_HEALTH);
    expect(combatant.maxHealth).toBe(COMBATANT_MAX_HEALTH);
    expect(combatant.energy).toBe(COMBATANT_STARTING_ENERGY);
    expect(combatant.maxEnergy).toBe(COMBATANT_MAX_ENERGY);
    expect(combatant.defense).toBe(0);
  });

  it("returns immutable combatant transitions", () => {
    const actor = playerState();
    const target = cpuState();
    const result = resolveAction(
      actor,
      target,
      action("skill-core-identity"),
      agentWithSkills("agent-player-1", ["skill-core-identity"])
    );

    expect(result.actor).not.toBe(actor);
    expect(result.target).toBe(target);
    expect(actor.defense).toBe(0);
    expect(result.actor.defense).toBe(3);
  });

  it("clamps health, energy, and defense", () => {
    const actor = playerState({
      defense: 11,
      energy: 9
    });
    const defended = resolveAction(
      actor,
      cpuState(),
      action("skill-core-identity"),
      agentWithSkills("agent-player-1", ["skill-core-identity"])
    );
    const damaged = resolveAction(
      playerState(),
      cpuState({ health: 3 }),
      action("skill-logic-storm"),
      agentWithSkills("agent-player-1", ["skill-logic-storm"])
    );
    const recovered = applyTurnEnergyRecovery(playerState({ energy: 9 }));

    expect(defended.actor.defense).toBe(MAX_DEFENSE);
    expect(damaged.target.health).toBe(0);
    expect(recovered.energy).toBe(COMBATANT_MAX_ENERGY);
  });
});

describe("skill resolution", () => {
  it("applies attack damage and energy cost", () => {
    const result = resolveAction(
      playerState(),
      cpuState(),
      action("skill-override-pulse"),
      agentWithSkills("agent-player-1", ["skill-override-pulse"])
    );

    expect(result.actor.energy).toBe(2);
    expect(result.target.health).toBe(23);
    expect(result.resolvedAction.damageDealt).toBe(7);
    expect(result.resolvedAction.energySpent).toBe(4);
  });

  it("applies defense mitigation before health damage", () => {
    const result = resolveAction(
      playerState(),
      cpuState({ defense: 5 }),
      action("skill-logic-storm"),
      agentWithSkills("agent-player-1", ["skill-logic-storm"])
    );

    expect(result.target.defense).toBe(0);
    expect(result.target.health).toBe(26);
    expect(result.resolvedAction.defenseReduced).toBe(5);
    expect(result.resolvedAction.damageDealt).toBe(4);
  });

  it("applies recovery behavior", () => {
    const result = resolveAction(
      playerState({ health: 20 }),
      cpuState(),
      action("skill-logic-drift"),
      agentWithSkills("agent-player-1", ["skill-logic-drift"])
    );

    expect(result.actor.health).toBe(25);
    expect(result.resolvedAction.healthRecovered).toBe(5);
  });

  it("applies disruption damage and energy reduction", () => {
    const result = resolveAction(
      playerState(),
      cpuState(),
      action("skill-signal-breach"),
      agentWithSkills("agent-player-1", ["skill-signal-breach"])
    );

    expect(result.target.health).toBe(26);
    expect(result.target.energy).toBe(4);
    expect(result.resolvedAction.energyReduced).toBe(2);
  });

  it("uses deterministic fallback for insufficient energy", () => {
    const result = resolveAction(
      playerState({ energy: 0 }),
      cpuState(),
      action("skill-logic-storm"),
      agentWithSkills("agent-player-1", ["skill-logic-storm"])
    );

    expect(result.actor.energy).toBe(2);
    expect(result.actor.defense).toBe(2);
    expect(result.target).toEqual(cpuState());
    expect(result.resolvedAction.resolvedSkillId).toBe(FALLBACK_ACTION_ID);
    expect(result.resolvedAction.fallback).toBe(true);
  });

  it("rejects invalid or unloaded skills", () => {
    expect(() =>
      resolveAction(
        playerState(),
        cpuState(),
        action("skill-logic-storm"),
        agentWithSkills("agent-player-1", ["skill-core-identity"])
      )
    ).toThrow(TypeError);
  });

  it.each([
    ["skill-core-identity", "defense", { defenseGained: 3 }],
    ["skill-signal-exposure", "disrupt", { damageDealt: 2, energyReduced: 2 }],
    ["skill-logic-drift", "recovery", { healthRecovered: 5 }],
    ["skill-null-pulse", "defense", { defenseGained: 5 }],
    ["skill-signal-breach", "disrupt", { damageDealt: 4, energyReduced: 2 }],
    ["skill-sigil-rule", "defense", { defenseGained: 2 }],
    ["skill-override-pulse", "attack", { damageDealt: 7 }],
    ["skill-logic-storm", "attack", { damageDealt: 9 }]
  ] as const)("resolves %s as %s", (skillId, category, expected) => {
    const result = resolveAction(
      playerState({ health: 20 }),
      cpuState(),
      action(skillId),
      agentWithSkills("agent-player-1", [skillId])
    );

    expect(result.resolvedAction.effectCategory).toBe(category);
    expect(result.resolvedAction).toMatchObject(expected);
  });
});
