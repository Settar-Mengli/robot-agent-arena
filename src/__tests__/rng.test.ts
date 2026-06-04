import { describe, expect, it } from "vitest";
import { createSeededRng } from "../engine/rng";

describe("createSeededRng", () => {
  it("produces deterministic float sequences for the same seed", () => {
    const rngA = createSeededRng("arena-seed-1");
    const rngB = createSeededRng("arena-seed-1");

    const seqA = [rngA.nextFloat(), rngA.nextFloat(), rngA.nextFloat()];
    const seqB = [rngB.nextFloat(), rngB.nextFloat(), rngB.nextFloat()];

    expect(seqA).toEqual(seqB);
  });

  it("keeps nextFloat values within [0, 1)", () => {
    const rng = createSeededRng(42);

    for (let i = 0; i < 50; i += 1) {
      const value = rng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("produces bounded integers with nextInt", () => {
    const rng = createSeededRng("bounded-seed");

    for (let i = 0; i < 50; i += 1) {
      const value = rng.nextInt(7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it("throws when nextInt receives a non-positive or non-integer bound", () => {
    const rng = createSeededRng(99);

    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-2)).toThrow(RangeError);
    expect(() => rng.nextInt(2.5)).toThrow(RangeError);
  });

  it("tracks internal state snapshots", () => {
    const rng = createSeededRng("snapshot-seed");

    const before = rng.snapshot();
    rng.nextFloat();
    rng.nextInt(10);
    const after = rng.snapshot();

    expect(before.calls).toBe(0);
    expect(after.calls).toBe(2);
    expect(after.seed).toBe("snapshot-seed");
    expect(after.state).not.toBe(before.state);
  });
});
