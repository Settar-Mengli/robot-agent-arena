# Architecture

## Overview

AGENT ARENA (repository: `robot-agent-arena`) is an educational 1v1 turn-based robot battle game. Players configure agent modules and skills; battles resolve through a pure TypeScript engine with seeded, deterministic outcomes.

**Status today:** the battle engine, environment interface (`src/env`), inference client, agent layer (LLM turn + greedy baseline), eval harness (through A3 / ES / Batch 5), and UI through Batch 3–4 (Watch, save, pack v3 diagnostics, Challenge, D-050 plain UX, Batch 4 BYOK Arena opt-in + leaderboard/methodology) are the product surface. Next: **final polish** (screenshots, demo video, issue #28).

## Layered architecture and dependency rule

**Layering** (engine-first, UI later):

```
data  →  engine
         ↑
         env (robotEnvironment + EnvironmentOf)  ←  eval (measurement core)
         ↑
inference (standalone)  →  agent  →  (lib bridge)  →  store  →  components / screens
         ↑__________________|
```

Dependencies should point inward toward the engine. Game logic must not live in React components. Browser APIs, persistence, and UI state stay outside `src/engine`.

**What exists today:**

| Concern | Location |
| --- | --- |
| Domain types | `src/engine/types.ts` |
| Constants / module list / fictional terms | `src/engine/constants.ts` |
| Canonical skill catalog (data) | `src/engine/skills.ts` |
| Validation | `src/engine/validation.ts` |
| Session lifecycle, combat, outcome, RNG, simulation | other `src/engine/*.ts` files |
| Environment interface + robot adapter | `src/env/` |
| CPU opponent catalog | `src/data/opponents.ts` |
| Multi-provider LLM client | `src/inference/` |
| LLM opponent turn + greedy baseline | `src/agent/` |
| Eval harness (oracle, suites, CLI) | `src/eval/`, `evals/`, `EVAL.md` |
| UI (Builder, Arena, results, battle-view store) | `src/ui/` |
| Tests | `src/__tests__/`, `src/ui/**/*.test.*` |

`src/data/` exists (opponents). There are **no** top-level `src/types/`, `src/store/`, `src/components/`, or `src/lib/` directories — UI store/components live under `src/ui/`.

**Layer rules (ESLint-enforced):** `src/inference/` is standalone (must not import engine, agent, or eval). `src/agent/` may import engine and inference but not eval. `src/engine/` must import neither agent, inference, nor eval. `src/env/` may import engine only (not agent, eval, or inference). `src/eval/` may import env, engine, agent, and inference; nothing imports eval.

**Oracle note:** `bestResponse` is an exact memoized best response against a *fixed* player policy (node-capped). It is not a game-theoretic equilibrium. Snapshot suites sample discriminative CPU decisions reached under greedy-CPU play (D-023). Dynamics go through the environment adapter (`robotEnvironment`); terminal scoring and memo/decision state keys live on the interface.

**UI (through Batch 4 / D-051):** React, Tailwind, and Zustand. App entry is `index.html` → `src/ui/main.tsx`. Builder, Arena, Results, Watch (lazy), Decision Lab (lazy), landing, honesty strip, first-visit tour, one-slot save, **leaderboard**, **methodology**, and **OpenRouter BYOK** (`src/ui/live/**`, Arena opt-in) live under `src/ui/`. Battle-view store (D-041 / D-042); greedy CPU adapter (`src/ui/play/cpu-turn.ts`). Packs and Batch 4 summaries are static JSON; no Node eval harness in the browser. Live keys stay in memory only and never appear on the leaderboard.

## Environment interface (A3 / D-033 batch 5 → Batch 5 / D-052)

The measurement core depends on the **environment interface** in `src/env/`.

**Robot production path (unchanged):** `Environment` + `robotEnvironment` (`start`, `apply`, `isTerminal`, `equippedActions`, `legalActions`, `terminalValue`, `memoStateKey`, `decisionStateKey`) still specialize to `BattleRuntime` / `SkillId`. Scoring and state keys stay on the interface.

**Generic contract (D-052):** `EnvironmentOf<S,A>` is the shared measurement shape. A zero-behavior adapter `asEnvironmentOf(robotEnvironment)` proves the robot satisfies it without changing production call sites. Resonance Seal implements `EnvironmentOf` directly. One shared `evaluateChoices` runs on both (robot golden ≡ existing metrics; Seal → committed baselines).

| Shared | Not shared |
|--------|------------|
| `EnvironmentOf` contract | LLM prompt / agent path |
| `evaluateChoices` + `aggregateChoiceMetrics` | Robot-specific `Environment` / `stepBattle` return shape |
| `wilsonInterval` / `bootstrapMeanCi` / `insufficientEvidence` | Cross-environment metric comparison (forbidden) |

Policies, prompt construction, grounding facts, and scenario content stay deliberately game-specific outside `src/env`. `DecisionSnapshot.runtime` remains today’s `BattleRuntime` JSON. Seal is headless / keyless only — not on the leaderboard; Seal metrics are never compared to robot battle metrics (different regret scale). Seal suite artifacts live under `evals/env-suites/resonance-seal/` (not `evals/suites/`, which remains robot-only).

## Determinism and the engine contract

The engine is pure TypeScript:

- No `Math.random`, no `Date.now`, no DOM/`localStorage`/network I/O inside `src/engine`
- Randomness is an instance-local seeded RNG from `createSeededRng(seed)` (`src/engine/rng.ts`)
- Identical seed and agent configs produce identical `BattleResult` histories

This boundary is enforced by tooling as well as convention: [eslint.config.js](eslint.config.js) applies `no-restricted-properties` (ban `Math.random` / `Date.now`) and `no-restricted-imports` (ban `react` / `zustand` / store/component paths) to `src/engine/**/*.ts`.

## The shared turn orchestrator

`resolveTurn` in `src/engine/simulation.ts` is the **single** per-turn resolver (D-012). It:

1. Records the player action via `submitPlayerAction`
2. Resolves the player action with `resolveAction`
3. Checks health outcomes; only if the battle is still open, selects and resolves the CPU action
4. Applies turn energy recovery and calls `determineBattleOutcome` when still open
5. Builds a `TurnRecord`, then `finalizeBattle` or `advanceBattleTurn`

`resolveBattle` loops by calling `resolveTurn` once per turn (auto-selecting skills via the seeded RNG). Any future interactive/UI path must call the same `resolveTurn` so simulation and play cannot diverge.

**Battle completion (D-011):** outcomes are authoritative via `outcome.ts` (`determineBattleOutcome`) after the turn plays, then `finalizeBattle`. `isBattleOver` is **status-only** (`session.status === "completed"`). It does **not** treat `turn >= maxTurns` as over before that turn is played.

## Engine file responsibilities

| File | Owns |
| --- | --- |
| `types.ts` | Domain types (`AgentConfig`, `BattleSession`, combat/outcome shapes, RNG interfaces) |
| `constants.ts` | MVP numeric caps, module ids, fallback ids, fictional term list |
| `skills.ts` | Canonical MVP skill catalog (data only) |
| `validation.ts` | Pure input guards for skills, agents, and sessions |
| `rng.ts` | Seeded RNG factory (`createSeededRng`) |
| `session.ts` | Lifecycle: `initBattle`, `submitPlayerAction`, `isBattleOver`, `finalizeBattle`, `advanceBattleTurn` |
| `combat.ts` | Combatant setup, single-action resolution, turn energy recovery, fallback stabilize |
| `outcome.ts` | Health and turn-limit winner/draw rules |
| `simulation.ts` | `resolveTurn` orchestrator, full-match `resolveBattle`, and interactive driver (`startBattle` / `stepBattle`) |
| `index.ts` | Public re-exports of the engine surface |

## Core data types

Defined in `src/engine/types.ts`:

| Type | Role |
| --- | --- |
| `AgentConfig` | `agentId`, `displayName`, `modules` (five module strings), `skillIds` |
| `BattleSession` | `sessionId`, `seed`, `turn`, `maxTurns`, `status`, `player`/`cpu` configs, optional `lastPlayerAction` |
| `CombatantState` | Per-side runtime: `health`/`maxHealth`, `energy`/`maxEnergy`, `defense`, identity fields |
| `TurnRecord` | One turn: starting combatants, `ResolvedAction[]`, ending combatants, optional `outcome` |
| `BattleOutcome` | `result` (`player-victory` \| `cpu-victory` \| `draw`), `reason`, optional winner fields |
| `BattleResult` | Full match: `finalSession`, final combatants, `turns`, `outcome`, `seed`, `totalTurns` |

MVP numbers from `src/engine/constants.ts` (source of truth): **5** modules, **8** catalog skills, **1–2** skills per agent (`MVP_SKILL_SLOT_LIMIT` = 2, minimum 1 via validation), **max 20** turns, combatant **30** max health / **10** max energy / **6** starting energy.

## Battle flow

**Session API (interactive path):**

1. `startBattle(configA, configB, seed, maxTurns?)` → `BattleRuntime`
2. While the battle is open: choose a player skill, call `stepBattle(runtime, playerSkillId, selectCpuSkillId?)` (optional sync CPU selector; default is the seeded simulation picker)
3. `BattleRuntime` is JSON-serializable for save/resume; when `stepBattle` produces an outcome, the session is finalized (`status: "completed"`)

**Auto-simulation:**

1. `resolveBattle(configA, configB, seed, maxTurns?)` initializes the session and combatants
2. Each loop iteration picks player/CPU skills via seeded RNG and calls `resolveTurn`
3. Returns a `BattleResult` with ordered turn history

Player actions resolve before CPU. If the player action ends the battle, the CPU action is skipped. Unaffordable skills resolve as `fallback-stabilize`.

## Agent turn (D-022)

`playAgentTurn` in `src/agent/` probes post-player state, calls `completeChat` under an end-to-end budget (`AbortSignal`), validates the JSON proposal, then either injects the skill into `stepBattle` or falls back to the default seeded picker. Emits a JSON-serializable `DecisionTrace`. Deterministic `createGreedySelector` supports evals. LLM failures never throw past the agent boundary; only engine errors propagate.

## Testing and verification

- Suite layout: `src/__tests__/**/*.test.ts` (Vitest, Node environment)
- Includes unit coverage for constants, RNG, skills/validation, session lifecycle, combat, outcome, simulation, and **seam parity** (`parity.test.ts`): replays `resolveBattle` histories through `resolveTurn` + `isBattleOver` and asserts identical turns/outcomes, including a mandatory turn-limit scenario
- Local commands: `npm test`, `npm run coverage`, `npm run typecheck`, `npm run lint`
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, coverage, and `npm run eval:replay -- --suite all` on every pull request and on pushes to `main`

Do not treat any checked-in coverage percentage as a permanent contract; use the latest CI / local `npm run coverage` report.

## Naming conventions

- **Player-facing** strings use the fictional in-world vocabulary (see `FICTIONAL_TERMS` / skill `displayName` values such as Signal Breach, Null Pulse, Override Pulse, Core Identity, Logic Storm, Sigil Rule, Signal Exposure, Logic Drift)
- **Internal code** uses neutral technical names (`health`, `energy`, `defense`, `resolveAction`, effect categories `attack` / `defense` / `recovery` / `disrupt`)
- Do not put real-world hacking, jailbreak, or prompt-injection terminology in player-facing copy ([AGENT_RULES.md](AGENT_RULES.md))

## Where decisions live

Architectural rationale and locked tradeoffs are recorded in [DECISIONS.md](DECISIONS.md) (D-001 through D-013), including engine purity (D-003), stack lock (D-005), combat ownership (D-010), status-only completion (D-011), shared `resolveTurn` (D-012), and minimum skill loadout (D-013).
