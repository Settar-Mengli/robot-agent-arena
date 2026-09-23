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
Locked stack and game shape still hold (React + Vite + TypeScript + Zustand + localStorage; turn-based; fictional vocabulary). Sequencing follows D-033â€™s **11 locked batches**, grouped into **5 execution batches** Aâ€“E (amend).

- Engine-first implementation (DONE).
- Pure TypeScript battle engine (DONE).
- Session-based 1v1 battle flow + interactive `startBattle` / `stepBattle` driver (DONE).
- 5 modules: Core Identity, Memory, Sigil and Security, Rules, Strategy (agent-design surface â€” D-020).
- 8 canonical skills; max 2 equipped (`MVP_SKILL_SLOT_LIMIT`); max 20 turns (`MAX_TURNS`).
- Player agent naming.
- 2 CPU opponents: FRACTURE and SENTINEL-X (catalog DONE).
- 1 localStorage save slot (Batch 3 / B.4 â€” D-049).
- Seeded RNG (DONE; restore-from-state DONE).
- **DONE:** Eval harness (M-EVAL) with measured held-out LLM results; grounding/memory tools (M-TOOLS) with adversarial ablation published in EVAL.md (D-024 falsified; D-030).
- **DONE:** M-BENCH headless (PR #23 / D-032).
- **DONE:** Execution batch **A1** (prompt-byte-frozen hardening) â€” greedyâ†’grounding proven choice-identical; MemoScope identity; CI drift job; pricing/env/sanitize; pinned tests.
- **DONE (code):** Execution batch **A2** â€” corrected facts as `agent-v4-grounded` / `grounded-v2`; pinned gemini ablation published (D-034 + D-036).
- **DONE (code):** **D-035** â€” snapshot state dedupe + honest match/sample counts. Suites regenerated (heldout adversarial **n=13**).
- **DONE (code):** **D-036** â€” multi-variant comparisons require `--models` pin; manifest records pin; unpinned mixture recordings are not published.
- **DONE (code):** **A3** â€” environment interface, adapter-only (PR #31).
- **DONE (code):** UI foundation D-038â€“D-041 (PR #32); execution **B.1** shell + Builder (PR #33); execution **B.2** Arena + results (D-042).
- **DONE (code):** Execution **B.2d** Decision Lab (partial diagnostic slice â€” not locked batch 8 / C).
- **NEXT:** Locked batch **9** â€” three new measurements (pre-register). Batch 3 (D-049) **DONE** on main. **D-050** UX + bugs **implemented on branch** (gates green; awaiting audit/PR).
- **PLANNED:** Diagnostics â†’ three new measurements â†’ BYOK + committed leaderboard + methodology writeup â†’ second reference environment + publish.
- **CUT by D-033:** post-match coach (was in D-025 M-UI part 2). First public Report is trace-driven and cites oracle regret. A coach, if ever built, must live in `src/agent` with prompts, fixtures, and evals first (D-018 / D-023).

## Milestones

### Completed engine / infra spine
- M0â€“M4: Foundation, domain model, session core, simulation, combat vertical slice â€” DONE.
- Convergence: shared `resolveTurn`, status-only completion, min-1 skill validation â€” DONE.
- Interactive driver (`startBattle` / `stepBattle`) + RNG restore â€” DONE.
- Infra: ESLint (engine-purity), coverage, CI, ARCHITECTURE + README â€” DONE.
- CPU opponent catalog (FRACTURE, SENTINEL-X) â€” DONE.
- M-INF multi-provider OpenAI-compatible client (`src/inference/`) â€” DONE (serverless proxy deferred per D-016 / D-033 BYOK decision).
- M-AGENT LLM opponent turn + greedy baseline (`src/agent/`) â€” DONE (PR #9).
- M-EVAL eval harness (`src/eval/`, `evals/`, `EVAL.md`) â€” **DONE**.
- M-TOOLS grounding + memory + adversarial ablation â€” **DONE** (D-024 falsified; D-030).
- M-BENCH headless model bench â€” **DONE** (PR #23 / D-032); multi-model proof committed in ES.

### AI milestone spine (D-033 â€” 11 locked batches, 5 execution groups)

Locked batch numbers and contents are unchanged (D-033). Execution groups **A1â€“A3 / Bâ€“E** (D-033 amends) share one gate/audit where noted; both numberings stay in sync here and in PROGRESS.

#### 1. Discrimination + parked fixes â€” DONE
Environment **DISCRIMINATES** (optimal â‰« greedy). Fixture manifest + multi-provider keyless `--suite all` replay.

#### 2. M-TOOLS grounding + memory â€” DONE
Grounding + memory + variant ablation (D-027). Standard inconclusive; pivotal greedy-saturated (D-028); adversarial suites (D-029). Held-out adversarial: grounding changed **0/20** decisions â€” D-024 **falsified** (D-030). Metric choice: regret distribution with rate (D-031). Memory variants still unmeasured.

#### 3. M-BENCH headless â€” DONE (PR #23 / D-032)
Pinned single-model runs (`--models`, `maxProviders: 1`), repeat-aware fixture keys, failure taxonomy, cost/latency, prompt-version axis, `--mode bench` + committed `evals/out-committed/bench.summary.json`. Multi-model proof committed (`singleModelPending: false`) after ES operator record.

#### 4. Correctness hardening â€” DONE â€” execution batch **A1** (prompt-byte frozen)
CI re-proves pivotal / adversarial / bench / discriminate regen (`drift` job, `SNAPSHOT_DRIFT=1`); Oracle MemoScope identity (numeric `maxTurns` + catalog); pricing for Groq pin `openai/gpt-oss-20b`; sanitize **new** fixture records only; `.env.example` `INFERENCE_*`; weak tests pin published values; greedyâ†’grounding landed after differential proof (0 choice diffs). **Gate held:** committed numbers byte-identical. Grounding *fact* fixes are **not** in A1 â€” see A2 / D-034.

#### A2. Grounding correctness + ablation re-run (D-034) â€” DONE
Corrected facts as `agent-v4-grounded` / variant `grounded-v2` / `facts-v2`. Old `agent-v2-grounded` fixtures and D-030 preserved. Pinned gemini ablation published on post-D-035 suites (D-036).

#### 5. Environment interface + port â€” DONE â€” execution batch **A3** (adapter only)
Measurement core depends on `src/env` (`robotEnvironment`). `DecisionSnapshot.runtime` stays todayâ€™s `BattleRuntime` JSON. Committed differential proof under `SNAPSHOT_DRIFT`. **Gate held:** byte-identical artifacts. Next: A-to-Z recon, then batch B (UI).

#### 6. UI part 1 â€” scaffolding + Builder â€” locked batch 6 / execution **B.1**
**DONE.** Foundation (D-038â€“D-041, PR #32) + B.1 shell/Builder (PR #33): `index.html` â†’ `src/ui/main.tsx`, Tailwind, Builder validates `AgentConfig` via engine APIs, CI `vite build`.

#### 7. UI part 2 â€” Arena + results â€” locked batch 7 / execution **B.2**
**DONE.** Arena + results on the epoch-guarded battle-view store (D-041 / D-042): `UiTurnResult = { step; trace? }`, reserve-before-`playTurn`, greedy CPU from `runtime.session.cpu`, Builder Continue-when-validated, restart/clear with preserved draft. Leave-while-pending proven via injected deferred `playTurn`. Operator production-preview smoke passed (opponent selection, fallback progression, results, restart, preserved Builder draft, clean console).

#### 7a. Decision Lab â€” execution **B.2d** (after B.2, before B.3)
**DONE (partial diagnostic slice).** Offline evidence pack exported via `npm run lab:pack` from heldout adversarial suite + fixture replay only; Lab Browse / Inspector / Compare / downloadable report. **Does not complete** locked batch 8 / execution C diagnostics.

#### 7a-es. Evidence + Ship â€” execution **ES** (after B.2d, before B.3) â€” D-048
**DONE.** Confidence intervals; additive heldout-ext suite (D-044, n=35); multi-model pin incl. groq (D-046); Decision Lab pack v2; free GitHub Pages (D-045); free-text variant recorded n=13 (D-047; ext freetext deferred). Two-phase handoff honored. Does not complete locked batch 8 / C.

#### 7b. Fixture-replayed LLM UI â€” execution **B.3** (after ES) â€” D-049
**DONE on main (PR #37).** Watch recorded AI battles from `arena-replay.v1.json` (gemini heldout base+grounded, 6 matches). Free play remains greedy. No Node eval harness in the browser.

#### 7c. MVP localStorage save slot â€” execution **B.4** (after B.3) â€” D-049
**DONE on main (PR #37).** One save slot (D-006 / AGENT_RULES). Save rules refined under D-050 (battle-only runtime).

#### 7d. You vs the model (Batch 3 Lab challenge) â€” D-049
**DONE on main (PR #37).** Human vs recorded/oracle comparison in Decision Lab (pack-only scoring). Guided path + plain copy under D-050.

#### 8. Diagnostic layer â€” execution batch C / Batch 3 â€” D-049
**DONE on main (PR #37).** Headless diagnostics + pack v3 + Lab Diagnostics UI (incl. vs published summary). Binding honesty: every conclusion traces to a measurement; small n â†’ â€œinsufficient evidenceâ€ (D-033 / D-031). Three new measurements remain batch 9. D-050 composes help text in UI (no pack regen).

#### 8a. UX + bugs â€” **D-050**
**Shipped in [PR #38](https://github.com/Settar-Mengli/robot-agent-arena/pull/38).** Plain landing, guided Challenge, AppView, Advanced Lab Compare (n=13), battle juice, tour, lazy Lab/Watch, ~380px layout. No artifact / engine changes.

#### 9. Three new measurements â€” execution batch C
Prompt-perturbation sensitivity; adversarial-context robustness; information-scaling curves. Pre-register protocols before implementation (D-024 / D-034 pattern). Same metrics/reporting surface as batch 8.

#### 10. BYOK + committed leaderboard + methodology writeup â€” execution batch D
UI default: deterministic CPU + fixture-replayed LLM (fixture path lands in **B.3**). Live BYOK: OpenRouter-only, key in memory, explicit warning. D-016 proxy deferred. Leaderboard = committed static comparison page (not a live backend â€” D-020 anti-scope stands). Methodology told through the failed measurement sets and the falsified hypothesis.

#### 11. Second reference environment + publish â€” execution batch E
Small provably solvable task proving the interface is real; then publish.

#### Parked / closed
- **D-026** seed-spread correlation and greedy-suboptimal snapshot reselection â€” **won't-fix** under D-033 (would require suite regeneration; contradicts batch 5â€™s no-behavior-change gate). Remain known limitations.
- **Coach** â€” cut by D-033 (unmeasured-if-UI-only contradicts D-018 / D-023).


### Stretch (optional)
- Natural-language robot builder (NL â†’ validated `AgentConfig`).
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
- Tools module (gameplay â€œToolsâ€ module â€” distinct from M-TOOLS grounding).
- Full mobile product polish (D-050 amends D-007: ~380px usable layout is in scope; this non-goal remains for broader mobile polish beyond that).
- Public final branding.
- Real-world attack, jailbreak, or prompt-injection content.
- Full service/DB/auth backend for MVP (minimal serverless inference proxy only if multi-provider live play is wanted â€” D-016 deferred).
- Paid LLM usage (free-tier providers only â€” D-017).

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
