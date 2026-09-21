import { describe, expect, it } from "vitest";
import type {
  AgentFallbackReason,
  AgentTurnSource,
  DecisionTrace,
  PlayAgentTurnResult
} from "../../agent";
import { SENTINEL_X } from "../../data/opponents";
import { finalizeBattle, startBattle, stepBattle } from "../../engine";
import type { AgentConfig, BattleRuntime, SkillId } from "../../engine";
import { createBattleViewStore, type UiTurnResult } from "./battle-view";

const modules = {
  coreIdentity: "Steady Vanguard",
  memory: "Pattern Recall",
  sigilSecurity: "Aegis Layer",
  rules: "Never Skip Verification",
  strategy: "Measured Pressure"
};

const playerConfig: AgentConfig = {
  agentId: "agent-player-1",
  displayName: "PLAYER-UNIT",
  modules,
  skillIds: ["skill-override-pulse", "skill-logic-storm"]
};

function freshRuntime(): BattleRuntime {
  return startBattle(playerConfig, SENTINEL_X, "ui-store-1", 5);
}

function baseTrace(
  overrides: Partial<DecisionTrace> & {
    source: AgentTurnSource;
    fallbackReason?: AgentFallbackReason;
  }
): DecisionTrace {
  return {
    promptVersion: "agent-v1",
    turn: 1,
    budgetMs: 1000,
    elapsedMs: 1,
    observation: null,
    messages: [],
    attempts: [],
    ...overrides
  };
}

