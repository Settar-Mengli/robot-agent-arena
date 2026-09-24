/**
 * Deterministic Resonance Seal suite generator (n=40 informative states).
 * Excludes all-tie oracle rows; stratifies by turn and resource bands.
 */
import {
  applySealAction,
  initialSealState,
  isSealTerminal,
  sealDecisionStateKey,
  sealLegalActions,
  sealMemoStateKey
} from "./dynamics";
import { sealBestResponse } from "./oracle";
import { sealGreedyAction } from "./policies";
import type { SealActionId, SealState } from "./types";

export type SealSuiteRow = {
  id: string;
  state: SealState;
  values: Record<SealActionId, number>;
  best: SealActionId[];
  exact: true;
};

export type SealSuiteV1 = {
  schemaVersion: 1;
  id: "resonance-seal-v1";
  n: number;
  excludedAllTieCount: number;
  snapshots: SealSuiteRow[];
};

const TARGET_N = 40;
const NEG = -1e12;

function legalFiniteValues(
  state: SealState,
  values: Record<SealActionId, number>
): number[] {
  return sealLegalActions(state)
    .map((a) => values[a]!)
    .filter((v) => Number.isFinite(v) && v > NEG / 2);
}

function isAllTie(state: SealState, values: Record<SealActionId, number>): boolean {
  const finite = legalFiniteValues(state, values);
  if (finite.length <= 1) {
    return true;
  }
  const first = finite[0]!;
  return finite.every((v) => Math.abs(v - first) < 1e-9);
}

function turnBand(turn: number): string {
  if (turn <= 2) return "early";
  if (turn <= 5) return "mid";
  return "late";
}

function energyBand(energy: number): string {
  if (energy <= 1) return "eLow";
  if (energy <= 3) return "eMid";
  return "eHigh";
}

function pressureBand(pressure: number): string {
  return pressure <= 2 ? "pLow" : "pHigh";
}

function stratumKey(state: SealState): string {
  return `${turnBand(state.turn)}|${energyBand(state.energy)}|${pressureBand(state.pressure)}`;
}

/** BFS + seeded walks to collect informative distinct states. */
export function generateResonanceSealSuite(): SealSuiteV1 {
  const byKey = new Map<string, SealSuiteRow>();
  const strataCounts = new Map<string, number>();
  let excludedAllTieCount = 0;

  function tryAdd(state: SealState, softCap: number): void {
    if (isSealTerminal(state)) return;
    const key = sealMemoStateKey(state);
    if (byKey.has(key)) return;
    const oracle = sealBestResponse(state);
    if (isAllTie(state, oracle.values)) {
      excludedAllTieCount += 1;
      return;
    }
    const stratum = stratumKey(state);
    const count = strataCounts.get(stratum) ?? 0;
    if (count >= softCap) return;

    byKey.set(key, {
      id: `seal__${key.replace(/\|/g, "_")}`,
      state: {
        turn: state.turn,
        maxTurns: state.maxTurns,
        energy: state.energy,
        seal: state.seal,
        pressure: state.pressure,
        braced: state.braced,
        bracedLastTurn: state.bracedLastTurn
      },
      values: { ...oracle.values },
      best: [...oracle.best],
      exact: true
    });
    strataCounts.set(stratum, count + 1);
  }

  // Pass 1: BFS from start with soft stratum cap 5
  {
    const q: SealState[] = [initialSealState(1)];
    const seen = new Set<string>();
    while (q.length > 0 && byKey.size < TARGET_N) {
      const s = q.shift()!;
      const k = sealMemoStateKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      tryAdd(s, 5);
      if (isSealTerminal(s)) continue;
      for (const a of sealLegalActions(s)) {
        q.push(applySealAction(s, a));
      }
      if (seen.size > 5000) break;
    }
  }

  // Pass 2: greedy walks from many seeds, softer cap
  for (let seed = 1; seed <= 500 && byKey.size < TARGET_N; seed += 1) {
    let state = initialSealState(seed);
    for (let step = 0; step < 12 && !isSealTerminal(state); step += 1) {
      tryAdd(state, 8);
      const legal = sealLegalActions(state);
      // Branch once per step to underfilled neighbors
      if (legal.length > 1) {
        for (const a of legal) {
          tryAdd(applySealAction(state, a), 8);
        }
      }
      state = applySealAction(state, sealGreedyAction(state));
    }
  }

  // Pass 3: no stratum cap — fill to 40
  if (byKey.size < TARGET_N) {
    const q: SealState[] = [initialSealState(1)];
    const seen = new Set<string>();
    while (q.length > 0 && byKey.size < TARGET_N) {
      const s = q.shift()!;
      const k = sealMemoStateKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      tryAdd(s, 999);
      if (isSealTerminal(s)) continue;
      for (const a of sealLegalActions(s)) {
        q.push(applySealAction(s, a));
      }
      if (seen.size > 20000) break;
    }
  }

  const snapshots = [...byKey.values()];
  if (snapshots.length < TARGET_N) {
    throw new Error(
      `resonance-seal suite underfilled: got ${snapshots.length}, need ${TARGET_N}`
    );
  }
  snapshots.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const trimmed = snapshots.slice(0, TARGET_N);

  return {
    schemaVersion: 1,
    id: "resonance-seal-v1",
    n: trimmed.length,
    excludedAllTieCount,
    snapshots: trimmed
  };
}

export { sealDecisionStateKey, sealMemoStateKey };
