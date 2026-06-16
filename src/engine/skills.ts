import type { SkillCatalog } from "./types";

export const MVP_SKILL_CATALOG = {
  skills: [
    {
      skillId: "skill-core-identity",
      displayName: "Core Identity",
      module: "coreIdentity",
      summary: "Stabilizes the agent around its declared operating pattern."
    },
    {
      skillId: "skill-signal-exposure",
      displayName: "Signal Exposure",
      module: "memory",
      summary: "Surfaces remembered patterns so the agent can read the arena state."
    },
    {
      skillId: "skill-logic-drift",
      displayName: "Logic Drift",
      module: "memory",
      summary: "Lets the agent adjust its recall path when pressure shifts."
    },
    {
      skillId: "skill-null-pulse",
      displayName: "Null Pulse",
      module: "sigilSecurity",
      summary: "Dampens incoming pressure through a fictional sigil response."
    },
    {
      skillId: "skill-signal-breach",
      displayName: "Signal Breach",
      module: "sigilSecurity",
      summary: "Tests the opposing signal pattern using fictional arena pressure."
    },
    {
      skillId: "skill-sigil-rule",
      displayName: "Sigil Rule",
      module: "rules",
      summary: "Reinforces one declared rule before the next exchange."
    },
    {
      skillId: "skill-override-pulse",
      displayName: "Override Pulse",
      module: "rules",
      summary: "Redirects the agent toward its highest-priority fictional rule."
    },
    {
      skillId: "skill-logic-storm",
      displayName: "Logic Storm",
      module: "strategy",
      summary: "Applies coordinated strategic pressure for the current turn."
    }
  ]
} as const satisfies SkillCatalog;
