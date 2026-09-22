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
  assertDecisionLabPackV2,
  classifyRecordedTaxonomy,
  llmPolicyKey,
  PROMPT_TEMPLATE_FILES,
  type DecisionLabCase,
  type DecisionLabCaseV2,
  type DecisionLabPackV1,
  type DecisionLabPackV2,
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
const SUITE_EXT_REL = "evals/suites/snapshots.adversarial.heldout-ext.json";
const MANIFEST_REL = "evals/fixtures/manifest.json";
const PACK_REL = "src/ui/lab/pack/decision-lab.v2.json";
const SKILLS_REL = "src/engine/skills.ts";
const ORACLE_REL = "src/eval/oracle.ts";
const REPLAY_PLACEHOLDER_KEY = "replay-placeholder-key-not-real";

const FIXED_PLAYER_POLICY =
  "scenario playerPolicy (fixed; best response vs known policy — not an equilibrium)";

const LIMITATIONS = [
  "Primary cohort is heldout adversarial snapshots (n=13) plus additive heldout-ext (n=35, D-044).",
  "LLM arms: gemini:gemini-3.5-flash-lite and groq:openai/gpt-oss-20b × base/grounded (and freetext on n=13 only).",
  "Free-text (agent-v5-freetext) recorded on adversarial n=13 only; heldout-ext freetext deferred (D-047).",
  "Oracle is exact best response vs a fixed player policy, not a game-theoretic equilibrium.",
  "Fixture misses are shown as unavailable; no invented model choices.",
  "Latency from live inference is not claimed in this pack; token/cost evidence is separate (live-profile).",
  "Sample sizes are small — insufficient evidence for broad model rankings when n<30 or Wilson width≥0.40.",
  "Evidence+Ship Decision Lab pack v2; B.3/B.4 and full batch-8 diagnostics remain open.",
  "Input hashes are SHA-256 of UTF-8 text after normalizing newlines to LF (CRLF and lone CR)."
].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const REPRODUCE = [
  "npm run lab:pack",
  "npm run eval:replay -- --suite heldout --variants base,grounded --snapshot-suite adversarial --models gemini:gemini-3.5-flash-lite",
  "npm run eval:replay -- --suite heldout --variants base,grounded --snapshot-suite adversarial-heldout-ext --models groq:openai/gpt-oss-20b",
  "npm run eval:replay -- --suite heldout --variants freetext --snapshot-suite adversarial --models gemini:gemini-3.5-flash-lite"
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
): Promise<{ pack: DecisionLabPackV2; json: string }> {
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

  const gemini = { provider: "gemini", model: "gemini-3.5-flash-lite" };
  const groq = { provider: "groq", model: "openai/gpt-oss-20b" };
  const pins = [gemini, groq] as const;
  const variantsCore = ["base", "grounded"] as const;
  const variantsAll = ["base", "grounded", "freetext"] as const;

  function pinnedEnv(pin: { provider: string; model: string }): Record<string, string> {
    const keyEnv =
      pin.provider === "gemini"
        ? "GEMINI_API_KEY"
        : pin.provider === "groq"
          ? "GROQ_API_KEY"
          : `${pin.provider.toUpperCase()}_API_KEY`;
    return {
      [keyEnv]: REPLAY_PLACEHOLDER_KEY,
      INFERENCE_PROVIDER_ORDER: pin.provider,
      INFERENCE_MAX_PROVIDERS: "1",
      INFERENCE_MAX_RETRIES: "0",
      [`${pin.provider.toUpperCase()}_MODEL`]: pin.model
    };
  }

  async function evalArm(
    snaps: DecisionSnapshot[],
    pin: { provider: string; model: string },
    variant: "base" | "grounded" | "freetext"
  ): Promise<Map<string, DecisionLabPolicyEvidence>> {
    const out = new Map<string, DecisionLabPolicyEvidence>();
    await evalLlmSnapshots(
      snaps,
      {
        ...variantToPlayOptions(variant),
        inference: {
          env: pinnedEnv(pin),
          fetch: fetchImpl
        },
        now: () => 0,
        budgetMs: 60_000
      },
      `llm:${pin.provider}:${variant}`,
      {
        setRepeat,
        onDecision: (snap, primary) => {
          out.set(
            snap.id,
            llmFromPrimary(snap, primary, variantPromptVersion(variant))
          );
        }
      }
    );
    return out;
  }

  type ArmMaps = Record<string, Map<string, DecisionLabPolicyEvidence>>;
  const advArms: ArmMaps = {};
  for (const pin of pins) {
    for (const variant of variantsAll) {
      const key = llmPolicyKey(pin.provider, pin.model, variant);
      advArms[key] = await evalArm(snapshots, pin, variant);
    }
  }

  const cases: DecisionLabCase[] = snapshots.map((snap) => {
    const greedySkill = greedyById.get(snap.id);
    if (greedySkill === undefined) {
      throw new Error(`missing greedy decision for ${snap.id}`);
    }
    const basePol = advArms[llmPolicyKey(gemini.provider, gemini.model, "base")]!.get(
      snap.id
    );
    const groundedPol = advArms[
      llmPolicyKey(gemini.provider, gemini.model, "grounded")
    ]!.get(snap.id);
    if (basePol === undefined || groundedPol === undefined) {
      throw new Error(`missing gemini llm decisions for ${snap.id}`);
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

  const packV1: DecisionLabPackV1 = {
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
      snapshotCount: snapshots.length
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

  assertDecisionLabPackV1(packV1);

  const unavailable = (detail: string): DecisionLabPolicyEvidence => ({
    status: "unavailable",
    reason: "fixture_miss",
    taxonomy: "unavailable",
    detail
  });

  const extText = await readText(SUITE_EXT_REL);
  const extJson = JSON.parse(extText) as {
    count: number;
    snapshots: DecisionSnapshot[];
  };
  const extSnaps = [...extJson.snapshots].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  const extGreedy = evalGreedySnapshots(extSnaps);
  const extGreedyById = new Map(
    extGreedy.decisions.map((d) => [d.snapshotId, d.executedSkillId as SkillId])
  );

  const extArms: ArmMaps = {};
  for (const pin of pins) {
    for (const variant of variantsCore) {
      const key = llmPolicyKey(pin.provider, pin.model, variant);
      extArms[key] = await evalArm(extSnaps, pin, variant);
    }
  }

  const v2Cases: DecisionLabCaseV2[] = [];

  for (const c of cases) {
    const policies: Record<string, DecisionLabPolicyEvidence> = {
      greedy: c.policies.greedy
    };
    for (const pin of pins) {
      for (const variant of variantsAll) {
        const key = llmPolicyKey(pin.provider, pin.model, variant);
        policies[key] =
          advArms[key]?.get(c.snapshotId) ??
          unavailable(`missing ${key} on adversarial`);
      }
    }
    v2Cases.push({
      suiteId: "heldout-adversarial",
      snapshotId: c.snapshotId,
      scenarioId: c.scenarioId,
      turn: c.turn,
      observation: c.observation,
      equippedSkillIds: c.equippedSkillIds,
      affordability: c.affordability,
      oracle: c.oracle,
      policies
    });
  }

  for (const snap of extSnaps) {
    const greedySkill = extGreedyById.get(snap.id);
    if (greedySkill === undefined) {
      throw new Error(`missing greedy decision for ext ${snap.id}`);
    }
    const policies: Record<string, DecisionLabPolicyEvidence> = {
      greedy: greedyPolicy(snap, greedySkill)
    };
    for (const pin of pins) {
      for (const variant of variantsCore) {
        const key = llmPolicyKey(pin.provider, pin.model, variant);
        policies[key] =
          extArms[key]?.get(snap.id) ??
          unavailable(`missing ${key} on heldout-ext`);
      }
      // freetext not recorded on ext
      policies[llmPolicyKey(pin.provider, pin.model, "freetext")] = unavailable(
        "freetext not recorded on adversarial-heldout-ext (D-047 n=13-only)"
      );
    }
    v2Cases.push({
      suiteId: "heldout-adversarial-ext",
      snapshotId: snap.id,
      scenarioId: snap.scenarioId,
      turn: snap.runtime.session.turn,
      observation: observationFromSnap(snap),
      equippedSkillIds: [...snap.runtime.session.cpu.skillIds],
      affordability: affordabilityFor(snap),
      oracle: oracleFor(snap),
      policies
    });
  }

  const pack: DecisionLabPackV2 = {
    schemaVersion: 2,
    inputHashes: {
      suite: sha256TextLf(suiteText + "\n" + extText),
      fixtureManifest: sha256TextLf(manifestText),
      promptTemplates: {
        files: [...PROMPT_TEMPLATE_FILES],
        sha256: sha256TextLf(promptConcat)
      },
      skillCatalog: sha256TextLf(skillCatalogText),
      oracleSource: sha256TextLf(oracleText)
    },
    suites: [
      {
        id: "heldout-adversarial",
        split: "heldout",
        kind: "adversarial",
        path: SUITE_REL,
        snapshotCount: snapshots.length
      },
      {
        id: "heldout-adversarial-ext",
        split: "heldout",
        kind: "adversarial-heldout-ext",
        path: SUITE_EXT_REL,
        snapshotCount: extSnaps.length
      }
    ],
    modelPins: [gemini, groq],
    variants: [...variantsAll],
    cases: v2Cases,
    limitations: LIMITATIONS,
    reproduce: REPRODUCE
  };

  // Thin ext cases to summary if pack would exceed ~300KB
  let json = `${JSON.stringify(pack, null, 2)}\n`;
  if (json.length > 300_000) {
    pack.cases = pack.cases.filter((c) => c.suiteId === "heldout-adversarial");
    pack.suites = pack.suites.filter((s) => s.id === "heldout-adversarial");
    pack.limitations = [
      ...LIMITATIONS,
      "Extended suite thinned from pack (>~300KB); full ext evidence remains in suites/fixtures/bench."
    ].sort((a, b) => (a < b ? -1 : 1));
    json = `${JSON.stringify(pack, null, 2)}\n`;
  }

  assertDecisionLabPackV2(pack);

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
  console.log(`path=${outPath}`);
  return 0;
}
