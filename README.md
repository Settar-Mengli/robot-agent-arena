# AGENT ARENA

An **agent evaluation framework** that measures and **diagnoses** agent decision quality against exact ground truth. The robot battle is the **reference environment** — not the end product.

Configure agent design choices. Run them in a deterministic battle environment. See which decisions were suboptimal, by how much, and why — cited to an exact oracle.

**Published negative result (held-out adversarial):** grounding changed **0** decisions on the historical pre-dedupe suite (D-024 falsified; D-030). Current held-out adversarial suite is **n=13** distinct states (D-035); greedy **0%** optimal / mean regret **156.15**. Pinned gemini ablation and bench rows: see [EVAL.md](EVAL.md).

**Status:** Engine, multi-provider inference client, agent layer, eval harness, grounding ablation, environment interface, and **UI** (Builder, Arena greedy CPU, results, Decision Lab) ship on main. **Next:** execution **Evidence+Ship (ES)** — multi-model evidence, CIs, extended suite, GitHub Pages (`https://settar-mengli.github.io/robot-agent-arena/`) — then **B.3** fixture-replayed LLM Arena → **B.4** save slot. Full diagnostic batch (locked 8 / C), BYOK, and a second reference environment remain **planned**. The Pages/app demo is a **static** site with **recorded** evidence — **no live AI** in the browser. Live multi-provider BYOK play is **not** promised (OpenRouter-only if live play ships).

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
npm run dev         # vite (Builder / Arena / Lab UI)
npm run eval        # baseline eval (no keys)
npm run eval:report # baseline + refresh EVAL.md block
npm run eval:replay # LLM via recorded fixtures
npm run eval:record # local only — writes fixtures (needs keys)
npm run lab:pack    # regenerate Decision Lab evidence pack
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

**PLANNED:** `src/ui` save slot (B.4); fixture-replayed LLM Arena (B.3). Measurement core uses `src/env`; Decision Lab shared types live in `src/decision-lab/`.

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
7a. Evidence + Ship (ES) — CIs, ext suite, multi-model, Pages — **in progress**
8. Diagnostic layer (headless first, then UI) — **not started** (B.2d/ES are partial slices only)
9. Three new measurements (pre-register before implement)
10. BYOK + committed static leaderboard + methodology writeup
11. Second reference environment + publish

Execution follow-ups: **ES** → **B.3** fixture-replayed LLM Arena → **B.4** save slot. Coach is **cut**. Order locked in [D-033](DECISIONS.md) with B.2d [D-043](DECISIONS.md) and ES [D-048](DECISIONS.md).

Track progress in [PROGRESS.md](PROGRESS.md) and scope in [ROADMAP.md](ROADMAP.md).

## Original work / theme

All robots, skills, and lore are original. Security-related gameplay uses safe fictional mechanics and approved vocabulary only — no real hacking content or copying of other games’ assets, characters, or moves. See [AGENT_RULES.md](AGENT_RULES.md).

## License

[MIT](LICENSE)

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — layers, engine contract, types, battle flow
- [DECISIONS.md](DECISIONS.md) — why the architecture is locked the way it is
- [EVAL.md](EVAL.md) — metrics, baselines, published findings
