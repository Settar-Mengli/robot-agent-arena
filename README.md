# AGENT ARENA

Configure an AI agent’s design choices. Run them in a deterministic battle environment. See measurable consequences.

**Status:** Engine, multi-provider inference client, agent layer (LLM turn + greedy baseline), eval harness (match/snapshot suites, oracle, recorded fixtures, CLI), and M-TOOLS grounding ablation are complete. Held-out LLM results and the adversarial ablation are published in [EVAL.md](EVAL.md). Next is **M-BENCH**; UI remains later.

## What it is

AGENT ARENA is an interactive agent-design sandbox that teaches AI-agent engineering by making design choices produce measurable outcomes. You configure identity, memory, tools/skills, guardrails/rules, and strategy; the pure TypeScript battle engine is the environment (seeded RNG, identical setups → identical resolution). Evals, decision traces, and an explanatory post-match report show which choices moved the result — not a course or LMS, just consequence plus a concise readout (D-020). Fictional vocabulary only; no real-world attack, jailbreak, or prompt-injection content.

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
- ESLint 10 (flat config, engine-purity and layer-boundary rules)

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

Optional local LLM keys: copy [`.env.example`](.env.example) to `.env` and fill values. **Tests do not need keys** — they inject `env` and `fetch` via options.

Useful scripts (from `package.json`):

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # vitest run
npm run coverage    # vitest run --coverage
npm run test:watch  # vitest
npm run dev         # vite (no app UI yet)
npm run eval        # baseline eval (no keys)
npm run eval:report # baseline + refresh EVAL.md block
npm run eval:replay # LLM via recorded fixtures
npm run eval:record # local only — writes fixtures (needs keys)
```

## Evals

Headless harness under `src/eval/` (D-018 / D-023). Committed baseline lives in [EVAL.md](EVAL.md). **No API keys needed** for `npm run eval` / `eval:report` (random + greedy). LLM path uses recorded fixtures in CI; `eval:record` / live are local-only.

Additional CLI flags (via `node scripts/run-ts.mjs src/eval/cli.ts` or the `npm run eval:*` scripts):

- `--mode discriminate` — keyless environment discrimination report (random / greedy / optimal)
- `--snapshot-suite standard|pivotal|adversarial` — which snapshot suite to evaluate
- `--variants base,grounded` (etc.) — prompt-variant ablation arms

CI runs `npm run eval:replay -- --suite all` after coverage (keyless fixture replay).

## Project structure

```
src/
  engine/          # Pure battle engine (types, constants, skills, validation, combat, …)
  data/            # CPU opponent catalog (FRACTURE, SENTINEL-X)
  inference/       # Multi-provider OpenAI-compatible LLM client
  agent/           # LLM opponent turn, validation, decision trace, greedy baseline
  eval/            # Match/snapshot suites, oracle, metrics, CLI
  __tests__/       # Vitest suite
evals/             # Committed snapshot suites + fixture store
scripts/           # run-ts.mjs (Vite runnerImport)
EVAL.md            # Metric definitions + committed baseline
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

The engine is covered by a comprehensive Vitest suite, including seam-parity tests that prove the interactive turn path matches full-match simulation. Agent/inference tests inject mocks (no live network). GitHub Actions CI runs `typecheck`, `lint`, `coverage`, and `eval:replay -- --suite all` on every pull request and on pushes to `main`.

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Status / roadmap

1. **Done:** Pure TypeScript battle engine, inference client (M-INF), agent turn + greedy baseline (M-AGENT), eval harness (M-EVAL), grounding + memory tools with measured ablation (M-TOOLS; D-024 falsified)
2. **Next:** M-BENCH (model comparison bench)
3. **Later:** M-UI — Builder + Arena, then Report + coach + bench surfacing (React/Tailwind/Zustand not installed yet; serverless proxy deferred to M-UI)

Track progress in [PROGRESS.md](PROGRESS.md) and scope in [ROADMAP.md](ROADMAP.md). Order locked in [D-025](DECISIONS.md) as amended.

## Original work / theme

All robots, skills, and lore are original. Security-related gameplay uses safe fictional mechanics and approved vocabulary only — no real hacking content or copying of other games’ assets, characters, or moves. See [AGENT_RULES.md](AGENT_RULES.md).

## License

[MIT](LICENSE)

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — layers, engine contract, types, battle flow
- [DECISIONS.md](DECISIONS.md) — why the architecture is locked the way it is
