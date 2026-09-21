# DECISIONS

## Decision Log Format
Each entry includes ID, date, status, decision, rationale, and consequences.
Status values: **Accepted** = in force; **Superseded** = replaced by a later decision (see that entry’s amendment); **Falsified** = pre-registered prediction failed (see that entry’s amendment).

## D-001 Naming Policy
Date: 2026-06-04  
Status: Accepted

Decision:
Keep the repository name as robot-agent-arena and use AGENT ARENA as the temporary app title. Record ARCZOLVEX as a pending final-name candidate only.

Rationale:
ARCZOLVEX is not legally finalized yet.

Consequences:
No repository rename and no public app rename until legal confirmation is complete.

## D-002 Architecture Priority
Date: 2026-06-04  
Status: Accepted

Decision:
Follow engine first, UI second.

Rationale:
This sequencing protects deterministic, testable game logic before interface complexity is added.

Consequences:
Implementation planning prioritizes engine domain and battle flow before React screen development.

## D-003 Engine Purity Boundary
Date: 2026-06-04  
Status: Accepted

Decision:
Keep `src/engine` pure TypeScript with no React, browser APIs, Zustand imports, DOM access, storage APIs, or network APIs.

Rationale:
Strict separation improves maintainability, testability, and portability.

Consequences:
All future implementation and code review must enforce this boundary.

## D-004 Session-Based Battle Requirement
Date: 2026-06-04  
Status: Accepted

Decision:
Use a session-based battle engine with `initBattle`, `submitPlayerAction`, `isBattleOver`, `finalizeBattle`, and deterministic simulation support.

Rationale:
Interactive turn flow requires persisted session state between actions.

Consequences:
Session lifecycle, transition rules, and deterministic state updates are core engine contracts.

## D-005 Technology Stack Lock
Date: 2026-06-04  
Status: Accepted

Decision:
Use React + Vite, TypeScript strict mode, Tailwind CSS, Zustand, Vitest, and localStorage for MVP persistence. Defer deployment choice to later between Vercel and Netlify.

Rationale:
This stack supports fast iteration, clear state flow, and strong testability.

Consequences:
Alternative frameworks are out of scope unless explicitly re-decided.

## D-006 MVP Scope Lock
Date: 2026-06-04  
Status: Accepted

Decision:
MVP includes 4 screens, 5 modules, 8 skills, player naming, 2 CPU opponents, 1 localStorage save slot, max 20 turns, seeded RNG, and post-match report output using fictional vocabulary only.

Rationale:
A strict MVP boundary is needed to keep delivery focused and achievable.

Consequences:
Scope expansion requests are deferred unless explicitly approved.

## D-007 Non-MVP Exclusions
Date: 2026-06-04  
Status: Accepted

Decision:
Exclude online multiplayer, real-time battle, node graph builder, visual robot customization, sound, campaign, leaderboards, tools module, mobile layout, and public final branding from MVP.

Rationale:
Exclusions reduce delivery risk and protect timeline focus.

Consequences:
Excluded features move to post-MVP backlog only.

## D-008 Safety Vocabulary Standard
Date: 2026-06-04  
Status: Accepted

Decision:
Use fictional player-facing terms: Signal Breach, Null Pulse, Override Pulse, Core Identity, Logic Storm, Sigil Rule, Signal Exposure, and Logic Drift.

Rationale:
The project must remain educational, fictional, and safe.

Consequences:
Player-facing text must be reviewed for vocabulary compliance before release.

## D-009 Engine Ownership Boundaries
Date: 2026-06-16  
Status: Accepted

Decision:
Keep canonical engine data in dedicated data files, runtime validation in `validation.ts`, and session lifecycle transitions in `session.ts`.

Rationale:
Separate ownership avoids duplicated validators and prevents data definitions from accumulating battle-resolution behavior.

Consequences:
Canonical catalog data remains data-only, validation stays pure TypeScript, and session code delegates shape/catalog checks before creating or transitioning sessions.

## D-010 Combat Engine Rules
Date: 2026-06-16
Status: Accepted

Decision:
Use deterministic combat rules for the M4 engine slice: unaffordable selected skills resolve as `fallback-stabilize`, actions resolve in player-then-CPU order, CPU action is skipped if the player action completes the battle, turn-limit outcomes compare health first and energy second before declaring a draw, and combat module ownership stays split across session lifecycle, combat resolution, outcome determination, simulation orchestration, and validation.

Rationale:
The combat slice needs complete deterministic battle resolution without introducing CPU strategy, UI, reports, damage variants, or non-MVP systems.

Consequences:
`session.ts` remains lifecycle-only, `combat.ts` owns action resolution helpers, `outcome.ts` owns completion and winner rules, `simulation.ts` owns orchestration, and `validation.ts` owns guards for catalog and config shapes.

## D-011 Battle Completion Authority
Date: 2026-09-16  
Status: Accepted

Decision:
Battle completion is authoritative via `outcome.ts` (`determineBattleOutcome`) and `finalizeBattle` after the final turn plays. `isBattleOver` returns true only when `session.status === "completed"`. This supersedes the earlier pre-play `turn >= maxTurns` check. Complements D-010 turn-limit outcome rules.

Rationale:
A UI looping on `isBattleOver` must not skip the final capped turn; turn-limit outcomes are decided after that turn resolves.

Consequences:
Interactive and simulation paths both play turn `maxTurns` when needed; status-only `isBattleOver` gates the interactive loop; turn-cap logic stays in `outcome.ts`.

## D-012 Shared Turn Orchestrator
Date: 2026-09-16  
Status: Accepted

Decision:
`resolveTurn` is the single shared per-turn orchestrator. Both `resolveBattle` and any future interactive or UI turn path must call it. Do not implement a second turn-resolution path.

Rationale:
One orchestrator prevents session and simulation combat semantics from diverging.

Consequences:
CPU skill selection is injected lazily into `resolveTurn`; combatants and turn records remain caller-owned state alongside the session.

## D-013 Minimum Skill Loadout
Date: 2026-09-16  
Status: Accepted

Decision:
`validateAgentConfigInput` requires `skillIds.length >= 1`. Empty configs are rejected at the validation boundary so all entry points (`initBattle`, `resolveBattle`, and future UI) fail identically. The minimum is 1 (correctness floor), not a designed loadout size.

Rationale:
Previously empty loadouts passed validation but failed mid-simulation; front-door rejection is consistent and fail-fast.

Consequences:
`MVP_SKILL_SLOT_LIMIT` remains the maximum; no new minimum-loadout constant is introduced; the empty-array guard in simulation stays as defense-in-depth.

## D-014 Agentic Re-Scope
Date: 2026-09-17  
Status: Accepted

Decision:
Re-scope the product to an agentic-AI system whose environment is the deterministic game. The pure TypeScript engine remains untouched and fully tested. This supersedes UI-first sequencing after the engine: the four MVP screens still ship, but later (M-UI), in service of showcasing the agents. Headless AI layer and evals are built and proven before UI.

Rationale:
Building UI before a proven agent strategy wastes work; the existing `selectCpuSkillId` seam already isolates move selection from deterministic resolution.

Consequences:
Roadmap priority is M-INF → M-AGENT → M-TOOLS → M-EVAL → M-COACH → M-UI. React/Tailwind/Zustand remain locked for UI but stay uninstalled until M-UI.

Amended (2026-09-17): Milestone order superseded by D-021 (M-EVAL before M-TOOLS).

Pointer: current milestone order is **D-025 as amended** (M-ENV dropped; batch 2 = M-TOOLS; then M-BENCH → M-UI parts → polish) — not the Consequences line above.

## D-015 AI Strategy Provider Seam
Date: 2026-09-17  
Status: Accepted

Decision:
AI acts as a strategy provider behind the existing `selectCpuSkillId` injection on `resolveTurn`. The engine still resolves combat deterministically. The deterministic bot (`selectSimulationSkillId`) is the fallback when the LLM is unavailable or returns an invalid/illegal move. Complements D-012 (shared orchestrator) and D-011 (completion authority).

Rationale:
One selection seam avoids a second turn path and preserves parity with the interactive driver.

Consequences:
LLM code must not live inside combat/outcome/session resolution; it only returns a legal `SkillId` (or triggers fallback).

## D-016 Minimal Serverless Inference Proxy
Date: 2026-09-17  
Status: Accepted

Decision:
A minimal serverless backend (free host, e.g. Vercel or Netlify functions) holds LLM API keys and proxies inference — not a full service/DB/auth backend. A heavier backend/DB is reconsidered only if a later stretch goal needs real persistence (cross-match learning, leaderboards, stored eval runs). Client-side localStorage remains the MVP persistence model for battle saves.

