export const AGENT_MODULES = [
  "coreIdentity",
  "memory",
  "sigilSecurity",
  "rules",
  "strategy"
] as const;

export const MAX_TURNS = 20 as const;
export const DEFAULT_MAX_TURNS = MAX_TURNS;
export const MVP_SKILL_COUNT = 8 as const;
export const MVP_SKILL_SLOT_LIMIT = 2 as const;
export const CPU_OPPONENT_COUNT = 2 as const;

export const FICTIONAL_TERMS = [
  "Signal Breach",
  "Null Pulse",
  "Override Pulse",
  "Core Identity",
  "Logic Storm",
  "Sigil Rule",
  "Signal Exposure",
  "Logic Drift"
] as const;

export type FictionalTerm = (typeof FICTIONAL_TERMS)[number];
