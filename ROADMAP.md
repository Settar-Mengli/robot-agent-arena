# ROADMAP

## Product Direction
- Repo and folder name: robot-agent-arena.
- Temporary app title: AGENT ARENA.
- Pending final-name candidate: ARCZOLVEX.
- ARCZOLVEX must remain a candidate only until legal finalization is complete.
- AGENT ARENA is a 1v1 turn-based robot fighting game where players build, name, and configure robot agents.

## MVP Scope
- Engine-first, UI-second implementation.
- Pure TypeScript battle engine.
- Session-based 1v1 battle flow.
- 4 screens: Home, Builder, Arena, Report.
- 5 modules: Core Identity, Memory, Sigil and Security, Rules, Strategy.
- 8 canonical skills.
- Player agent naming.
- 2 CPU opponents: FRACTURE and SENTINEL-X.
- 1 localStorage save slot.
- Max 20 turns.
- Seeded RNG.
- Post-match report output using fictional vocabulary only.

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
- Implement `initBattle`, `submitPlayerAction`, `isBattleOver`, and `finalizeBattle`.
- Validate session lifecycle inputs and state transitions.
- Add canonical MVP skill catalog and agent config validation.
- Enforce max 20-turn limit and MVP skill-slot limit.

### M3: Simulation and Testability
- Implement deterministic full-match simulation behavior.
- Add unit tests for deterministic behavior, boundary cases, and battle completion.
- Validate consistency between session flow and simulation flow.

### M4: Combat Engine Vertical Slice
- Implement deterministic combatant state, action resolution, and outcome rules.
- Resolve complete battle simulations into ordered turn histories.
- Keep combat, outcome, simulation, validation, and session lifecycle ownership separate.

### M5: UI Integration Layer
- Build state/store integration with strict separation from engine logic.
- Implement 4 MVP screens and core interaction loops.
- Ensure UI calls store and lib functions only for workflows.

### M6: Persistence and Reporting
- Add one local save slot using localStorage.
- Implement post-match report content with fictional vocabulary.
- Validate complete MVP flow from Home to Report.

## Explicit Non-Goals
- Online multiplayer.
- Real-time battle.
- Node graph builder.
- Visual robot customization.
- Sound.
- Campaign.
- Leaderboards.
- Tools module.
- Mobile layout.
- Public final branding.
- Real-world attack, jailbreak, or prompt-injection content.

## MVP Completion Criteria
- All required engine functions are present and tested.
- Deterministic outcomes are produced with identical seeds and inputs.
- Canonical skill catalog and agent configs are validated before battle sessions start.
- 4 MVP screens are connected through a full battle flow.
- FRACTURE and SENTINEL-X are selectable and functional CPU opponents.
- Report output uses fictional vocabulary and avoids prohibited terms.
- No non-MVP features are shipped.
