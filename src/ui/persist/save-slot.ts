/**
 * One-slot localStorage persistence (D-005 / D-006 / D-049 B.4 / D-053).
 * Rebuilds AgentConfig from allowlisted fields; validates via engine rules.
 */
import {
  MVP_SKILL_CATALOG,
  validateAgentConfigInput,
  type AgentConfig,
  type BattleOutcome,
  type BattleRuntime
} from "../../engine";

export const SAVE_SLOT_KEY = "agent-arena.save.v1";
export const SAVE_SLOT_SCHEMA_VERSION = 1 as const;

const AGENT_CONFIG_KEYS = [
  "agentId",
  "displayName",
  "modules",
  "skillIds"
] as const;

const MODULE_KEYS = [
  "coreIdentity",
  "memory",
  "sigilSecurity",
  "rules",
  "strategy"
] as const;

const OUTCOME_RESULTS: ReadonlySet<string> = new Set([
  "player-victory",
  "cpu-victory",
  "draw"
]);

const OUTCOME_REASONS: ReadonlySet<string> = new Set([
  "player-health-zero",
  "cpu-health-zero",
  "mutual-health-zero",
  "turn-limit"
]);

const OUTCOME_SIDES: ReadonlySet<string> = new Set(["player", "cpu"]);

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

/** Rebuild AgentConfig from allowlisted fields only; validate with engine rules. */
function assertAgentConfig(value: unknown, path: string): AgentConfig {
  if (!isPlainObject(value)) {
    throw new TypeError(`${path}: expected object`);
  }
  const modulesRaw = value.modules;
  if (!isPlainObject(modulesRaw)) {
    throw new TypeError(`${path}: modules`);
  }
  for (const key of MODULE_KEYS) {
    if (typeof modulesRaw[key] !== "string") {
      throw new TypeError(`${path}.modules.${key}`);
    }
  }
  const modules = {
    coreIdentity: modulesRaw.coreIdentity as string,
    memory: modulesRaw.memory as string,
    sigilSecurity: modulesRaw.sigilSecurity as string,
    rules: modulesRaw.rules as string,
    strategy: modulesRaw.strategy as string
  };
  if (!Array.isArray(value.skillIds)) {
    throw new TypeError(`${path}: skillIds`);
  }
  const skillIds = value.skillIds.map((id, i) => {
    if (typeof id !== "string") {
      throw new TypeError(`${path}.skillIds[${i}]`);
    }
    return id;
  });
  if (typeof value.agentId !== "string" || typeof value.displayName !== "string") {
    throw new TypeError(`${path}: agentId/displayName`);
  }
  const rebuilt: AgentConfig = {
    agentId: value.agentId,
    displayName: value.displayName,
    modules,
    skillIds
  };
  validateAgentConfigInput(rebuilt, MVP_SKILL_CATALOG, path);
  // Guarantee Object.keys is exactly the allowlist (no __proto__ etc.)
  const keys = Object.keys(rebuilt);
  if (
    keys.length !== AGENT_CONFIG_KEYS.length ||
    !AGENT_CONFIG_KEYS.every((k) => keys.includes(k))
  ) {
    throw new TypeError(`${path}: unexpected keys`);
  }
  return rebuilt;
}

function assertBattleOutcome(value: unknown, path: string): BattleOutcome {
  if (!isPlainObject(value)) {
    throw new TypeError(`${path}: expected object`);
  }
  const result = value.result;
  const reason = value.reason;
  if (typeof result !== "string" || !OUTCOME_RESULTS.has(result)) {
    throw new TypeError(`${path}: result`);
  }
  if (typeof reason !== "string" || !OUTCOME_REASONS.has(reason)) {
    throw new TypeError(`${path}: reason`);
  }
  const out: BattleOutcome = {
    result: result as BattleOutcome["result"],
    reason: reason as BattleOutcome["reason"]
  };
  if (value.winnerSide !== undefined) {
    if (
      typeof value.winnerSide !== "string" ||
      !OUTCOME_SIDES.has(value.winnerSide)
    ) {
      throw new TypeError(`${path}: winnerSide`);
    }
    out.winnerSide = value.winnerSide as BattleOutcome["winnerSide"];
  }
  if (value.winnerAgentId !== undefined) {
    if (typeof value.winnerAgentId !== "string") {
      throw new TypeError(`${path}: winnerAgentId`);
    }
    out.winnerAgentId = value.winnerAgentId;
  }
  return out;
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
  if (typeof value.side !== "string") {
    throw new TypeError(`${path}: side`);
  }
  if (typeof value.agentId !== "string") {
    throw new TypeError(`${path}: agentId`);
  }
  if (typeof value.displayName !== "string") {
    throw new TypeError(`${path}: displayName`);
  }
  for (const key of [
    "health",
    "maxHealth",
    "energy",
    "maxEnergy",
    "defense"
  ] as const) {
    const n = value[key];
    if (typeof n !== "number" || !Number.isFinite(n)) {
      throw new TypeError(`${path}: ${key}`);
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
  const playerConfig = assertAgentConfig(
    raw.draft.playerConfig,
    "draft.playerConfig"
  );
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
  let lastOutcome: BattleOutcome | undefined;
  if (raw.lastOutcome !== undefined) {
    lastOutcome = assertBattleOutcome(raw.lastOutcome, "lastOutcome");
  }
  return {
    schemaVersion: SAVE_SLOT_SCHEMA_VERSION,
    savedAt: raw.savedAt,
    draft: {
      playerConfig,
      opponentId: raw.draft.opponentId,
      seed: raw.draft.seed
    },
    mode: raw.mode,
    ...(isPlainObject(raw.watch) && typeof raw.watch.matchId === "string"
      ? { watch: { matchId: raw.watch.matchId } }
      : {}),
    runtime,
    battleOver: raw.battleOver,
    ...(lastOutcome !== undefined ? { lastOutcome } : {})
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
