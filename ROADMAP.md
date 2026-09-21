# ROADMAP

## Product Direction
- Repo and folder name: robot-agent-arena.
- Temporary app title: AGENT ARENA.
- Pending final-name candidate: ARCZOLVEX.
- ARCZOLVEX must remain a candidate only until legal finalization is complete.
- **Strategic direction (D-033):** an **agent evaluation framework** that measures and **diagnoses** agent decision quality against exact ground truth. The robot battle is the **reference environment**, not the end product. Bring-your-own-key model bench and a published methodology are in scope. The teaching sandbox (D-020) is delivered through measurement, not assertion.
- **Engine spine (D-014, still true):** the pure TypeScript battle engine stays the untouched, tested backbone. AI is a strategy provider behind the existing `selectCpuSkillId` seam. UI renders the framework; it owns no measurement logic.
- Does not change the engine purity boundary (D-003), the agent turn contract (D-022), or the determinism boundary (D-019).

## MVP Scope
Locked stack and game shape still hold (React + Vite + TypeScript + Zustand + localStorage; turn-based; fictional vocabulary). Sequencing follows D-033’s **11 locked batches**, grouped into **5 execution batches** A–E (amend).

- Engine-first implementation (DONE).
- Pure TypeScript battle engine (DONE).
- Session-based 1v1 battle flow + interactive `startBattle` / `stepBattle` driver (DONE).
- 5 modules: Core Identity, Memory, Sigil and Security, Rules, Strategy (agent-design surface — D-020).
- 8 canonical skills; max 2 equipped (`MVP_SKILL_SLOT_LIMIT`); max 20 turns (`MAX_TURNS`).
- Player agent naming.
- 2 CPU opponents: FRACTURE and SENTINEL-X (catalog DONE).
- 1 localStorage save slot (PLANNED with UI).
- Seeded RNG (DONE; restore-from-state DONE).
- **DONE:** Eval harness (M-EVAL) with measured held-out LLM results; grounding/memory tools (M-TOOLS) with adversarial ablation published in EVAL.md (D-024 falsified; D-030).
- **DONE:** M-BENCH headless (PR #23 / D-032).
- **DONE:** Execution batch **A1** (prompt-byte-frozen hardening) — greedy→grounding proven choice-identical; MemoScope identity; CI drift job; pricing/env/sanitize; pinned tests.
- **DONE (code):** Execution batch **A2** — corrected facts as `agent-v4-grounded` / `grounded-v2`; pinned gemini ablation published (D-034 + D-036).
- **DONE (code):** **D-035** — snapshot state dedupe + honest match/sample counts. Suites regenerated (heldout adversarial **n=13**).
- **DONE (code):** **D-036** — multi-variant comparisons require `--models` pin; manifest records pin; unpinned mixture recordings are not published.
- **DONE (code):** **A3** — environment interface, adapter-only (PR #31).
- **DONE (code):** UI foundation D-038–D-041 (PR #32); execution **B.1** shell + Builder (PR #33); execution **B.2** Arena + results (D-042).
- **DONE (code):** Execution **B.2d** Decision Lab (partial diagnostic slice — not locked batch 8 / C).
- **NEXT:** Execution **Evidence+Ship (ES)** (D-048) → **B.3** fixture-replayed LLM UI → **B.4** MVP save slot.
- **PLANNED:** Diagnostics → three new measurements → BYOK + committed leaderboard + methodology writeup → second reference environment + publish.
- **CUT by D-033:** post-match coach (was in D-025 M-UI part 2). First public Report is trace-driven and cites oracle regret. A coach, if ever built, must live in `src/agent` with prompts, fixtures, and evals first (D-018 / D-023).

## Milestones

### Completed engine / infra spine
- M0–M4: Foundation, domain model, session core, simulation, combat vertical slice — DONE.
- Convergence: shared `resolveTurn`, status-only completion, min-1 skill validation — DONE.
- Interactive driver (`startBattle` / `stepBattle`) + RNG restore — DONE.
- Infra: ESLint (engine-purity), coverage, CI, ARCHITECTURE + README — DONE.
- CPU opponent catalog (FRACTURE, SENTINEL-X) — DONE.
- M-INF multi-provider OpenAI-compatible client (`src/inference/`) — DONE (serverless proxy deferred per D-016 / D-033 BYOK decision).
- M-AGENT LLM opponent turn + greedy baseline (`src/agent/`) — DONE (PR #9).
- M-EVAL eval harness (`src/eval/`, `evals/`, `EVAL.md`) — **DONE**.
- M-TOOLS grounding + memory + adversarial ablation — **DONE** (D-024 falsified; D-030).
- M-BENCH headless model bench — **DONE** (PR #23 / D-032); multi-model pending operator record.

### AI milestone spine (D-033 — 11 locked batches, 5 execution groups)

Locked batch numbers and contents are unchanged (D-033). Execution groups **A1–A3 / B–E** (D-033 amends) share one gate/audit where noted; both numberings stay in sync here and in PROGRESS.

#### 1. Discrimination + parked fixes — DONE
Environment **DISCRIMINATES** (optimal ≫ greedy). Fixture manifest + multi-provider keyless `--suite all` replay.

#### 2. M-TOOLS grounding + memory — DONE
Grounding + memory + variant ablation (D-027). Standard inconclusive; pivotal greedy-saturated (D-028); adversarial suites (D-029). Held-out adversarial: grounding changed **0/20** decisions — D-024 **falsified** (D-030). Metric choice: regret distribution with rate (D-031). Memory variants still unmeasured.

#### 3. M-BENCH headless — DONE (PR #23 / D-032)
Pinned single-model runs (`--models`, `maxProviders: 1`), repeat-aware fixture keys, failure taxonomy, cost/latency, prompt-version axis, `--mode bench` + committed `evals/out-committed/bench.summary.json`. Single-model gemini proof committed; multi-model awaits operator record.

#### 4. Correctness hardening — DONE — execution batch **A1** (prompt-byte frozen)
CI re-proves pivotal / adversarial / bench / discriminate regen (`drift` job, `SNAPSHOT_DRIFT=1`); Oracle MemoScope identity (numeric `maxTurns` + catalog); pricing for Groq pin `openai/gpt-oss-20b`; sanitize **new** fixture records only; `.env.example` `INFERENCE_*`; weak tests pin published values; greedy→grounding landed after differential proof (0 choice diffs). **Gate held:** committed numbers byte-identical. Grounding *fact* fixes are **not** in A1 — see A2 / D-034.

#### A2. Grounding correctness + ablation re-run (D-034) — DONE
Corrected facts as `agent-v4-grounded` / variant `grounded-v2` / `facts-v2`. Old `agent-v2-grounded` fixtures and D-030 preserved. Pinned gemini ablation published on post-D-035 suites (D-036).

#### 5. Environment interface + port — DONE — execution batch **A3** (adapter only)
Measurement core depends on `src/env` (`robotEnvironment`). `DecisionSnapshot.runtime` stays today’s `BattleRuntime` JSON. Committed differential proof under `SNAPSHOT_DRIFT`. **Gate held:** byte-identical artifacts. Next: A-to-Z recon, then batch B (UI).

#### 6. UI part 1 — scaffolding + Builder — locked batch 6 / execution **B.1**
**DONE.** Foundation (D-038–D-041, PR #32) + B.1 shell/Builder (PR #33): `index.html` → `src/ui/main.tsx`, Tailwind, Builder validates `AgentConfig` via engine APIs, CI `vite build`.

#### 7. UI part 2 — Arena + results — locked batch 7 / execution **B.2**
**DONE.** Arena + results on the epoch-guarded battle-view store (D-041 / D-042): `UiTurnResult = { step; trace? }`, reserve-before-`playTurn`, greedy CPU from `runtime.session.cpu`, Builder Continue-when-validated, restart/clear with preserved draft. Leave-while-pending proven via injected deferred `playTurn`. Operator production-preview smoke passed (opponent selection, fallback progression, results, restart, preserved Builder draft, clean console).

#### 7a. Decision Lab — execution **B.2d** (after B.2, before B.3)
**DONE (partial diagnostic slice).** Offline evidence pack exported via `npm run lab:pack` from heldout adversarial suite + fixture replay only; Lab Browse / Inspector / Compare / downloadable report. **Does not complete** locked batch 8 / execution C diagnostics.

#### 7a-es. Evidence + Ship — execution **ES** (after B.2d, before B.3) — D-048
Confidence intervals; additive heldout-ext suite (D-044); multi-model pin incl. groq (D-046); Decision Lab pack v2; free GitHub Pages (D-045); free-text variant code (D-047) with operator-recorded fixtures. Two-phase: agent scaffolding → operator record → agent finalize. **B.3** and **B.4** remain named and not started. Does not complete locked batch 8 / C.

#### 7b. Fixture-replayed LLM UI — execution **B.3** (after ES)
Browser-safe fixture playback for LLM turns (D-033 default: deterministic CPU + fixture-replayed LLM). No Node eval harness in the browser. **Not started.**

#### 7c. MVP localStorage save slot — execution **B.4** (after B.3)
One save slot (D-006 / AGENT_RULES). **Not started.**

#### 7d. You vs the model (Batch 3 / post-ES Lab challenge)
Human vs recorded/oracle comparison challenge in Decision Lab. **Planned after ES**; not in ES scope.

#### 8. Diagnostic layer — execution batch C
Headless first, then surfaced in the UI. Binding honesty: every conclusion traces to a measurement; small n → “insufficient evidence” (D-033 / D-031). **Not started** — B.2d / ES are partial slices only; batch 8 remains open.

#### 9. Three new measurements — execution batch C
Prompt-perturbation sensitivity; adversarial-context robustness; information-scaling curves. Pre-register protocols before implementation (D-024 / D-034 pattern). Same metrics/reporting surface as batch 8.

#### 10. BYOK + committed leaderboard + methodology writeup — execution batch D
UI default: deterministic CPU + fixture-replayed LLM (fixture path lands in **B.3**). Live BYOK: OpenRouter-only, key in memory, explicit warning. D-016 proxy deferred. Leaderboard = committed static comparison page (not a live backend — D-020 anti-scope stands). Methodology told through the failed measurement sets and the falsified hypothesis.

#### 11. Second reference environment + publish — execution batch E
Small provably solvable task proving the interface is real; then publish.

#### Parked / closed
- **D-026** seed-spread correlation and greedy-suboptimal snapshot reselection — **won't-fix** under D-033 (would require suite regeneration; contradicts batch 5’s no-behavior-change gate). Remain known limitations.
- **Coach** — cut by D-033 (unmeasured-if-UI-only contradicts D-018 / D-023).


### Stretch (optional)
- Natural-language robot builder (NL → validated `AgentConfig`).
- An agent that adapts across matches (bandit/RL). Revisit a heavier backend/DB only if cross-match learning or stored eval runs require real persistence beyond localStorage.

## Explicit Non-Goals
- Online multiplayer.
- Real-time battle.
- Node graph builder.
- Visual robot customization.
- Sound.
- Campaign.
- Live / public PvP leaderboards (a **committed static** BYOK comparison page is in-scope under D-033).
- Post-match LLM coach (cut by D-033).
- Tools module (gameplay “Tools” module — distinct from M-TOOLS grounding).
- Mobile layout.
- Public final branding.
- Real-world attack, jailbreak, or prompt-injection content.
- Full service/DB/auth backend for MVP (minimal serverless inference proxy only if multi-provider live play is wanted — D-016 deferred).
- Paid LLM usage (free-tier providers only — D-017).

## MVP Completion Criteria
- All required engine functions are present and tested.
- Deterministic outcomes are produced with identical seeds and inputs.
- Canonical skill catalog and agent configs are validated before battle sessions start.
- FRACTURE and SENTINEL-X are selectable and functional CPU opponents.
- Report / results output uses fictional vocabulary and avoids prohibited terms.
- AI strategy provider + eval harness prove agent behavior headless before UI.
- Environment interface exists; the game is one implementation of it.
- UI screens render the framework and own no measurement logic.
- No non-MVP features are shipped.
