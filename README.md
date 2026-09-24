# AGENT ARENA

An **agent evaluation framework** that measures and **diagnoses** agent decision quality against exact ground truth. The robot battle is the **reference environment** — not the end product.

Configure agent design choices. Run them in a deterministic battle environment. See which decisions were suboptimal, by how much, and why — cited to an exact oracle.

**Published negative result (held-out adversarial):** grounding changed **0** decisions on the historical pre-dedupe suite (D-024 falsified; D-030). Current held-out adversarial suite is **n=13** distinct states (D-035) — **insufficient evidence** to rank models (Wilson intervals too wide). Heldout-ext **n=35** (D-044) meets the evidence gate; Wilson rows and regret: see [EVAL.md](EVAL.md). Pinned gemini ablation and bench rows: see [EVAL.md](EVAL.md).

**Status:** Engine through Evidence+Ship (ES), **Batch 3** (D-049), **D-050** ([PR #38](https://github.com/Settar-Mengli/robot-agent-arena/pull/38)), **Batch 4 / D-051** robustness + BYOK/leaderboard ([PR #39](https://github.com/Settar-Mengli/robot-agent-arena/pull/39)), and **Batch 5:** second headless reference environment (Resonance Seal) proves EnvironmentOf via a shared evaluateChoices path (keyless baselines only). **Batch 4 result (this robot battle, this test set, these two models):** rewording, a rumor, and extra facts did not change choices; Groq’s same-question-twice wobble was 1/35 — see [Methodology](src/ui/methodology/MethodologyView.tsx) / [EVAL.md](EVAL.md). Pages demo: `https://settar-mengli.github.io/robot-agent-arena/` — **static** recorded evidence; live AI is **opt-in BYOK** (OpenRouter) and never ranked. **Next:** final polish (screenshots, demo video, issue #28).

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

- ~~localStorage persistence (one save slot)~~ — **done** (Batch 3 / B.4)

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
npm run lab:pack    # regenerate Decision Lab evidence pack (v3)
npm run arena:pack  # regenerate Watch arena-replay.v1.json
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

**DONE:** `src/ui` save slot (B.4); Watch-recorded LLM Arena (B.3). Measurement core uses `src/env`; Decision Lab shared types live in `src/decision-lab/`.

## Testing

```bash
npm test
npm run coverage
```

The engine is covered by a comprehensive Vitest suite, including seam-parity tests that prove the interactive turn path matches full-match simulation. Agent/inference tests inject mocks (no live network). GitHub Actions CI runs `typecheck`, `lint`, `coverage`, and `eval:replay -- --suite all` on every pull request and on pushes to `main`.

**Issue #28 / `SNAPSHOT_DRIFT`:** drift-guard tests run only when `SNAPSHOT_DRIFT=1` (CI drift job). If that variable is left set in your shell, plain `npm test` will execute the long regenerators and can hit vitest `Timeout calling "onTaskUpdate"` worker errors even when assertions pass. Clear it first:

```powershell
Remove-Item Env:SNAPSHOT_DRIFT -ErrorAction SilentlyContinue
```

Vitest prints a startup warning when `SNAPSHOT_DRIFT=1` outside CI.

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Status / roadmap (D-033 — 11 batches)

1. **Done:** Discrimination + parked fixes
2. **Done:** M-TOOLS grounding/memory ablation (D-024 falsified)
3. **Done:** M-BENCH headless
4. **Done:** Correctness hardening (A1/A2)
5. **Done:** Environment interface + port (A3)
6. **Done:** UI part 1 — scaffolding + Builder (B.1)
7. **Done:** UI part 2 — Arena + results (B.2); **B.2d** Decision Lab; **ES**; **Batch 3** (B.3 Watch / B.4 save / batch-8 diagnostics / Lab challenge) — D-049
8. Diagnostic layer — **done** in Batch 3 (pack v3 + Lab Diagnostics); three new measurements remain batch **9**
9. Three new measurements (pre-register before implement)
10. BYOK + committed static leaderboard + methodology writeup
11. Second reference environment + publish

Order locked in [D-033](DECISIONS.md); Batch 3 [D-049](DECISIONS.md); ES [D-048](DECISIONS.md).

Track progress in [PROGRESS.md](PROGRESS.md) and scope in [ROADMAP.md](ROADMAP.md).

## Original work / theme

All robots, skills, and lore are original. Security-related gameplay uses safe fictional mechanics and approved vocabulary only — no real hacking content or copying of other games’ assets, characters, or moves. See [AGENT_RULES.md](AGENT_RULES.md).

**Pages security:** the demo ships a Content-Security-Policy meta (scripts/styles from `'self'`; `connect-src` limited to `'self'` and `https://openrouter.ai`) and `referrer: strict-origin-when-cross-origin`. OpenRouter still receives an explicit `HTTP-Referer` header from the live client (not the browser’s default referrer). GitHub Pages cannot set `frame-ancestors` via HTTP headers or CSP meta — residual clickjacking risk is low for this static demo.

## License

[MIT](LICENSE)

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — layers, engine contract, types, battle flow
- [DECISIONS.md](DECISIONS.md) — why the architecture is locked the way it is
- [EVAL.md](EVAL.md) — metrics, baselines, published findings
