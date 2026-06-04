export type Seed = number | string;

export interface RngState {
  seed: Seed;
  state: number;
  calls: number;
}

export interface SeededRng {
  nextFloat: () => number;
  nextInt: (maxExclusive: number) => number;
  snapshot: () => RngState;
}
