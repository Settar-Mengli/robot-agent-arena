import { describe, expect, it } from "vitest";
import { startBattle } from "../../engine";
import { CPU_OPPONENTS } from "../../data/opponents";
import { QUICKSTART_ROBOT } from "../data/quickstart-robot";
import { buildSavePayload, saveAllowedForView } from "./build-save-payload";

describe("buildSavePayload", () => {
  const runtime = startBattle(
    QUICKSTART_ROBOT,
    CPU_OPPONENTS[0]!,
    "arena-1"
  );

  it("battle includes store runtime", () => {
    const p = buildSavePayload({
      viewKind: "battle",
      playerConfig: QUICKSTART_ROBOT,
      opponentId: CPU_OPPONENTS[0]!.agentId,
      seed: "arena-1",
      storeRuntime: runtime,
      battleOver: false
    });
    expect(p.mode).toBe("free");
    expect(p.runtime).toBe(runtime);
  });

  it("builder ignores stale storeRuntime", () => {
    const p = buildSavePayload({
      viewKind: "builder",
      playerConfig: QUICKSTART_ROBOT,
      opponentId: CPU_OPPONENTS[0]!.agentId,
      seed: "arena-1",
      storeRuntime: runtime,
      battleOver: true
    });
    expect(p.mode).toBe("free");
    expect(p.runtime).toBeNull();
    expect(p.battleOver).toBe(false);
  });

  it("setup ignores stale storeRuntime", () => {
    const p = buildSavePayload({
      viewKind: "setup",
      playerConfig: QUICKSTART_ROBOT,
      opponentId: CPU_OPPONENTS[0]!.agentId,
      seed: "arena-1",
      storeRuntime: runtime,
      battleOver: true
    });
    expect(p.runtime).toBeNull();
  });

  it("watch ignores stale storeRuntime and sets matchId", () => {
    const p = buildSavePayload({
      viewKind: "watch",
      playerConfig: QUICKSTART_ROBOT,
      opponentId: CPU_OPPONENTS[0]!.agentId,
      seed: "arena-1",
      storeRuntime: runtime,
      watchMatchId: "m1",
      battleOver: false
    });
    expect(p.mode).toBe("watch");
    expect(p.runtime).toBeNull();
    expect(p.watch?.matchId).toBe("m1");
  });

  it("saveAllowedForView matches table", () => {
    expect(saveAllowedForView("home")).toBe(false);
    expect(saveAllowedForView("lab")).toBe(false);
    expect(saveAllowedForView("battle")).toBe(true);
    expect(saveAllowedForView("watch")).toBe(true);
  });
});
