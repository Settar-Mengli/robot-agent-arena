import { createStore, type StoreApi } from "zustand/vanilla";
import type { PlayAgentTurnResult } from "../../agent";
import type { BattleRuntime, SkillId } from "../../engine";

export type PlayTurnFn = (
  runtime: BattleRuntime,
  playerSkillId: SkillId
) => Promise<PlayAgentTurnResult>;

export type InFlightTurn = {
  epoch: number;
  playerSkillId: SkillId;
  promise: Promise<PlayAgentTurnResult>;
};

export type BattleViewStatus = "idle" | "inFlight";

export type BattleViewState = {
  runtime: BattleRuntime | null;
  /** Monotonic; never reused. Bumped on dispatch and on reset while invalidating in-flight. */
  turnEpoch: number;
  status: BattleViewStatus;
  inFlight: InFlightTurn | null;
  lastResult: PlayAgentTurnResult | null;
};

export type DispatchTurnResult =
  | { ok: true; epoch: number }
  | { ok: false; reason: "no_runtime" | "already_in_flight" };

export type BattleViewActions = {
  /**
   * Replace battle state (e.g. after startBattle).
   * Bumps `turnEpoch` so any in-flight promise cannot commit (stale-by-construction).
   */
  resetBattle: (runtime: BattleRuntime) => void;
  /**
   * Start one turn. Rejects a second dispatch while in flight (by construction).
   * Does not write `runtime` until the matching epoch resolves (no optimistic apply).
   */
  dispatchTurn: (
    playerSkillId: SkillId,
    playTurn: PlayTurnFn
  ) => DispatchTurnResult;
};

export type BattleViewStore = BattleViewState & BattleViewActions;

const initialState: BattleViewState = {
  runtime: null,
  turnEpoch: 0,
  status: "idle",
  inFlight: null,
  lastResult: null
};

export function createBattleViewStore(
  seed?: Partial<BattleViewState>
): StoreApi<BattleViewStore> {
  return createStore<BattleViewStore>((set, get) => ({
    ...initialState,
    ...seed,

    resetBattle(runtime) {
      set({
        runtime,
        turnEpoch: get().turnEpoch + 1,
        status: "idle",
        inFlight: null,
        lastResult: null
      });
    },

    dispatchTurn(playerSkillId, playTurn) {
      const state = get();
      if (state.runtime === null) {
        return { ok: false, reason: "no_runtime" };
      }
      if (state.status === "inFlight") {
        return { ok: false, reason: "already_in_flight" };
      }

      const epoch = state.turnEpoch + 1;
      const runtimeSnapshot = state.runtime;
      const promise = playTurn(runtimeSnapshot, playerSkillId);

      set({
        turnEpoch: epoch,
        status: "inFlight",
        inFlight: { epoch, playerSkillId, promise }
        // runtime intentionally unchanged until resolve — no optimistic apply
      });

      void promise.then(
        (result) => {
          const current = get();
          if (current.turnEpoch !== epoch) {
            // Stale resolution — ignore by construction
            return;
          }
          set({
            runtime: result.step.runtime,
            status: "idle",
            inFlight: null,
            lastResult: result
          });
        },
        () => {
          const current = get();
          if (current.turnEpoch !== epoch) {
            return;
          }
          set({
            status: "idle",
            inFlight: null
          });
        }
      );

      return { ok: true, epoch };
    }
  }));
}