function resultFor(
  runtime: BattleRuntime,
  playerSkillId: SkillId,
  trace: DecisionTrace
): PlayAgentTurnResult {
  const step = stepBattle(runtime, playerSkillId);
  return { step, trace };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("battle view store", () => {
  it("does not apply runtime optimistically before the turn promise resolves", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const before = store.getState().runtime;

    const gate = deferred<UiTurnResult>();
    const dispatched = store.getState().dispatchTurn(
      "skill-logic-storm",
      () => gate.promise
    );
    // resetBattle bumps epoch to 1; first dispatch uses 2
    expect(dispatched).toEqual({ ok: true, epoch: 2 });
    expect(store.getState().status).toBe("inFlight");
    expect(store.getState().runtime).toBe(before);
    expect(store.getState().lastError).toBeNull();

    const next = resultFor(
      runtime,
      "skill-logic-storm",
      baseTrace({
        source: "llm",
        observation: { cpu: runtime.cpu, player: runtime.player }
      })
    );
    gate.resolve(next);
    await gate.promise;
    await Promise.resolve();

    expect(store.getState().runtime).toEqual(next.step.runtime);
    expect(store.getState().lastResult?.trace?.source).toBe("llm");
    expect(store.getState().status).toBe("idle");
  });

  it("applies skipped exit path (source=skipped)", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const next = resultFor(
      runtime,
      "skill-logic-storm",
      baseTrace({ source: "skipped" })
    );
    store.getState().dispatchTurn("skill-logic-storm", async () => next);
    await Promise.resolve();
    expect(store.getState().lastResult?.trace?.source).toBe("skipped");
    expect(store.getState().runtime).toEqual(next.step.runtime);
  });

  it("applies llm exit path (source=llm)", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const next = resultFor(
      runtime,
      "skill-logic-storm",
      baseTrace({
        source: "llm",
        observation: { cpu: runtime.cpu, player: runtime.player }
      })
    );
    store.getState().dispatchTurn("skill-logic-storm", async () => next);
    await Promise.resolve();
    expect(store.getState().lastResult?.trace?.source).toBe("llm");
  });

  it("applies invalid_output fallback exit path", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const next = resultFor(
      runtime,
      "skill-logic-storm",
      baseTrace({
        source: "fallback",
        fallbackReason: "invalid_output",
        observation: { cpu: runtime.cpu, player: runtime.player }
      })
    );
    store.getState().dispatchTurn("skill-logic-storm", async () => next);
    await Promise.resolve();
    expect(store.getState().lastResult?.trace?.source).toBe("fallback");
    expect(store.getState().lastResult?.trace?.fallbackReason).toBe(
      "invalid_output"
    );
  });

  it("applies budget_exceeded fallback exit path", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const next = resultFor(
      runtime,
      "skill-logic-storm",
      baseTrace({
        source: "fallback",
        fallbackReason: "budget_exceeded",
        observation: { cpu: runtime.cpu, player: runtime.player }
      })
    );
    store.getState().dispatchTurn("skill-logic-storm", async () => next);
    await Promise.resolve();
    expect(store.getState().lastResult?.trace?.fallbackReason).toBe(
      "budget_exceeded"
    );
  });

  it("rejects a second dispatch while a turn is in flight", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const gate = deferred<UiTurnResult>();
    const first = store.getState().dispatchTurn(
      "skill-logic-storm",
      () => gate.promise
    );
    expect(first.ok).toBe(true);
    const second = store.getState().dispatchTurn(
      "skill-override-pulse",
      async () => {
        throw new Error("must not be called");
      }
    );
    expect(second).toEqual({ ok: false, reason: "already_in_flight" });
    expect(store.getState().inFlight?.playerSkillId).toBe("skill-logic-storm");

    gate.resolve(
      resultFor(runtime, "skill-logic-storm", baseTrace({ source: "llm" }))
    );
    await gate.promise;
    await Promise.resolve();
  });

  it("rejects dispatch when battle is already over", () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    const completed: BattleRuntime = {
      ...runtime,
      session: finalizeBattle(runtime.session)
    };
    store.getState().resetBattle(completed);
    const result = store.getState().dispatchTurn(
      "skill-logic-storm",
      async () => {
        throw new Error("must not be called");
      }
    );
    expect(result).toEqual({ ok: false, reason: "battle_over" });
    expect(store.getState().status).toBe("idle");
  });

  it("surfaces a synchronous playTurn throw via lastError without changing runtime", () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const before = store.getState().runtime;

    const result = store.getState().dispatchTurn("skill-logic-storm", () => {
      throw new Error("sync-boom");
    });
    expect(result).toEqual({ ok: true, epoch: 2 });
    expect(store.getState().runtime).toBe(before);
    expect(store.getState().status).toBe("idle");
    expect(store.getState().inFlight).toBeNull();
    expect(store.getState().lastError).toEqual({
      epoch: 2,
      message: "sync-boom"
    });
  });

  it("surfaces a rejected playTurn promise via lastError without changing runtime", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const before = store.getState().runtime;
    const gate = deferred<UiTurnResult>();

    store.getState().dispatchTurn("skill-logic-storm", () => gate.promise);
    expect(store.getState().status).toBe("inFlight");

    gate.reject(new Error("async-boom"));
    await gate.promise.catch(() => undefined);
    await Promise.resolve();

    expect(store.getState().runtime).toBe(before);
    expect(store.getState().status).toBe("idle");
    expect(store.getState().lastError).toEqual({
      epoch: 2,
      message: "async-boom"
    });
  });

  it("recovers after a failed turn: next dispatch can succeed", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);

    store.getState().dispatchTurn("skill-logic-storm", () => {
      throw new Error("first-fail");
    });
    expect(store.getState().lastError?.message).toBe("first-fail");

    const next = resultFor(
      runtime,
      "skill-override-pulse",
      baseTrace({ source: "llm" })
    );
    store.getState().dispatchTurn("skill-override-pulse", async () => next);
    await Promise.resolve();

    expect(store.getState().lastError).toBeNull();
    expect(store.getState().runtime).toEqual(next.step.runtime);
    expect(store.getState().lastResult?.step).toEqual(next.step);
  });

  it("ignores a stale promise after epoch is superseded", async () => {
    const store = createBattleViewStore();
    const runtimeA = freshRuntime();
    const runtimeB = startBattle(playerConfig, SENTINEL_X, "ui-store-2", 5);
    store.getState().resetBattle(runtimeA);

    const gate = deferred<UiTurnResult>();
    store.getState().dispatchTurn("skill-logic-storm", () => gate.promise);
    expect(store.getState().turnEpoch).toBe(2);

    store.getState().resetBattle(runtimeB);
    expect(store.getState().runtime).toBe(runtimeB);
    expect(store.getState().turnEpoch).toBe(3);
    expect(store.getState().status).toBe("idle");

    const stale = resultFor(
      runtimeA,
      "skill-logic-storm",
      baseTrace({ source: "llm" })
    );
    gate.resolve(stale);
    await gate.promise;
    await Promise.resolve();

    expect(store.getState().runtime).toBe(runtimeB);
    expect(store.getState().lastResult).toBeNull();
    expect(store.getState().status).toBe("idle");
  });

  it("clearBattle nulls runtime and ignores a later deferred resolve", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const gate = deferred<UiTurnResult>();

    store.getState().dispatchTurn("skill-logic-storm", () => gate.promise);
    expect(store.getState().status).toBe("inFlight");

    store.getState().clearBattle();
    expect(store.getState().runtime).toBeNull();
    expect(store.getState().status).toBe("idle");
    expect(store.getState().inFlight).toBeNull();
    expect(store.getState().lastError).toBeNull();
    const epochAfterClear = store.getState().turnEpoch;

    gate.resolve(
      resultFor(runtime, "skill-logic-storm", baseTrace({ source: "llm" }))
    );
    await gate.promise;
    await Promise.resolve();

    expect(store.getState().runtime).toBeNull();
    expect(store.getState().lastResult).toBeNull();
    expect(store.getState().turnEpoch).toBe(epochAfterClear);
  });

  it("clearBattle during sync playTurn cannot be overwritten by failTurn", () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);

    store.getState().dispatchTurn("skill-logic-storm", () => {
      store.getState().clearBattle();
      throw new Error("after-clear");
    });

    expect(store.getState().runtime).toBeNull();
    expect(store.getState().lastError).toBeNull();
    expect(store.getState().status).toBe("idle");
  });

  it("ignores a stale rejection after clearBattle", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const gate = deferred<UiTurnResult>();

    store.getState().dispatchTurn("skill-logic-storm", () => gate.promise);
    store.getState().clearBattle();

    gate.reject(new Error("stale-reject"));
    await gate.promise.catch(() => undefined);
    await Promise.resolve();

    expect(store.getState().runtime).toBeNull();
    expect(store.getState().lastError).toBeNull();
  });

  it("accepts UiTurnResult without a trace", async () => {
    const store = createBattleViewStore();
    const runtime = freshRuntime();
    store.getState().resetBattle(runtime);
    const step = stepBattle(runtime, "skill-logic-storm");
    store.getState().dispatchTurn("skill-logic-storm", async () => ({ step }));
    await Promise.resolve();
    expect(store.getState().lastResult).toEqual({ step });
    expect(store.getState().lastResult?.trace).toBeUndefined();
  });
});
