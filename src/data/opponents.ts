import type { AgentConfig } from "../engine/types";

/** Easy / aggressive CPU opponent — pressure-first loadout. */
export const FRACTURE: AgentConfig = {
  agentId: "cpu-fracture",
  displayName: "FRACTURE",
  modules: {
    coreIdentity: "Fractured Pattern",
    memory: "Short Recall",
    sigilSecurity: "Thin Aegis",
    rules: "Strike First",
    strategy: "Blunt Pressure"
  },
  skillIds: ["skill-override-pulse", "skill-signal-exposure"]
};

/** Hard CPU opponent — defense plus high-value strike. */
export const SENTINEL_X: AgentConfig = {
  agentId: "cpu-sentinel-x",
  displayName: "SENTINEL-X",
  modules: {
    coreIdentity: "Counter Logic",
    memory: "Adaptive Recall",
    sigilSecurity: "Echo Shield",
    rules: "Fail Closed",
    strategy: "Reactive Pressure"
  },
  skillIds: ["skill-null-pulse", "skill-logic-storm"]
};

/** Canonical MVP CPU roster (length matches CPU_OPPONENT_COUNT). */
export const CPU_OPPONENTS: readonly AgentConfig[] = [FRACTURE, SENTINEL_X];
