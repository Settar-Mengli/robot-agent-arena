import { access, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LlmVariant } from "./policies";
import { isLlmVariant, variantPromptVersion } from "./policies";
import { buildMatchSuite, type EvalSplit, type MatchScenario } from "./scenarios";

export type ManifestSnapshotSuite =
  | "standard"
  | "pivotal"
  | "adversarial"
  | "adversarial-heldout-ext";

export type ManifestModelEntry = {
  provider: string;
  model: string;
  scenarioIds: string[];
  snapshots?: boolean;
  snapshotSuite?: ManifestSnapshotSuite;
};

export type ManifestVariantEntry = {
  id: LlmVariant;
  promptVersion: string;
  scenarioIds: string[];
  snapshots: boolean;
  snapshotSuite?: ManifestSnapshotSuite;
  /** Pinned provider for this recorded variant run (D-036). */
  provider?: string;
  /** Pinned model for this recorded variant run (D-036). */
  model?: string;
  /** Optional per-model scenario lists; absent = use variant-level scenarioIds. */
  models?: ManifestModelEntry[];
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
  snapshotSuite?: ManifestSnapshotSuite;
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

function modelKey(
  provider: string,
  model: string,
  snapshotSuite?: string
): string {
  return `${provider}|${model}|${snapshotSuite ?? ""}`;
}

function normalizeModelEntry(entry: ManifestModelEntry): ManifestModelEntry {
  return {
    provider: entry.provider,
    model: entry.model,
    scenarioIds: Array.isArray(entry.scenarioIds)
      ? sortUnique(entry.scenarioIds)
      : [],
    ...(entry.snapshots !== undefined ? { snapshots: entry.snapshots } : {}),
    ...(entry.snapshotSuite !== undefined
      ? { snapshotSuite: entry.snapshotSuite }
      : {})
  };
}

function mergeModels(
  left: readonly ManifestModelEntry[] | undefined,
  right: readonly ManifestModelEntry[] | undefined
): ManifestModelEntry[] | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }
  const byKey = new Map<string, ManifestModelEntry>();
  for (const raw of [...(left ?? []), ...(right ?? [])]) {
    const entry = normalizeModelEntry(raw);
    const key = modelKey(entry.provider, entry.model, entry.snapshotSuite);
    const prev = byKey.get(key);
    if (prev === undefined) {
      byKey.set(key, entry);
      continue;
    }
    byKey.set(key, {
      provider: entry.provider,
      model: entry.model,
      scenarioIds: sortUnique([...prev.scenarioIds, ...entry.scenarioIds]),
      ...(entry.snapshots !== undefined || prev.snapshots !== undefined
        ? { snapshots: entry.snapshots ?? prev.snapshots }
        : {}),
      ...(entry.snapshotSuite !== undefined || prev.snapshotSuite !== undefined
        ? { snapshotSuite: entry.snapshotSuite ?? prev.snapshotSuite }
        : {})
    });
  }
  return [...byKey.values()].sort((a, b) => {
    const ka = modelKey(a.provider, a.model, a.snapshotSuite);
    const kb = modelKey(b.provider, b.model, b.snapshotSuite);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
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
      : {}),
    ...(typeof withIds.provider === "string" && withIds.provider.length > 0
      ? { provider: withIds.provider }
      : {}),
    ...(typeof withIds.model === "string" && withIds.model.length > 0
      ? { model: withIds.model }
      : {}),
    ...(withIds.models !== undefined
      ? { models: mergeModels(undefined, withIds.models) }
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

    // Promote both legacy pins into models[] so a second pin (D-046) does not
    // overwrite the first pin's provenance.
    let models = mergeModels(prev.models, entry.models);
    if (
      typeof prev.provider === "string" &&
      prev.provider.length > 0 &&
      typeof prev.model === "string" &&
      prev.model.length > 0
    ) {
      models = mergeModels(models, [
        {
          provider: prev.provider,
          model: prev.model,
          scenarioIds: prev.scenarioIds,
          snapshots: prev.snapshots,
          ...(prev.snapshotSuite !== undefined
            ? { snapshotSuite: prev.snapshotSuite }
            : {})
        }
      ]);
    }
    if (
      typeof entry.provider === "string" &&
      entry.provider.length > 0 &&
      typeof entry.model === "string" &&
      entry.model.length > 0
    ) {
      models = mergeModels(models, [
        {
          provider: entry.provider,
          model: entry.model,
          scenarioIds: entry.scenarioIds,
          snapshots: entry.snapshots,
          ...(entry.snapshotSuite !== undefined
            ? { snapshotSuite: entry.snapshotSuite }
            : {})
        }
      ]);
    }

    const provider = prev.provider ?? entry.provider;
    const model = prev.model ?? entry.model;
    // Do not let a later suite recording overwrite an earlier suite at variant level.
    const snapshotSuite = prev.snapshotSuite ?? entry.snapshotSuite;

    byId.set(entry.id, {
      id: entry.id,
      promptVersion: entry.promptVersion || prev.promptVersion,
      scenarioIds: sortUnique([...prev.scenarioIds, ...entry.scenarioIds]),
      snapshots: prev.snapshots || entry.snapshots,
      ...(snapshotSuite !== undefined ? { snapshotSuite } : {}),
      ...(provider !== undefined ? { provider } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(models !== undefined ? { models } : {})
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
 * True when at least one requested split lists the variant (or is legacy
 * without a variants[] array). Used by replay to fail closed when an
 * explicitly requested arm has never been recorded.
 */
export function manifestRecordsVariant(
  manifest: FixtureManifest | undefined,
  variantId: LlmVariant,
  splits: readonly ("dev" | "heldout")[]
): boolean {
  if (manifest === undefined) {
    return false;
  }
  for (const split of splits) {
    const entry = manifest.splits[split];
    if (entry === undefined) {
      continue;
    }
    if (entry.variants === undefined || entry.variants.length === 0) {
      return true;
    }
    if (entry.variants.some((v) => v.id === variantId)) {
      return true;
    }
  }
  return false;
}

export type ResolveVariantPin = {
  provider: string;
  model: string;
};

/**
 * Resolve which scenarioIds / snapshot flags to use for a variant on a split.
 * - Legacy (no variants[]): split-level scenarioIds.
 * - Modern (variants[] present): only that variant's scenarioIds; absent
 *   variant → empty list (do not inherit another variant's matches).
 * - With pin + models[]: select that model's scenarioIds when present.
 */
export function resolveVariantRun(
  split: ManifestSplit | undefined,
  variantId: LlmVariant,
  pin?: ResolveVariantPin
): {
  scenarioIds: string[];
  snapshots: boolean;
  snapshotSuite?: ManifestSnapshotSuite;
  promptVersion: string;
  provider?: string;
  model?: string;
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

    let scenarioIds = entry.scenarioIds ?? [];
    let snapshots = entry.snapshots ?? split.snapshots;
    let snapshotSuite = entry.snapshotSuite ?? split.snapshotSuite;
    let provider = entry.provider;
    let model = entry.model;

    if (pin !== undefined && entry.models !== undefined && entry.models.length > 0) {
      const matches = entry.models.filter(
        (m) => m.provider === pin.provider && m.model === pin.model
      );
      const modelEntry =
        matches.find((m) => m.snapshotSuite === snapshotSuite) ??
        matches.find((m) => m.snapshotSuite === entry.snapshotSuite) ??
        matches[0];
      if (modelEntry !== undefined) {
        scenarioIds = modelEntry.scenarioIds;
        if (modelEntry.snapshots !== undefined) {
          snapshots = modelEntry.snapshots;
        }
        if (modelEntry.snapshotSuite !== undefined) {
          snapshotSuite = modelEntry.snapshotSuite;
        }
        provider = modelEntry.provider;
        model = modelEntry.model;
      }
    }

    return {
      scenarioIds,
      snapshots,
      ...(snapshotSuite !== undefined ? { snapshotSuite } : {}),
      promptVersion: entry.promptVersion || variantPromptVersion(variantId),
      ...(provider !== undefined ? { provider } : {}),
      ...(model !== undefined ? { model } : {})
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
    snapshotSuite?: ManifestSnapshotSuite;
    provider?: string;
    model?: string;
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
        : {}),
      ...(options.provider !== undefined ? { provider: options.provider } : {}),
      ...(options.model !== undefined ? { model: options.model } : {})
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
