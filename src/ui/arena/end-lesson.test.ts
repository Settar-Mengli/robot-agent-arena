import { describe, expect, it } from "vitest";
import type { BattleOutcome, CombatantState, TurnRecord } from "../../engine";
import { END_LESSON_STRINGS, endLesson } from "./end-lesson";
import { narrateAction } from "./turn-narration";
import { assertNoForbiddenTechnicalText } from "../copy/forbidden-default-path";

const player: CombatantState = {
  side: "player",
  agentId: "p",
  displayName: "AEGIS",
  health: 10,
  maxHealth: 30,
  energy: 4,
  maxEnergy: 10,
  defense: 0
};

const cpu: CombatantState = {
  side: "cpu",
  agentId: "c",
  displayName: "FRACTURE",
  health: 20,
  maxHealth: 30,
  energy: 4,
  maxEnergy: 10,
  defense: 0
};

function outcome(
  result: BattleOutcome["result"],
  winnerSide?: BattleOutcome["winnerSide"]
): BattleOutcome {
  const reason =
    result === "draw"
      ? "turn-limit"
      : result === "player-victory"
        ? "cpu-health-zero"
        : "player-health-zero";
  return {
    result,
    reason,
    ...(winnerSide !== undefined ? { winnerSide, winnerAgentId: "x" } : {})
  };
}

function turn(fallback: boolean): TurnRecord {
  return {
    turn: 1,
    startedPlayer: player,
    startedCpu: cpu,
    actions: [
      {
        actor: "player",
        target: "cpu",
        selectedSkillId: "skill-logic-storm",
        resolvedSkillId: fallback ? "fallback-stabilize" : "skill-logic-storm",
        effectCategory: fallback ? "fallback" : "attack",
        fallback,
        energySpent: 5,
        damageDealt: fallback ? 0 : 7,
        defenseReduced: 0,
        defenseGained: 0,
        healthRecovered: 0,
        energyRecovered: 0,
        energyReduced: 0
      }
    ],
    endedPlayer: player,
    endedCpu: cpu
  };
}

describe("endLesson", () => {
  it("endLesson: fallback branch", () => {
    expect(
      endLesson({
        outcome: outcome("player-victory", "player"),
        turns: [turn(true)],
        finalPlayer: { ...player, health: 30 }
      })
    ).toBe(END_LESSON_STRINGS[0]);
  });

  it("endLesson: player lost branch", () => {
    expect(
      endLesson({
        outcome: outcome("cpu-victory", "cpu"),
        turns: [turn(false)],
        finalPlayer: player
      })
    ).toBe(END_LESSON_STRINGS[1]);
  });

  it("endLesson: close win HP under 40% branch", () => {
    expect(
      endLesson({
        outcome: outcome("player-victory", "player"),
        turns: [turn(false)],
        finalPlayer: { ...player, health: 10, maxHealth: 30 }
      })
    ).toBe(END_LESSON_STRINGS[2]);
  });

  it("endLesson: clean win branch", () => {
    expect(
      endLesson({
        outcome: outcome("player-victory", "player"),
        turns: [turn(false)],
        finalPlayer: { ...player, health: 25, maxHealth: 30 }
      })
    ).toBe(END_LESSON_STRINGS[3]);
  });

  it("endLesson: draw branch", () => {
    expect(
      endLesson({
        outcome: outcome("draw"),
        turns: [turn(false)],
        finalPlayer: player
      })
    ).toBe(END_LESSON_STRINGS[4]);
  });

  it("endLesson strings pass forbidden-default-path", () => {
    for (const s of END_LESSON_STRINGS) {
      expect(() => assertNoForbiddenTechnicalText(s)).not.toThrow();
    }
  });
});

describe("turnNarration", () => {
  it("turnNarration maps damageDealt and defenseGained", () => {
    const dmg = narrateAction(
      {
        actor: "player",
        target: "cpu",
        selectedSkillId: "skill-logic-storm",
        resolvedSkillId: "skill-logic-storm",
        effectCategory: "attack",
        fallback: false,
        energySpent: 5,
        damageDealt: 7,
        defenseReduced: 0,
        defenseGained: 0,
        healthRecovered: 0,
        energyRecovered: 0,
        energyReduced: 0
      },
      "AEGIS",
      "FRACTURE"
    );
    expect(dmg).toMatch(/dealt 7 damage/);

    const def = narrateAction(
      {
        actor: "player",
        target: "player",
        selectedSkillId: "skill-null-pulse",
        resolvedSkillId: "skill-null-pulse",
        effectCategory: "defense",
        fallback: false,
        energySpent: 2,
        damageDealt: 0,
        defenseReduced: 0,
        defenseGained: 5,
        healthRecovered: 0,
        energyRecovered: 0,
        energyReduced: 0
      },
      "AEGIS",
      "FRACTURE"
    );
    expect(def).toMatch(/gained 5 defense/);
  });
});
