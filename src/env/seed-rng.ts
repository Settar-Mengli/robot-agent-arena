/**
 * Tiny seeded RNG for reference environments (no battle types).
 * Same xorshift family as the engine so Seed semantics stay familiar.
 */

export type EnvSeed = number | string;

const UINT32_MAX_PLUS_ONE = 0x1_0000_0000;
const EMPTY_SEED_FALLBACK = 0x9e3779b9;

function seedToUint32(seed: EnvSeed): number {
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

export type EnvRng = {
  nextFloat: () => number;
  nextInt: (minInclusive: number, maxExclusive: number) => number;
};

export function createEnvRng(seed: EnvSeed): EnvRng {
  let state = seedToUint32(seed);
  function nextUint32(): number {
    let next = state;
    next ^= next << 13;
    next >>>= 0;
    next ^= next >>> 17;
    next >>>= 0;
    next ^= next << 5;
    next >>>= 0;
    state = next;
    return next;
  }
  return {
    nextFloat: () => nextUint32() / UINT32_MAX_PLUS_ONE,
    nextInt: (minInclusive, maxExclusive) => {
      const span = maxExclusive - minInclusive;
      if (span <= 0) {
        return minInclusive;
      }
      return minInclusive + (nextUint32() % span);
    }
  };
}
