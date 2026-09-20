import { createStore, type StoreApi } from "zustand/vanilla";
import type { DecisionTrace } from "../../agent";
import { isBattleOver, type BattleRuntime, type SkillId } from "../../engine";

/** UI turn result — assignable from `PlayAgentTurnResult`; trace optional for greedy CPU. */
export type UiTurnResult = {
  step: ReturnType<typeof import("../../engine").stepBattle>;
  trace?: DecisionTrace;
};

export type PlayTurnFn = (
  runtime: BattleRuntime,
  playerSkillId: SkillId
) => Promise<UiTurnResult>;

export type InFlightTurn = {
  epoch: number;
  playerSkillId: SkillId;
  promise: Promise<UiTurnResult>;
};

export type BattleViewStatus = "idle" | "inFlight";

export type BattleViewError = {
  epoch: number;
  message: string;
};

export type BattleViewState = {
  runtime: BattleRuntime | null;
  /** Monotonic; never reused. Bumped on dispatch and on reset/clear while invalidating in-flight. */
  turnEpoch: number;
  status: BattleViewStatus;
  inFlight: InFlightTurn | null;
  lastResult: UiTurnResult | null;
  lastError: BattleViewError | null;
};

export type DispatchTurnResult =
  | { ok: true; epoch: number }
  | {
      ok: false;
      reason: "no_runtime" | "already_in_flight" | "battle_over";
    };

export type BattleViewActions = {
  /**
   * Replace battle state (e.g. after startBattle / restart).
   * Bumps `turnEpoch` so any in-flight promise cannot commit (stale-by-construction).
   */
  resetBattle: (runtime: BattleRuntime) => void;
  /**
   * Leave the battle: null runtime, bump epoch, clear flight/result/error.
   * Pending resolves/rejects cannot overwrite afterward.
   */
  clearBattle: () => void;
  /**
   * Start one turn. Reserves epoch + marks in-flight **before** invoking `playTurn`.
   * Sync throws and promise rejections share one epoch-gated failure path.
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
  lastResult: null,
  lastError: null
};

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return String(err);
}

export function createBattleViewStore(
  seed?: Partial<BattleViewState>
): StoreApi<BattleViewStore> {
  return createStore<BattleViewStore>((set, get) => {
    function failTurn(epoch: number, message: string): void {
      const current = get();
      if (current.turnEpoch !== epoch) {
        return;
      }
      set({
        status: "idle",
        inFlight: null,
        lastError: { epoch, message }
        // runtime intentionally unchanged
      });
    }

    function settleSuccess(epoch: number, result: UiTurnResult): void {
      const current = get();
      if (current.turnEpoch !== epoch) {
        return;
      }
      set({
        runtime: result.step.runtime,
        status: "idle",
        inFlight: null,
        lastResult: result,
        lastError: null
      });
    }

    return {
      ...initialState,
      ...seed,

      resetBattle(runtime) {
        set({
          runtime,
          turnEpoch: get().turnEpoch + 1,
          status: "idle",
          inFlight: null,
          lastResult: null,
          lastError: null
        });
      },

      clearBattle() {
        set({
          runtime: null,
          turnEpoch: get().turnEpoch + 1,
          status: "idle",
          inFlight: null,
          lastResult: null,
          lastError: null
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
        if (isBattleOver(state.runtime.session)) {
          return { ok: false, reason: "battle_over" };
        }

        const epoch = state.turnEpoch + 1;
        const runtimeSnapshot = state.runtime;

        // Observable promise reserved with the epoch; bridged to playTurn below.
        // Never rewrite inFlight after this set — sync clear/reset must not be overwritten.
        let resolveHeld!: (value: UiTurnResult) => void;
        let rejectHeld!: (reason?: unknown) => void;
        const held = new Promise<UiTurnResult>((resolve, reject) => {
          resolveHeld = resolve;
          rejectHeld = reject;
        });
        void held.catch(() => undefined);

        set({
          turnEpoch: epoch,
          status: "inFlight",
          inFlight: { epoch, playerSkillId, promise: held },
          lastError: null
          // runtime intentionally unchanged until resolve — no optimistic apply
        });

        try {
          const promise = playTurn(runtimeSnapshot, playerSkillId);
          void promise.then(
            (result) => {
              resolveHeld(result);
              settleSuccess(epoch, result);
            },
            (err) => {
              rejectHeld(err);
              failTurn(epoch, errorMessage(err));
            }
          );
        } catch (err) {
          failTurn(epoch, errorMessage(err));
          rejectHeld(err);
        }

        return { ok: true, epoch };
      }
    };
  });
}
