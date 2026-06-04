# AGENT_RULES

## Purpose
Operational rules for all contributors and coding agents working in this repository.

## Current Phase Lock
Until explicit owner approval to start implementation:
- Do not create app code.
- Do not install packages.
- Do not create React or Vite project files.
- Do not modify README.md.
- Do not expand MVP scope.
- Do not run terminal commands unless the owner is asked first and approves.

## Approval Rules
Always ask before:
- running terminal commands
- installing packages
- deleting files
- renaming files or folders
- changing locked architecture
- committing or pushing
- modifying README.md

## Product and Branding Rules
- Repository remains robot-agent-arena until further notice.
- Temporary app title is AGENT ARENA.
- ARCZOLVEX is a pending candidate name only.
- Do not publish or rename publicly to ARCZOLVEX until legal finalization is confirmed.

## Legal and Safety Rules
- Do not reference Tekken in public-facing files.
- Do not copy any existing game assets, characters, moves, names, UI, music, or story.
- Keep security-related gameplay language fictional, educational, and safe.
- Avoid real hacking, jailbreak, and prompt-injection terminology in player-facing text.

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

## Architecture Guardrails
- Engine first, UI second.
- src/engine must stay pure TypeScript.
- No React, browser APIs, or Zustand imports inside src/engine.
- Game logic never belongs inside React components.
- UI renders state and calls lib/store functions only.
- Session-based battle engine is required.

Required engine concept:
- initBattle(configA, configB, seed)
- submitPlayerAction(session, skillId)
- isBattleOver(session)
- finalizeBattle(session)
- resolveBattle(configA, configB, seed) for tests and simulations

## Scope Guardrails (MVP Only)
Must include:
- Home, Builder, Arena, Report screens
- Core Identity, Memory, Sigil and Security, Rules, Strategy modules
- 8 skills
- Player agent naming
- FRACTURE and SENTINEL-X CPU opponents
- One localStorage save slot
- Max 20 turns
- Seeded RNG
- Post-match report with fictional vocabulary only

Must exclude:
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

## Process Rules
- Check ROADMAP, PROGRESS, and DECISIONS before starting a task.
- Record major tradeoffs and scope changes in DECISIONS.
- Keep PROGRESS updated with dated snapshots.
- If a request conflicts with these rules, stop and request owner clarification.
- Prefer the smallest viable increment while preserving architecture boundaries.

## Definition of Done for Future Implementation Tasks
- Changes align with locked architecture and MVP scope.
- Deterministic behavior is preserved where required.
- Tests are updated or added when implementation begins.
- Player-facing text follows fictional vocabulary rules.
- Documentation updates include decision and progress traceability.
