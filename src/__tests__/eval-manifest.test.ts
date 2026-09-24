import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCommittedManifestScenarioIds,
  assertScenarioIdsInSuite,
  discoverVariantScenarioIds,
  listFixtureHostModels,
  mergeManifest,
  manifestRecordsVariant,
  readManifestSync,
  resolveVariantRun,
  selectScenariosByIds,
  scenarioMatchFixturesPresent
} from "../eval";
import { buildMatchSuite, selectDiverseScenarios } from "../eval";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fixturesDir = join(root, "evals/fixtures");
const manifestPath = join(fixturesDir, "manifest.json");

describe("fixture manifest", () => {
  it("mergeManifest unions scenarioIds and providers deterministically", () => {
    const merged = mergeManifest(
      {
        version: 1,
        splits: {
          dev: {
            scenarioIds: ["b", "a"],
            snapshots: false,
            providers: ["groq|m"]
          }
        }
      },
      {
        version: 1,
        splits: {
          dev: {
            scenarioIds: ["a", "c"],
            snapshots: true,
            providers: ["gemini|g"]
          },
          heldout: {
            scenarioIds: ["h1"],
            snapshots: true,
            providers: []
          }
        }
      }
    );
    expect(merged.splits.dev?.scenarioIds).toEqual(["a", "b", "c"]);
    expect(merged.splits.dev?.snapshots).toBe(true);
    expect(merged.splits.dev?.providers).toEqual(["gemini|g", "groq|m"]);
    expect(merged.splits.heldout?.scenarioIds).toEqual(["h1"]);
  });

  it("mergeManifest unions per-variant scenarioIds without dropping variants", () => {
    const merged = mergeManifest(
      {
        version: 1,
        splits: {
          heldout: {
            scenarioIds: ["s1", "s2", "s3"],
            snapshots: true,
            providers: [],
            variants: [
              {
                id: "base",
                promptVersion: "agent-v1",
                scenarioIds: ["s1", "s2", "s3"],
                snapshots: true
              }
            ]
          }
        }
      },
      {
        version: 1,
        splits: {
          heldout: {
            scenarioIds: ["s1", "s2"],
            snapshots: true,
            providers: [],
            variants: [
              {
                id: "grounded",
                promptVersion: "agent-v2-grounded",
                scenarioIds: ["s1", "s2"],
                snapshots: true,
                snapshotSuite: "adversarial"
              }
            ]
          }
        }
      }
    );
    const variants = merged.splits.heldout!.variants!;
    expect(variants.map((v) => v.id)).toEqual(["base", "grounded"]);
    expect(variants.find((v) => v.id === "base")!.scenarioIds).toEqual([
      "s1",
      "s2",
      "s3"
    ]);
    expect(variants.find((v) => v.id === "grounded")!.scenarioIds).toEqual([
      "s1",
      "s2"
    ]);
  });

  it("mergeManifest preserves variant provider/model pins from the patch", () => {
    const merged = mergeManifest(
      {
        version: 1,
        splits: {
          heldout: {
            scenarioIds: ["s1"],
            snapshots: true,
            providers: [],
            variants: [
              {
                id: "base",
                promptVersion: "agent-v1",
                scenarioIds: ["s1"],
                snapshots: true,
                snapshotSuite: "adversarial"
              }
            ]
          }
        }
      },
      {
        version: 1,
        splits: {
          heldout: {
            scenarioIds: ["s1"],
            snapshots: true,
            providers: [],
            variants: [
              {
                id: "base",
                promptVersion: "agent-v1",
                scenarioIds: ["s1"],
                snapshots: true,
                snapshotSuite: "adversarial",
                provider: "groq",
                model: "openai/gpt-oss-20b"
              }
            ]
          }
        }
      }
    );
    const base = merged.splits.heldout!.variants!.find((v) => v.id === "base")!;
    expect(base.provider).toBe("groq");
    expect(base.model).toBe("openai/gpt-oss-20b");
    expect(resolveVariantRun(merged.splits.heldout, "base")).toMatchObject({
      provider: "groq",
      model: "openai/gpt-oss-20b"
    });
  });

  it("manifestRecordsVariant is false for batch4 arms not yet in the manifest", () => {
    const manifest = readManifestSync(manifestPath);
    expect(manifest).toBeDefined();
    if (manifest === undefined) {
      throw new Error("manifest missing");
    }
    for (const absent of [
      "base-repeat",
      "perturb",
      "advctx",
      "info-partial"
    ] as const) {
      expect(manifestRecordsVariant(manifest, absent, ["heldout"])).toBe(
        false
      );
      expect(manifestRecordsVariant(manifest, absent, ["dev", "heldout"])).toBe(
        false
      );
    }
    expect(manifestRecordsVariant(manifest, "base", ["heldout"])).toBe(true);
    expect(manifestRecordsVariant(manifest, "freetext", ["dev"])).toBe(false);
    expect(manifestRecordsVariant(manifest, "freetext", ["dev", "heldout"])).toBe(
      true
    );
  });

  it("resolveVariantRun returns snapshots:false for variants absent from the manifest", () => {
    const manifest = readManifestSync(manifestPath);
    expect(manifest).toBeDefined();
    if (manifest === undefined) {
      throw new Error("manifest missing");
    }
    const heldout = manifest.splits.heldout;
    expect(heldout).toBeDefined();
    if (heldout === undefined) {
      throw new Error("heldout split missing");
    }
    for (const absent of [
      "base-repeat",
      "perturb",
      "advctx",
      "info-partial"
    ] as const) {
      const resolved = resolveVariantRun(heldout, absent, {
        provider: "groq",
        model: "openai/gpt-oss-20b"
      });
      expect(resolved.snapshots).toBe(false);
      // CLI replay must fail (not silently skip) when snapshots===false — see cli.ts.
      expect(
        `variant ${absent} has no recorded fixtures in the manifest`
      ).toMatch(/has no recorded fixtures in the manifest/);
    }
  });

  it("resolveVariantRun leaves legacy entries without provider/model unpinned", () => {
    const resolved = resolveVariantRun(
      {
        scenarioIds: ["a"],
        snapshots: true,
        providers: [],
        variants: [
          {
            id: "base",
            promptVersion: "agent-v1",
            scenarioIds: ["a"],
            snapshots: true
          }
        ]
      },
      "base"
    );
    expect(resolved.provider).toBeUndefined();
    expect(resolved.model).toBeUndefined();
  });

  it("resolveVariantRun uses per-variant scenarioIds; legacy falls back", () => {
    const legacy = resolveVariantRun(
      {
        scenarioIds: ["a", "b"],
        snapshots: true,
        providers: []
      },
      "base"
    );
    expect(legacy.scenarioIds).toEqual(["a", "b"]);

    const modern = resolveVariantRun(
      {
        scenarioIds: ["a", "b", "c"],
        snapshots: true,
        providers: [],
        variants: [
          {
            id: "grounded",
            promptVersion: "agent-v2-grounded",
            scenarioIds: ["a"],
            snapshots: true,
            snapshotSuite: "adversarial"
          }
        ]
      },
      "grounded"
    );
    expect(modern.scenarioIds).toEqual(["a"]);
    expect(modern.snapshotSuite).toBe("adversarial");
  });

  it("assertScenarioIdsInSuite rejects unknown ids", () => {
    expect(() =>
      assertScenarioIdsInSuite("dev", ["not-a-real-scenario"])
    ).toThrow(/unknown scenarioIds/);
  });

  it("assertScenarioIdsInSuite accepts bootstrap ids", () => {
    const dev = buildMatchSuite("dev").slice(0, 4).map((s) => s.id);
    const heldout = selectDiverseScenarios(buildMatchSuite("heldout"), 6).map(
      (s) => s.id
    );
    expect(() => assertScenarioIdsInSuite("dev", dev)).not.toThrow();
    expect(() => assertScenarioIdsInSuite("heldout", heldout)).not.toThrow();
  });

  it("selectScenariosByIds preserves manifest order", () => {
    const suite = buildMatchSuite("dev");
    const ids = [suite[2]!.id, suite[0]!.id];
    const selected = selectScenariosByIds(suite, ids);
    expect(selected.map((s) => s.id)).toEqual(ids);
  });

  it("committed manifest scenarioIds are in suite and fixtures are present", async () => {
    const manifest = readManifestSync(manifestPath);
    expect(manifest).toBeDefined();
    assertCommittedManifestScenarioIds(manifest!);

    const hostModels = listFixtureHostModels(fixturesDir);
    expect(hostModels.length).toBeGreaterThan(0);

    for (const split of ["dev", "heldout"] as const) {
      const entry = manifest!.splits[split];
      if (entry === undefined) continue;
      const suite = buildMatchSuite(split);
      for (const variant of entry.variants ?? []) {
        assertScenarioIdsInSuite(split, variant.scenarioIds);
        const scenarios = selectScenariosByIds(suite, variant.scenarioIds);
        for (const scenario of scenarios) {
          const ok = await scenarioMatchFixturesPresent(
            scenario,
            variant.id,
            fixturesDir,
            hostModels
          );
          expect(
            ok,
            `fixtures missing for ${split}/${variant.id}/${scenario.id}`
          ).toBe(true);
        }
      }
    }
  }, 120_000);

  it("discoverVariantScenarioIds is stable for heldout base vs grounded", async () => {
    const manifest = readManifestSync(manifestPath)!;
    const heldout = manifest.splits.heldout!;
    const suite = buildMatchSuite("heldout");
    const candidates = selectScenariosByIds(suite, heldout.scenarioIds);
    const base = await discoverVariantScenarioIds(
      candidates,
      "base",
      fixturesDir
    );
    const grounded = await discoverVariantScenarioIds(
      candidates,
      "grounded",
      fixturesDir
    );
    expect(base).toEqual(
      heldout.variants!.find((v) => v.id === "base")!.scenarioIds
    );
    expect(grounded).toEqual(
      heldout.variants!.find((v) => v.id === "grounded")!.scenarioIds
    );
    expect(grounded.length).toBeLessThan(base.length);
  }, 120_000);
});
