/**
 * Offline Decision Lab pack exporter.
 * Uses createReplayFetch only — no network fallback.
 *
 * Provenance `inputHashes` are SHA-256 of UTF-8 text after LF newline
 * normalization (CRLF→LF, lone CR→LF), so Windows and Linux working trees
 * with the same logical source produce identical packs under `.gitattributes`
 * `eol=lf`.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DecisionTrace, PlayAgentTurnResult } from "../agent";
import {
  findSkillDefinition,
  MVP_SKILL_CATALOG,
  type SkillId
} from "../engine";
import {
  assertDecisionLabPackV1,
  classifyRecordedTaxonomy,
  PROMPT_TEMPLATE_FILES,
  type DecisionLabCase,
  type DecisionLabPackV1,
  type DecisionLabPolicyEvidence,
  type DecisionLabSanitizedTrace
} from "../decision-lab";
import { createDirStore } from "./dir-store";
import { traceHasFixtureMiss } from "./metrics";
import {
  variantPromptVersion,
  variantToPlayOptions
} from "./policies";
import {
  evalGreedySnapshots,
  evalLlmSnapshots
} from "./snapshot-eval";
import type { DecisionSnapshot } from "./snapshots";
import { createReplayFetch, type RepeatAwareFetch } from "./transport";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SUITE_REL = "evals/suites/snapshots.adversarial.heldout.json";
const MANIFEST_REL = "evals/fixtures/manifest.json";
const PACK_REL = "src/ui/lab/pack/decision-lab.v1.json";
const SKILLS_REL = "src/engine/skills.ts";
const ORACLE_REL = "src/eval/oracle.ts";
const REPLAY_PLACEHOLDER_KEY = "replay-placeholder-key-not-real";

const FIXED_PLAYER_POLICY =
  "scenario playerPolicy (fixed; best response vs known policy — not an equilibrium)";

const LIMITATIONS = [
  "Cohort is heldout adversarial snapshots only (n=13).",
  "LLM arms are pinned gemini:gemini-3.5-flash-lite base (agent-v1) and grounded (agent-v2-grounded).",
  "Oracle is exact best response vs a fixed player policy, not a game-theoretic equilibrium.",
  "Fixture misses are shown as unavailable; no invented model choices.",
  "Latency/cost from live inference are not claimed; this pack is offline replay evidence.",
  "Sample size is small — insufficient evidence for broad model rankings.",
  "B.2d Decision Lab is a partial diagnostic slice; B.3/B.4 and full batch-8 diagnostics remain open.",
  "Input hashes are SHA-256 of UTF-8 text after normalizing newlines to LF (CRLF and lone CR)."
].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const REPRODUCE = [
  "npm run lab:pack",
  "npm run eval:replay -- --suite heldout --variants base,grounded --snapshot-suite adversarial --models gemini:gemini-3.5-flash-lite"
].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * Normalize newlines to LF before hashing provenance inputs.
 * CRLF → LF, then any remaining lone CR → LF.
 */
