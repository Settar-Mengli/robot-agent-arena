import { describe, expect, it } from "vitest";
import { FRACTURE } from "../data/opponents";
import type { BattleRuntime, SkillId } from "../engine";
import {
  asEnvironmentOf,
  robotEnvironment,
  robotEnvironmentOf,
  type EnvironmentOf
} from "../env";
import { STRIKER } from "../eval/scenarios";

describe("envof-robot-assignability", () => {
  it("asEnvironmentOf(robotEnvironment) is EnvironmentOf<BattleRuntime, SkillId>", () => {
    const adapted: EnvironmentOf<BattleRuntime, SkillId> =
      asEnvironmentOf(robotEnvironment);
    const proof: EnvironmentOf<BattleRuntime, SkillId> = robotEnvironmentOf;
    expect(typeof adapted.memoStateKey).toBe("function");
    expect(typeof proof.legalActions).toBe("function");
    expect(typeof adapted.decisionStateKey).toBe("function");
  });

  it("adapter legalActions match robot cpu legalActions on a started battle", () => {
    const runtime = robotEnvironment.start(STRIKER, FRACTURE, "envof-1", 8);
    expect(robotEnvironmentOf.legalActions(runtime)).toEqual(
      robotEnvironment.legalActions(runtime, "cpu")
    );
    expect([...robotEnvironmentOf.equippedActions(runtime)]).toEqual([
      ...robotEnvironment.equippedActions(runtime, "cpu")
    ]);
  });
});
