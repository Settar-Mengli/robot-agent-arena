import { describe, expect, it } from "vitest";
import {
  assertScenarioIdsInSuite,
  mergeManifest,
  selectScenariosByIds
} from "../eval/manifest";
import { buildMatchSuite, selectDiverseScenarios } from "../eval";

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
});
