import { describe, expect, it } from "vitest";
import {
  bootstrapMeanCi,
  insufficientEvidence,
  wilsonInterval
} from "../decision-lab/stats";

describe("decision-lab stats", () => {
  it("Wilson CI matches known values", () => {
    const w = wilsonInterval(50, 100);
    expect(w.low).toBeCloseTo(0.4038, 3);
    expect(w.high).toBeCloseTo(0.5962, 3);
  });

  it("Wilson bounds stay in [0, 1] on edge counts", () => {
    for (const [s, n] of [
      [5, 5],
      [0, 30],
      [30, 30],
      [0, 0]
    ] as const) {
      const w = wilsonInterval(s, n);
      expect(Number.isFinite(w.low)).toBe(true);
      expect(Number.isFinite(w.high)).toBe(true);
      expect(w.low).toBeGreaterThanOrEqual(0);
      expect(w.high).toBeLessThanOrEqual(1);
      expect(w.low).toBeLessThanOrEqual(w.high);
    }
  });

  it("insufficientEvidence when n < 30", () => {
    expect(
      insufficientEvidence({ n: 13, wilson: wilsonInterval(2, 13) })
    ).toBe(true);
  });

  it("insufficientEvidence when Wilson width >= 0.40 even if n large", () => {
    const wilson = { low: 0.1, high: 0.55 };
    expect(insufficientEvidence({ n: 40, wilson })).toBe(true);
  });

  it("bootstrapMeanCi is deterministic for the same seed", () => {
    const values = [1, 2, 3, 4, 5, 100, 2, 2, 2, 2, 2, 2, 5];
    const a = bootstrapMeanCi(values, { seed: 0xa11ce, B: 2000 });
    const b = bootstrapMeanCi(values, { seed: 0xa11ce, B: 2000 });
    expect(a).toEqual(b);
    expect(a.mean).toBeCloseTo(values.reduce((s, v) => s + v, 0) / values.length, 10);
    expect(a.low).toBeLessThanOrEqual(a.mean);
    expect(a.high).toBeGreaterThanOrEqual(a.mean);
  });
});
