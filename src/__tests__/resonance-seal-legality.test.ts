import { describe, expect, it } from "vitest";
import {
  applySealAction,
  initialSealState,
  isSealActionLegal,
  isSealTerminal,
  sealLegalActions,
  type SealActionId,
  type SealState
} from "../env/resonance-seal";

function stateOf(state: Partial<SealState>): SealState {
  return { ...initialSealState(1), ...state };
}

describe("resonance-seal-legality", () => {
  it("channel is always legal when not terminal", () => {
    expect(isSealActionLegal(stateOf({ energy: 0 }), "channel")).toBe(true);
    expect(
      isSealActionLegal(stateOf({ energy: 5, pressure: 4 }), "channel")
    ).toBe(true);
  });

  it("inscribe requires energy >= 2", () => {
    expect(isSealActionLegal(stateOf({ energy: 1 }), "inscribe")).toBe(false);
    expect(isSealActionLegal(stateOf({ energy: 2 }), "inscribe")).toBe(true);
  });

  it("vent requires energy >= 1 and pressure >= 1", () => {
    expect(isSealActionLegal(stateOf({ energy: 1, pressure: 0 }), "vent")).toBe(
      false
    );
    expect(isSealActionLegal(stateOf({ energy: 0, pressure: 2 }), "vent")).toBe(
      false
    );
    expect(isSealActionLegal(stateOf({ energy: 1, pressure: 1 }), "vent")).toBe(
      true
    );
  });

  it("brace requires energy >= 1 and !bracedLastTurn", () => {
    expect(isSealActionLegal(stateOf({ energy: 0 }), "brace")).toBe(false);
    expect(
      isSealActionLegal(stateOf({ energy: 1, bracedLastTurn: true }), "brace")
    ).toBe(false);
    expect(
      isSealActionLegal(stateOf({ energy: 1, bracedLastTurn: false }), "brace")
    ).toBe(true);
  });

  it("no action legal when terminal", () => {
    const win = stateOf({ seal: 3 });
    expect(isSealTerminal(win)).toBe(true);
    expect(sealLegalActions(win)).toEqual([]);
  });

  it("brace cannot be used on consecutive turns after apply", () => {
    let s = stateOf({ energy: 2 });
    s = applySealAction(s, "brace");
    expect(s.bracedLastTurn).toBe(true);
    expect(isSealActionLegal(s, "brace")).toBe(false);
    const legal: SealActionId[] = sealLegalActions(s);
    expect(legal.includes("brace")).toBe(false);
  });
});
