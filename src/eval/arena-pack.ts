/**
 * Arena replay pack exporter (Node).
 * Walks gemini heldout full-match fixtures with createReplayFetch — no network.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DecisionTrace } from "../agent";
import type { CombatantState } from "../engine";
import { robotEnvironment } from "../env";
import {
  assertArenaReplayPackV1,
  type ArenaReplayCombatant,
  type ArenaReplayMatch,
  type ArenaReplayPackV1,
  type ArenaReplaySanitizedTrace,
  type ArenaReplayTurn
} from "../ui/arena/pack/schema";
import { createDirStore } from "./dir-store";
import { readManifest, resolveVariantRun, selectScenariosByIds } from "./manifest";
import type { CpuPolicy } from "./policies";
import {
  llmCpuPolicy,
  resolvePlayerPolicy,
  variantToPlayOptions,
  type LlmVariant
} from "./policies";
import { buildMatchSuite, type MatchScenario } from "./scenarios";
import { createReplayFetch, type RepeatAwareFetch } from "./transport";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PACK_REL = "src/ui/arena/pack/arena-replay.v1.json";
const REPLAY_PLACEHOLDER_KEY = "replay-placeholder-key-not-real";
const PIN = { provider: "gemini", model: "gemini-3.5-flash-lite" } as const;
const VARIANTS: Array<"base" | "grounded"> = ["base", "grounded"];
const SIZE_SOFT_CAP_BYTES = 300_000;

const LIMITATIONS = [
  "Recorded replay of gemini heldout full matches only — not live AI.",
  "Fixed playerPolicy on each scenario (greedy or seeded-random) — not free-play.",
  "Free play in the Arena remains a greedy CPU baseline.",
  "Oracle / diagnostics live in Decision Lab; this pack is combat replay only.",
  "Sample size is small (≤6 matches) — insufficient evidence for model rankings."
].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const REPRODUCE = [
  "npm run arena:pack",
  "npm run eval:replay -- --suite heldout --variants base,grounded --models gemini:gemini-3.5-flash-lite"
].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

function sanitizeString(value: string): string {
  return value
    .replace(/Authorization:\s*Bearer\s+\S+/gi, "Authorization: Bearer [redacted]")
    .replace(/\b(api[_-]?key|token)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

function sanitizeTrace(trace: DecisionTrace): ArenaReplaySanitizedTrace {
  const out: ArenaReplaySanitizedTrace = {
    messages: trace.messages.map((m) => ({
      role: m.role,
      content: sanitizeString(m.content)
    })),
    source: trace.source
  };
  if (trace.rawText !== undefined) {
    out.rawText = sanitizeString(trace.rawText);
  }
  if (trace.provider !== undefined) {
    out.provider = trace.provider;
  }
  if (trace.model !== undefined) {
    out.model = trace.model;
  }
  if (trace.validation !== undefined) {
    out.validation = trace.validation;
  }
  if (trace.fallbackReason !== undefined) {
    out.fallbackReason = trace.fallbackReason;
  }
  return out;
}

function combatant(c: CombatantState): ArenaReplayCombatant {
  return {
    side: c.side,
    agentId: c.agentId,
    displayName: c.displayName,
    health: c.health,
    maxHealth: c.maxHealth,
    energy: c.energy,
    maxEnergy: c.maxEnergy,
    defense: c.defense
  };
}

function pinnedEnv(): Record<string, string> {
  return {
    GEMINI_API_KEY: REPLAY_PLACEHOLDER_KEY,
    INFERENCE_PROVIDER_ORDER: PIN.provider,
    INFERENCE_MAX_PROVIDERS: "1",
    INFERENCE_MAX_RETRIES: "0",
    GEMINI_MODEL: PIN.model
  };
}

export type BuildArenaPackOptions = {
  root?: string;
  dryRun?: boolean;
  fetch?: RepeatAwareFetch;
  forceAllVariants?: boolean;
};

export type BuildArenaPackResult = {
  pack: ArenaReplayPackV1;
  json: string;
  bytes: number;
  includedVariants: Array<"base" | "grounded">;
  slippedGrounded: boolean;
};

export async function buildArenaReplayPack(
  options: BuildArenaPackOptions = {}
): Promise<BuildArenaPackResult> {
  const root = options.root ?? ROOT;
  const fixturesDir = join(root, "evals/fixtures");
  const manifest = await readManifest(join(fixturesDir, "manifest.json"));
  if (manifest === undefined) {
    throw new Error("arena:pack requires evals/fixtures/manifest.json");
  }
  const heldout = manifest.splits.heldout;
  if (heldout === undefined) {
    throw new Error("arena:pack: manifest missing heldout split");
  }

  const store = createDirStore(fixturesDir);
  const fetchImpl = options.fetch ?? createReplayFetch(store);
  const suite = buildMatchSuite("heldout");

  const matches: ArenaReplayMatch[] = [];
  const included: Array<"base" | "grounded"> = [];

  for (const variant of VARIANTS) {
    const resolved = resolveVariantRun(heldout, variant, PIN);
    if (resolved.scenarioIds.length === 0) {
      continue;
    }
    const scenarios = selectScenariosByIds(suite, resolved.scenarioIds);
    const policy = llmCpuPolicy({
      ...variantToPlayOptions(variant as LlmVariant),
      variant: variant as LlmVariant,
      inference: {
        env: pinnedEnv(),
        fetch: fetchImpl
      },
      now: () => 0,
      budgetMs: 60_000
    });

    for (const scenario of scenarios) {
      matches.push(await runMatchInstrumented(scenario, policy, variant));
    }
    included.push(variant);
  }

  let slippedGrounded = false;
  let finalMatches = matches;
  let finalIncluded = included;
  let pack = assemblePack(finalMatches, finalIncluded);
  let json = `${JSON.stringify(pack)}\n`;
  let bytes = Buffer.byteLength(json, "utf8");

  if (
    !options.forceAllVariants &&
    bytes > SIZE_SOFT_CAP_BYTES &&
    included.includes("grounded")
  ) {
    slippedGrounded = true;
    finalIncluded = ["base"];
    finalMatches = matches.filter((m) => m.variant === "base");
    pack = assemblePack(finalMatches, finalIncluded);
    json = `${JSON.stringify(pack)}\n`;
    bytes = Buffer.byteLength(json, "utf8");
  }

  assertArenaReplayPackV1(pack);

  if (!options.dryRun) {
    const outPath = join(root, PACK_REL);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, json, "utf8");
  }

  return {
    pack,
    json,
    bytes,
    includedVariants: finalIncluded,
    slippedGrounded
  };
}

function assemblePack(
  matches: ArenaReplayMatch[],
  variants: Array<"base" | "grounded">
): ArenaReplayPackV1 {
  const sorted = [...matches].sort((a, b) =>
    a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0
  );
  return {
    schemaVersion: 1,
    provider: PIN.provider,
    model: PIN.model,
    variants,
    limitations: LIMITATIONS,
    reproduce: REPRODUCE,
    matches: sorted
  };
}

async function runMatchInstrumented(
  scenario: MatchScenario,
  policy: CpuPolicy,
  variant: "base" | "grounded"
): Promise<ArenaReplayMatch> {
  const playerPolicy = resolvePlayerPolicy(scenario);
  let runtime = robotEnvironment.start(
    scenario.playerConfig,
    scenario.cpuConfig,
    scenario.seed
  );
  const startedPlayer = combatant(runtime.player);
  const startedCpu = combatant(runtime.cpu);
  const turns: ArenaReplayTurn[] = [];

  while (!robotEnvironment.isTerminal(runtime)) {
    const playerSkillId = playerPolicy(runtime);
    const turn = runtime.session.turn;
    const { step, trace } = await policy.decide(runtime, playerSkillId);
    runtime = step.runtime;
    const last = runtime.turns[runtime.turns.length - 1]!;
    const cpuAction = last.actions.find((a) => a.actor === "cpu");
    const cpuSkillId =
      cpuAction?.selectedSkillId ??
      (trace?.executedSkillId as string | undefined) ??
      "unknown";

    const turnRec: ArenaReplayTurn = {
      turn,
      playerSkillId,
      cpuSkillId,
      endedPlayer: combatant(runtime.player),
      endedCpu: combatant(runtime.cpu)
    };
    if (last.outcome !== undefined) {
      turnRec.outcome = {
        result: last.outcome.result,
        reason: last.outcome.reason,
        ...(last.outcome.winnerSide !== undefined
          ? { winnerSide: last.outcome.winnerSide }
          : {})
      };
    }
    if (trace !== undefined) {
      turnRec.trace = sanitizeTrace(trace);
    }
    turns.push(turnRec);
  }

  const last = runtime.turns[runtime.turns.length - 1];
  const outcome = last?.outcome;
  if (outcome === undefined) {
    throw new Error(`arena:pack match ${scenario.id} ended without outcome`);
  }

  return {
    matchId: `heldout:${variant}:${scenario.id}`,
    scenarioId: scenario.id,
    variant,
    provider: PIN.provider,
    model: PIN.model,
    seed: scenario.seed,
    playerPolicy: scenario.playerPolicy,
    playerConfig: {
      agentId: scenario.playerConfig.agentId,
      displayName: scenario.playerConfig.displayName,
      modules: { ...scenario.playerConfig.modules },
      skillIds: [...scenario.playerConfig.skillIds]
    },
    cpuConfig: {
      agentId: scenario.cpuConfig.agentId,
      displayName: scenario.cpuConfig.displayName,
      modules: { ...scenario.cpuConfig.modules },
      skillIds: [...scenario.cpuConfig.skillIds]
    },
    startedPlayer,
    startedCpu,
    maxTurns: runtime.session.maxTurns,
    outcome: {
      result: outcome.result,
      reason: outcome.reason,
      ...(outcome.winnerSide !== undefined
        ? { winnerSide: outcome.winnerSide }
        : {})
    },
    totalTurns: runtime.turns.length,
    turns
  };
}

export async function main(_argv: string[] = []): Promise<number> {
  void _argv;
  const result = await buildArenaReplayPack();
  console.log(
    `arena:pack wrote ${PACK_REL} bytes=${result.bytes} matches=${result.pack.matches.length} variants=${result.includedVariants.join(",")} slippedGrounded=${result.slippedGrounded}`
  );
  if (result.slippedGrounded) {
    console.warn(
      "arena:pack: grounded matches slipped (soft size cap); base-only shipped"
    );
  }
  return 0;
}
