# ROADMAP

## Product Direction
- Repo and folder name: robot-agent-arena.
- Temporary app title: AGENT ARENA.
- Pending final-name candidate: ARCZOLVEX.
- ARCZOLVEX must remain a candidate only until legal finalization is complete.
- AGENT ARENA is a 1v1 turn-based robot fighting game where players build, name, and configure robot agents.
- **Strategic direction (D-014):** the product is an agentic-AI system whose environment is this deterministic game. The pure engine stays the untouched, tested backbone. AI is a strategy provider behind the existing `selectCpuSkillId` seam; UI showcases the agents after the AI layer and evals are proven (headless-first).

## MVP Scope
Locked stack and game shape still hold (React + Vite + TypeScript + Zustand + localStorage; turn-based; fictional vocabulary). Sequencing is updated: AI layer and evals before UI.

- Engine-first implementation (DONE).
- Pure TypeScript battle engine (DONE).
- Session-based 1v1 battle flow + interactive `startBattle` / `stepBattle` driver (DONE).
- 4 screens: Home, Builder, Arena, Report — **re-sequenced to M-UI** (after M-EVAL); still in scope, later.
- 5 modules: Core Identity, Memory, Sigil and Security, Rules, Strategy.
- 8 canonical skills.
- Player agent naming.
- 2 CPU opponents: FRACTURE and SENTINEL-X (catalog DONE).
- 1 localStorage save slot (PLANNED with UI / persistence).
- Max 20 turns.
- Seeded RNG (DONE; restore-from-state DONE).
- Post-match report output using fictional vocabulary only (PLANNED; coach surfaces in Report later).
- **PLANNED:** LLM strategy provider + serverless inference proxy + eval harness (see AI milestone spine).

## Milestones

### Completed engine / infra spine
- M0–M4: Foundation, domain model, session core, simulation, combat vertical slice — DONE.
- Convergence: shared `resolveTurn`, status-only completion, min-1 skill validation — DONE.
- Interactive driver (`startBattle` / `stepBattle`) + RNG restore — DONE.
- Infra: ESLint (engine-purity), coverage, CI, ARCHITECTURE + README — DONE.
- CPU opponent catalog (FRACTURE, SENTINEL-X) — DONE.

### M5 / M6 (re-sequenced)
Former UI Integration (M5) and Persistence/Reporting (M6) are **not cancelled**. They land as **M-UI** (and related persistence) after the AI spine below so no UI is thrown away when agents land.

### PLANNED — AI milestone spine (headless-first)

#### M-INF — Inference layer
Serverless endpoint(s) + multi-provider free-tier LLM client: structured output, timeout, retry, provider fallback, API keys in server env only. Candidate providers confirmed at build time (e.g. Groq, Google Gemini, Cerebras, OpenRouter, and similar free tiers) — no hardcoded rate limits in planning docs.

#### M-AGENT — LLM agent
Battle-state + personality → validated LEGAL move; deterministic bot (`selectSimulationSkillId`) is fallback when the LLM is unavailable or invalid. Plugs into the existing `selectCpuSkillId` seam; engine resolution stays deterministic.

#### M-TOOLS — Grounding + memory
Grounding tool (computed affordable/threat facts so the agent decides on real state, not hallucination) + per-match memory of player tendencies.

#### M-EVAL — Eval harness (signature piece)
Headless agent-vs-bot batches reporting win rate, decision-validity %, latency, and fallback stats; used to compare prompts/models. Free-tier-safe via caching, recorded fixtures, and small batches. First-class deliverable, not optional.

#### M-COACH — Post-battle coach
LLM post-battle coach: turns the battle log into tailored advice (surfaces in the Report screen in M-UI).

#### M-UI — Minimal functional UI
Minimal functional UI built to showcase the agents; visual polish optional afterward. Uses store/lib over the engine; React/Tailwind/Zustand installed then.

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
