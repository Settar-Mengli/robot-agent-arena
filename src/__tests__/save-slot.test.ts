import { describe, expect, it } from "vitest";
import {
  assertSaveSlotV1,
  clearSlot,
  loadSlot,
  SAVE_SLOT_KEY,
  saveSlot,
  type SaveSlotV1
} from "../ui/persist/save-slot";
import { startBattle } from "../engine";
import { CPU_OPPONENTS } from "../data/opponents";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    }
  } as Storage;
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

function sampleSlot(runtime: SaveSlotV1["runtime"] = null): Omit<
  SaveSlotV1,
  "schemaVersion" | "savedAt"
> {
  return {
    draft: {
      playerConfig: { ...player, skillIds: [...player.skillIds] },
      opponentId: CPU_OPPONENTS[0]!.agentId,
      seed: "arena-1"
    },
    mode: "free",
    runtime,
    battleOver: false
  };
}

describe("save-slot", () => {
  it("round-trips draft + runtime", () => {
    const storage = memoryStorage();
    const runtime = startBattle(
      sampleSlot().draft.playerConfig,
      CPU_OPPONENTS[0]!,
      "arena-1"
    );
    const saved = saveSlot(sampleSlot(runtime), { inFlight: false, storage });
    expect(saved.ok).toBe(true);
    const loaded = loadSlot(storage);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.slot.draft.seed).toBe("arena-1");
      expect(loaded.slot.runtime?.session.seed).toBe("arena-1");
    }
  });

  it("refuses save while inFlight", () => {
    const storage = memoryStorage();
    const result = saveSlot(sampleSlot(), { inFlight: true, storage });
    expect(result).toEqual({ ok: false, reason: "in_flight" });
    expect(storage.getItem(SAVE_SLOT_KEY)).toBeNull();
  });

  it("clears corrupt JSON", () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_SLOT_KEY, "{not-json");
    const loaded = loadSlot(storage);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.reason).toBe("corrupt");
    }
    expect(storage.getItem(SAVE_SLOT_KEY)).toBeNull();
  });

  it("rejects wrong schemaVersion and clears", () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_SLOT_KEY,
      JSON.stringify({ schemaVersion: 99, draft: {} })
    );
    const loaded = loadSlot(storage);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.reason).toBe("version");
    }
    expect(storage.getItem(SAVE_SLOT_KEY)).toBeNull();
  });

  it("rejects runtime missing session/player/cpu/rng/turns", () => {
    expect(() =>
      assertSaveSlotV1({
        schemaVersion: 1,
        savedAt: "2026-01-01T00:00:00.000Z",
        draft: sampleSlot().draft,
        mode: "free",
        runtime: { turns: [] },
        battleOver: false
      })
    ).toThrow(/runtime/);
  });

  it("assertSaveSlotV1 accepts valid payload", () => {
    const slot = assertSaveSlotV1({
      schemaVersion: 1,
      savedAt: "2026-01-01T00:00:00.000Z",
      draft: sampleSlot().draft,
      mode: "watch",
      watch: { matchId: "heldout:base:x" },
      runtime: null,
      battleOver: true
    });
    expect(slot.mode).toBe("watch");
  });

  it("rejects empty skillIds", () => {
    expect(() =>
      assertSaveSlotV1({
        schemaVersion: 1,
        savedAt: "2026-01-01T00:00:00.000Z",
        draft: {
          ...sampleSlot().draft,
          playerConfig: { ...player, skillIds: [] }
        },
        mode: "free",
        runtime: null,
        battleOver: false
      })
    ).toThrow(/skillIds/);
  });

  it("rejects unknown skill id", () => {
    expect(() =>
      assertSaveSlotV1({
        schemaVersion: 1,
        savedAt: "2026-01-01T00:00:00.000Z",
        draft: {
          ...sampleSlot().draft,
          playerConfig: {
            ...player,
            skillIds: ["skill-not-real"]
          }
        },
        mode: "free",
        runtime: null,
        battleOver: false
      })
    ).toThrow(/known skill/);
  });

  it("strips own __proto__ key from playerConfig", () => {
    const playerConfig = JSON.parse(
      JSON.stringify({
        agentId: "p1",
        displayName: "P1",
        modules: { ...player.modules },
        skillIds: [...player.skillIds]
      })
    ) as Record<string, unknown>;
    Object.defineProperty(playerConfig, "__proto__", {
      value: { polluted: true },
      enumerable: true,
      configurable: true,
      writable: true
    });
    expect(Object.prototype.hasOwnProperty.call(playerConfig, "__proto__")).toBe(
      true
    );
    const slot = assertSaveSlotV1({
      schemaVersion: 1,
      savedAt: "2026-01-01T00:00:00.000Z",
      draft: {
        playerConfig,
        opponentId: CPU_OPPONENTS[0]!.agentId,
        seed: "arena-1"
      },
      mode: "free",
      runtime: null,
      battleOver: false
    });
    expect(Object.keys(slot.draft.playerConfig).sort()).toEqual(
      ["agentId", "displayName", "modules", "skillIds"].sort()
    );
  });

  it("rejects garbage lastOutcome", () => {
    expect(() =>
      assertSaveSlotV1({
        schemaVersion: 1,
        savedAt: "2026-01-01T00:00:00.000Z",
        draft: sampleSlot().draft,
        mode: "free",
        runtime: null,
        battleOver: true,
        lastOutcome: { winner: "hacked" }
      })
    ).toThrow(/lastOutcome/);
  });

  it("valid slot round-trips unchanged (allowlisted fields)", () => {
    const storage = memoryStorage();
    const draft = sampleSlot();
    const withOutcome = {
      ...draft,
      battleOver: true,
      lastOutcome: {
        result: "player-victory" as const,
        reason: "cpu-health-zero" as const,
        winnerSide: "player" as const,
        winnerAgentId: "p1"
      }
    };
    expect(saveSlot(withOutcome, { inFlight: false, storage }).ok).toBe(true);
    const loaded = loadSlot(storage);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.slot.draft.playerConfig).toEqual(withOutcome.draft.playerConfig);
      expect(loaded.slot.lastOutcome).toEqual(withOutcome.lastOutcome);
      expect(Object.keys(loaded.slot.draft.playerConfig).sort()).toEqual(
        ["agentId", "displayName", "modules", "skillIds"].sort()
      );
    }
  });

  it("load with invalid draft returns schema/corrupt-style failure", () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_SLOT_KEY,
      JSON.stringify({
        schemaVersion: 1,
        savedAt: "2026-01-01T00:00:00.000Z",
        draft: {
          playerConfig: { ...player, skillIds: [] },
          opponentId: "x",
          seed: "s"
        },
        mode: "free",
        runtime: null,
        battleOver: false
      })
    );
    const loaded = loadSlot(storage);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.reason).toBe("schema");
    }
  });

  it("clearSlot removes key", () => {
    const storage = memoryStorage();
    saveSlot(sampleSlot(), { inFlight: false, storage });
    clearSlot(storage);
    expect(loadSlot(storage).ok).toBe(false);
  });
});
