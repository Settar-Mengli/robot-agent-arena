/**
 * Arena replay pack — browser-safe recorded gemini match frames.
 * UI imports JSON only; no Node/eval in the browser.
 */

export const ARENA_REPLAY_SCHEMA_VERSION = 1 as const;

export type ArenaReplayCombatant = {
  side: "player" | "cpu";
  agentId: string;
  displayName: string;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  defense: number;
};

export type ArenaReplaySanitizedTrace = {
  messages: Array<{ role: string; content: string }>;
  source: string;
  rawText?: string;
  provider?: string;
  model?: string;
  validation?: unknown;
  fallbackReason?: string;
};

export type ArenaReplayTurn = {
  turn: number;
  playerSkillId: string;
  cpuSkillId: string;
  endedPlayer: ArenaReplayCombatant;
  endedCpu: ArenaReplayCombatant;
  outcome?: {
    result: string;
    reason: string;
    winnerSide?: string;
  };
  trace?: ArenaReplaySanitizedTrace;
};

export type ArenaReplayMatch = {
  matchId: string;
  scenarioId: string;
  variant: "base" | "grounded";
  provider: string;
  model: string;
  seed: string | number;
  playerPolicy: "greedy" | "seeded-random";
  playerConfig: {
    agentId: string;
    displayName: string;
    modules: Record<string, string>;
    skillIds: string[];
  };
  cpuConfig: {
    agentId: string;
    displayName: string;
    modules: Record<string, string>;
    skillIds: string[];
  };
  startedPlayer: ArenaReplayCombatant;
  startedCpu: ArenaReplayCombatant;
  maxTurns: number;
  outcome: {
    result: string;
    reason: string;
    winnerSide?: string;
  };
  totalTurns: number;
  turns: ArenaReplayTurn[];
};

export type ArenaReplayPackV1 = {
  schemaVersion: typeof ARENA_REPLAY_SCHEMA_VERSION;
  provider: string;
  model: string;
  variants: Array<"base" | "grounded">;
  limitations: string[];
  reproduce: string[];
  matches: ArenaReplayMatch[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new TypeError(`ArenaReplayPackV1 ${path}: ${message}`);
}

export function assertArenaReplayPackV1(raw: unknown): ArenaReplayPackV1 {
  if (!isPlainObject(raw)) {
    fail("", "expected object");
  }
  if (raw.schemaVersion !== ARENA_REPLAY_SCHEMA_VERSION) {
    fail("schemaVersion", "expected 1");
  }
  if (typeof raw.provider !== "string" || typeof raw.model !== "string") {
    fail("provider|model", "expected strings");
  }
  if (!Array.isArray(raw.variants) || raw.variants.length === 0) {
    fail("variants", "expected non-empty array");
  }
  if (!Array.isArray(raw.limitations) || !Array.isArray(raw.reproduce)) {
    fail("limitations|reproduce", "expected arrays");
  }
  if (!Array.isArray(raw.matches) || raw.matches.length === 0) {
    fail("matches", "expected non-empty array");
  }
  for (let i = 0; i < raw.matches.length; i += 1) {
    const m = raw.matches[i];
    if (!isPlainObject(m)) {
      fail(`matches[${i}]`, "expected object");
    }
    if (typeof m.matchId !== "string" || typeof m.scenarioId !== "string") {
      fail(`matches[${i}].ids`, "expected strings");
    }
    if (m.variant !== "base" && m.variant !== "grounded") {
      fail(`matches[${i}].variant`, "expected base|grounded");
    }
    if (!Array.isArray(m.turns) || m.turns.length === 0) {
      fail(`matches[${i}].turns`, "expected non-empty array");
    }
  }
  return raw as ArenaReplayPackV1;
}
