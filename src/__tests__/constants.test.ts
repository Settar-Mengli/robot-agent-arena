import { describe, expect, it } from "vitest";
import {
  CPU_OPPONENT_COUNT,
  DEFAULT_MAX_TURNS,
  FICTIONAL_TERMS,
  MAX_TURNS,
  MVP_SKILL_COUNT
} from "../engine/constants";
import type {
  AgentConfig,
  BattleSession,
  PlayerAction,
  SkillDefinition
} from "../engine/types";

describe("engine constants", () => {
  it("defines locked MVP numeric constants", () => {
    expect(MAX_TURNS).toBe(20);
    expect(DEFAULT_MAX_TURNS).toBe(MAX_TURNS);
    expect(MVP_SKILL_COUNT).toBe(8);
    expect(CPU_OPPONENT_COUNT).toBe(2);
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
    skillIds: ["skill-signal-burst", "skill-shield-matrix"]
  };

  const sampleSkill: SkillDefinition = {
    skillId: "skill-signal-burst",
    displayName: "Signal Burst",
    module: "strategy",
    summary: "Applies focused pressure for one turn."
  };

  it("accepts minimal AgentConfig fixtures", () => {
    expect(sampleAgent.agentId).toBe("agent-player-1");
    expect(sampleAgent.modules.coreIdentity).toBe("Steady Vanguard");
    expect(sampleAgent.skillIds.length).toBe(2);
  });

  it("accepts minimal SkillDefinition fixtures", () => {
    expect(sampleSkill.module).toBe("strategy");
    expect(sampleSkill.skillId).toBe("skill-signal-burst");
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
        skillId: "skill-signal-burst"
      }
    };

    expect(session.status).toBe("awaiting-player-action");
    expect(session.player.agentId).toBe("agent-player-1");
    expect(session.cpu.displayName).toBe("SENTINEL-X");
  });

  it("accepts PlayerAction fixtures", () => {
    const action: PlayerAction = {
      type: "use-skill",
      skillId: "skill-shield-matrix"
    };

    expect(action.type).toBe("use-skill");
    expect(action.skillId).toBe("skill-shield-matrix");
  });

  it("handles PlayerAction with an exhaustive discriminant switch", () => {
    const actionLabel = (action: PlayerAction): string => {
      switch (action.type) {
        case "use-skill":
          return `use:${action.skillId}`;
      }
    };

    expect(actionLabel({ type: "use-skill", skillId: "skill-signal-burst" })).toBe(
      "use:skill-signal-burst"
    );
  });
});
