import type { EnvRng } from "../seed-rng";
import { sealLegalActions } from "./dynamics";
import type { SealActionId, SealState } from "./types";

/** Prefer inscribe if legal, else channel if energy < 2, else vent if pressure >= 3, else brace if legal, else first legal. */
export function sealGreedyAction(state: SealState): SealActionId {
  const legal = sealLegalActions(state);
  if (legal.length === 0) {
    throw new Error("no legal seal actions");
  }
  if (legal.includes("inscribe")) {
    return "inscribe";
  }
  if (state.energy < 2 && legal.includes("channel")) {
    return "channel";
  }
  if (state.pressure >= 3 && legal.includes("vent")) {
    return "vent";
  }
  if (legal.includes("brace")) {
    return "brace";
  }
  if (legal.includes("channel")) {
    return "channel";
  }
  return legal[0]!;
}

export function sealRandomAction(state: SealState, rng: EnvRng): SealActionId {
  const legal = sealLegalActions(state);
  if (legal.length === 0) {
    throw new Error("no legal seal actions");
  }
  return legal[rng.nextInt(0, legal.length)]!;
}
