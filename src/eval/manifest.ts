import { readFile, writeFile } from "node:fs/promises";
import type { LlmVariant } from "./policies";
import { isLlmVariant, variantPromptVersion } from "./policies";
import { buildMatchSuite, type EvalSplit, type MatchScenario } from "./scenarios";

export type ManifestVariant = {
  id: LlmVariant;
  promptVersion: string;
};

export type ManifestSplit = {
  scenarioIds: string[];
  snapshots: boolean;
  providers: string[];
  /** Optional; absent = legacy base-only replay. */
  variants?: ManifestVariant[];
  /** Which snapshot suite was evaluated; absent = standard. */
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

function mergeVariants(
  left: readonly ManifestVariant[] | undefined,
  right: readonly ManifestVariant[] | undefined
): ManifestVariant[] | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }
  const byId = new Map<string, ManifestVariant>();
  for (const entry of [...(left ?? []), ...(right ?? [])]) {
    byId.set(entry.id, entry);
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
    splits[split] = {
      scenarioIds: sortUnique([...left.scenarioIds, ...right.scenarioIds]),
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

export function manifestVariantsFor(
  variants: readonly LlmVariant[]
): ManifestVariant[] {
  return variants
    .map((id) => ({ id, promptVersion: variantPromptVersion(id) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
