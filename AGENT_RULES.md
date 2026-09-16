# AGENT_RULES

## Purpose
Operational rules for contributors and coding agents working in this repository.

## Approval Rules
Ask before installing packages, deleting files, renaming files or folders, changing locked architecture, modifying README.md, or running dependency/security fixes.

## Product And Branding
- Repository remains robot-agent-arena until further notice.
- Temporary app title is AGENT ARENA.
- ARCZOLVEX is a pending candidate name only.
- Do not publish or rename publicly to ARCZOLVEX until legal finalization is confirmed.

## Safety Rules
- Do not reference other commercial fighting-game franchises or their characters, moves, or assets.
- Do not copy existing game assets, characters, moves, names, UI, music, or story.
- Keep security-related gameplay language fictional, educational, and safe.
- Avoid real hacking, jailbreak, and prompt-injection terminology in player-facing text.
- Use approved fictional vocabulary for player-facing safety concepts.

## Architecture Rules
- Engine first, UI second.
- `src/engine` must stay pure TypeScript.
- No React, Zustand, DOM, localStorage, window, document, browser, or network APIs inside `src/engine`.
- Game logic never belongs inside React components.
- Data definitions must not contain battle-resolution algorithms.
- Validation must not contain battle-resolution behavior.
- `session.ts` owns lifecycle transitions only.
- Avoid circular imports and excessive file splitting.

## Scope Rules
- Keep the MVP to 4 screens, 5 modules, 8 skills, 2 CPU opponents, one save slot, max 20 turns, seeded RNG, and fictional report output.
- Do not add online multiplayer, real-time battle, node graph builder, visual customization, sound, campaign, leaderboards, tools module, mobile layout, or public final branding unless explicitly approved.
- Do not run `npm audit fix`, dependency upgrades, or package installation unless explicitly approved.

## Process Rules
- Check ROADMAP, PROGRESS, DECISIONS, and AGENT_RULES before starting implementation.
- Record major tradeoffs and scope changes in DECISIONS.
- Keep PROGRESS updated with current state, changed files, test status, blockers, and exact next step.
- Prefer the smallest viable increment while preserving architecture boundaries.