Rationale:
A static frontend cannot hold secrets; a full backend is over-engineering while there are no users and no server persistence requirement.

Consequences:
M-INF delivers serverless endpoint(s) + env-based keys. No app database in the near-term spine.

Amended (2026-09-17): M-INF delivered the multi-provider client under `src/inference/` only. The serverless proxy is deferred until the UI needs browser-safe key handling (M-UI). The agent layer runs as a local Node module for now.

## D-017 Multi-Provider Free-Tier LLM Client
Date: 2026-09-17  
Status: Accepted

Decision:
Use a multi-provider free-tier LLM client with fallback across providers and no paid usage. Candidate providers are confirmed at M-INF build time (examples: Groq, Google Gemini, Cerebras, OpenRouter, and similar free tiers). Do not treat any specific provider or rate limit as locked in planning docs.

Rationale:
Free tiers change; fallback across providers keeps the agent usable without cost.

Consequences:
Client must support timeout, retry, structured output, and provider fallback. Rate limits and final provider list are verified when M-INF is implemented.

Amended (2026-09-17): Current default order lives in `src/inference/providers.ts` (`groq`, `cloudflare`, `gemini`, `mistral`, `openrouter`). Cerebras dropped (now requires a card). Provider lists are volatile and re-verified before live use.

## D-018 Eval Harness First-Class
Date: 2026-09-17  
Status: Accepted

Decision:
The eval harness is a first-class deliverable (M-EVAL), not optional. It runs headless agent-vs-bot batches and reports win rate, decision-validity %, latency, and fallback stats, enabling prompt/model comparison. Free-tier-safe via caching, recorded fixtures, and small batches.

Rationale:
Without measurable agent quality, UI and coach work cannot be validated.

Consequences:
M-EVAL precedes M-UI. Eval tooling must not require paid LLM quota.

## D-019 Determinism Boundary With LLM Selection
Date: 2026-09-17  
Status: Accepted

Decision:
LLM non-determinism lives only in move selection. The engine, its tests (~88 today), and replay/resume via `BattleRuntime` / `RngState` stay deterministic. The AI layer must not modify engine combat, outcome, validation, or existing engine tests to “make AI work.”

Pointer: do not use the “~88” figure; the live test count is in PROGRESS.md (Status Snapshot) and the CI coverage run.

Rationale:
Preserves the tested backbone and save/resume guarantees while still allowing intelligent opponents.

Consequences:
Invalid LLM outputs fall back to the deterministic bot; recorded eval fixtures can pin selection where needed for reproducibility.

Amended (2026-09-17): Replace reliance on a hardcoded "~88 tests" count with "the full engine test suite" (see current PROGRESS / CI coverage run).

## D-020 Agent-Design Teaching Sandbox Positioning
Date: 2026-09-17  
Status: Accepted

Decision:
Reposition the project as an interactive agent-design sandbox that teaches AI-agent engineering through measurable consequence. The deterministic battle/game is the environment, not the point. Users configure an agent (identity, memory, tools/skills, guardrails/rules, strategy), run it against opponents/scenarios, and see how those choices change outcomes — backed by real evals, decision traces, and honest failure analysis. Tagline framing: a tool that teaches AI-agent design, built by doing real AI engineering; the medium demonstrates the maker’s skill. This is positioning only: it does not redesign the engine, the `selectCpuSkillId` seam, the AI milestone spine (M-INF → M-AGENT → M-TOOLS → M-EVAL → M-COACH → M-UI), or the determinism boundary (D-019). All prior decisions stand.

Rationale:
Higher and more durable value than a fighting game alone — it targets what AI engineers actually want (seeing how agent-design choices move real eval metrics) and reinforces the maker’s AI-engineering credibility. Plays directly to the engine’s strength as a controllable, measurable environment.

Consequences:
Framing and copy shift toward agent-design/teaching. The five agent modules and the post-match report are the teaching surface (modules as real design levers; the report as an explanatory lesson of which design choice caused the result). The eval harness (M-EVAL) is elevated as core evidence, not optional. No change to the engine, seam, determinism, or milestone spine.
Anti-scope (so this framing does not balloon): this remains a focused sandbox/demo — not a course, curriculum, LMS, or content platform. Teaching happens through consequence plus a concise report, not lessons/text. No new heavy “educational” infrastructure (no CMS, no accounts, no backend beyond the planned minimal serverless proxy). Prior review anti-scope still holds: no agent framework, no vector DB/RAG, no multi-agent debate, no LLM judges, no real backend/leaderboard. Scope stays one configurable agent vs opponents, a few scenarios, and a live eval/decision readout — depth over breadth.

### Amend — 2026-09-18 — Coach cut by D-033

Decision (amend):
The Decision body above still lists `M-COACH` as its own milestone in the spine. **D-033 cuts the post-match coach.** It is not a milestone. The first public Report is trace-driven and cites oracle regret. Teaching-sandbox intent (consequence through measurement) remains; the coach deliverable does not.

## D-021 Milestone Order (Eval Before Tools)
Date: 2026-09-17
Status: Superseded (see amendment 2026-09-18)

Decision:
Roadmap priority is M-INF → M-AGENT → M-EVAL → M-TOOLS → M-COACH → M-UI.

Rationale:
Grounding and memory (M-TOOLS) must be proven by ablation against an eval baseline, so evals come first. Supersedes the M-TOOLS-before-M-EVAL order recorded in D-014.

Consequences:
PROGRESS / ROADMAP follow this order. M-AGENT may start a minimal M-EVAL baseline alongside the agent turn; M-TOOLS stays after measurable agent quality exists.

### Amend — 2026-09-18 — Order superseded by D-025

Decision (amend):
This milestone order is **superseded by D-025** (and D-025’s 2026-09-18 amend). M-ENV was dropped; the remaining plan is Discrimination → M-TOOLS → M-BENCH → M-UI part 1 → M-UI part 2 (coach folded in) → Polish. PROGRESS / ROADMAP follow D-025 as amended, not the Consequences line above.

## D-022 Agent Turn Contract
Date: 2026-09-17
Status: Accepted

Decision:
The LLM opponent turn lives in `src/agent/` and:
- Uses a pure post-player probe (`observePostPlayerState`) for observation without keeping the probe step.
- Calls the async LLM outside the engine under one end-to-end budget (external `AbortSignal`; abort is terminal).
- Validates model output; equipped-but-unaffordable skill ids are accepted (engine owns fallback-stabilize).
- On any LLM/validation/budget/cancel failure, executes plain `stepBattle` (default seeded picker, D-015).
- Emits a JSON-serializable `DecisionTrace`.
- Provides a deterministic greedy baseline selector for evals.

Rationale:
Keeps the engine sync and deterministic while making agent behavior measurable and abortable.

Consequences:
ESLint layer rules: engine imports neither agent nor inference; inference imports neither engine nor agent; agent may import both.

## D-023 Eval Methodology
Date: 2026-09-17
Status: Accepted

Decision:
M-EVAL methodology is locked as follows:
- Exact memoized best-response oracle vs a fixed player policy, with a node cap (`exact: false` when exceeded). Not a game-theoretic equilibrium.
- Dev / held-out splits with disjoint seeds; match suites (120 scenarios each) plus decision-snapshot suites (20 per split, drawn from greedy-CPU play on a bounded scenario scan).
- Recorded-fixture replay is the CI / committed LLM path; live and record modes are local-only and refuse `CI`.
- Zero new runtime deps: Vite `runnerImport` via `scripts/run-ts.mjs`.
- Drift guards on committed snapshot suites and the EVAL.md baseline block.

Rationale:
Makes agent quality measurable without paid quota, keeps results reproducible, and prevents silent suite/report drift when the engine or policies change.

Consequences:
`src/eval/`, `evals/`, `EVAL.md`, and npm `eval*` scripts are first-class. LLM measurement still requires a local record run before replay numbers appear in EVAL.md.

### Amend — 2026-09-17 — Split independence and keyless replay

Decision (amend):
- Dev and held-out splits must be **structurally independent**: disjoint player archetypes (and therefore disjoint stratum keys), plus disjoint `{turn, player, cpu}` snapshot state keys. Seed separation alone is insufficient under a deterministic player policy with injected CPU (RNG does not diversify states).
- Fixture replay is **keyless**: provider env (placeholder API key, model, order) is derived from committed fixture `request.host` / `request.model`. CI runs `npm run eval:replay` after coverage.
- Stratified `--max-matches` sampling is **archetype-first** (archetype varies fastest, then policy, opponent, seed index).

