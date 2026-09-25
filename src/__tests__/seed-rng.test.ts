import { describe, expect, it } from "vitest";
import { createEnvRng } from "../env/seed-rng";

describe("createEnvRng nextInt", () => {
  it("throws when span is not positive", () => {
    const rng = createEnvRng(1);
    expect(() => rng.nextInt(0, 0)).toThrow(RangeError);
    expect(() => rng.nextInt(5, 5)).toThrow(RangeError);
    expect(() => rng.nextInt(3, 1)).toThrow(RangeError);
  });

  it("returns values in [min, max) for positive span", () => {
    const rng = createEnvRng(42);
    for (let i = 0; i < 20; i += 1) {
      const v = rng.nextInt(0, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }
  });
});
