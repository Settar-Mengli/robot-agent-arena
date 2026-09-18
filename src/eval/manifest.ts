import { access, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LlmVariant } from "./policies";
import { isLlmVariant, variantPromptVersion } from "./policies";
import { buildMatchSuite, type EvalSplit, type MatchScenario } from "./scenarios";

export type ManifestVariantEntry = {
  id: LlmVariant;
  promptVersion: string;
  scenarioIds: string[];
  snapshots: boolean;
  snapshotSuite?: "standard" | "pivotal" | "adversarial";
};

/** @deprecated Use ManifestVariantEntry. */
export type ManifestVariant = ManifestVariantEntry;

export type ManifestSplit = {
  /** Legacy shared list; union of all variant lists for old readers. */
  scenarioIds: string[];
  snapshots: boolean;
  providers: string[];
  /** Optional; absent = legacy base-only replay. */
  variants?: ManifestVariantEntry[];
  /** Legacy split-level suite; prefer variants[].snapshotSuite. */
  snapshotSuite?: "standard" | "pivotal" | "adversarial";
};

export type FixtureManifest = {
  version: 1;
  splits: {
    dev?: ManifestSplit;
    heldout?: ManifestSplit;
  };
};

function emptySplit(): ManifestSplit {
  return { scenarioIds: [], snapshots: false, providers: [] };
}

function sortUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function normalizeVariantEntry(
  entry: ManifestVariantEntry | { id: LlmVariant; promptVersion: string }
): ManifestVariantEntry {
  const withIds = entry as ManifestVariantEntry;
  return {
    id: withIds.id,
    promptVersion: withIds.promptVersion,
    scenarioIds: Array.isArray(withIds.scenarioIds)
      ? sortUnique(withIds.scenarioIds)
      : [],
    snapshots: withIds.snapshots === true,
    ...(withIds.snapshotSuite !== undefined
      ? { snapshotSuite: withIds.snapshotSuite }
      : {})
  };
}

/**
 * Merge variant entries by id. scenarioIds union per variant; never drop
 * another variant. Right overwrites promptVersion when provided.
 */
function mergeVariants(
  left: readonly ManifestVariantEntry[] | undefined,
  right: readonly ManifestVariantEntry[] | undefined
): ManifestVariantEntry[] | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }
  const byId = new Map<string, ManifestVariantEntry>();
  for (const raw of [...(left ?? []), ...(right ?? [])]) {
    const entry = normalizeVariantEntry(raw);
    const prev = byId.get(entry.id);
    if (prev === undefined) {
      byId.set(entry.id, entry);
      continue;
    }
    byId.set(entry.id, {
      id: entry.id,
      promptVersion: entry.promptVersion || prev.promptVersion,
      scenarioIds: sortUnique([...prev.scenarioIds, ...entry.scenarioIds]),
      snapshots: prev.snapshots || entry.snapshots,
      ...(entry.snapshotSuite !== undefined || prev.snapshotSuite !== undefined
        ? {
            snapshotSuite: entry.snapshotSuite ?? prev.snapshotSuite
          }
        : {})
    });
  }
  return [...byId.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
}

export function mergeManifest(
  existing: FixtureManifest | undefined,
  patch: FixtureManifest
): FixtureManifest {
  const splits: FixtureManifest["splits"] = {};
  for (const split of ["dev", "heldout"] as const) {
    const a = existing?.splits[split];
    const b = patch.splits[split];
    if (a === undefined && b === undefined) {
      continue;
    }
    const left = a ?? emptySplit();
    const right = b ?? emptySplit();
    const variants = mergeVariants(left.variants, right.variants);
    const snapshotSuite = right.snapshotSuite ?? left.snapshotSuite;
    const scenarioIdsFromVariants =
      variants === undefined
        ? []
        : variants.flatMap((v) => v.scenarioIds);
    splits[split] = {
      scenarioIds: sortUnique([
        ...left.scenarioIds,
        ...right.scenarioIds,
        ...scenarioIdsFromVariants
      ]),
      snapshots: left.snapshots || right.snapshots,
      providers: sortUnique([...left.providers, ...right.providers]),
      ...(variants !== undefined ? { variants } : {}),
      ...(snapshotSuite !== undefined ? { snapshotSuite } : {})
    };
  }
  return { version: 1, splits };
}

export async function readManifest(
  path: string
): Promise<FixtureManifest | undefined> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as FixtureManifest;
    if (raw.version !== 1 || typeof raw.splits !== "object" || raw.splits === null) {
      return undefined;
    }
    return raw;
  } catch {
    return undefined;
  }
}

