import { describe, expect, it } from "vitest";
import {
  applySealAction,
  initialSealState,
  isSealTerminal,
  resonanceSealEnvironment,
  sealMemoStateKey,
  sealTerminalValue
} from "../env/resonance-seal";

describe("resonance-seal-dynamics", () => {
  it("start is deterministic for a seed", () => {
    expect(initialSealState(7)).toEqual(initialSealState(7));
    expect(resonanceSealEnvironment.start(7)).toEqual(initialSealState(7));
  });

  it("channel then vault pressure advances turn", () => {
    const s0 = initialSealState(1);
    const s1 = applySealAction(s0, "channel");
    expect(s1.energy).toBe(2);
    expect(s1.turn).toBe(2);
    expect(s1.pressure).toBe(0); // turn 1: no spike
  });

  it("vault spikes on turns where pre-action turn % 3 === 0", () => {
    let s = initialSealState(1);
    s = applySealAction(s, "channel"); // turn1 →2, +0
    s = applySealAction(s, "channel"); // turn2 →3, +0
    expect(s.pressure).toBe(0);
    s = applySealAction(s, "channel"); // turn3 →4, spike +2
    expect(s.pressure).toBe(2);
  });

  it("brace reduces next vault hit by 1", () => {
    let s = { ...initialSealState(1), energy: 2, turn: 3 };
    s = applySealAction(s, "brace");
    // turn 3 spike would be 2, braced → 1
    expect(s.pressure).toBe(1);
    expect(s.braced).toBe(false);
    expect(s.bracedLastTurn).toBe(true);
  });

  it("terminal values: win / loss / timeout", () => {
    expect(sealTerminalValue({ ...initialSealState(1), seal: 3, turn: 4 })).toBe(
      96
    );
    expect(
      sealTerminalValue({ ...initialSealState(1), pressure: 5, turn: 2 })
    ).toBe(-100);
    expect(
      sealTerminalValue({
        ...initialSealState(1),
        turn: 9,
        maxTurns: 8,
        seal: 2,
        pressure: 1
      })
    ).toBe(1);
  });

  it("memoStateKey stable", () => {
    const s = applySealAction(initialSealState(1), "channel");
    expect(sealMemoStateKey(s)).toBe(sealMemoStateKey({ ...s }));
  });

  it("isTerminal on win", () => {
    expect(isSealTerminal({ ...initialSealState(1), seal: 3 })).toBe(true);
  });
});
