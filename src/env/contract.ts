import type { Seed } from "../engine";

/**
 * Generic measurement contract (D-052 / Batch 5).
 * Robot battle specialization remains `Environment` in types.ts (unchanged).
 * Shared with Resonance Seal via `EnvironmentOf`; LLM/agent path is NOT on this contract.
 */
export type EnvironmentOf<S, A extends string> = {
  start: (seed: Seed, init?: unknown) => S;
  isTerminal: (state: S) => boolean;
  apply: (
    state: S,
    action: A,
    opponent?: (state: S) => A
  ) => { state: S };
  /** Candidate set for oracle (may include currently unaffordable). */
  equippedActions: (state: S) => readonly A[];
  /** Affordable / legal now. */
  legalActions: (state: S) => A[];
  terminalValue: (state: S) => number;
  memoStateKey: (state: S) => string;
  decisionStateKey: (state: S, action: A) => string;
};
