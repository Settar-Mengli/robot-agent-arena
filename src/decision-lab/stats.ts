/**
 * Pure confidence-interval helpers shared by eval (Node) and Lab UI.
 * No Node, eval, React, or DOM imports.
 */

export type WilsonInterval = {
  low: number;
  high: number;
};

/** Wilson score interval for a binomial proportion (z ≈ 1.96 → ~95%). */
export function wilsonInterval(
  successes: number,
  n: number,
  z = 1.96
): WilsonInterval {
  if (n <= 0) {
    return { low: 0, high: 0 };
  }
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return {
    low: (center - margin) / denom,
    high: (center + margin) / denom
  };
}

export type InsufficientEvidenceInput = {
  n: number;
  wilson?: WilsonInterval;
  minN?: number;
  maxWidth?: number;
};

/**
 * Label “insufficient evidence” when n is small or the Wilson interval is wide.
 * Defaults: minN=30, maxWidth=0.40 (D-033 / ES).
 */
export function insufficientEvidence(
  input: InsufficientEvidenceInput
): boolean {
  const minN = input.minN ?? 30;
  const maxWidth = input.maxWidth ?? 0.4;
  if (input.n < minN) {
    return true;
  }
  if (input.wilson !== undefined) {
    const width = input.wilson.high - input.wilson.low;
    if (width >= maxWidth) {
      return true;
    }
  }
  return false;
}

/** Deterministic Mulberry32 PRNG — same seed ⇒ same stream on every OS. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return (): number => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type BootstrapMeanCiOptions = {
  seed?: number;
  B?: number;
  alpha?: number;
};

export type BootstrapMeanCi = {
  low: number;
  high: number;
  mean: number;
};

/**
 * Seeded bootstrap percentile CI for the mean of `values`.
 * Default: seed 0xA11CE, B=2000, alpha=0.05 → 2.5% / 97.5% percentiles.
 */
export function bootstrapMeanCi(
  values: readonly number[],
  options: BootstrapMeanCiOptions = {}
): BootstrapMeanCi {
  const n = values.length;
  if (n === 0) {
    return { low: 0, high: 0, mean: 0 };
  }
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  const mean = sum / n;
  if (n === 1) {
    return { low: mean, high: mean, mean };
  }

  const seed = options.seed ?? 0xa11ce;
  const B = options.B ?? 2000;
  const alpha = options.alpha ?? 0.05;
  const rand = mulberry32(seed);
  const means: number[] = [];

  for (let b = 0; b < B; b += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) {
      const idx = Math.floor(rand() * n);
      s += values[idx]!;
    }
    means.push(s / n);
  }

  means.sort((a, b) => a - b);
  const loIdx = Math.min(
    means.length - 1,
    Math.max(0, Math.floor((alpha / 2) * means.length))
  );
  const hiIdx = Math.min(
    means.length - 1,
    Math.max(0, Math.ceil((1 - alpha / 2) * means.length) - 1)
  );
  return {
    low: means[loIdx]!,
    high: means[hiIdx]!,
    mean
  };
}