Rationale:
The original held-out suite reused the same archetypes as dev with only different seeds; under injected CPU, snapshot states overlapped 20/20, so held-out numbers were not independent evidence. Keyless replay removes the false requirement for live API keys on the committed path.

Consequences:
`HELDOUT_ARCHETYPES` (aegis / tempest / mnemonic) are separate from `PLAYER_ARCHETYPES`. Held-out LLM metrics require a fresh `eval:record --suite heldout` before they can appear in EVAL.md.

## D-024 M-TOOLS hypothesis (pre-registered)
Date: 2026-09-17
Status: Falsified (see amendment 2026-09-18)

Decision:
Written **before** building M-TOOLS. Prediction: giving the agent computed grounded facts (affordability, damage-after-defense, lethality, threat) will raise held-out snapshot optimality **above the greedy baseline of 50%** and beat greedy on match outcomes.

Pre-specified test:
- Same held-out match suite and committed held-out snapshots as the measured baseline in EVAL.md.
- Same model set / provider order as the held-out record run.
- Ablation: grounding **on** vs grounding **off**.
- Report: snapshot optimality, mean regret, and match outcomes (and publish both outcomes in EVAL.md).

Falsifier:
If grounded prompts do **not** beat 50% held-out snapshot optimality (and do not beat greedy on matches), the honest conclusion is that this environment is too simple for LLM strategy to add value — and that result is published in EVAL.md as well.

Rationale:
The held-out measurement shows greedy indistinguishable from the LLM mixture on both snapshots and the n=6 match sample. M-TOOLS must be judged against that baseline with a pre-registered criterion, not post-hoc narrative.

Consequences:
M-TOOLS is next on the spine; EVAL.md is the publication surface for the ablation; no claim of LLM advantage until the falsifier is passed.

### Amend — 2026-09-18 — Falsified (measurement-set honesty)

Decision (amend):
**Falsified.** The prediction was pre-registered against the **standard** held-out snapshot baseline (greedy 50% / mean regret 0.50). After D-028/D-029, the ablation was executed on the **adversarial** suite (greedy 0% by construction). The qualitative result stands and is published in EVAL.md / D-030: grounding changed **0 of 20** decisions (base ≡ grounded at 5% / mean regret 4.25). The claim that “the pre-registered test was run exactly as written” does **not** stand — the measurement set changed between registration and execution.

## D-025 Product direction and milestone order
Date: 2026-09-17
Status: Superseded (see amendment 2026-09-18)

Decision:
**Supersedes D-021’s milestone order.** Product direction: a **measurement bench for agent design**, where the correct answer is known by an exact oracle — model comparison (BYOK), cost/latency per decision, prompt version as a first-class axis, a failure taxonomy per model, and self-consistency checks. The teaching sandbox is delivered **through measurement** rather than assertion.

Locked 7-batch plan:
1. Discrimination + parked fixes (this batch) — done when the environment’s ability to separate good from bad play is measured.
2. **M-ENV** — deepen the environment (**conditional on batch 1’s verdict**: proceed because the environment DISCRIMINATES).
3. **M-TOOLS** — grounding ablation (D-024).
4. **M-BENCH** — model comparison bench.
5. **M-UI part 1** — Builder + Arena.
6. **M-UI part 2** — Report + coach + bench surfacing.
7. Polish and publish.

Rationale:
The held-out LLM↔greedy tie looked like “environment too simple,” but the discrimination report shows large headroom for optimal play. Deepening the environment before the bench keeps the oracle meaningful.

Consequences:
ROADMAP / PROGRESS follow this order. Batch 2 is M-ENV, not M-BENCH.

### Amend — 2026-09-18 — M-ENV conditional resolved; batch 2 is M-TOOLS

Decision (amend):
Batch 1’s discrimination verdict (**DISCRIMINATES**; optimal ~83–88% vs greedy ~9–11%) resolves D-025’s conditional. **M-ENV is dropped** as a milestone batch: the environment already separates good from bad play strongly, so deepening it is not the limiting factor — the agent is. Batch 2 is **M-TOOLS** (D-024). The plan keeps its shape with the M-ENV slot replaced by M-TOOLS; everything after is unchanged and renumbered:

1. Discrimination — done.
2. **M-TOOLS** — grounding + memory ablation (D-024).
3. **M-BENCH** — model comparison bench.
4. **M-UI part 1** — Builder + Arena.
5. **M-UI part 2** — Report + coach + bench surfacing.
6. Polish and publish.

Rationale:
~75 points of win-rate headroom above greedy are already achievable inside the current rules. Spending a batch on environment deepen before proving whether grounding helps would delay the pre-registered M-TOOLS test.

Consequences:
ROADMAP / PROGRESS follow the amended order. D-026 items remain parked (see amend below), not scheduled as batch 2.

### Amend — 2026-09-18 — Scope and batch order superseded by D-033

Decision (amend):
**D-033** supersedes this entry’s product scope and batch order. The 6-batch plan above (M-TOOLS → M-BENCH → M-UI part 1 → M-UI part 2 with coach → Polish) is replaced by D-033’s 11-batch plan. **M-UI part 2’s post-match coach is cut** (see D-033). ROADMAP / PROGRESS follow D-033, not the Consequences lines above.

## D-026 Deferred to M-ENV
Date: 2026-09-17
Status: Superseded (see amendment 2026-09-18)

Decision:
Deferred until M-ENV (which regenerates suites/baselines/fixtures anyway):
- **Seed spread:** nearby small integer seeds appear correlated (e.g. random CPU won 0/30 on dev seeds 1–10 but 10/30 on heldout seeds 101–110 against the same deterministic player).
- **Snapshot reselection** toward greedy-suboptimal decision points (current suites under-sample headroom states).

Rationale:
Either change forces regenerating snapshot suites, baselines, and LLM fixtures. Parking them avoids thrash before M-ENV.

Consequences:
Do not regenerate suites solely for these issues outside M-ENV.

### Amend — 2026-09-18 — Parked without an M-ENV milestone

Decision (amend):
With M-ENV dropped as a batch (D-025 amend), these items stay **parked** until a future suite regeneration — they are **not** in scope for M-TOOLS and are no longer gated on an M-ENV milestone.

Consequences:
Do not regenerate suites for seed-spread / snapshot reselection during M-TOOLS.

### Amend — 2026-09-18 — Closed as won't-fix under D-033

Decision (amend):
**Won't-fix.** D-033 batch 5 (environment interface) is a port with no behavior change — committed suites, baselines, and fixtures must still replay. Seed-spread correlation and greedy-suboptimal snapshot reselection require regenerating those artifacts, so they cannot ride batch 5. Batch 4 (correctness hardening) fixes silent risks on **existing** suites; it is not a resample. Small n and seed correlation remain **known limitations** under D-033; diagnosis (batch 8) uses the existing adversarial set. A future suite regeneration would need a new decision.

## D-027 Grounding contract
Date: 2026-09-18
Status: Accepted

Decision:
- **Facts are authoritative:** `computeGroundedFacts` mirrors the engine’s own combat rules (damage after defense, lethality, heal caps, energy drain, affordability). When grounding is on, the prompt states that `ENGINE_GROUNDED_FACTS` are engine-computed and the model must not recompute them.
- **Parity is tested:** a skill×state grid asserts projections match `resolveAction` / battle stepping; threat uses next-turn player energy via `TURN_ENERGY_RECOVERY` (not current energy).
- **Opt-in variants:** grounding and memory default **off**. Default `PROMPT_VERSION` remains `"agent-v1"` so existing fixtures and CI keyless replay stay valid. Opt-in versions: `agent-v2-grounded`, `agent-v2-memory`, `agent-v3-grounded-memory`.
- **Prompt version is first-class:** every decision trace and ablation result carries `promptVersion`; manifest records `{ id, promptVersion }` per variant so replay reproduces the recorded set.
- **Low health is shared:** per-match memory uses `LOW_HEALTH_RATIO` from the greedy baseline (0.4).

Rationale:
Fixture keys hash messages. Changing the default prompt would break CI. Ablation must compare arms without invalidating the committed keyless path. D-024’s prediction and falsifier apply to the operator’s local record run.

Consequences:
M-TOOLS code is in; ablation **numbers** land in EVAL.md only after a local `eval:record` with `--variants`. Next batch is M-BENCH.

## D-028 Snapshot stakes
Date: 2026-09-18
Status: Superseded (see amendment 2026-09-18)

