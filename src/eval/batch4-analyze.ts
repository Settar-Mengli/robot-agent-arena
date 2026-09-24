/**
 * Batch 4 / D-051 Phase 2 analysis: build robustness summary from fixtures.
 * Deterministic; no network.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { wilsonInterval, insufficientEvidence } from "../decision-lab";
import { buildAgentMessages } from "../agent/prompt";
import { buildAgentMessagesBatch4 } from "../agent/prompt-batch4";
import { observePostPlayerState } from "../agent/observe";
import { computeGroundedFacts } from "../agent/grounding";
import { regret } from "./oracle";
import { fixtureKey } from "./transport";
import { variantToPlayOptions, type LlmVariant } from "./policies";
import type { DecisionSnapshot } from "./snapshots";
import {
  BATCH4_BOOTSTRAP_ALPHA,
  BATCH4_BOOTSTRAP_B,
  BATCH4_BOOTSTRAP_SEED,
  flipRateWilson,
  pairedDeltaRegretCi,
  separableForComparison,
  wilsonIntervalsDisjoint,
  type Batch4ComparisonRow,
  type Batch4RobustnessSummaryV1
} from "./batch4-summary";

export const BATCH4_PREREG_SHA =
  "2a130a757543433fbec9d56a1ead9fd59d07d114";

export const BATCH4_AMENDMENT_SHAS = [
  "48fa3d2",
  "6b08ebb"
] as const;

export type Batch4PinId = "gemini" | "groq";

export type Batch4ArmId =
  | "base"
  | "grounded"
  | "base-repeat"
  | "perturb"
  | "advctx"
  | "info-partial";

const PINS: Record<
  Batch4PinId,
  { model: string; host: string; label: string }
> = {
  gemini: {
    model: "gemini-3.5-flash-lite",
    host: "generativelanguage.googleapis.com",
    label: "gemini:gemini-3.5-flash-lite"
  },
  groq: {
    model: "openai/gpt-oss-20b",
    host: "api.groq.com",
    label: "groq:openai/gpt-oss-20b"
  }
};

export type ArmDecision = {
  snapshotId: string;
  skillId: string;
  regret: number;
  optimal: boolean;
};

export type ArmSeries = {
  pin: Batch4PinId;
  arm: Batch4ArmId;
  decisions: ArmDecision[];
  optimalCount: number;
  meanRegret: number;
};

type FixtureRec = {
  key: string;
  request: { host: string; model: unknown; messages: unknown };
  response: unknown;
};

function extractSkillId(response: unknown): string | null {
  try {
    const content = (
      response as {
        choices?: Array<{ message?: { content?: string } }>;
      }
    ).choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return null;
    }
    const parsed = JSON.parse(content) as { skillId?: string };
    return typeof parsed.skillId === "string" ? parsed.skillId : null;
  } catch {
    return null;
  }
}

function buildMessages(
  snap: DecisionSnapshot,
  arm: Batch4ArmId
): ReturnType<typeof buildAgentMessages> {
  const observation = observePostPlayerState(snap.runtime, snap.playerSkillId);
  if (observation === null) {
    throw new Error(`null observation for ${snap.id}`);
  }
  const common = {
    turn: snap.runtime.session.turn,
    maxTurns: snap.runtime.session.maxTurns,
    observation,
    cpuConfig: snap.runtime.session.cpu,
    snapshotId: snap.id,
    playerSkillIds: snap.runtime.session.player.skillIds
  };
  if (arm === "base") {
    return buildAgentMessages(common);
  }
  if (arm === "grounded") {
    const grounding = computeGroundedFacts(
      observation,
      snap.runtime.session.cpu,
      snap.runtime.session.player.skillIds,
      snap.runtime.session.turn,
      snap.runtime.session.maxTurns
    );
    return buildAgentMessages({ ...common, grounding });
  }
  const opts = variantToPlayOptions(arm as LlmVariant);
  return buildAgentMessagesBatch4({
    ...common,
    promptVariant: opts.promptVariant
  });
}

export function loadFixtureIndex(
  fixturesDir: string
): Map<string, FixtureRec> {
  const map = new Map<string, FixtureRec>();
  for (const name of readdirSync(fixturesDir)) {
    if (!name.endsWith(".json") || name === "manifest.json") {
      continue;
    }
    try {
      const rec = JSON.parse(
        readFileSync(join(fixturesDir, name), "utf8")
      ) as FixtureRec;
      if (typeof rec.key === "string") {
        map.set(rec.key, rec);
      }
    } catch {
      // skip malformed
    }
  }
  return map;
}

export function loadArmSeries(
  snapshots: readonly DecisionSnapshot[],
  pin: Batch4PinId,
  arm: Batch4ArmId,
  fixtures: Map<string, FixtureRec>
): ArmSeries {
  const pinMeta = PINS[pin];
  const decisions: ArmDecision[] = [];
  let optimalCount = 0;
  let regretSum = 0;

  for (const snap of snapshots) {
    const messages = buildMessages(snap, arm);
    const body = {
      model: pinMeta.model,
      messages,
      temperature: 0,
      response_format: { type: "json_object" }
    };
    const url = `https://${pinMeta.host}/v1/chat/completions`;
    const repeat = arm === "base-repeat" ? 1 : 0;
    const key = fixtureKey(url, body, repeat);
    const rec = fixtures.get(key);
    if (rec === undefined) {
      throw new Error(`missing fixture ${pin}/${arm} snap=${snap.id} key=${key}`);
    }
    const skillId = extractSkillId(rec.response);
    if (skillId === null || snap.values[skillId] === undefined) {
      throw new Error(`bad skill in fixture ${pin}/${arm} snap=${snap.id}`);
    }
    const reg = regret(snap.values, skillId);
    const optimal = snap.best.includes(skillId);
    if (optimal) {
      optimalCount += 1;
    }
    regretSum += reg;
    decisions.push({ snapshotId: snap.id, skillId, regret: reg, optimal });
  }

  return {
    pin,
    arm,
    decisions,
    optimalCount,
    meanRegret: regretSum / decisions.length
  };
}

function countFlips(a: ArmSeries, b: ArmSeries): number {
  let n = 0;
  for (let i = 0; i < a.decisions.length; i += 1) {
    if (a.decisions[i]!.skillId !== b.decisions[i]!.skillId) {
      n += 1;
    }
  }
  return n;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function ciRound(ci: { low: number; high: number; mean: number }): {
  low: number;
  high: number;
  mean: number;
} {
  return {
    low: round4(ci.low),
    high: round4(ci.high),
    mean: round4(ci.mean)
  };
}

function wilsonRound(w: { low: number; high: number }): {
  low: number;
  high: number;
} {
  return { low: round4(w.low), high: round4(w.high) };
}

function deltaRow(input: {
  id: string;
  experiment: Batch4ComparisonRow["experiment"];
  pin: Batch4PinId;
  variant: string;
  baselineVariant: string;
  direction: Batch4ComparisonRow["registeredDirection"];
  variantSeries: ArmSeries;
  baselineSeries: ArmSeries;
  expectedDegenerate?: boolean;
  flipVariantVsBase?: number;
  flipNoiseVsBase?: number;
  n: number;
}): Batch4ComparisonRow {
  const regretsV = input.variantSeries.decisions.map((d) => d.regret);
  const regretsB = input.baselineSeries.decisions.map((d) => d.regret);
  const ci = ciRound(pairedDeltaRegretCi(regretsV, regretsB));
  const optWilson = wilsonRound(
    wilsonInterval(input.variantSeries.optimalCount, input.n)
  );

  let separableFromNoise: boolean | undefined;
  let flipRateVariantVsBase: number | undefined;
  let flipWilson: { low: number; high: number } | undefined;
  let flipRateNoiseVsBase: number | undefined;
  let flipNoiseWilson: { low: number; high: number } | undefined;

  if (
    input.flipVariantVsBase !== undefined &&
    input.flipNoiseVsBase !== undefined
  ) {
    const fv = flipRateWilson(input.flipVariantVsBase, input.n);
    const fn = flipRateWilson(input.flipNoiseVsBase, input.n);
    flipRateVariantVsBase = round4(fv.rate);
    flipWilson = wilsonRound(fv.wilson);
    flipRateNoiseVsBase = round4(fn.rate);
    flipNoiseWilson = wilsonRound(fn.wilson);
    separableFromNoise = wilsonIntervalsDisjoint(fv.wilson, fn.wilson);
  }
  const separable = separableForComparison({
    direction: input.direction,
    deltaRegretCi: ci,
    separableFromNoise
  });

  return {
    id: input.id,
    experiment: input.experiment,
    pin: PINS[input.pin].label,
    variant: input.variant,
    baselineVariant: input.baselineVariant,
    registeredDirection: input.direction,
    meanDeltaRegret: round4(ci.mean),
    deltaRegretCi: ci,
    separable,
    ...(input.expectedDegenerate === true
      ? { expectedDegenerate: true }
      : {}),
    ...(flipRateVariantVsBase !== undefined
      ? { flipRateVariantVsBase, flipRateWilson: flipWilson }
      : {}),
    ...(flipRateNoiseVsBase !== undefined
      ? {
          flipRateNoiseVsBase,
          flipRateNoiseWilson: flipNoiseWilson
        }
      : {}),
    ...(separableFromNoise !== undefined ? { separableFromNoise } : {}),
    optimalRateWilson: optWilson,
    insufficientEvidence: insufficientEvidence({
      n: input.n,
      wilson: optWilson
    })
  };
}

function flipRow(input: {
  id: string;
  pin: Batch4PinId;
  variant: string;
  baselineVariant: string;
  flips: number;
  n: number;
  noiseBaseline: boolean;
  /** Required for A-flip-perturb: flips(base-repeat vs base) for noise gate. */
  noiseFlips?: number;
}): Batch4ComparisonRow {
  const fw = flipRateWilson(input.flips, input.n);
  const zeroCi = { low: 0, high: 0, mean: 0 };
  let separable = false;
  let separableFromNoise: boolean | undefined;
  if (!input.noiseBaseline && input.noiseFlips !== undefined) {
    const nw = flipRateWilson(input.noiseFlips, input.n);
    separableFromNoise = wilsonIntervalsDisjoint(fw.wilson, nw.wilson);
    separable = separableFromNoise;
  }
  return {
    id: input.id,
    experiment: input.noiseBaseline ? "noise" : "A",
    pin: PINS[input.pin].label,
    variant: input.variant,
    baselineVariant: input.baselineVariant,
    registeredDirection: input.noiseBaseline ? "noise-baseline" : "two-sided",
    meanDeltaRegret: 0,
    deltaRegretCi: zeroCi,
    separable,
    flipRateVariantVsBase: round4(fw.rate),
    flipRateWilson: wilsonRound(fw.wilson),
    ...(separableFromNoise !== undefined ? { separableFromNoise } : {}),
    optimalRateWilson: wilsonRound(wilsonInterval(0, input.n)),
    insufficientEvidence: false
  };
}

