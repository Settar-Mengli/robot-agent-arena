# AGENT ARENA

An **agent evaluation framework** that measures and **diagnoses** agent decision quality against exact ground truth. The robot battle is the **reference environment** — not the end product.

Configure agent design choices. Run them in a deterministic battle environment. See which decisions were suboptimal, by how much, and why — cited to an exact oracle.

**Published negative result (held-out adversarial, n=20):** grounding changed **0/20** decisions (D-024 falsified). Greedy: **0%** optimal / mean regret **104.35**. LLM (failover mixture): **5%** / **4.25**. Details in [EVAL.md](EVAL.md).

**Status:** Engine, multi-provider inference client, agent layer (LLM turn + greedy baseline), eval harness, grounding ablation, and environment interface are complete. **UI:** Builder, Arena (greedy CPU opponent), results, and **Decision Lab** (offline evidence pack — Browse / Inspector / Compare) ship on main. Next: **B.3** fixture-replayed LLM Arena → **B.4** save slot. Full diagnostic batch (locked 8 / C), BYOK leaderboard, and a second reference environment remain **planned**. Live multi-provider BYOK play is **not** promised (OpenRouter-only if live play ships; default is deterministic CPU + fixture replay).

## What it is

AGENT ARENA measures agent decision quality in a seeded, pure TypeScript battle environment (identical setups → identical resolution). Identity, memory, tools/skills, guardrails/rules, and strategy are the design surface; the engine is the first **reference environment** behind a planned environment interface (D-033). Binding honesty: every public conclusion must trace to a measurement (D-020 / D-031 / D-033). Fictional vocabulary only; no real-world attack, jailbreak, or prompt-injection content.

Temporary product title: **AGENT ARENA**. Repository name: `robot-agent-arena`. See [DECISIONS.md](DECISIONS.md) for naming policy.

## Tech stack

**In use today**

- TypeScript (strict)
- Vite
- Vitest (+ `@vitest/coverage-v8`)
- ESLint 10 (flat config, engine-purity and layer-boundary rules)
- React + Tailwind CSS + Zustand

**Planned**

- localStorage persistence (one save slot) — execution **B.4**, not shipped

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

**PLANNED (UI batches):** `store/`, `components/` / screens, and a thin `lib/` bridge. Those directories do not exist yet. Measurement core will depend on an environment interface; the game is the first implementation (D-033).

## Testing

```bash
npm test
npm run coverage
```

The engine is covered by a comprehensive Vitest suite, including seam-parity tests that prove the interactive turn path matches full-match simulation. Agent/inference tests inject mocks (no live network). GitHub Actions CI runs `typecheck`, `lint`, `coverage`, and `eval:replay -- --suite all` on every pull request and on pushes to `main`.

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Status / roadmap (D-033 — 11 batches)

1. **Done:** Discrimination + parked fixes
2. **Done:** M-TOOLS grounding/memory ablation (D-024 falsified)
3. **Done:** M-BENCH headless
4. **Done:** Correctness hardening (A1/A2)
5. **Done:** Environment interface + port (A3)
6. **Done:** UI part 1 — scaffolding + Builder (B.1)
7. **Done:** UI part 2 — Arena + results (B.2); **B.2d** Decision Lab (partial diagnostics — not batch 8)
8. Diagnostic layer (headless first, then UI) — **not started** (B.2d is a partial slice only)
9. Three new measurements (pre-register before implement)
10. BYOK + committed static leaderboard + methodology writeup
11. Second reference environment + publish

Execution follow-ups after B.2d: **B.3** fixture-replayed LLM Arena → **B.4** save slot. Coach is **cut** (unmeasured-if-UI-only contradicts D-018 / D-023). Order locked in [D-033](DECISIONS.md) with B.2d amend [D-043](DECISIONS.md).

Track progress in [PROGRESS.md](PROGRESS.md) and scope in [ROADMAP.md](ROADMAP.md).

## Original work / theme

All robots, skills, and lore are original. Security-related gameplay uses safe fictional mechanics and approved vocabulary only — no real hacking content or copying of other games’ assets, characters, or moves. See [AGENT_RULES.md](AGENT_RULES.md).

## License

[MIT](LICENSE)

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — layers, engine contract, types, battle flow
- [DECISIONS.md](DECISIONS.md) — why the architecture is locked the way it is
- [EVAL.md](EVAL.md) — metrics, baselines, published findings
