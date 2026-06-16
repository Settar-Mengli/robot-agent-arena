import { describe, expect, it } from "vitest";
import {
  AGENT_MODULES,
  COMBATANT_MAX_ENERGY,
  COMBATANT_MAX_HEALTH,
  COMBATANT_STARTING_ENERGY,
  CPU_OPPONENT_COUNT,
  DEFAULT_MAX_TURNS,
  FALLBACK_ACTION_ID,
  FALLBACK_DEFENSE_GAIN,
  FALLBACK_ENERGY_RECOVERY,
  FICTIONAL_TERMS,
  MAX_DEFENSE,
  MAX_TURNS,
  MVP_SKILL_COUNT,
  MVP_SKILL_SLOT_LIMIT,
  TURN_ENERGY_RECOVERY
} from "../engine/constants";
import type {
  AgentConfig,
  BattleResult,
  BattleSession,
  CombatantState,
  PlayerAction,
  ResolvedAction,
  SkillDefinition
} from "../engine/types";

describe("engine constants", () => {
  it("defines locked MVP numeric constants", () => {
    expect(MAX_TURNS).toBe(20);
    expect(DEFAULT_MAX_TURNS).toBe(MAX_TURNS);
    expect(MVP_SKILL_COUNT).toBe(8);
    expect(MVP_SKILL_SLOT_LIMIT).toBe(2);
    expect(CPU_OPPONENT_COUNT).toBe(2);
  });

  it("defines locked combat constants", () => {
    expect(COMBATANT_MAX_HEALTH).toBe(30);
    expect(COMBATANT_MAX_ENERGY).toBe(10);
    expect(COMBATANT_STARTING_ENERGY).toBe(6);
    expect(TURN_ENERGY_RECOVERY).toBe(2);
    expect(MAX_DEFENSE).toBe(12);
    expect(FALLBACK_ACTION_ID).toBe("fallback-stabilize");
    expect(FALLBACK_ENERGY_RECOVERY).toBe(2);
    expect(FALLBACK_DEFENSE_GAIN).toBe(2);
  });

  it("defines the supported agent modules", () => {
    expect(AGENT_MODULES).toEqual([
      "coreIdentity",
      "memory",
      "sigilSecurity",
      "rules",
      "strategy"
    ]);
  });

  it("defines the approved fictional terminology list", () => {
    expect(FICTIONAL_TERMS).toEqual([
      "Signal Breach",
      "Null Pulse",
      "Override Pulse",
      "Core Identity",
      "Logic Storm",
      "Sigil Rule",
      "Signal Exposure",
      "Logic Drift"
    ]);
  });
});

