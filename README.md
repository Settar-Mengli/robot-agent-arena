# AGENT ARENA

Build configurable AI-agent robots. Win 1v1 turn-based battles that resolve deterministically.

**Status:** Engine complete and fully tested. UI milestone is next (not started in-repo).

## What it is

AGENT ARENA is an educational robot fighting game. You design an agent’s modules and skills; the pure TypeScript engine resolves battles with a seeded RNG so identical setups produce identical outcomes. Gameplay consequences teach sound agent design without real-world attack, jailbreak, or prompt-injection content.

Temporary product title: **AGENT ARENA**. Repository name: `robot-agent-arena`. See [DECISIONS.md](DECISIONS.md) for naming policy.

## Live demo

_Coming with the UI milestone._

## Screenshots

_Screenshots coming with the UI._

## Tech stack

**In use today**

- TypeScript (strict)
- Vite
- Vitest (+ `@vitest/coverage-v8`)
- ESLint 10 (flat config, engine-purity rules on `src/engine/**`)

**PLANNED for UI (not installed yet)**

- React
- Tailwind CSS
- Zustand
- localStorage persistence (one save slot)

## Getting started

```bash
git clone https://github.com/Settar-Mengli/robot-agent-arena.git
cd robot-agent-arena
npm install
```

Useful scripts (from `package.json`):

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # vitest run
npm run coverage    # vitest run --coverage
npm run test:watch  # vitest
npm run dev         # vite (no app UI yet)
```

## Project structure

```
src/
  engine/          # Pure battle engine (types, constants, skills, validation, combat, …)
  __tests__/       # Vitest suite
ARCHITECTURE.md    # Design reference (read this for depth)
DECISIONS.md       # Locked decisions and rationale
ROADMAP.md         # MVP scope and milestones
PROGRESS.md        # Current status
AGENT_RULES.md     # Contributor / agent operating rules
```

**PLANNED (UI milestone):** `store/`, `components/` / screens, and a thin `lib/` bridge. Those directories do not exist yet.

## Testing

```bash
npm test
npm run coverage
```

The engine is covered by a comprehensive Vitest suite, including seam-parity tests that prove the interactive turn path matches full-match simulation. GitHub Actions CI runs `typecheck`, `lint`, and `coverage` on every pull request and on pushes to `main`.

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Status / roadmap

1. **Done:** Pure TypeScript battle engine, validation, seeded simulation, shared `resolveTurn`, CI + lint + coverage
2. **Next:** M5 UI (screens, store, React/Tailwind/Zustand) — packages not installed yet; CPU opponent catalog not built yet
3. **Later:** Deploy (Vercel or Netlify — deferred in D-005)

Track progress in [PROGRESS.md](PROGRESS.md) and scope in [ROADMAP.md](ROADMAP.md).

## Original work / theme

All robots, skills, and lore are original. Security-related gameplay uses safe fictional mechanics and approved vocabulary only — no real hacking content or copying of other games’ assets, characters, or moves. See [AGENT_RULES.md](AGENT_RULES.md).

## License

License: TBD

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — layers, engine contract, types, battle flow
- [DECISIONS.md](DECISIONS.md) — why the architecture is locked the way it is
