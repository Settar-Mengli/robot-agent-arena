import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { manifestRecordsVariant, readManifestSync } from "../eval";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const cliPath = join(root, "src/eval/cli.ts");
const manifestPath = join(root, "evals/fixtures/manifest.json");

describe("cli replay unknown-variant guard", () => {
  it("fails with a clear error instead of silently skipping absent variants", () => {
    const src = readFileSync(cliPath, "utf8");
    expect(src).toContain(
      "variant ${variant} has no recorded fixtures in the manifest"
    );
    expect(src).toContain("manifestRecordsVariant");
    const idx = src.indexOf(
      "has no recorded fixtures in the manifest"
    );
    expect(idx).toBeGreaterThan(0);
    const window = src.slice(Math.max(0, idx - 200), idx + 80);
    expect(window).toMatch(/return 1/);
  });

  it("batch4 variants are absent from committed manifest (would trip the guard)", () => {
    const manifest = readManifestSync(manifestPath);
    expect(manifest).toBeDefined();
    if (manifest === undefined) {
      throw new Error("manifest missing");
    }
    for (const v of [
      "base-repeat",
      "perturb",
      "advctx",
      "info-partial"
    ] as const) {
      expect(manifestRecordsVariant(manifest, v, ["heldout"])).toBe(false);
    }
  });
});
