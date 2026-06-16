# DECISIONS

## Decision Log Format
Each entry includes ID, date, status, decision, rationale, and consequences.

## D-001 Naming Policy
Date: 2026-06-04  
Status: Accepted

Decision:
Keep the repository name as robot-agent-arena and use AGENT ARENA as the temporary app title. Record ARCZOLVEX as a pending final-name candidate only.

Rationale:
ARCZOLVEX is not legally finalized yet.

Consequences:
No repository rename and no public app rename until legal confirmation is complete.

## D-002 Architecture Priority
Date: 2026-06-04  
Status: Accepted

Decision:
Follow engine first, UI second.

Rationale:
This sequencing protects deterministic, testable game logic before interface complexity is added.

Consequences:
Implementation planning prioritizes engine domain and battle flow before React screen development.

## D-003 Engine Purity Boundary
Date: 2026-06-04  
Status: Accepted

Decision:
Keep `src/engine` pure TypeScript with no React, browser APIs, Zustand imports, DOM access, storage APIs, or network APIs.

Rationale:
Strict separation improves maintainability, testability, and portability.

Consequences:
All future implementation and code review must enforce this boundary.

## D-004 Session-Based Battle Requirement
Date: 2026-06-04  
Status: Accepted

Decision:
Use a session-based battle engine with `initBattle`, `submitPlayerAction`, `isBattleOver`, `finalizeBattle`, and deterministic simulation support.

Rationale:
Interactive turn flow requires persisted session state between actions.

Consequences:
Session lifecycle, transition rules, and deterministic state updates are core engine contracts.

## D-005 Technology Stack Lock
Date: 2026-06-04  
Status: Accepted

Decision:
Use React + Vite, TypeScript strict mode, Tailwind CSS, Zustand, Vitest, and localStorage for MVP persistence. Defer deployment choice to later between Vercel and Netlify.

Rationale:
This stack supports fast iteration, clear state flow, and strong testability.

Consequences:
Alternative frameworks are out of scope unless explicitly re-decided.

## D-006 MVP Scope Lock
Date: 2026-06-04  
Status: Accepted

Decision:
MVP includes 4 screens, 5 modules, 8 skills, player naming, 2 CPU opponents, 1 localStorage save slot, max 20 turns, seeded RNG, and post-match report output using fictional vocabulary only.

Rationale:
A strict MVP boundary is needed to keep delivery focused and achievable.

Consequences:
Scope expansion requests are deferred unless explicitly approved.

## D-007 Non-MVP Exclusions
Date: 2026-06-04  
Status: Accepted

Decision:
Exclude online multiplayer, real-time battle, node graph builder, visual robot customization, sound, campaign, leaderboards, tools module, mobile layout, and public final branding from MVP.

Rationale:
Exclusions reduce delivery risk and protect timeline focus.

Consequences:
Excluded features move to post-MVP backlog only.

## D-008 Safety Vocabulary Standard
Date: 2026-06-04  
Status: Accepted

Decision:
Use fictional player-facing terms: Signal Breach, Null Pulse, Override Pulse, Core Identity, Logic Storm, Sigil Rule, Signal Exposure, and Logic Drift.

Rationale:
The project must remain educational, fictional, and safe.

Consequences:
Player-facing text must be reviewed for vocabulary compliance before release.

## D-009 Engine Ownership Boundaries
Date: 2026-06-16  
Status: Accepted

Decision:
Keep canonical engine data in dedicated data files, runtime validation in `validation.ts`, and session lifecycle transitions in `session.ts`.

Rationale:
Separate ownership avoids duplicated validators and prevents data definitions from accumulating battle-resolution behavior.

Consequences:
Canonical catalog data remains data-only, validation stays pure TypeScript, and session code delegates shape/catalog checks before creating or transitioning sessions.
