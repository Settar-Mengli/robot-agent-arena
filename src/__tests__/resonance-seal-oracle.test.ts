import { describe, expect, it } from "vitest";
import {
  applySealAction,
  initialSealState,
  sealBestResponse,
  sealGreedyAction,
  sealLegalActions,
  sealRegret
} from "../env/resonance-seal";

describe("resonance-seal-oracle", () => {
  it("exact flag and non-empty best at start", () => {
    const s = initialSealState(1);
    const o = sealBestResponse(s);
    expect(o.exact).toBe(true);
    expect(o.best.length).toBeGreaterThan(0);
    for (const a of o.best) {
      expect(sealLegalActions(s).includes(a)).toBe(true);
    }
  });

  it("regret >= 0; optimal action has regret 0", () => {
    let s = initialSealState(1);
    for (let i = 0; i < 4; i += 1) {
      if (sealLegalActions(s).length === 0) break;
      const o = sealBestResponse(s);
      for (const a of sealLegalActions(s)) {
        const r = sealRegret(o.values, a);
        expect(r).toBeGreaterThanOrEqual(0);
      }
      for (const a of o.best) {
        expect(sealRegret(o.values, a)).toBe(0);
      }
      s = applySealAction(s, sealGreedyAction(s));
    }
  });

  it("deterministic across calls", () => {
    const s = applySealAction(initialSealState(42), "channel");
    expect(sealBestResponse(s)).toEqual(sealBestResponse(s));
  });
});
