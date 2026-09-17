import { describe, expect, it } from "vitest";
import { createSeededRng, createSeededRngFromState } from "../engine/rng";

describe("createSeededRngFromState", () => {
  it("resumes the same float sequence and matching snapshots after a mid-stream snapshot", () => {
    const seed = "rng-resume-a";
    const k = 5;
    const m = 7;

    const original = createSeededRng(seed);
    for (let i = 0; i < k; i += 1) {
      original.nextFloat();
    }

    const midSnapshot = original.snapshot();
    const seqA = Array.from({ length: m }, () => original.nextFloat());
    const afterA = original.snapshot();

    const restored = createSeededRngFromState(midSnapshot);
    const seqB = Array.from({ length: m }, () => restored.nextFloat());
    const afterB = restored.snapshot();

    expect(seqA).toEqual(seqB);
    expect(afterA).toEqual(afterB);
  });

  it("matches a fresh createSeededRng when restored from a calls=0 snapshot", () => {
    const seed = "rng-resume-b";
    const fresh = createSeededRng(seed);
    const fromSnapshot = createSeededRngFromState(createSeededRng(seed).snapshot());

    expect(fromSnapshot.snapshot().calls).toBe(0);

    const seqFresh = Array.from({ length: 20 }, () => fresh.nextFloat());
    const seqRestored = Array.from({ length: 20 }, () => fromSnapshot.nextFloat());

    expect(seqRestored).toEqual(seqFresh);
    expect(fromSnapshot.snapshot()).toEqual(fresh.snapshot());
  });
});
