import type { SkillCatalog } from "./types";

export const MVP_SKILL_CATALOG = {
  skills: [
    {
      skillId: "skill-core-identity",
      displayName: "Core Identity",
      module: "coreIdentity",
      summary: "Stabilizes the agent around its declared operating pattern.",
      energyCost: 1,
      effect: {
        category: "defense",
        defenseAmount: 3
      }
    },
    {
      skillId: "skill-signal-exposure",
      displayName: "Signal Exposure",
      module: "memory",
      summary: "Surfaces remembered patterns so the agent can read the arena state.",
      energyCost: 2,
      effect: {
        category: "disrupt",
        basePower: 2,
        energyDamage: 2
      }
    },
    {
      skillId: "skill-logic-drift",
      displayName: "Logic Drift",
      module: "memory",
      summary: "Lets the agent adjust its recall path when pressure shifts.",
      energyCost: 2,
      effect: {
        category: "recovery",
        recoveryAmount: 5
      }
    },
    {
      skillId: "skill-null-pulse",
      displayName: "Null Pulse",
      module: "sigilSecurity",
      summary: "Dampens incoming pressure through a fictional sigil response.",
      energyCost: 2,
      effect: {
        category: "defense",
        defenseAmount: 5
      }
    },
    {
      skillId: "skill-signal-breach",
      displayName: "Signal Breach",
      module: "sigilSecurity",
      summary: "Tests the opposing signal pattern using fictional arena pressure.",
      energyCost: 3,
      effect: {
        category: "disrupt",
        basePower: 4,
        energyDamage: 2
      }
    },
    {
      skillId: "skill-sigil-rule",
      displayName: "Sigil Rule",
      module: "rules",
      summary: "Reinforces one declared rule before the next exchange.",
      energyCost: 1,
      effect: {
        category: "defense",
        defenseAmount: 2
      }
    },
    {
      skillId: "skill-override-pulse",
      displayName: "Override Pulse",
      module: "rules",
      summary: "Redirects the agent toward its highest-priority fictional rule.",
      energyCost: 4,
      effect: {
        category: "attack",
        basePower: 7
      }
    },
    {
      skillId: "skill-logic-storm",
      displayName: "Logic Storm",
      module: "strategy",
      summary: "Applies coordinated strategic pressure for the current turn.",
      energyCost: 5,
      effect: {
        category: "attack",
        basePower: 9
      }
    }
  ]
} as const satisfies SkillCatalog;