Decision:
- Snapshot suites used to **compare policies** must sample by **decision stakes** (oracle value spread = best − worst), not merely by non-flatness.
- A suite whose **maxRegret is near zero** (standard held-out: maxRegret ≈ 1.0) cannot discriminate between policies — the first M-TOOLS ablation’s Δ0.0pp on standard suites is therefore **inconclusive**, not a negative result for grounding.
- **Standard** suites (`snapshots.dev.json` / `snapshots.heldout.json`) are retained for fixture keys and CI keyless replay stability.
- **Pivotal** suites (`snapshots.pivotal.{dev,heldout}.json`) select exact non-flat points with spread ≥ `PIVOTAL_MIN_SPREAD` (100), ranked by spread; they are the measurement set for ablations (`--snapshot-suite pivotal`).
- This **supersedes** the snapshot-reselection item parked in D-026 for the purpose of ablation measurement (seed-spread correlation remains parked).

Rationale:
Discrimination shows ~75 points of win-rate headroom above greedy from rare catastrophic decisions (max spread ~2007). Measuring grounding on near-zero-stakes points cannot detect whether facts help on the decisions that matter.

Consequences:
Re-run M-TOOLS ablation with `--snapshot-suite pivotal`. Per-decision snapshot results + prompt-version guard keep future ablations auditable. Next batch remains M-BENCH after that re-run.

### Amend — 2026-09-18 — Ablation set replaced by D-029

Decision (amend):
**D-029** replaced pivotal as the ablation measurement set. Pivotal remains a **stakes probe** (high spread; greedy-saturated). Ablations that claim to beat a baseline must use `--snapshot-suite adversarial`. The stakes-sampling rationale above still stands for why standard suites cannot discriminate policies.

## D-029 Measure where the baseline fails
Date: 2026-09-18
Status: Accepted

Decision:
- Ablations that claim to beat a **baseline** must measure on points where that baseline **fails**. Selecting by stakes alone is insufficient when the baseline saturates the high-stakes set.
- **Spread** (best − worst) selects lethal availability — greedy rule 1 often coincides with the oracle there, which is why pivotal suites show greedy at 100% / 95%.
- **Adversarial** suites (`snapshots.adversarial.{dev,heldout}.json`) select exact non-flat points with `greedyRegret ≥ ADVERSARIAL_MIN_REGRET` (100), ranked by greedyRegret; greedy optimalRate is **0% by construction**. They are the measurement set for ablations (`--snapshot-suite adversarial`).
- Motivating full-split regret-tail counts (@1 / @100 / @500 / @1000): **dev 39 / 3 / 3 / 3**; **heldout 38 / 1 / 1 / 1**. Selected: dev 3 (regret 2001), heldout 1 (regret 2002). Shortfall vs target 20 is accepted and recorded.
- **Pivotal** (D-028) is retained as a **stakes probe**, not the ablation set. **Standard** suites remain for fixtures/CI.
- Committed adversarial runtimes keep `turns` so `memory=match` summaries still work.

Pointer: the `ADVERSARIAL_MIN_REGRET` (100) and selected-count shortfall (dev 3 / heldout 1) in the bullets above are historical; see **Amendment (2026-09-18)** below — min regret is now **1**, both splits fill **n=20**.

Rationale:
An ablation that only moves scores on points the baseline already solves cannot demonstrate improvement. Selecting by baseline regret makes failure the filter criterion.

Consequences:
Operator re-runs M-TOOLS with `--snapshot-suite adversarial` and pastes results into EVAL.md. Next batch remains **M-BENCH** after that publication.

### Amendment (2026-09-18) — min regret 1 for measurable n

- Full-split scan at `greedyRegret ≥ 100` yielded only **3 (dev) / 1 (heldout)** points — too few to measure an ablation. An earlier informal count of “~12 @≥100 in the first 12 scenarios” was incorrect: those scenarios are nearly the same matchup with inert seeds (one state repeated).
- **`ADVERSARIAL_MIN_REGRET` is now `1`** (any point where greedy errs). Ranking remains by greedyRegret descending; target remains 20. Both splits fill n=20 (dev selected mix includes 3 points @≥100; heldout 1). Greedy optimalRate remains **0% by construction**.
- Rationale unchanged: measure where the baseline fails; the stakes floor is what to relax when catastrophic errors are rare, not the construction.

## D-030 M-TOOLS ablation outcome
Date: 2026-09-18
Status: Accepted

Decision:
- On the held-out **adversarial** measurement set (n=20), grounded facts produced **no behavioral change**: base and grounded are identical at 5% optimal / mean regret 4.25 / median 5 / max 5; all 20 decisions match; prompt versions differ (`agent-v1` vs `agent-v2-grounded`). **D-024 is falsified** and published in EVAL.md.
- Corrected suite baselines: greedy 0% / mean 104.35; LLM Δoptimal +5.0pp / Δregret −100.10 vs greedy. Greedy and the LLM fail in opposite ways (catastrophic rare vs cheap constant).
- Candidate explanations to test rather than assert: the model may already infer these facts from raw state; the adversarial set may be dominated by regret-2 points where any choice is nearly equal; the grounded block may be placed or phrased such that it is ignored.
- Memory variants (`agent-v2-memory`, `agent-v3-grounded-memory`) remain **unmeasured**.

Rationale:
An ablation that changes zero decisions cannot support the grounding hypothesis on this set, regardless of rate deltas vs greedy.

Consequences:
Next batch is **M-BENCH**. Do not treat grounding-as-implemented as settled positive evidence.

### Amend — 2026-09-19 — Sample size wording (D-035)

The historical ablation ran on a committed suite whose **20** rows were only **6** distinct decision states. Wording “0 of 20” is more precisely **0 of N distinct states** on that suite; the **zero-change** conclusion is unaffected (base ≡ grounded decision-for-decision). Historical fixtures are preserved. Current held-out adversarial suite after D-035 is **n=13** distinct; LLM re-measure is pending.

## D-031 Metric choice on stakes-skewed suites
Date: 2026-09-18
Status: Accepted

Decision:
- On stakes-skewed suites (adversarial, pivotal), report the **regret distribution** (mean, median, max, count with regret ≥ 100) alongside optimality rate. A policy can be far better in value while looking worse (or only barely better) by rate.
- Motivating case: this M-TOOLS ablation — greedy 0% / mean 104.35 vs LLM 5% / mean 4.25 / max 5 on held-out adversarial.

Rationale:
Mean regret is dominated by rare high-stakes misses; rate alone hides that structure.

Consequences:
Eval digests and ablation tables include median / max / highRegret≥100; CLI baseline deltas compare against the loaded suite’s measured greedy and random metrics.

## D-032 Bench protocol
Date: 2026-09-18
Status: Accepted

Decision:
- **M-BENCH** compares models under a pinned provider+model with failover disabled (`INFERENCE_MAX_PROVIDERS=1`). The M-TOOLS adversarial record was a 71/8/1 gemini/openrouter/groq mixture — that is not a single-model claim.
- Measurement set remains **held-out adversarial** (D-029 / D-030). Report optimality **and** regret distribution (D-031).
- Axes: **prompt version** (`base` / `grounded` / …) and **model** (`--models provider:model`).
- Fixture keys are **repeat-aware**: `repeat` enters the hash only when ≠ 0 so legacy fixtures stay valid; `--consistency N` uses `fetch.setRepeat(i)` without changing the HTTP body.
- Cost is informational via committed `evals/pricing.json`; **null when unpriced** (never invent). Free-tier known models may be `0` while quota still binds.
- Committed summary: `evals/out-committed/bench.summary.json`. Partial single-model proof is allowed when other pins/variants miss fixtures; do not invent rows from fallbacks.

Rationale:
Model comparison without a pin conflates provider routing with model quality. Repeat-aware keys enable self-consistency without rewriting recorded bodies.

Consequences:
`--mode bench` defaults to heldout + adversarial + max-matches 0. Remains in force for batches 3 and 10 under D-033. Multi-model rows await operator record.

## D-033 Product direction: an agent evaluation framework with an exact oracle
Date: 2026-09-18
Status: Accepted

Decision:
**Supersedes D-025’s scope and batch order.** This repository is an **agent evaluation framework** that measures and **diagnoses** agent decision quality against exact ground truth. The robot battle is its **reference environment**, not the product’s end. The framework includes a bring-your-own-key model bench and a published methodology. The teaching sandbox (D-020) is delivered **through measurement**, not assertion — consequence and diagnosis, not a scoreboard claim.

### Scope

