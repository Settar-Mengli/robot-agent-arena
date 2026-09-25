import { describe, expect, it } from "vitest";
import { FRACTURE } from "../data/opponents";
import { robotEnvironment } from "../env";
import { startBattle } from "../engine";
import { STRIKER } from "../eval/scenarios";

describe("robotEnvironment.terminalValue", () => {
  it("is HP differential only while battle is not over", () => {
    const runtime = startBattle(STRIKER, FRACTURE, "tv-mid", 10);
    expect(robotEnvironment.isTerminal(runtime)).toBe(false);
    const expected = runtime.cpu.health - runtime.player.health;
    const value = robotEnvironment.terminalValue(runtime);
    expect(value).toBe(expected);
    expect(Math.abs(value)).toBeLessThan(1000);
  });
});
