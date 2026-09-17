import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeBaselineReport } from "../eval/cli";
import {
  extractBaselineBlock,
  renderBaselineBlock
} from "../eval/report";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("eval report", () => {
  it(
    "drift-guard: rendered baseline block matches committed EVAL.md",
    async () => {
      const report = await computeBaselineReport({ suite: "all" });
      const rendered = renderBaselineBlock(report);
      const committed = extractBaselineBlock(
        readFileSync(join(root, "EVAL.md"), "utf8")
      );
      expect(rendered).toBe(committed);
    },
    120_000
  );
});
