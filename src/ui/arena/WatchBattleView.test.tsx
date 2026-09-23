import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { WatchBattleView } from "./WatchBattleView";
import pack from "./pack/arena-replay.v1.json";
import { SENTINEL_X } from "../../data/opponents";
import { startBattle, stepBattle } from "../../engine";
import { createBattleViewStore } from "../store/battle-view";
import {
  loadSlot,
  saveSlot,
  type PersistStorage
} from "../persist/save-slot";

afterEach(() => {
  cleanup();
});

function memoryStorage(): PersistStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    }
  };
}

const player = {
  agentId: "p1",
  displayName: "P1",
  modules: {
    coreIdentity: "a",
    memory: "b",
    sigilSecurity: "c",
    rules: "d",
    strategy: "e"
  },
  skillIds: ["skill-logic-storm", "skill-override-pulse"] as const
};

describe("WatchBattleView", () => {
  it("shows honesty line and advances frames with story narration", () => {
    render(<WatchBattleView onLeave={() => undefined} />);

    expect(screen.getByTestId("watch-battle-view")).toBeTruthy();
    expect(screen.getByTestId("watch-honesty-line")).toHaveTextContent(
      /Recorded examples, not live AI/
    );

    fireEvent.click(screen.getByTestId("watch-next"));
    expect(screen.getAllByText(/used /i).length).toBeGreaterThanOrEqual(1);
  });

  it("notifies onMatchIdChange and restores initialMatchId", () => {
    const second = pack.matches[1]?.matchId;
    expect(second).toBeTruthy();
    const seen: string[] = [];
    const { rerender } = render(
      <WatchBattleView
        onLeave={() => undefined}
        onMatchIdChange={(id) => {
          seen.push(id);
        }}
      />
    );
    expect(seen[0]).toBe(pack.matches[0]!.matchId);

    fireEvent.change(screen.getByTestId("watch-match-select"), {
      target: { value: second }
    });
    expect(seen.at(-1)).toBe(second);

    rerender(
      <WatchBattleView
        onLeave={() => undefined}
        initialMatchId={second}
        onMatchIdChange={() => undefined}
      />
    );
    expect(
      (screen.getByTestId("watch-match-select") as HTMLSelectElement).value
    ).toBe(second);
  });

  it("save → load restores the same watch matchId", () => {
    const storage = memoryStorage();
    const matchId = pack.matches[2]!.matchId;
    const saved = saveSlot(
      {
        draft: {
          playerConfig: { ...player, skillIds: [...player.skillIds] },
          opponentId: SENTINEL_X.agentId,
          seed: "arena-1"
        },
        mode: "watch",
        watch: { matchId },
        runtime: null,
        battleOver: false
      },
      { inFlight: false, storage }
    );
    expect(saved.ok).toBe(true);
    const loaded = loadSlot(storage);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.slot.mode).toBe("watch");
      expect(loaded.slot.watch?.matchId).toBe(matchId);
    }
  });
});

describe("epoch after load", () => {
  it("resetBattle on load bumps epoch so stale settle is ignored", async () => {
    const store = createBattleViewStore();
    const runtime = startBattle(
      { ...player, skillIds: [...player.skillIds] },
      SENTINEL_X,
      "epoch-1"
    );
    store.getState().resetBattle(runtime);
    const epochBefore = store.getState().turnEpoch;

    let resolveTurn!: (v: {
      step: ReturnType<typeof stepBattle>;
      trace?: undefined;
    }) => void;
    const deferred = new Promise<{
      step: ReturnType<typeof stepBattle>;
      trace?: undefined;
    }>((resolve) => {
      resolveTurn = resolve;
    });

    const dispatch = store.getState().dispatchTurn(
      "skill-override-pulse",
      async () => deferred
    );
    expect(dispatch.ok).toBe(true);
    const inFlightEpoch = store.getState().turnEpoch;

    const restored = startBattle(
      { ...player, skillIds: [...player.skillIds] },
      SENTINEL_X,
      "epoch-restored"
    );
    store.getState().resetBattle(restored);
    expect(store.getState().turnEpoch).toBeGreaterThan(epochBefore);
    expect(store.getState().turnEpoch).toBeGreaterThan(inFlightEpoch);
    const epochAfterLoad = store.getState().turnEpoch;

    const step = stepBattle(
      runtime,
      "skill-override-pulse",
      () => "skill-null-pulse"
    );
    resolveTurn({ step });
    await deferred;
    await Promise.resolve();

    expect(store.getState().turnEpoch).toBe(epochAfterLoad);
    expect(store.getState().runtime?.session.seed).toBe("epoch-restored");
    expect(store.getState().status).toBe("idle");
  });
});
