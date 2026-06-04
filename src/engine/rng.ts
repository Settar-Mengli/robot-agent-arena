import type { Seed, SeededRng } from "./types";

const UINT32_MAX_PLUS_ONE = 0x1_0000_0000;
const EMPTY_SEED_FALLBACK = 0x9e3779b9;

function seedToUint32(seed: Seed): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      return EMPTY_SEED_FALLBACK;
    }

    const normalized = Math.trunc(seed) >>> 0;
    return normalized === 0 ? EMPTY_SEED_FALLBACK : normalized;
  }

  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const normalized = hash >>> 0;
  return normalized === 0 ? EMPTY_SEED_FALLBACK : normalized;
}

function nextUint32(state: number): number {
  let next = state;
  next ^= next << 13;
  next >>>= 0;
  next ^= next >>> 17;
  next >>>= 0;
  next ^= next << 5;
  next >>>= 0;
  return next;
}

export function createSeededRng(seed: Seed): SeededRng {
  let state = seedToUint32(seed);
  let calls = 0;

  const nextFloat = (): number => {
    state = nextUint32(state);
    calls += 1;
    return state / UINT32_MAX_PLUS_ONE;
  };

  const nextInt = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("maxExclusive must be a positive integer.");
    }

    return Math.floor(nextFloat() * maxExclusive);
  };

  const snapshot = () => ({
    seed,
    state,
    calls
  });

  return {
    nextFloat,
    nextInt,
    snapshot
  };
}
