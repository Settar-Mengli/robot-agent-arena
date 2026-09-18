# ROADMAP

## Product Direction
- Repo and folder name: robot-agent-arena.
- Temporary app title: AGENT ARENA.
- Pending final-name candidate: ARCZOLVEX.
- ARCZOLVEX must remain a candidate only until legal finalization is complete.
- AGENT ARENA is a 1v1 turn-based robot fighting game where players build, name, and configure robot agents.
- **Strategic direction (D-014):** the product is an agentic-AI system whose environment is this deterministic game. The pure engine stays the untouched, tested backbone. AI is a strategy provider behind the existing `selectCpuSkillId` seam; UI showcases the agents after the AI layer and evals are proven (headless-first).
- **Positioning (D-020):** an interactive agent-design sandbox that teaches AI-agent engineering through measurable consequence. The battle is the environment, not the point; the five modules and post-match report are the teaching surface; M-EVAL is core evidence. Focused sandbox/demo only — not a course, LMS, or content platform. Does not change the engine, seam, determinism (D-019), or the AI milestone spine below.

## MVP Scope
Locked stack and game shape still hold (React + Vite + TypeScript + Zustand + localStorage; turn-based; fictional vocabulary). Sequencing is updated: AI layer and evals before UI.

- Engine-first implementation (DONE).
- Pure TypeScript battle engine (DONE).
- Session-based 1v1 battle flow + interactive `startBattle` / `stepBattle` driver (DONE).
- 4 screens: Home, Builder, Arena, Report — **re-sequenced to M-UI** (after M-EVAL); still in scope, later.
- 5 modules: Core Identity, Memory, Sigil and Security, Rules, Strategy (framed as the agent-design teaching surface — D-020).
- 8 canonical skills.
- Player agent naming.
- 2 CPU opponents: FRACTURE and SENTINEL-X (catalog DONE).
- 1 localStorage save slot (PLANNED with UI / persistence).
- Max 20 turns.
- Seeded RNG (DONE; restore-from-state DONE).
- Post-match report: explanatory lesson of which design choice caused the result, fictional vocabulary only (PLANNED; coach surfaces in Report later — D-020).
- **PLANNED:** Grounding/memory tools (M-TOOLS); serverless inference proxy with M-UI; coach + screens (see AI milestone spine / D-021). Eval harness (M-EVAL) is **DONE** with measured held-out LLM results in EVAL.md.

## Milestones

### Completed engine / infra spine
- M0–M4: Foundation, domain model, session core, simulation, combat vertical slice — DONE.
- Convergence: shared `resolveTurn`, status-only completion, min-1 skill validation — DONE.
- Interactive driver (`startBattle` / `stepBattle`) + RNG restore — DONE.
- Infra: ESLint (engine-purity), coverage, CI, ARCHITECTURE + README — DONE.
- CPU opponent catalog (FRACTURE, SENTINEL-X) — DONE.
- M-INF multi-provider OpenAI-compatible client (`src/inference/`) — DONE (serverless proxy deferred to M-UI per D-016 amendment).
- M-AGENT LLM opponent turn + greedy baseline (`src/agent/`) — DONE (PR #9).
- M-EVAL eval harness (`src/eval/`, `evals/`, `EVAL.md`) — **DONE** (incl. independent held-out split, keyless replay, measured held-out LLM results); next is M-TOOLS.

### M5 / M6 (re-sequenced)
Former UI Integration (M5) and Persistence/Reporting (M6) are **not cancelled**. They land as **M-UI** (and related persistence) after the AI spine below so no UI is thrown away when agents land.

### AI milestone spine (headless-first, D-021)

#### M-INF — Inference layer (client DONE)
Multi-provider free-tier LLM client: structured output, timeout, retry, provider fallback, external abort + per-attempt hook. Default order in `src/inference/providers.ts`: groq, cloudflare, gemini, mistral, openrouter. Serverless proxy deferred to M-UI (D-016 amendment).

#### M-AGENT — LLM agent (DONE)
Battle-state + personality → validated legal move via `playAgentTurn`; plain `stepBattle` seeded picker is fallback (D-015/D-022). Deterministic greedy baseline for evals. Optional `selectCpuSkillId` on `stepBattle`.

#### M-EVAL — Eval harness (signature piece) — DONE
Headless match + snapshot suites; exact fixed-policy best-response oracle; recorded-fixture transport; Vite `runnerImport` CLI; committed baseline in EVAL.md (D-023). Discrimination report: environment **DISCRIMINATES** (optimal ≫ greedy). Held-out LLM still ties greedy on the n=6 sample. Fixture manifest + multi-provider keyless `--suite all` replay.

#### M-TOOLS — Grounding + memory — DONE (ablation measured; grounding negative)
Grounding + memory + variant ablation harness (D-027). Standard ablation inconclusive; pivotal greedy-saturated (D-028); adversarial suites (D-029). Held-out adversarial record: grounding changed **0/20** decisions — D-024 **falsified** (D-030). Metric choice: report regret distribution with rate (D-031). Memory variants still unmeasured.

#### M-BENCH — Model comparison bench — NEXT
BYOK model comparison, cost/latency per decision, prompt version axis, failure taxonomy, self-consistency (D-025).

#### M-COACH — Post-battle coach
LLM post-battle coach: turns the battle log into tailored advice (surfaces in the Report screen in M-UI).

#### M-UI — Minimal functional UI (+ deferred serverless proxy)
Part 1 Builder+Arena; part 2 Report+coach+bench surfacing (D-025). Serverless inference proxy when the browser needs secret-safe calls.

#### Parked (D-026)
Seed-spread correlation and greedy-suboptimal snapshot reselection — deferred until a future suite regeneration (M-ENV milestone dropped).
### Stretch (optional)
- Natural-language robot builder (NL → validated `AgentConfig`).
- An agent that adapts across matches (bandit/RL). Revisit a heavier backend/DB only if cross-match learning, leaderboards, or stored eval runs require real persistence beyond localStorage.

## Explicit Non-Goals
- Online multiplayer.
- Real-time battle.
- Node graph builder.
- Visual robot customization.
- Sound.
- Campaign.
- Leaderboards.
- Tools module (gameplay “Tools” module — distinct from M-TOOLS grounding).
- Mobile layout.
- Public final branding.
- Real-world attack, jailbreak, or prompt-injection content.
- Full service/DB/auth backend for MVP (minimal serverless inference proxy only — D-016).
- Paid LLM usage (free-tier providers only — D-017).

## MVP Completion Criteria
- All required engine functions are present and tested.
- Deterministic outcomes are produced with identical seeds and inputs.
- Canonical skill catalog and agent configs are validated before battle sessions start.
- FRACTURE and SENTINEL-X are selectable and functional CPU opponents.
- Report output uses fictional vocabulary and avoids prohibited terms.
- AI strategy provider + eval harness prove agent behavior headless before M-UI.
- 4 MVP screens are connected through a full battle flow (after M-UI).
- No non-MVP features are shipped.
