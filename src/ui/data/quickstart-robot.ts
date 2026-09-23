import type { AgentConfig } from "../../engine";

/** Ready-made robot for one-click free play (stable id, no UUID). */
export const QUICKSTART_ROBOT: AgentConfig = {
  agentId: "quickstart-aegis",
  displayName: "AEGIS",
  modules: {
    coreIdentity: "Steady Vanguard",
    memory: "Pattern Recall",
    sigilSecurity: "Aegis Layer",
    rules: "Never Skip Verification",
    strategy: "Measured Pressure"
  },
  skillIds: ["skill-null-pulse", "skill-logic-storm"]
};