export async function writeManifest(
  path: string,
  manifest: FixtureManifest
): Promise<void> {
  const normalized = mergeManifest(undefined, manifest);
  await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

/**
 * Fail loudly if any scenarioId is not in buildMatchSuite(split).
 * Prevents typo'd manifest ids from silently shrinking replay.
 */
export function assertScenarioIdsInSuite(
  split: EvalSplit,
  scenarioIds: readonly string[]
): void {
  const suiteIds = new Set(buildMatchSuite(split).map((s) => s.id));
  const missing = scenarioIds.filter((id) => !suiteIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `manifest.splits.${split} has unknown scenarioIds: ${missing.join(", ")}`
    );
  }
}

export function selectScenariosByIds(
  suite: readonly MatchScenario[],
  scenarioIds: readonly string[]
): MatchScenario[] {
  const byId = new Map(suite.map((s) => [s.id, s]));
  const selected: MatchScenario[] = [];
  for (const id of scenarioIds) {
    const scenario = byId.get(id);
    if (scenario === undefined) {
      throw new Error(`scenarioId not found in suite: ${id}`);
    }
    selected.push(scenario);
  }
  return selected;
}

export function manifestPathFor(fixturesDir: string): string {
  return `${fixturesDir.replace(/\\/g, "/").replace(/\/$/, "")}/manifest.json`;
}

export function variantsFromManifestSplit(
  split: ManifestSplit | undefined
): LlmVariant[] | undefined {
  if (split?.variants === undefined || split.variants.length === 0) {
    return undefined;
  }
  const ids: LlmVariant[] = [];
  for (const entry of split.variants) {
    if (!isLlmVariant(entry.id)) {
      throw new Error(`manifest variant id unknown: ${entry.id}`);
    }
    ids.push(entry.id);
  }
  return ids;
}

/**
 * Resolve which scenarioIds / snapshot flags to use for a variant on a split.
 * - Legacy (no variants[]): split-level scenarioIds.
 * - Modern (variants[] present): only that variant's scenarioIds; absent
 *   variant → empty list (do not inherit another variant's matches).
 */
export function resolveVariantRun(
  split: ManifestSplit | undefined,
  variantId: LlmVariant
): {
  scenarioIds: string[];
  snapshots: boolean;
  snapshotSuite?: "standard" | "pivotal" | "adversarial";
  promptVersion: string;
} {
  if (split === undefined) {
    return {
      scenarioIds: [],
      snapshots: false,
      promptVersion: variantPromptVersion(variantId)
    };
  }

  if (split.variants !== undefined && split.variants.length > 0) {
    const entry = split.variants.find((v) => v.id === variantId);
    if (entry === undefined) {
      return {
        scenarioIds: [],
        snapshots: false,
        promptVersion: variantPromptVersion(variantId)
      };
    }
    return {
      scenarioIds: entry.scenarioIds ?? [],
      snapshots: entry.snapshots ?? split.snapshots,
      ...(entry.snapshotSuite !== undefined || split.snapshotSuite !== undefined
        ? { snapshotSuite: entry.snapshotSuite ?? split.snapshotSuite }
        : {}),
      promptVersion: entry.promptVersion || variantPromptVersion(variantId)
    };
  }

  return {
    scenarioIds: split.scenarioIds,
    snapshots: split.snapshots,
    ...(split.snapshotSuite !== undefined
      ? { snapshotSuite: split.snapshotSuite }
      : {}),
    promptVersion: variantPromptVersion(variantId)
  };
}

export function manifestVariantsFor(
  variants: readonly LlmVariant[],
  options: {
    scenarioIds: readonly string[];
    snapshots: boolean;
    snapshotSuite?: "standard" | "pivotal" | "adversarial";
  }
): ManifestVariantEntry[] {
  return variants
    .map((id) => ({
      id,
      promptVersion: variantPromptVersion(id),
      scenarioIds: sortUnique([...options.scenarioIds]),
      snapshots: options.snapshots,
      ...(options.snapshotSuite !== undefined
        ? { snapshotSuite: options.snapshotSuite }
        : {})
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function fixtureFileExists(fixturesDir: string, key: string): boolean {
  return existsSync(join(fixturesDir, `${key}.json`));
}

export function assertCommittedManifestScenarioIds(
  manifest: FixtureManifest
): void {
  for (const split of ["dev", "heldout"] as const) {
    const entry = manifest.splits[split];
    if (entry === undefined) continue;
    assertScenarioIdsInSuite(split, entry.scenarioIds);
    for (const variant of entry.variants ?? []) {
      assertScenarioIdsInSuite(split, variant.scenarioIds);
    }
  }
}

export function readManifestSync(path: string): FixtureManifest | undefined {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as FixtureManifest;
    if (raw.version !== 1 || typeof raw.splits !== "object" || raw.splits === null) {
      return undefined;
    }
    return raw;
  } catch {
    return undefined;
  }
}

export async function assertFixtureFileReadable(
  fixturesDir: string,
  key: string
): Promise<void> {
  await access(join(fixturesDir, `${key}.json`));
}