1. **Environment interface** — The measurement core depends on a contract (legal moves, apply move, terminal test, terminal value, prompt description), not on this game. The existing game becomes its first implementation. No measurement changes in the port.
2. **Diagnostic layer** — Failure clustering by decision type (missed lethal, ignored incoming threat, wasted energy, over-defending at full health); ranked “what would help most” from variant results; stakes distribution of errors (frequent-and-cheap vs rare-and-fatal); one replayable counterexample per run (state, the agent’s own reason string, the optimal move, the cost); run-to-run diffs with confidence intervals.
3. **Three new measurements** — Prompt-perturbation sensitivity (same decision, reworded and reordered: does the choice flip?); adversarial-context robustness (inject a false grounded fact or wrong tendency summary: does the agent trust it?); information-scaling curves (raw state → grounded → memory → both, reported as a curve).
4. **BYOK model bench + committed leaderboard** — Pinned model per run, no failover (bench pin protocol D-032 / batch 3); rerun on demand, never on a schedule. The “leaderboard” is a **committed static comparison page**, not a live backend — D-020’s anti-scope against a real backend/leaderboard stays in force.
5. **UI** — Builder, Arena, results and diagnostics pages; renders the framework, owns no measurement logic.
6. **Methodology writeup** — Told through the four failed measurement sets (standard had no stakes; pivotal was greedy-saturated; adversarial at regret≥100 gave n=1; the inert-seed duplicate miscount) and the falsified pre-registered hypothesis (D-024 / D-030), linking the committed reproduce logs.
7. **Second reference environment** — A small, provably solvable task proving the interface is real rather than asserted.

### Explicitly cut: post-match coach

D-025’s M-UI part 2 included a post-battle coach; **this supersedes that**. Reasons: (a) a coach demonstrates LLM machinery this repo has already demonstrated and serves the sandbox framing rather than the framework; (b) shipping it inside a UI batch means it ships **unmeasured**, which contradicts D-018 and D-023. The first public Report is **trace-driven and cites oracle regret**. If a coach is ever built, it goes in `src/agent` with its own prompts, fixtures, and evals **first**.

### BYOK (locked)

Browser-direct multi-provider calls are blocked or unsafe: `completeChat` reads `process.env` (`src/inference/client.ts`), sends `Authorization: Bearer` straight to providers, Gemini’s OpenAI-compat endpoint lacks usable CORS for browser apps, Groq’s SDK treats browser keys as dangerous, and Cloudflare puts the account id in the URL (`src/inference/providers.ts`). Therefore:

- The UI ships with **deterministic CPU** (greedy/random) plus **fixture-replayed** LLM results by default.
- Live BYOK play is **OpenRouter-only**, key held in memory, with an explicit warning.
- The D-016 serverless proxy stays **deferred** until multi-provider live play is actually wanted.

### Arena correctness (locked for UI batches)

`playAgentTurn` always calls `stepBattle` on timeout, invalid output, or provider failure (`src/agent/llm-turn.ts`); no in-flight type exists. The UI must model the in-flight turn explicitly and apply the returned runtime **only after awaiting**, or double-click desyncs the displayed state from the decision trace. Design against this race in batches 6–7.

### Honesty constraints on the diagnostic layer (binding)

Every conclusion must trace to a specific measurement. Where n is too small, the output must say **“insufficient evidence”** instead of asserting. No recommendation may be generated that the measured data does not support. Precedent: D-031 (report regret distribution alongside rate).

### Known limitations

