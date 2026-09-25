# AGENT ARENA — Master Project Record
**Repository:** `robot-agent-arena`  
**Product title:** AGENT ARENA  
**GitHub:** https://github.com/Settar-Mengli/robot-agent-arena  
**Live demo (GitHub Pages):** https://settar-mengli.github.io/robot-agent-arena/  
**License:** MIT  
**Version (package):** 0.1.0  
**Record date:** 2026-09-25  
**HEAD at record time (approx):** `release/final-polish` — **v0.1.0 release cut via [PR #47](https://github.com/Settar-Mengli/robot-agent-arena/pull/47) (D-055)** (builds on #46 / `ec8935d`)  
**Branch:** `release/final-polish` — v0.1.0 portfolio cut (D-055).

---

## 1. One-sentence purpose

An **agent evaluation framework** that measures and diagnoses LLM/agent decision quality against an **exact oracle** (ground truth), using a deterministic fictional robot battle as the first reference environment — not as the end product.

---

## 2. What it is / what it is not

### Is
- Measurement bench for agent design choices (identity, memory, skills/rules, strategy, prompts).
- Seeded pure-TypeScript battle engine → identical setup → identical resolution.
- Headless eval harness with committed fixtures, baselines, packs.
- Static Pages demo of **recorded** evidence; optional BYOK live AI (OpenRouter) never ranked.
- Second reference environment (Resonance Seal) proving a shared `EnvironmentOf` + `evaluateChoices` path.

### Is not
- A production multiplayer game backend.
- A general ranking of “all AI.”
- A host of model APIs (browser talks to OpenRouter only when user pastes a key).
- Real-world hacking / jailbreak / attack content (fictional vocabulary only).

---

## 3. Core thesis & published findings

**Binding honesty:** public conclusions must trace to measurements (D-020 / D-031 / D-033).

**Key published results (scoped — see EVAL.md / Methodology):**
- **D-024 falsified (D-030):** grounding changed **0** decisions on historical pre-dedupe suite.
- Held-out adversarial **n=13** (D-035): often **insufficient to rank** models (wide Wilson intervals).
- Heldout-ext **n=35** (D-044): meets evidence gate for some claims.
- **Batch 4 (D-051):** rewording, rumor, extra facts → **no measurable choice change** on that test set / those models; Groq same-question-twice wobble **1/35**.

**Visitor lesson:** diagnosis and evidence hygiene > vibes or live chat demos.

---

## 4. Tech stack

| Layer | Tech |
|--------|------|
| Language | TypeScript (strict) |
| UI | React 19, Tailwind 4, Zustand |
| Build | Vite 7 |
| Test | Vitest 3, Testing Library, coverage-v8 |
| Lint | ESLint 10 flat config (layer fences) |
| CI | GitHub Actions (ubuntu-24.04, Node 24) |
| Hosting | GitHub Pages (`VITE_BASE=/robot-agent-arena/`) |
| LLM (local/CI) | Multi-provider OpenAI-compatible client; **browser build = OpenRouter only** |

**Scripts (`package.json`):**
- `dev`, `build`, `preview:pages`
- `typecheck`, `lint`, `test`, `test:watch`, `coverage`
- `eval`, `eval:report`, `eval:replay`, `eval:record`
- `lab:pack`, `arena:pack`

---

## 5. Repository layout

```
src/
  engine/       # Pure battle engine (no RNG globals, no I/O, no React)
  data/         # CPU opponents (FRACTURE, SENTINEL-X)
  env/          # Environment interface + robot adapter + Resonance Seal
  inference/    # LLM HTTP client (Node full providers; browser OpenRouter-only alias)
  agent/        # LLM turn, prompts, grounding, greedy baseline, traces
  eval/         # Oracle, suites, metrics, CLI, pack generators
  decision-lab/ # Shared Lab types/diagnostics (no React, no eval import)
  ui/           # React app: landing, builder, arena, lab, live, leaderboard, persist
  __tests__/    # Headless / cross-cutting Vitest
evals/          # Committed suites + fixtures + out-committed summaries
scripts/        # run-ts.mjs, check-dist-urls, generators
.github/workflows/  # ci.yml, pages.yml
EVAL.md, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md, PROGRESS.md, AGENT_RULES.md
```

---

## 6. Architecture (layers)

```
data → engine
         ↑
         env (robotEnvironment + EnvironmentOf)
         ↑
inference (standalone) → agent → ui (store/screens)
eval imports env/engine/agent/inference; NOTHING imports eval from ui/env/agent
```

**ESLint fences (critical):**
- `src/engine`: no Math.random/Date.now; no React/Zustand
- `src/env`: no agent/eval/inference
- `src/agent`: no eval
- `src/ui`: no `**/eval/**`, no Node fs/path
- `src/decision-lab`: no eval, no React

**Implications:** UI cannot call `bestResponse` / `evaluateChoices` directly. Challenge scores use **precomputed pack oracle values**. Free-play human-as-player regret would need a new player-side oracle + fence change.

---

## 7. Engine contract (battle)

- Deterministic seeded RNG (`createSeededRng`).
- Player then CPU action order; unaffordable → fallback-stabilize.
- Shared orchestrator `resolveTurn` (D-012).
- Session lifecycle in `session.ts`; combat/outcome/simulation split (D-009/D-010).
- Skills: catalog in `skills.ts`; loadout slot limit; fictional modules (coreIdentity, memory, sigilSecurity, rules, strategy).

**Note:** numeric seed `0` maps to fallback constant `0x9e3779b9` (known quirk; changing breaks reproducibility).

---

## 8. Environment & evaluation

### Robot environment
`robotEnvironment`: start / apply / isTerminal / legalActions / equippedActions / terminalValue / memo & decision keys.

`terminalValue` (post-#46): non-terminal → HP differential only; terminal → ±1000 victory base + HP diff.

### Resonance Seal (Batch 5 / D-052)
Second `EnvironmentOf` env; keyless baselines only; **never compared** to robot regret scale; artifacts under `evals/env-suites/resonance-seal/`.

### Oracle
`bestResponse` = exact memoized best **CPU** response vs a **fixed player policy** (not Nash equilibrium). Node-capped (`exact: false` when exceeded).

### Suites & fixtures
- Snapshot suites: standard / pivotal / adversarial / heldout-ext, etc.
- Fixtures hashed from prompt bytes; CI keyless `eval:replay`.
- Changing grounding/prompt versions can invalidate fixtures (A2 / D-034).

### Metrics (see EVAL.md)
Optimal rate, regret (mean/median/max), Wilson intervals, insufficient evidence, discrimination (random/greedy/optimal).

---

## 9. Agent / inference

- `playAgentTurn`: observe → optional grounding/memory → LLM JSON (or freetext) → validate → stepBattle; fallback on failure.
- Prompt versions: base, grounded, grounded-v2, memory variants, Batch 4 arms (perturb, advctx, info-partial, base-repeat, freetext).
- Grounding V1 vs V2 facts; V2 preferred for corrected fallback/threat modeling.
- Greedy baseline uses engine projections (not invented combat math).
- Temperature 0 for live Arena path; keys via injected EnvMap (never process.env in live UI).

---

## 10. UI product surface

| View | Role |
|------|------|
| Home / Landing | Challenge CTA; **What we found** (Batch 4 scoped null); Play/Watch; **More ways to play** → Build + Live BYOK |
| Beat the AI / Lab | Challenge (pick vs best + recorded AI), Situations, Compare, Diagnostics |
| Watch | Recorded arena replay pack |
| Build / Setup | AgentConfig builder; battle setup; optional live panel |
| Arena / Results | Free play vs CPU or live; results + honesty |
| Leaderboard | Static pack; uncertainty bands; live never ranked |
| Methodology | How scoring works; Batch 4 findings |
| Persist | One localStorage save slot (schema-versioned) |

**Live session (D-053):** memory-only key; clear on Home/Leave/Load; Fight again keeps live; notices clear on LLM recovery; abort/generation guards (#46).

**Battle store (D-041):** `turnEpoch`; in-flight settles ignored after clear/reset.

**Default-path copy fence:** no `oracle` / `regret` / `Wilson` / skill-ids / UUIDs on non-Advanced UI (`forbidden-default-path.ts`).

---

## 11. Decision log index (D-001 … D-055)

| ID | Topic |
|----|--------|
| D-001 | Naming (AGENT ARENA vs repo name) |
| D-002–D-013 | Architecture, purity, combat, skills, orchestrator |
| D-014–D-017 | Agentic re-scope, AI seam, inference client |
| D-018–D-023 | Eval harness, determinism+LLM, methodology |
| D-024 / D-030 | M-TOOLS grounding hypothesis → falsified |
| D-025–D-033 | Product direction → evaluation framework + oracle |
| D-034–D-037 | Grounding A2, suite dedupe, pinning, env interface A3 |
| D-038–D-042 | UI fence, tsconfig, vitest, battle-view, Arena wiring |
| D-043 | *(no standalone entry — see amend under D-042)* |
| D-044–D-047 | heldout-ext, Pages, bench pin, freetext |
| D-048 | Evidence+Ship (ES) |
| D-049 | Batch 3 Watch/save/diagnostics/challenge |
| D-050 | Plain-language UX bugs |
| D-051 | Batch 4 robustness + BYOK + leaderboard + methodology (**closes locked batch 9**) |
| D-052 | Batch 5 Resonance Seal |
| D-053 | Live session lifecycle |
| D-054 | UX 2 redesign |
| D-055 | v0.1.0 portfolio cut; memory curve defer; known-limitations lock |

Full text: `DECISIONS.md`.

---

## 12. Roadmap status (D-033 eleven batches)

1–7 Done (discrimination → Arena/Lab/Batch 3).  
8 Diagnostics done (Batch 3 / D-049).  
9 Three measurements **closed under D-051** (Batch 4 robustness); memory / full scaling curve **deferred D-055**.  
10 BYOK/leaderboard/methodology shipped (D-051).  
11 Second env shipped (D-052).  
**Next (D-055):** Pages check / operator BYOK smoke after the v0.1.0 release cut ([PR #47](https://github.com/Settar-Mengli/robot-agent-arena/pull/47)); optional demo video; issue #28 (SNAPSHOT_DRIFT worker noise). Screenshots intentionally skipped for this release.

---

## 13. CI / quality gates

**Job `verify`:** typecheck, lint, build (+ Pages base), protected-path diff vs **PR base only** (skipped on push), dist URL allowlist (OpenRouter only), coverage (**no percentage thresholds**), multi-model `eval:replay`. F15 demo visible-copy tests run in the **ui** Vitest project on verify.

**Protected paths (cannot casually edit in PRs):** `src/engine`, prompts, fixtures, lab/arena packs, many `evals/out-committed/*`, `env-robot.test.ts`, lockfiles, etc.

**Job `drift`:** SNAPSHOT_DRIFT regenerators (slow); some steps use `--dangerouslyIgnoreUnhandledErrors` (issue #28).

**Pages:** separate workflow deploy.

---

## 14. Security & safety

- Fictional combat vocabulary only (D-008 / AGENT_RULES).
- BYOK: key never in localStorage/URL/logs; CSP meta; `connect-src` self + openrouter.ai.
- Browser bundle strips non-OpenRouter provider URLs.
- No serverless proxy in current product (earlier D-016 context superseded by BYOK client-side).

---

## 15. How to run (operators)

```bash
npm install
npm run dev          # UI
npm test
npm run typecheck
npm run eval         # keyless baselines
npm run eval:replay -- --suite all --models gemini:gemini-3.5-flash-lite
```

Clear `SNAPSHOT_DRIFT` locally before plain `npm test` if set.

Optional `.env` from `.env.example` for `eval:record` / live keys — tests inject mocks.

---

## 16. Notable merged PRs (recent)

Baseline for **D-055** is **#46** on main lineage; **v0.1.0 release cut shipped via [PR #47](https://github.com/Settar-Mengli/robot-agent-arena/pull/47) (D-055)**.

| PR | Title |
|----|--------|
| #47 | final polish — insight loop, lifecycle races, D-055 docs (v0.1.0 release cut) |
| #46 | battle leave races, persist guards, terminalValue (grounding V2 reverted for lab-pack fence) |
| #45 | arena usability / responsive UI |
| #44 | CSP + SHA-pinned actions |
| #43–#42 | Final polish 1–2 |
| #41 | Bug-hunt D-053 lifecycle |
| #40 | Batch 5 Resonance Seal |
| #39 | Batch 4 robustness/BYOK |
| #38 | D-050 plain UX |
| #37 | Batch 3 Watch/save/challenge |

---

## 17. Known limitations & deferred tech debt (D-055)

- Seed `0` ↔ fallback RNG constant `0x9e3779b9` (repro lock).
- Duplicate agent `skillIds`: **not** deduped in engine — persist/Builder only for v0.1.0.
- Grounding **V1** unaffordable still shows projected damage; V2 deferred (protected pack bytes).
- `legalActions` vs oracle enumeration (D-037); CPU uses pre-player energy context.
- Env `nextInt`: **`span ≤ 0` throws** (fixed this release); **modulo bias for `span ≥ 1` remains accepted** (Seal baselines).
- Memory variants and full information-scaling curve **unmeasured** (D-055 defer).
- Free-play Results cannot show true player-vs-oracle regret without new oracle + UI fence exception.
- Small-n / seed correlation known (D-026 won’t-fix for some items); committed held-out adversarial **n=13** (historical 0/20 is narrative-only).
- Issue #28 drift worker timeouts.
- Screenshots intentionally **skipped** for v0.1.0; capture plan remains in `docs/media/SHOT-LIST.md` (not captured).

---

## 18. Working tree at record time

**v0.1.0 release cut shipped via [PR #47](https://github.com/Settar-Mengli/robot-agent-arena/pull/47) (D-055)** — visitor insight loop + lifecycle fixes + docs; screenshots skipped. Post-merge: Pages check and operator BYOK smoke.

---

## 19. Canonical docs (read in this order)

1. README.md — entry  
2. ARCHITECTURE.md — layers & contracts  
3. DECISIONS.md — why (through **D-055**)  
4. EVAL.md — numbers & protocols  
5. ROADMAP.md / PROGRESS.md — status  
6. AGENT_RULES.md — contributor/agent rules  
7. **docs/AGENT-ARENA-MASTER-RECORD.md** — this consolidated operator record  
8. **docs/demo-video-script.md** — voice-over + recording checklist  
9. **docs/media/SHOT-LIST.md** — README screenshot filenames + preview:pages steps  
10. Methodology UI + Lab packs — visitor-facing evidence  

---

## 20. Value proposition (honest)

**Strong:** reproducible measurement harness, oracle-backed diagnosis, published negative results, honest live-vs-recorded separation, second-env interface proof.  
**Weak for casuals:** free play still feels like a toy unless Challenge/Methodology carry the thesis.  
**Portfolio:** excellent as an evaluation-methodology case study; not a mass-market AI ranking product.

---

*End of master record. For byte-level truth always prefer the repo files and EVAL.md over this summary.*
