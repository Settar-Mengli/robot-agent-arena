/**
 * One-slot localStorage persistence (D-005 / D-006 / D-049 B.4).
 * Browser-only; no engine/eval imports beyond types used for shape checks.
 */
import type {
  AgentConfig,
  BattleOutcome,
  BattleRuntime
} from "../../engine";

export const SAVE_SLOT_KEY = "agent-arena.save.v1";
export const SAVE_SLOT_SCHEMA_VERSION = 1 as const;

export type SaveDraftV1 = {
  playerConfig: AgentConfig;
  opponentId: string;
  seed: string;
};

export type SaveSlotV1 = {
  schemaVersion: typeof SAVE_SLOT_SCHEMA_VERSION;
  savedAt: string;
  draft: SaveDraftV1;
  mode: "free" | "watch";
  watch?: { matchId: string };
  runtime: BattleRuntime | null;
  battleOver: boolean;
  lastOutcome?: BattleOutcome;
};

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: "in_flight" | "quota" | "serialize" };

export type LoadResult =
  | { ok: true; slot: SaveSlotV1 }
  | {
      ok: false;
      reason: "empty" | "corrupt" | "version" | "schema";
      message: string;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertAgentConfig(value: unknown, path: string): AgentConfig {
  if (!isPlainObject(value)) {
    throw new TypeError(`${path}: expected object`);
  }
  if (typeof value.agentId !== "string" || typeof value.displayName !== "string") {
    throw new TypeError(`${path}: agentId/displayName`);
  }
  if (!isPlainObject(value.modules) || !Array.isArray(value.skillIds)) {
    throw new TypeError(`${path}: modules/skillIds`);
  }
  return value as unknown as AgentConfig;
}

function assertCombatant(value: unknown, path: string): void {
  if (!isPlainObject(value)) {
    throw new TypeError(`${path}: expected object`);
  }
  for (const key of [
    "side",
    "agentId",
    "displayName",
    "health",
    "maxHealth",
    "energy",
    "maxEnergy",
    "defense"
  ] as const) {
    if (!(key in value)) {
      throw new TypeError(`${path}: missing ${key}`);
    }
  }
}

function assertBattleRuntime(value: unknown): BattleRuntime {
  if (!isPlainObject(value)) {
    throw new TypeError("runtime: expected object");
  }
  if (!isPlainObject(value.session)) {
    throw new TypeError("runtime.session: expected object");
  }
  if (typeof value.session.turn !== "number") {
    throw new TypeError("runtime.session.turn: expected number");
  }
  assertCombatant(value.player, "runtime.player");
  assertCombatant(value.cpu, "runtime.cpu");
  if (!isPlainObject(value.rng)) {
    throw new TypeError("runtime.rng: expected object");
  }
  if (typeof value.rng.state !== "number" || typeof value.rng.calls !== "number") {
    throw new TypeError("runtime.rng: state/calls");
  }
  if (!Array.isArray(value.turns)) {
    throw new TypeError("runtime.turns: expected array");
  }
  return value as unknown as BattleRuntime;
}

/** Validate SaveSlotV1; throws on failure. */
export function assertSaveSlotV1(raw: unknown): SaveSlotV1 {
  if (!isPlainObject(raw)) {
    throw new TypeError("SaveSlotV1: expected object");
  }
  if (raw.schemaVersion !== SAVE_SLOT_SCHEMA_VERSION) {
    throw new TypeError("SaveSlotV1: unsupported schemaVersion");
  }
  if (typeof raw.savedAt !== "string") {
    throw new TypeError("SaveSlotV1: savedAt");
  }
  if (!isPlainObject(raw.draft)) {
    throw new TypeError("SaveSlotV1: draft");
  }
  assertAgentConfig(raw.draft.playerConfig, "draft.playerConfig");
  if (typeof raw.draft.opponentId !== "string" || typeof raw.draft.seed !== "string") {
    throw new TypeError("SaveSlotV1: draft.opponentId/seed");
  }
  if (raw.mode !== "free" && raw.mode !== "watch") {
    throw new TypeError("SaveSlotV1: mode");
  }
  if (typeof raw.battleOver !== "boolean") {
    throw new TypeError("SaveSlotV1: battleOver");
  }
  let runtime: BattleRuntime | null = null;
  if (raw.runtime !== null) {
    runtime = assertBattleRuntime(raw.runtime);
  }
  return {
    schemaVersion: SAVE_SLOT_SCHEMA_VERSION,
    savedAt: raw.savedAt,
    draft: {
      playerConfig: assertAgentConfig(raw.draft.playerConfig, "draft.playerConfig"),
      opponentId: raw.draft.opponentId as string,
      seed: raw.draft.seed as string
    },
    mode: raw.mode,
    ...(isPlainObject(raw.watch) && typeof raw.watch.matchId === "string"
      ? { watch: { matchId: raw.watch.matchId } }
      : {}),
    runtime,
    battleOver: raw.battleOver,
    ...(raw.lastOutcome !== undefined
      ? { lastOutcome: raw.lastOutcome as BattleOutcome }
      : {})
  };
}

export type PersistStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function saveSlot(
  slot: Omit<SaveSlotV1, "schemaVersion" | "savedAt"> & {
    savedAt?: string;
  },
  options: {
    inFlight: boolean;
    storage?: PersistStorage;
    now?: () => Date;
  }
): SaveResult {
  if (options.inFlight) {
    return { ok: false, reason: "in_flight" };
  }
  const storage = options.storage ?? globalThis.localStorage;
  const payload: SaveSlotV1 = {
    schemaVersion: SAVE_SLOT_SCHEMA_VERSION,
    savedAt: slot.savedAt ?? (options.now?.() ?? new Date()).toISOString(),
    draft: slot.draft,
    mode: slot.mode,
    ...(slot.watch !== undefined ? { watch: slot.watch } : {}),
    runtime: slot.runtime,
    battleOver: slot.battleOver,
    ...(slot.lastOutcome !== undefined ? { lastOutcome: slot.lastOutcome } : {})
  };
  try {
    assertSaveSlotV1(payload);
    storage.setItem(SAVE_SLOT_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.code === 22)
    ) {
      return { ok: false, reason: "quota" };
    }
    return { ok: false, reason: "serialize" };
  }
}

