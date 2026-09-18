# DECISIONS

## Decision Log Format
Each entry includes ID, date, status, decision, rationale, and consequences.

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

## D-021 Milestone Order (Eval Before Tools)
Date: 2026-09-17
Status: Accepted

Decision:
Roadmap priority is M-INF → M-AGENT → M-EVAL → M-TOOLS → M-COACH → M-UI.

Rationale:
Grounding and memory (M-TOOLS) must be proven by ablation against an eval baseline, so evals come first. Supersedes the M-TOOLS-before-M-EVAL order recorded in D-014.

Consequences:
PROGRESS / ROADMAP follow this order. M-AGENT may start a minimal M-EVAL baseline alongside the agent turn; M-TOOLS stays after measurable agent quality exists.

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
Status: Accepted

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