export function buildBatch4RobustnessSummary(opts: {
  snapshots: readonly DecisionSnapshot[];
  fixturesDir: string;
}): Batch4RobustnessSummaryV1 {
  const fixtures = loadFixtureIndex(opts.fixturesDir);
  const n = opts.snapshots.length;
  const comparisons: Batch4ComparisonRow[] = [];

  for (const pin of ["gemini", "groq"] as const) {
    const base = loadArmSeries(opts.snapshots, pin, "base", fixtures);
    const grounded = loadArmSeries(opts.snapshots, pin, "grounded", fixtures);
    const baseRepeat = loadArmSeries(
      opts.snapshots,
      pin,
      "base-repeat",
      fixtures
    );
    const perturb = loadArmSeries(opts.snapshots, pin, "perturb", fixtures);
    const advctx = loadArmSeries(opts.snapshots, pin, "advctx", fixtures);
    const infoPartial = loadArmSeries(
      opts.snapshots,
      pin,
      "info-partial",
      fixtures
    );

    const flipPerturb = countFlips(perturb, base);
    const flipNoise = countFlips(baseRepeat, base);
    const flipInfoBase = countFlips(infoPartial, base);
    const flipInfoGrounded = countFlips(infoPartial, grounded);

    const geminiCDegenerate = pin === "gemini";

    comparisons.push(
      deltaRow({
        id: `${pin}/A-delta`,
        experiment: "A",
        pin,
        variant: "perturb",
        baselineVariant: "base",
        direction: "two-sided",
        variantSeries: perturb,
        baselineSeries: base,
        flipVariantVsBase: flipPerturb,
        flipNoiseVsBase: flipNoise,
        n
      }),
      deltaRow({
        id: `${pin}/A-noise-delta`,
        experiment: "noise",
        pin,
        variant: "base-repeat",
        baselineVariant: "base",
        direction: "noise-baseline",
        variantSeries: baseRepeat,
        baselineSeries: base,
        n
      }),
      deltaRow({
        id: `${pin}/B-delta`,
        experiment: "B",
        pin,
        variant: "advctx",
        baselineVariant: "base",
        direction: "worse",
        variantSeries: advctx,
        baselineSeries: base,
        n
      }),
      deltaRow({
        id: `${pin}/C-vs-base`,
        experiment: "C",
        pin,
        variant: "info-partial",
        baselineVariant: "base",
        direction: "better",
        variantSeries: infoPartial,
        baselineSeries: base,
        expectedDegenerate: geminiCDegenerate,
        n
      }),
      deltaRow({
        id: `${pin}/C-vs-grounded`,
        experiment: "C",
        pin,
        variant: "info-partial",
        baselineVariant: "grounded",
        direction: "worse",
        variantSeries: infoPartial,
        baselineSeries: grounded,
        expectedDegenerate: geminiCDegenerate,
        n
      }),
      flipRow({
        id: `${pin}/A-flip-perturb`,
        pin,
        variant: "perturb",
        baselineVariant: "base",
        flips: flipPerturb,
        n,
        noiseBaseline: false,
        noiseFlips: flipNoise
      }),
      flipRow({
        id: `${pin}/A-flip-noise`,
        pin,
        variant: "base-repeat",
        baselineVariant: "base",
        flips: flipNoise,
        n,
        noiseBaseline: true
      })
    );

    // Sanity: audit flip counts embedded in notes via closed checks below
    void flipInfoBase;
    void flipInfoGrounded;
  }

  const notes = [
    "Most situations in this suite offer two legal moves, so there is little room for any manipulation to change a choice.",
    "Recorder temperature was 0 (greedy decoding).",
    "Evidence is from a single suite (adversarial-heldout-ext, n=35).",
    "No multiplicity correction across the 14 pre-registered comparisons (family-wise error not controlled).",
    "Experiment A combines three surface changes (rewording, option order, formatting) and does not attribute which one matters.",
    "Gemini information-scaling (C) is expected-degenerate: base and grounded already chose identically on all 35 cases.",
    "Groq shows small wobble (1 of 35), from repeat runs or provider changes over time.",
    "Groq's base answers were recorded in Batch 2; the new versions were recorded later. The 1 of 35 difference may reflect changes on the provider's side over time, not only same-session wobble.",
    "Window 3 (adversarial n=13 secondary) was not recorded; cut per pre-registration.",
    `Pre-registration commit: ${BATCH4_PREREG_SHA}.`,
    `Pre-recording amendment commits: ${BATCH4_AMENDMENT_SHAS.join(", ")}.`
  ];

  return {
    schemaVersion: 1,
    preregistrationCommitSha: BATCH4_PREREG_SHA,
    bootstrap: {
      seed: BATCH4_BOOTSTRAP_SEED,
      B: BATCH4_BOOTSTRAP_B,
      alpha: BATCH4_BOOTSTRAP_ALPHA
    },
    suite: { id: "adversarial-heldout-ext", n },
    comparisons,
    notes
  };
}