export function loadSlot(storage?: PersistStorage): LoadResult {
  const store = storage ?? globalThis.localStorage;
  let rawText: string | null;
  try {
    rawText = store.getItem(SAVE_SLOT_KEY);
  } catch {
    return { ok: false, reason: "corrupt", message: "storage read failed" };
  }
  if (rawText === null || rawText === "") {
    return { ok: false, reason: "empty", message: "no save" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    try {
      store.removeItem(SAVE_SLOT_KEY);
    } catch {
      /* ignore */
    }
    return { ok: false, reason: "corrupt", message: "invalid JSON" };
  }
  try {
    if (isPlainObject(parsed) && parsed.schemaVersion !== SAVE_SLOT_SCHEMA_VERSION) {
      store.removeItem(SAVE_SLOT_KEY);
      return {
        ok: false,
        reason: "version",
        message: `unsupported schemaVersion ${String(parsed.schemaVersion)}`
      };
    }
    const slot = assertSaveSlotV1(parsed);
    return { ok: true, slot };
  } catch (err) {
    try {
      store.removeItem(SAVE_SLOT_KEY);
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      reason: "schema",
      message: err instanceof Error ? err.message : "schema assert failed"
    };
  }
}

export function clearSlot(storage?: PersistStorage): void {
  const store = storage ?? globalThis.localStorage;
  try {
    store.removeItem(SAVE_SLOT_KEY);
  } catch {
    /* ignore quota / security errors on clear */
  }
}
