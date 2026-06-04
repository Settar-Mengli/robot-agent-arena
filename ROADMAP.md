# ROADMAP

## Project Identity
- Repo and folder name: robot-agent-arena
- Temporary app title: AGENT ARENA
- Pending final-name candidate: ARCZOLVEX
- Naming policy: ARCZOLVEX is recorded as a candidate only until legal finalization is complete. Do not rename the repo or public app yet.

## Project Concept
AGENT ARENA is a 1v1 turn-based robot fighting game where players build, name, and configure robot agents.

The player configures fictional systems inspired by agent architecture:
- Core Identity
- Memory
- Sigil and Security
- Rules
- Strategy
- Skills

Battle flow is session-based. The player chooses one move per turn. The CPU chooses moves based on its configuration. The game teaches robust agent design through fictional battle consequences.

## Legal and Safety Constraints
- Do not reference Tekken in public-facing files.
- Do not copy existing game assets, characters, moves, names, UI, music, or story.
- Keep all security concepts fictional, educational, and safe.
- Do not use real hacking, jailbreak, or prompt-injection terminology in player-facing text.

## Fictional Vocabulary Standard
Use these terms in player-facing text:
- Signal Breach
- Null Pulse
- Override Pulse
- Core Identity
- Logic Storm
- Sigil Rule
- Signal Exposure
- Logic Drift

## Locked Technology Direction
- React + Vite
- TypeScript strict mode
- Tailwind CSS
- Zustand
- Vitest
- localStorage for MVP
- Deployment later to Vercel or Netlify

## Locked Architecture
- Engine first, UI second.
- Engine must be pure TypeScript.
- No React, browser APIs, or Zustand imports inside src/engine.
- Game logic must never live inside React components.
- UI renders state and calls lib/store functions only.
- Session-based battle engine is required.

Required engine concept:
- initBattle(configA, configB, seed)
- submitPlayerAction(session, skillId)
- isBattleOver(session)
- finalizeBattle(session)
- resolveBattle(configA, configB, seed) remains planned for tests and simulations.

## MVP Scope
- 4 screens: Home, Builder, Arena, Report
- 5 modules: Core Identity, Memory, Sigil and Security, Rules, Strategy
- 8 skills
- Player names their agent
- 2 CPU opponents: FRACTURE and SENTINEL-X
- 1 localStorage save slot
- Max 20 turns
- Seeded RNG
- Post-match report uses fictional vocabulary only

## Explicitly Not MVP
- Online multiplayer
- Real-time battle
- Node graph builder
- Visual robot customization
- Sound
- Campaign
- Leaderboards
- Tools module
- Mobile layout
- Public final branding

## Milestones

### M0: Foundation and Governance
- Establish project memory files and constraints baseline.
- Confirm naming policy, safety vocabulary, and MVP boundaries.
- Freeze non-MVP items unless explicitly approved later.

### M1: Engine Domain Model
- Define engine data types for agent config, skill, turn state, match state, and outcome.
- Define deterministic seeded RNG behavior and turn caps.
- Keep all logic framework-agnostic and pure TypeScript.

### M2: Session Battle Core
- Implement session lifecycle: initBattle, submitPlayerAction, isBattleOver, finalizeBattle.
- Enforce one player action per turn and max 20-turn limit.
- Add CPU move selection based on configuration and strategy.

### M3: Simulation and Testability
- Implement resolveBattle for deterministic full-match simulation.
- Add unit tests for deterministic behavior, boundary cases, and battle completion.
- Validate consistency between session flow and simulation flow.

### M4: UI Integration Layer
- Build state/store integration with strict separation from engine logic.
- Implement 4 MVP screens and core interaction loops.
- Ensure UI calls store and lib functions only for workflows.

### M5: Persistence and Reporting
- Add one local save slot using localStorage.
- Implement post-match report content with fictional vocabulary.
- Validate complete MVP flow from Home to Report.

## MVP Completion Criteria
- All required engine functions are present and tested.
- Deterministic outcomes are produced with identical seeds and inputs.
- 4 MVP screens are connected through a full battle flow.
- FRACTURE and SENTINEL-X are selectable and functional CPU opponents.
- Report output uses fictional vocabulary and avoids prohibited terms.
- No non-MVP features are shipped.