describe("engine domain type contracts", () => {
  const sampleAgent: AgentConfig = {
    agentId: "agent-player-1",
    displayName: "PLAYER-UNIT",
    modules: {
      coreIdentity: "Steady Vanguard",
      memory: "Pattern Recall",
      sigilSecurity: "Aegis Layer",
      rules: "Never Skip Verification",
      strategy: "Measured Pressure"
    },
    skillIds: ["skill-core-identity", "skill-null-pulse"]
  };

  const sampleSkill: SkillDefinition = {
    skillId: "skill-logic-storm",
    displayName: "Logic Storm",
    module: "strategy",
    summary: "Applies coordinated strategic pressure for the current turn.",
    energyCost: 5,
    effect: {
      category: "attack",
      basePower: 9
    }
  };

  const samplePlayerState: CombatantState = {
    side: "player",
    agentId: "agent-player-1",
    displayName: "PLAYER-UNIT",
    health: 30,
    maxHealth: 30,
    energy: 6,
    maxEnergy: 10,
    defense: 0
  };

  const sampleCpuState: CombatantState = {
    side: "cpu",
    agentId: "agent-cpu-1",
    displayName: "SENTINEL-X",
    health: 30,
    maxHealth: 30,
    energy: 6,
    maxEnergy: 10,
    defense: 0
  };

  it("accepts minimal AgentConfig fixtures", () => {
    expect(sampleAgent.agentId).toBe("agent-player-1");
    expect(sampleAgent.modules.coreIdentity).toBe("Steady Vanguard");
    expect(sampleAgent.skillIds.length).toBe(2);
  });

  it("accepts combat-ready SkillDefinition fixtures", () => {
    expect(sampleSkill.module).toBe("strategy");
    expect(sampleSkill.effect.category).toBe("attack");
    expect(sampleSkill.energyCost).toBe(5);
  });

  it("accepts minimal BattleSession fixtures", () => {
    const session: BattleSession = {
      sessionId: "session-1",
      seed: "arena-seed-01",
      turn: 1,
      maxTurns: 20,
      status: "awaiting-player-action",
      player: sampleAgent,
      cpu: {
        ...sampleAgent,
        agentId: "agent-cpu-1",
        displayName: "SENTINEL-X"
      },
      lastPlayerAction: {
        type: "use-skill",
        skillId: "skill-core-identity"
      }
    };

    expect(session.status).toBe("awaiting-player-action");
    expect(session.player.agentId).toBe("agent-player-1");
    expect(session.cpu.displayName).toBe("SENTINEL-X");
  });

  it("accepts PlayerAction fixtures", () => {
    const action: PlayerAction = {
      type: "use-skill",
      skillId: "skill-null-pulse"
    };

    expect(action.type).toBe("use-skill");
    expect(action.skillId).toBe("skill-null-pulse");
  });

  it("handles PlayerAction with an exhaustive discriminant switch", () => {
    const actionLabel = (action: PlayerAction): string => {
      switch (action.type) {
        case "use-skill":
          return `use:${action.skillId}`;
      }
    };

    expect(actionLabel({ type: "use-skill", skillId: "skill-core-identity" })).toBe(
      "use:skill-core-identity"
    );
  });

  it("accepts minimal combat result fixtures", () => {
    const resolvedAction: ResolvedAction = {
      actor: "player",
      target: "cpu",
      selectedSkillId: "skill-logic-storm",
      resolvedSkillId: "skill-logic-storm",
      effectCategory: "attack",
      fallback: false,
      energySpent: 5,
      damageDealt: 9,
      defenseReduced: 0,
      defenseGained: 0,
      healthRecovered: 0,
      energyRecovered: 0,
      energyReduced: 0
    };

    const finalSession: BattleSession = {
      sessionId: "session-1",
      seed: "arena-seed-01",
      turn: 1,
      maxTurns: 1,
      status: "completed",
      player: sampleAgent,
      cpu: {
        ...sampleAgent,
        agentId: "agent-cpu-1",
        displayName: "SENTINEL-X"
      },
      lastPlayerAction: {
        type: "use-skill",
        skillId: "skill-logic-storm"
      }
    };

    const result: BattleResult = {
      finalSession,
      finalPlayer: samplePlayerState,
      finalCpu: {
        ...sampleCpuState,
        health: 21
      },
      turns: [
        {
          turn: 1,
          startedPlayer: samplePlayerState,
          startedCpu: sampleCpuState,
          actions: [resolvedAction],
          endedPlayer: samplePlayerState,
          endedCpu: {
            ...sampleCpuState,
            health: 21
          },
          outcome: {
            result: "player-victory",
            reason: "cpu-health-zero",
            winnerSide: "player",
            winnerAgentId: "agent-player-1"
          }
        }
      ],
      outcome: {
        result: "player-victory",
        reason: "cpu-health-zero",
        winnerSide: "player",
        winnerAgentId: "agent-player-1"
      },
      seed: "arena-seed-01",
      totalTurns: 1
    };

    expect(result.turns[0].actions[0].resolvedSkillId).toBe("skill-logic-storm");
    expect(result.finalSession.status).toBe("completed");
  });
});