export function normalizeNewlinesToLf(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sha256Hex(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** SHA-256 hex of UTF-8 bytes of LF-normalized text. */
export function sha256TextLf(text: string): string {
  return sha256Hex(normalizeNewlinesToLf(text));
}

async function defaultReadText(root: string, relPath: string): Promise<string> {
  return (await readFile(join(root, relPath))).toString("utf8");
}

function sortBest(best: readonly string[]): string[] {
  return [...best].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function sanitizeString(value: string): string {
  return value
    .replace(/Authorization:\s*Bearer\s+\S+/gi, "Authorization: Bearer [redacted]")
    .replace(/\b(api[_-]?key|token)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

function sanitizeTrace(trace: DecisionTrace): DecisionLabSanitizedTrace {
  const messages = trace.messages.map((m) => ({
    role: m.role,
    content: sanitizeString(m.content)
  }));
  const out: DecisionLabSanitizedTrace = {
    messages,
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
  if (trace.usage !== undefined) {
    out.usage = {
      promptTokens: trace.usage.prompt_tokens,
      completionTokens: trace.usage.completion_tokens,
      totalTokens: trace.usage.total_tokens
    };
  }
  if (trace.validation !== undefined) {
    out.validation = trace.validation;
  }
  if (trace.failures !== undefined) {
    out.failures = trace.failures.map((f) => ({
      provider: f.provider,
      reason: sanitizeString(f.reason),
      model: f.model,
      attempt: f.attempt,
      status: f.status,
      durationMs: f.durationMs
    }));
  }
  return out;
}

function observationFromSnap(snap: DecisionSnapshot) {
  const { cpu, player } = snap.runtime;
  return {
    cpu: {
      displayName: cpu.displayName,
      health: cpu.health,
      maxHealth: cpu.maxHealth,
      energy: cpu.energy,
      maxEnergy: cpu.maxEnergy,
      defense: cpu.defense
    },
    player: {
      displayName: player.displayName,
      health: player.health,
      maxHealth: player.maxHealth,
      energy: player.energy,
      maxEnergy: player.maxEnergy,
      defense: player.defense
    }
  };
}

function affordabilityFor(snap: DecisionSnapshot) {
  return snap.runtime.session.cpu.skillIds.map((skillId) => {
    const skill = findSkillDefinition(MVP_SKILL_CATALOG, skillId);
    const energyCost = skill?.energyCost ?? 0;
    return {
      skillId,
      energyCost,
      affordable: snap.runtime.cpu.energy >= energyCost
    };
  });
}

function oracleFor(snap: DecisionSnapshot) {
  const { turn, maxTurns } = snap.runtime.session;
  const best = sortBest(snap.best);
  return {
    perspective: "cpu" as const,
    fixedPlayerPolicy: FIXED_PLAYER_POLICY,
    horizon: {
      turn,
      maxTurns,
      turnsRemaining: maxTurns - turn
    },
    values: { ...snap.values },
    best,
    ties: best.length > 1,
    exact: snap.exact === true
  };
}

function greedyPolicy(
  snap: DecisionSnapshot,
  executedSkillId: SkillId
): DecisionLabPolicyEvidence {
  const chosenValue = snap.values[executedSkillId]!;
  const bestValue = Math.max(...Object.values(snap.values));
  const regret = bestValue - chosenValue;
  const optimal = snap.best.includes(executedSkillId);
  return {
    status: "recorded",
    source: "greedy",
    promptVersion: "n/a",
    executedSkillId,
    optimal,
    regret,
    chosenValue,
    bestValue,
    taxonomy: classifyRecordedTaxonomy({ regret })
  };
}

function llmFromPrimary(
  snap: DecisionSnapshot,
  primary: PlayAgentTurnResult,
  promptVersion: string
): DecisionLabPolicyEvidence {
  const { trace } = primary;
  if (traceHasFixtureMiss(trace)) {
    return {
      status: "unavailable",
      reason: "fixture_miss",
      taxonomy: "unavailable",
      detail: "Offline fixture store miss; no invented model choice."
    };
  }

  const executed =
    trace.executedSkillId ??
    primary.step.turnRecord.actions.find((a) => a.actor === "cpu")
      ?.selectedSkillId ??
    snap.runtime.session.cpu.skillIds[0]!;
  const resolved =
    primary.step.turnRecord.actions.find((a) => a.actor === "cpu")
      ?.resolvedSkillId;
  const chosenValue = snap.values[executed];
  if (chosenValue === undefined) {
    throw new TypeError(`executed skill missing from oracle values: ${executed}`);
  }
  const bestValue = Math.max(...Object.values(snap.values));
  const regret = bestValue - chosenValue;
  const validationOk =
    trace.validation === undefined ? undefined : trace.validation.ok;
  const taxonomy = classifyRecordedTaxonomy({
    regret,
    source: trace.source,
    fallbackReason: trace.fallbackReason,
    validationOk
  });

  const record: DecisionLabPolicyEvidence = {
    status: "recorded",
    source: "llm",
    promptVersion,
    executedSkillId: executed,
    optimal: snap.best.includes(executed),
    regret,
    chosenValue,
    bestValue,
    taxonomy,
    trace: sanitizeTrace(trace)
  };
  if (trace.proposedSkillId !== undefined) {
    record.proposedSkillId = trace.proposedSkillId;
  }
  if (resolved !== undefined) {
    record.resolvedSkillId = resolved;
  }
  if (trace.fallbackReason !== undefined) {
    record.fallbackReason = trace.fallbackReason;
  }
  if (trace.validation !== undefined && !trace.validation.ok) {
    record.validationCode = trace.validation.code;
  }
  return record;
}

export type BuildLabPackOptions = {
  root?: string;
  fetch?: RepeatAwareFetch;
  /** When true, skip writing to disk (tests). */
  dryRun?: boolean;
  /**
   * Test seam: return UTF-8 file text for a path relative to `root`
   * (before LF normalization). Defaults to reading the real file.
   */
  readText?: (relPath: string) => Promise<string>;
};

export async function buildDecisionLabPack(
  options: BuildLabPackOptions = {}
): Promise<{ pack: DecisionLabPackV1; json: string }> {
  const root = options.root ?? ROOT;
  const readText =
    options.readText ?? ((rel: string) => defaultReadText(root, rel));

  const suiteText = await readText(SUITE_REL);
  const manifestText = await readText(MANIFEST_REL);

  const promptTexts: string[] = [];
  for (const rel of PROMPT_TEMPLATE_FILES) {
    promptTexts.push(await readText(rel));
  }
  const promptConcat = promptTexts.join("");
  const skillCatalogText = await readText(SKILLS_REL);
  const oracleText = await readText(ORACLE_REL);

  const suiteJson = JSON.parse(suiteText) as {
    count: number;
    distinctStateCount: number;
    snapshots: DecisionSnapshot[];
  };
  if (
    suiteJson.count !== 13 ||
    suiteJson.distinctStateCount !== 13 ||
    suiteJson.snapshots.length !== 13
  ) {
    throw new Error(
      `expected heldout adversarial suite n=13, got count=${suiteJson.count} distinct=${suiteJson.distinctStateCount} len=${suiteJson.snapshots.length}`
    );
  }

  const snapshots = [...suiteJson.snapshots].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  const greedy = evalGreedySnapshots(snapshots);
  const greedyById = new Map(
    greedy.decisions.map((d) => [d.snapshotId, d.executedSkillId as SkillId])
  );

  const fixturesDir = join(root, "evals/fixtures");
  const store = createDirStore(fixturesDir);
  const fetchImpl = options.fetch ?? createReplayFetch(store);
  const setRepeat =
    typeof fetchImpl.setRepeat === "function"
      ? (n: number) => fetchImpl.setRepeat(n)
      : undefined;

  const inferenceBase = {
    env: {
      GEMINI_API_KEY: REPLAY_PLACEHOLDER_KEY,
      INFERENCE_PROVIDER_ORDER: "gemini",
      INFERENCE_MAX_PROVIDERS: "1",
      INFERENCE_MAX_RETRIES: "0",
      INFERENCE_GEMINI_MODEL: "gemini-3.5-flash-lite"
    },
    fetch: fetchImpl
  };

  const llmBase = new Map<string, DecisionLabPolicyEvidence>();
  const llmGrounded = new Map<string, DecisionLabPolicyEvidence>();

  await evalLlmSnapshots(
    snapshots,
    {
      ...variantToPlayOptions("base"),
      inference: inferenceBase,
      now: () => 0,
      budgetMs: 60_000
    },
    "llm:base",
    {
      setRepeat,
      onDecision: (snap, primary) => {
        llmBase.set(
          snap.id,
          llmFromPrimary(snap, primary, variantPromptVersion("base"))
        );
      }
    }
  );

  await evalLlmSnapshots(
    snapshots,
    {
      ...variantToPlayOptions("grounded"),
      inference: inferenceBase,
      now: () => 0,
      budgetMs: 60_000
    },
    "llm:grounded",
    {
      setRepeat,
      onDecision: (snap, primary) => {
        llmGrounded.set(
          snap.id,
          llmFromPrimary(snap, primary, variantPromptVersion("grounded"))
        );
      }
    }
  );

  const cases: DecisionLabCase[] = snapshots.map((snap) => {
    const greedySkill = greedyById.get(snap.id);
    if (greedySkill === undefined) {
      throw new Error(`missing greedy decision for ${snap.id}`);
    }
    const basePol = llmBase.get(snap.id);
    const groundedPol = llmGrounded.get(snap.id);
    if (basePol === undefined || groundedPol === undefined) {
      throw new Error(`missing llm decisions for ${snap.id}`);
    }
    return {
      snapshotId: snap.id,
      scenarioId: snap.scenarioId,
      turn: snap.runtime.session.turn,
      observation: observationFromSnap(snap),
      equippedSkillIds: [...snap.runtime.session.cpu.skillIds],
      affordability: affordabilityFor(snap),
      oracle: oracleFor(snap),
      policies: {
        greedy: greedyPolicy(snap, greedySkill),
        "llm:base": basePol,
        "llm:grounded": groundedPol
      }
    };
  });

  const pack: DecisionLabPackV1 = {
    schemaVersion: 1,
    inputHashes: {
      suite: sha256TextLf(suiteText),
      fixtureManifest: sha256TextLf(manifestText),
      promptTemplates: {
        files: [...PROMPT_TEMPLATE_FILES],
        sha256: sha256TextLf(promptConcat)
      },
      skillCatalog: sha256TextLf(skillCatalogText),
      oracleSource: sha256TextLf(oracleText)
    },
    suite: {
      split: "heldout",
      kind: "adversarial",
      path: SUITE_REL,
      snapshotCount: 13
    },
    oracleDefaults: {
      perspective: "cpu",
      fixedPlayerPolicy: FIXED_PLAYER_POLICY,
      kind: "best_response_fixed_player_policy"
    },
    modelPin: {
      provider: "gemini",
      model: "gemini-3.5-flash-lite"
    },
    cases,
    limitations: LIMITATIONS,
    reproduce: REPRODUCE
  };

  assertDecisionLabPackV1(pack);
  const json = `${JSON.stringify(pack, null, 2)}\n`;

  if (options.dryRun !== true) {
    const outPath = join(root, PACK_REL);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, json, "utf8");
  }

  return { pack, json };
}

export async function main(_argv: string[] = []): Promise<number> {
  void _argv;
  const { pack, json } = await buildDecisionLabPack();
  const outPath = join(ROOT, PACK_REL);
  console.log(
    `wrote ${PACK_REL} (${pack.cases.length} cases, ${json.length} bytes)`
  );
  let recorded = 0;
  let unavailable = 0;
  for (const c of pack.cases) {
    for (const key of ["llm:base", "llm:grounded"] as const) {
      if (c.policies[key].status === "recorded") {
        recorded += 1;
      } else {
        unavailable += 1;
      }
    }
  }
  console.log(`llm cells: recorded=${recorded} unavailable=${unavailable}`);
  console.log(`path=${outPath}`);
  return 0;
}