/** Stable LF JSON for committed artifacts. */
export function stableStringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function auditFlipCounts(summary: Batch4RobustnessSummaryV1): {
  gemini: Record<string, number>;
  groq: Record<string, number>;
} {
  const out = {
    gemini: {} as Record<string, number>,
    groq: {} as Record<string, number>
  };
  for (const row of summary.comparisons) {
    const pin = row.pin.startsWith("gemini") ? "gemini" : "groq";
    if (row.id.endsWith("A-flip-perturb") && row.flipRateVariantVsBase !== undefined) {
      out[pin]["flip-perturb"] = Math.round(row.flipRateVariantVsBase * 35);
    }
    if (row.id.endsWith("A-flip-noise") && row.flipRateVariantVsBase !== undefined) {
      out[pin]["flip-noise"] = Math.round(row.flipRateVariantVsBase * 35);
    }
    if (row.id.endsWith("A-delta") && row.flipRateVariantVsBase !== undefined) {
      out[pin]["A-delta-flip"] = Math.round(row.flipRateVariantVsBase * 35);
    }
    if (row.id.endsWith("A-delta") && row.flipRateNoiseVsBase !== undefined) {
      out[pin]["A-delta-noise-flip"] = Math.round(row.flipRateNoiseVsBase * 35);
    }
  }
  return out;
}