- The reference environment is small: **2** equipped skills (`MVP_SKILL_SLOT_LIMIT`), **20**-turn cap (`MAX_TURNS`) — `src/engine/constants.ts`.
- Sample sizes are small (n=20 snapshots; small match counts).
- Published LLM figures came from a multi-model failover mixture before pinned single-model runs (PR #23 / batch 3).
- Memory variants (`agent-v2-memory`, `agent-v3-grounded-memory`) remain **unmeasured**.
- Cost is **null** for unpriced pins.
- Findings concern **methodology**, which transfers, rather than the domain, which does not.

### Locked 11-batch plan

1. ✅ Discrimination + parked fixes
2. ✅ M-TOOLS grounding/memory ablation
3. 🔄 M-BENCH headless (PR #23)
4. **Correctness hardening** — silent risks on existing files, before any Report screen: CI must re-prove headline numbers (pivotal / adversarial / bench / discriminate regen currently `skipIf`-gated); Oracle MemoScope identity must include the numeric `maxTurns` (and not be bypassable by same-string different policy); grounding must model fallback-stabilize, not silently zero unknown effect categories, and not mis-state `diesNextTurn` when the CPU would guard; greedy must call grounding instead of reimplementing combat arithmetic; pricing must cover the recorded Groq pin; sanitize **new** fixture records (drop provider junk; do not rewrite committed fixtures — they are the hash preimage); complete `.env.example` for `INFERENCE_*` vars; strengthen weak tests that assert “finite” or exit code instead of published values.
5. Environment interface + port the game to it (no behavior change; all committed artifacts must still replay)
6. UI part 1 — scaffolding (React, entry, state layer, component test env) + Builder
7. UI part 2 — Arena + results pages (design against the in-flight race)
8. Diagnostic layer (headless first, then surfaced in the UI)
9. The three new measurements (pre-register protocols before implementation — D-024 pattern)
10. BYOK + committed leaderboard page + methodology writeup
11. Second reference environment + publish

### Decisions kept in force

D-018, D-020 (coach line amended), D-022, D-027, D-029, D-031, D-032. Pin / repeat / cost protocol remains in force for batches 3 and 10.

### D-026

Closed as **won't-fix** (see D-026 amendment). Seed-spread and snapshot reselection stay known limitations; they are not in batch 4 or batch 5.

Rationale:
Measured reality: grounding changed 0 of 20 decisions, and rate vs value disagree (greedy 0% / mean regret 104.35 vs LLM 5% / 4.25 on held-out adversarial). The interesting output is **diagnosis**, not a score. Structural: the measurement core imports this game’s `stepBattle`, `MVP_SKILL_CATALOG`, `createGreedySelector`, and `src/data/opponents` directly — the interface must land before the UI hard-codes the game into screens.

Consequences:
ROADMAP / PROGRESS / README follow this 11-batch order. Next after PR #23 is **batch 4 (correctness hardening)**, then the environment interface (batch 5). Coach is out of scope.

### Amend — 2026-09-18 — Execution grouping (five execution batches)

The **11 locked batches above are unchanged** in number and content. For execution they are **grouped into five execution batches**, because several share one gate and one audit:

- **Execution batch A** = locked batches **4 + 5** (correctness hardening + environment interface). Both touch the same `src/eval` files and both must leave every committed number byte-identical, so they share one gate: all committed suites, summaries, and fixtures still replay unchanged.
- **Execution batch B** = locked batches **6 + 7** (UI scaffolding + Builder + Arena + results). Splitting the UI means the second half rebuilds context. Highest risk in the plan: first runtime dependencies, first non-headless code, and the in-flight race already recorded in this entry.
- **Execution batch C** = locked batches **8 + 9** (diagnostic layer + the three new measurements). Same metrics layer and reporting surface. The binding honesty constraint in this entry applies most sharply here.
- **Execution batch D** = locked batch **10** (BYOK + leaderboard + methodology writeup).
- **Execution batch E** = locked batch **11** (second reference environment + publish).

ROADMAP / PROGRESS show both numberings (locked batch + execution group letter) so neither drifts.

### Amend — 2026-09-20 — Execution batch B subdivides into B.1 / B.2

Locked batches **6** and **7** are unchanged in number and content. After foundation (D-038–D-041) landed on main, remaining UI work is executed as:

- **B.1 — app shell + Builder.** Root `index.html` → `src/ui/main.tsx`; Tailwind; Builder produces validated `AgentConfig` via `validateAgentConfigInput`; local form state; production `vite build` in CI; no Arena or turn execution.
- **B.2 — Arena + results.** Must use the epoch-guarded battle-view store (D-041). **Design to resolve (not decided here):** a UI-owned turn-result shape that applies CPU `step` results and may carry an optional genuine agent `DecisionTrace` — without importing eval types or fabricating traces.

Rationale:
Foundation already shipped; Builder does not need turn wiring. Keeping locked 6/7 intact avoids rewriting the product plan while allowing a second gate before Arena/in-flight risk.

Consequences:
ROADMAP / PROGRESS show B.1 / B.2 beside locked batches 6 and 7. Store contract widening is deferred to B.2 design, not implemented in B.1.

### Amend — 2026-09-18 — Execution batch A splits into A1 / A2 / A3

Locked batches **4** and **5** are unchanged in number and content. Execution batch **A** cannot share one gate. Three findings:

1. Grounded facts are serialized into the prompt (`ENGINE_GROUNDED_FACTS\n${JSON.stringify(input.grounding)}` at `src/agent/prompt.ts:154`) and those messages are hashed into fixture keys (`src/eval/transport.ts:48–60`). Correcting the facts changes prompt bytes, invalidates grounded fixtures, and breaks committed bench/ablation rows — contradicting a single byte-identical gate for all of A.
2. Committed snapshot suites embed a full `BattleRuntime` including turn history (e.g. `evals/suites/snapshots.adversarial.heldout.json:10–73`). An interface that introduces a new serialized state type cannot keep those files byte-identical; only an adapter preserving today’s JSON is compatible with that gate.
3. Greedy re-implements combat arithmetic (`src/agent/baselines/greedy.ts:26–52`). Routing it through grounding needs a differential proof that no choice changes on any committed suite state before it can share the byte-identical gate.

Therefore execution batch **A** (locked **4 + 5**) splits into:

- **A1 — hardening, prompt-byte frozen.** Enable CI regen gates (pivotal / adversarial / bench / discriminate); Oracle MemoScope identity must include numeric `maxTurns` plus policy/catalog identity; add pricing for the recorded Groq pin `openai/gpt-oss-20b`; complete `.env.example` `INFERENCE_*` names; sanitize **new** fixture records only (do not rewrite committed fixtures); strengthen weak tests; greedy→grounding **only if** a differential proof shows zero choice changes on committed suite states. **Gate: every committed number byte-identical.**
- **A2 — grounding correctness and ablation re-run (D-034).** Fix the facts, bump the prompt version, regenerate grounded fixtures, republish the ablation. Explicitly **not** under the byte-identical gate — prompt bytes change by design. Requires an operator record run with keys.
- **A3 — environment interface, adapter only.** `DecisionSnapshot.runtime` stays today’s `BattleRuntime` JSON; no new serialized state type. **Gate: byte-identical.**

ROADMAP / PROGRESS show A1 / A2 / A3 alongside locked batch numbers 4 and 5.

### Amend — 2026-09-18 — A1 hardening shipped (prompt-byte frozen)

**A1 done** on `feat/a1-hardening`. Shipped under the byte-identical gate (no edits to `prompt.ts` / `grounding.ts`; committed `evals/suites`, `evals/fixtures`, `evals/out-committed` unchanged):

- Greedy→grounding **landed**: differential proof over suite + match-walk decision states found **0 choice diffs**; `createGreedySelector` now calls `projectSkillEffects` / damage projections; permanent agreement test added.
- Oracle `MemoScope` identity is `policy|agents|maxTurns=<n>|catalog=<skillIds>` via `oracleMemoIdentity`; reuse across maxTurns/catalog throws.
- CI: separate `drift` job on every PR/push with `SNAPSHOT_DRIFT=1` re-proves pivotal / adversarial / bench / discriminate regen (verify stays fast; measured drift wall ~5 min).
- Pricing entry `groq:openai/gpt-oss-20b`; `.env.example` `INFERENCE_*`; sanitize-on-record strips `id`/`created`/`extra_content`/`thought_signature` (new records only).
- Weak tests pin published EVAL / `adversarial.baselines.json` values.

Next: **A2 (D-034)** — grounding fact correction + ablation re-run (needs keys). Not under the byte-identical gate.

## D-034 Grounding correction and ablation re-run (pre-registered)
Date: 2026-09-18
Status: Accepted

Decision:
Written **before** correcting grounding facts (same pattern as D-024).

### Context

D-024 was falsified using grounding facts that were partly defective:

- `diesNextTurn` is computed against the CPU’s **pre-action** defense: threat uses `projectSkillEffects(skill, player, cpu)` on the current CPU combatant (`src/agent/grounding.ts:163`) and then `diesNextTurn: maxIncomingDamage >= cpu.health` (`:188`), so it can report false when the CPU would guard this turn.
- Fallback-stabilize effects are **not modelled** in grounding at all. The engine defines `FALLBACK_ENERGY_RECOVERY = 2` and `FALLBACK_DEFENSE_GAIN = 2` (`src/engine/constants.ts:21–22`) and applies them in `resolveFallback` (`src/engine/combat.ts:125–126`).

This does **not** invalidate D-030’s published result: grounding **as implemented** changed **0 of 20** decisions on held-out adversarial. Corrected facts still deserve a re-run.

### Prediction (pre-registered)

With corrected facts (accurate `diesNextTurn` after this-turn CPU defense, and fallback effects modelled), the grounded arm will change **at least one** decision versus base on the held-out adversarial suite, and will **not increase** mean regret.

### Pre-specified test

- Same held-out adversarial suite (**n=20**).
- Same pinned model per D-032; temperature **0**.
- Arms: **base** vs **corrected-grounded** (new prompt version).
- Report: optimality; regret mean / median / max; per-decision audit of which picks changed.

### Falsifier

If corrected grounding still changes **zero** decisions, publish that the failure is **not** attributable to fact quality, and record the next candidate explanation (the model may already infer these facts from raw state, or the adversarial set may be dominated by near-equal choices).

### Bookkeeping

- Corrected facts get a **new prompt version**.
- Old grounded fixtures remain committed as the record of the D-024 / D-030 run and are **not** deleted or rewritten.

Rationale:
Measurement honesty requires separating prompt-byte-frozen hardening (A1) from a deliberate fixture-invalidating fact correction (A2 / this decision).

Consequences:
A2 implements this protocol; EVAL.md publishes the outcome; D-030’s historical 0/20 row stays the as-implemented record.

### Amend — 2026-09-19 — Corrected facts shipped (results pending record)

**A2 code complete** on `feat/a2-grounding-correction`. Shipped:

- New prompt version **`agent-v4-grounded`** (`PROMPT_VERSIONS.groundedV2`), play option **`facts-v2`**, eval variant **`grounded-v2`**.
- Three defects corrected in V2 facts only: (1) per-candidate `diesNextTurnAfterMove` after this-move defense/heal (global pre-action kept as `diesNextTurnPreAction`); (2) unaffordable candidates project fallback-stabilize (`FALLBACK_ENERGY_RECOVERY` / `FALLBACK_DEFENSE_GAIN`); (3) unknown effect categories return `unmodelledCategory` from `projectSkillEffects` (non-fatal); `computeGroundedFactsV2` throws if any candidate is marked; greedy skips marked skills.
- **`agent-v2-grounded` / `computeGroundedFacts` / committed grounded fixtures / D-030 result preserved** unchanged as the historical record.

Operator must run the D-034 record (keys) before EVAL results are filled; see EVAL.md corrected-arm section.

### Amend — 2026-09-19 — Suite n after D-035

D-034’s pre-registered “n=20” / “0 of 20” wording referred to the pre-dedupe adversarial suite. After D-035 the held-out adversarial suite is **n=13** distinct states. The zero-change conclusion for the **historical** grounded arm is unaffected. Operator record for `base` vs `grounded-v2` must use the regenerated suite under a **pinned** model (D-036).

### Amend — 2026-09-19 — Comparative claim WITHDRAWN pending pinned run

Any reading that the unpinned post-D-035 `grounded-v2` ablation **falsified** the “mean regret does not increase” half of the prediction, or that grounded-v2 “changed one decision for the worse,” is **WITHDRAWN**. Two consecutive unpinned record runs with identical prompts and T=0 moved **base** alone on dev:adversarial from **50.00% / 1.00** to **33.33% / 334.50** solely by provider assignment under failover. The apparent one-decision delta sits inside that variation. The prediction remains testable **only** under a pinned model (D-036). D-030’s historical zero-change claim on the prior suite is unaffected.

### Amend — 2026-09-19 — Pinned gemini result (resolves withdrawal)

Pinned record under **`gemini/gemini-3.5-flash-lite`** (D-036), post-D-035 adversarial suites, keyless replay verified:

| split | base vs grounded-v2 decision diffs | base mean regret | grounded-v2 mean regret |
| --- | ---: | ---: | ---: |
| dev (n=6) | **0** | 334.50 | 334.50 |
| heldout (n=13) | **1** | 2.00 | 2.15 |

`grounded` ≡ `grounded-v2` on both splits. **Prediction:** ≥1 decision change on held-out — **met**. Mean regret does not increase — **falsified** (2.00 → 2.15). At this n the effect is one decision and is not an improvement claim.

### Amend — 2026-09-19 — Match scenarioIds trimmed (not re-recorded)

Held-out base match scenarios that lacked complete gemini-pinned fixtures (`aegis__seeded-random__fracture__s101`, `mnemonic__seeded-random__fracture__s101`) were **removed from the manifest** rather than re-recorded. Reason: no published result depends on match recordings (ablation is snapshot-measured, D-033/D-034); free-tier quota was exhausted. Fixture files were not deleted. Snapshots and pins unchanged.

## D-035 Snapshot suites counted duplicate states
Date: 2026-09-19
Status: Accepted

Decision:
Committed snapshot suites must assert **distinct decision states**. The assertion lives in the generators and in the drift guards — an invariant that fails loudly at generation time, not another local correction.

### Defect (re-verified on main @ b0dac3c)

Distinct states by `{turn, playerHp, playerEnergy, playerDefense, cpuHp, cpuEnergy, cpuDefense, playerSkillId}` (defense is the only mutable non-HP/energy combatant field; there is no cooldown in the engine):

| suite | n | distinct states | notes |
| --- | ---: | ---: | --- |
| standard dev | 20 | 2 | 2 states ×10 |
| standard heldout | 20 | 2 | 2 states ×10 |
| pivotal dev | 20 | 2 | 2 states ×10 |
| pivotal heldout | 20 | 8 | |
| adversarial dev | 20 | 3 | |
| adversarial heldout | 20 | 6 | one state appears **15** times |

**Cause:** With a deterministic player policy and an injected greedy CPU selector, the engine RNG seed is never consumed, so scenarios that differ only by seed produce identical battles. Selectors rank candidates and take the top `targetCount` by score (pivotal: `selectPivotalSnapshots` → `qualified.slice(0, targetCount)` at `src/eval/snapshots.ts:269`; adversarial: same pattern at `:423`; standard: `selectEveryKth` at `:164–196`). Tie-breaks use `scenarioId` then turn; nothing dedupes by decision state. Distinct `(scenarioId, turn)` rows are therefore often clones of the same combat state.

**Weighting bias:** Published greedy mean regret is multiplicity-weighted over duplicate rows. On held-out adversarial, published **104.35** vs unweighted over 6 distinct states **≈336.5** — the bias **flattered** the published comparison (greedy looked less bad). Dev adversarial: published **301.85**, unweighted **≈668.3**. Match suites collapse similarly (greedy+greedy ≈6 distinct battles / 60 scenarios); Wilson intervals at n=120 overstate precision. `countDistinctMatchups` counts strata (seed excluded), not battle fingerprints, so it can report full stratum coverage while battles are clones.

**What survives (do not over-correct):**
- Greedy **0%** optimal on adversarial suites — true by construction of the selection rule (`greedyRegret >= 1`).
- Grounding changing **zero** decisions in D-030 / D-034 — an agreement claim, independent of n.
- Direction of the discrimination verdict (optimal ≫ greedy).

**What does not survive:** published mean regrets, effective sample sizes, and Wilson intervals that treated seed clones as independent trials.

### Third instance of the same root cause

This is the third time inert / non-discriminative sampling produced inflated n: (1) held-out split duplicating dev; (2) stratified sampling collapsing to one matchup; (3) snapshot selection counting duplicate decision states. Local patches failed to prevent recurrence. **Fix:** generators keep the highest-ranked instance of each distinct state while filling `targetCount`, record honest `count` / `targetCount` / `distinctStateCount` on shortfall (no padding), and drift guards plus an always-on test assert `distinctStateCount === snapshots.length` with unique state keys.

Rationale:
Sample-size honesty is a pre-condition for every published comparison; another one-off suite edit would leave the class of bug open.

Consequences:
Suites regenerate smaller where the split cannot supply 20 distinct states; EVAL.md numbers are corrected; match statistics and headroom denominators move to distinct-battle / distinct-state units; operator re-record is required for fixture-backed LLM/bench rows on new states.

### Amend — 2026-09-19 — Shipped on `fix/duplicate-state-suites`

**What shipped:** `decisionStateKey` + generator dedupe; suite schema `distinctStateCount`; always-on uniqueness test; full byte-equality drift guards (never weakened); match Wilson / rates over battle fingerprints; headroom first-visit-wins; regenerated suites + baselines + discriminate summary; pending empty bench summary.

**New distinct counts (selected / target):**

| suite | old n (distinct) | new n (= distinct) |
| --- | ---: | ---: |
| standard dev | 20 (2) | **20** |
| standard heldout | 20 (2) | **20** |
| pivotal dev | 20 (2) | **8** |
| pivotal heldout | 20 (8) | **8** |
| adversarial dev | 20 (3) | **6** |
| adversarial heldout | 20 (6) | **13** |

**Published numbers that moved (selected):**

| metric | old | new |
| --- | ---: | ---: |
| heldout adversarial greedy mean regret | 104.35 | **156.15** |
| heldout adversarial random mean regret | 52.18 | **78.08** |
| dev adversarial greedy mean regret | 301.85 | **335.17** |
| pivotal greedy (dev / heldout) | 100% / 95% | **87.5% / 87.5%** |
| discriminate headroom points (dev / heldout) | 340 / 381 | **40 / 91** |
| discriminate greedy n (dev / heldout) | 120 / 120 | **41 / 53** distinct battles |
| overall non-zero spread (verdict reason) | 67.1% | **70.2%** |

LLM ablation / bench rows on the new adversarial suite are published under pinned gemini (D-034 amend / D-036). Historical D-030 0-decision claim preserved.

## D-036 Pinning is required for any comparison
Date: 2026-09-19
Status: Accepted

Decision:
Any **comparative** measurement across prompt variants (ablation, multi-variant record/live/replay) requires exactly one pinned `provider:model`. The pin comes from either `--models` or a unanimous recorded manifest pin. The CLI **fails hard** without a resolved pin on multi-variant record/live. Legacy unpinned multi-variant replay still runs (so CI is not blocked on old manifests) but **withholds** comparative output — a warning a reader can scroll past is not enforcement. The pin is written onto each manifest variant entry and replayed with `maxProviders=1` via the existing bench helper (`pinnedInferenceEnv`). Single-variant exploration may stay unpinned but is warned as not comparable across runs.

Evidence (same defect as D-032, second location):
Two unpinned multi-variant record runs, identical args/prompts/T=0, base **dev:adversarial**: run 1 → 50.00% optimal / mean regret 1.00; run 2 → 33.33% / 334.50. Only the answering provider mixture changed (gemini dominated with many 429s; groq/openrouter also served). Fixture keys include host+model, so failover reassigns which recorded answer a decision gets.

This **generalises D-032** from `--mode bench` to every comparative measurement path. **Gameplay failover in `src/inference` is deliberately unchanged** — only the eval harness refuses unattributable comparisons.

**Recordings from unpinned multi-variant runs are not committed.** Local leftovers from those runs stay out of git. **Only recordings from a pinned multi-variant run become the published record.** After the operator’s pinned run, matching keys regenerate or reuse by content hash — no manual salvage of the unpinned mixture.

Rationale:
Without a pin, “variant A beat variant B” confounds routing with prompt quality — the same root cause that forced D-032 for bench.

Consequences:
Operator D-034 / D-035 refill used `--models gemini:gemini-3.5-flash-lite` (pinned record committed). CI `eval:replay --suite all` is green on those fixtures.

## D-037 Environment interface (A3), adapter-only
Date: 2026-09-19
Status: Accepted

Decision:
Locked batch 5 / execution **A3** lands an `Environment` contract in `src/env/` with the robot game as `robotEnvironment`. State type is concrete `BattleRuntime` (no generics until batch 11). Methods: `start`, `apply`, `isTerminal`, `equippedActions`, `legalActions`, `terminalValue`, `memoStateKey`, `decisionStateKey`.

**On the interface (not oracle-private):** `terminalValue` and both state keys. A second environment must supply scoring and memo/dedupe fingerprints; leaving them private would reopen the interface in batch 11.

**`equippedActions` ≠ `legalActions`:** the oracle enumerates all equipped CPU skills (unaffordable still stepped; engine fallback). Snapshots, metrics, and discriminate filter by current energy. Both shapes are preserved exactly.

**Out of scope for A3:** prompt construction, grounding fact shapes, observation probe semantics, catalog prompt payloads (`src/agent/prompt.ts` / `grounding.ts` untouched — fixture key preimages). `DecisionSnapshot.runtime` stays today’s `BattleRuntime` JSON. Agent `observe` / `llm-turn` still call `stepBattle` directly (gameplay path, not measurement core).

**Gate:** byte-identical committed suites, summaries, fixtures, and EVAL numbers; SNAPSHOT_DRIFT drift-guards plus a committed differential proof covering (1) adapter `apply`/`start` vs engine `stepBattle`/`startBattle`, (2) suite `bestResponse` vs committed suite JSON, and (3) match-walk parallel greedy choices + byte-identical runtime serialization. Not a second independent oracle implementation — once parallel runtimes are byte-identical, oracle equality follows from purity.

**Batch 11 will need:** a different `State` / `Action` (generics or a second concrete adapter), pluggable prompt description without `MVP_SKILL_CATALOG`, and likely a new snapshot serialization decision — not a silent change to `BattleRuntime` JSON.

Rationale:
D-033’s product is an evaluation framework; hard-wiring measurement to engine internals blocks a second reference environment.

Consequences:
ARCHITECTURE layering is `eval → env → engine`. ESLint restricts `src/env` to engine-only imports. CI drift job lists `env-differential.test.ts` (flag set unchanged from issue #28).

## D-038 UI layer eslint fence
Date: 2026-09-20
Status: Accepted

Decision:
`src/ui/**` is a first-class layer with `no-restricted-imports` denying `**/eval`, `**/eval/**`, `node:*`, `fs` / `fs/**`, `path` / `path/**`, `child_process`, `os`, `worker_threads`, and `module`. Proof-of-bite is a node-suite test that runs ESLint `lintText` against a virtual `src/ui/` path (no on-disk violating file).

Rationale:
Browser code must not pull the Node-only eval harness or filesystem APIs. Matching other per-layer blocks keeps the fence discoverable.

Consequences:
UI imports of eval or Node builtins fail lint. A future root-level entry (`main.tsx` outside `src/ui/`) is **not** covered — carry-forward before shipping an app shell.

## D-039 Dual tsconfig: DOM/jsx scoped to src/ui
Date: 2026-09-20
Status: Accepted

Decision:
Root `tsconfig.json` keeps `"lib": ["ES2022"]` (no `jsx`) and `exclude: ["src/ui"]`. `tsconfig.ui.json` extends root and **overrides** `include`, `exclude`, `compilerOptions.lib` (`ES2022`+`DOM`+`DOM.Iterable`), and `compilerOptions.jsx` (`react-jsx`). Typecheck runs both projects. Child `exclude` must be set explicitly so root’s `exclude: ["src/ui"]` is not inherited (otherwise zero inputs).

Rationale:
Adding `"dom"` at the root would expose DOM globals to engine, agent, inference, and eval under `tsc`.

Consequences:
Root `lib` staying free of `"dom"` is **load-bearing** for the engine boundary. The Commit 2 probe (temporary engine file referencing `document`) is a **one-shot demonstration**, not a standing guard. A later batch adding `"dom"` to the root would **silently remove** the separation.

## D-040 Vitest node + ui projects; coverage at root
Date: 2026-09-20
Status: Accepted

Decision:
`vitest.config.ts` uses `test.projects`: project `node` keeps `include: ["src/__tests__/**/*.test.ts"]` and `environment: "node"`; project `ui` uses `include: ["src/ui/**/*.test.ts", "src/ui/**/*.test.tsx"]` and `environment: "jsdom"`. Coverage stays on the **root** `test.coverage` block (not per-project).

Rationale:
Preserve byte-identical collection of the existing node suite while enabling component/DOM tests without overlapping globs.

Consequences:
New UI tests must live under `src/ui/` so they do not inflate the node project count. Unfiltered `vitest run` executes both projects.

## D-041 Battle-view in-flight turn contract
Date: 2026-09-20
Status: Accepted

Decision:
`src/ui/store` holds a vanilla Zustand (`zustand/vanilla`) battle-view store with an explicit `InFlightTurn` and monotonic `turnEpoch`. `dispatchTurn` injects `playTurn` (no provider calls in the store). Three failure modes are prevented **by construction**: (1) no pre-await `runtime` write (no optimistic apply); (2) second dispatch while `status === "inFlight"` returns `already_in_flight`; (3) resolve commits only when `epoch === turnEpoch` (stale ignored; `resetBattle` bumps epoch to invalidate in-flight).

Rationale:
`playAgentTurn` always returns the same `{ step, trace }` shape after `stepBattle` on every exit path; the UI must apply runtime only after await and must not lose races. Vanilla `createStore` keeps the model pure and testable without React components (stack library is Zustand per D-005; vanilla vs React bindings is a batch choice, not a D-005 mandate).

Consequences:
Arena/Builder must use this contract (or an equivalent epoch guard). Wiring real `playAgentTurn` / BYOK is a later batch.

## D-042 UI turn result, Arena wiring, and deferred B.3 / B.4
Date: 2026-09-20
Status: Accepted

Decision:
Execution **B.2** (locked batch 7) ships Arena + results with these contracts:

1. **`UiTurnResult = { step; trace? }`** — assignable from `PlayAgentTurnResult`; greedy CPU returns `{ step }` only (no fabricated traces; no eval imports).
2. **`dispatchTurn` reserves `turnEpoch` and marks in-flight before invoking injected `playTurn`.** Sync throws and promise rejections share one epoch-checked `failTurn` path (`lastError`, idle, clear flight; **runtime unchanged**). `clearBattle` / `resetBattle` bump epoch so a later settle cannot overwrite them. Terminal sessions reject with `battle_over`.
3. **Greedy adapter** (`createGreedyPlayTurn`) uses direct `stepBattle` + `createGreedySelector(runtime.session.cpu)` so CPU config cannot disagree with the live battle.
4. **Builder:** Validate stays non-navigating; **Continue to battle setup** shows only while `validated !== null`; any edit invalidates. App preserves player/opponent/seed draft; Builder `initialConfig` restores fields without minting a new `agentId` when provided. Restart rebuilds from the same triple; return-to-Builder calls `clearBattle`.

**Deferred (named, not done in B.2):**
- **B.3 — Fixture-replayed LLM UI** — browser-safe fixture playback for LLM turns (D-033 default path); no Node eval harness in the browser.
- **B.4 — MVP localStorage save slot** — one slot (D-006 / AGENT_RULES).

Live BYOK remains execution batch D / locked batch 10.

Rationale:
Resolves the open design note in the D-033 B.1/B.2 amend: CPU play must not invent traces, and leave-while-pending must be proven via an injected deferred `playTurn` (no production delays). Fixture-replay and save slot stay product defaults but are sequenced after Arena/results so B.2 stays mergeable.

Consequences:
ROADMAP / PROGRESS list B.3 then B.4 after B.2. Do not mark fixture-replay LLM UI or save slot complete until those execution slices land.

### Amend — 2026-09-20 — B.1 merged; B.2 implements D-042

B.1 (shell + Builder) is on main. B.2 implements D-042 above. Follow-ups are **B.3** then **B.4** (not locked-batch renumbers — execution-only slices after locked batch 7).

### Amend — 2026-09-21 — D-043 Decision Lab (execution B.2d)

Decision:
Insert execution **B.2d — Decision Lab** after **B.2** and **before** **B.3**. Retain **B.3** (fixture-replayed LLM Arena) and **B.4** (save slot) as named, **not started**, not redefined. B.2d is a **partial diagnostic slice**; locked batch 8 / execution C is **not** complete.

Ship in one PR:

1. **Shared pack contract** (`src/decision-lab/pack-v1.ts`): types + `assertDecisionLabPackV1`; no Node/eval/DOM. Deterministic pack (inputHashes only; no timestamps/commit SHAs).
2. **Exporter** (`src/eval/lab-pack.ts`, `npm run lab:pack`): heldout adversarial n=13; greedy + LLM `base`/`grounded` via `createReplayFetch` only; optional `onDecision` on `evalLlmSnapshots` (default omitted → bench byte-unchanged); fixture_miss → `unavailable` (never fallback skill as recorded); single committed pack at `src/ui/lab/pack/decision-lab.v1.json`.
3. **UI Lab**: Browse / Inspector (oracle ties, all `best` ids) / Compare (base vs grounded on recorded∩recorded) / downloadable report; schema assert error state; no eval/Node imports.
4. **Product clarity:** Arena opponent is greedy CPU; Builder skills affect Arena; modules do not change greedy combat (LLM prompt surface for B.3+).

Rationale:
Operators need inspectable per-decision evidence without waiting for full diagnostic batch C or live LLM Arena (B.3). Offline pack keeps UI browser-safe and CI deterministic.

Consequences:
ROADMAP / PROGRESS list **B.2d** then **B.3** then **B.4**. Do not mark locked batch 8 complete. README status may be corrected to reflect shipped UI + Decision Lab.
