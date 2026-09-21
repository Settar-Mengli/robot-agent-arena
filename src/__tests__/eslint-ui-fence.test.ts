import { beforeAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const uiProbePath = path.join(root, "src/ui/_fence_probe.ts");
const labProbePath = path.join(root, "src/decision-lab/_fence_probe.ts");

describe("ui layer eslint fence", () => {
  let eslint: ESLint;

  beforeAll(async () => {
    eslint = new ESLint({
      cwd: root,
      overrideConfigFile: path.join(root, "eslint.config.js")
    });
    // Warm the flat-config load so individual cases stay under the default timeout.
    await eslint.lintText("export {};\n", { filePath: uiProbePath });
  }, 30_000);

  it(
    "reports no-restricted-imports for forbidden eval import under src/ui",
    async () => {
      const results = await eslint.lintText(
        'import { something } from "../eval/cli";\n',
        { filePath: uiProbePath }
      );

      expect(results).toHaveLength(1);
      const hit = results[0]!.messages.find(
        (m) =>
          m.ruleId === "no-restricted-imports" &&
          typeof m.message === "string" &&
          m.message.includes("eval")
      );
      expect(hit).toBeDefined();
      expect(hit!.severity).toBe(2);
    },
    15_000
  );

  it(
    "reports no-restricted-imports for node:fs under src/ui",
    async () => {
      const results = await eslint.lintText(
        'import { readFile } from "node:fs";\n',
        { filePath: uiProbePath }
      );

      expect(results).toHaveLength(1);
      const hit = results[0]!.messages.find(
        (m) => m.ruleId === "no-restricted-imports"
      );
      expect(hit).toBeDefined();
      expect(hit!.severity).toBe(2);
    },
    15_000
  );
});

describe("decision-lab eslint fence", () => {
  let eslint: ESLint;

  beforeAll(async () => {
    eslint = new ESLint({
      cwd: root,
      overrideConfigFile: path.join(root, "eslint.config.js")
    });
    await eslint.lintText("export {};\n", { filePath: labProbePath });
  }, 30_000);

  it(
    "reports no-restricted-imports for forbidden eval import under src/decision-lab",
    async () => {
      const results = await eslint.lintText(
        'import { something } from "../eval/cli";\n',
        { filePath: labProbePath }
      );

      expect(results).toHaveLength(1);
      const hit = results[0]!.messages.find(
        (m) =>
          m.ruleId === "no-restricted-imports" &&
          typeof m.message === "string" &&
          m.message.includes("eval")
      );
      expect(hit).toBeDefined();
      expect(hit!.severity).toBe(2);
    },
    15_000
  );

  it(
    "reports no-restricted-imports for react under src/decision-lab",
    async () => {
      const results = await eslint.lintText(
        'import { useState } from "react";\n',
        { filePath: labProbePath }
      );

      expect(results).toHaveLength(1);
      const hit = results[0]!.messages.find(
        (m) =>
          m.ruleId === "no-restricted-imports" &&
          typeof m.message === "string" &&
          m.message.toLowerCase().includes("react")
      );
      expect(hit).toBeDefined();
      expect(hit!.severity).toBe(2);
    },
    15_000
  );

  it(
    "reports no-restricted-imports for node:fs under src/decision-lab",
    async () => {
      const results = await eslint.lintText(
        'import { readFile } from "node:fs";\n',
        { filePath: labProbePath }
      );

      expect(results).toHaveLength(1);
      const hit = results[0]!.messages.find(
        (m) => m.ruleId === "no-restricted-imports"
      );
      expect(hit).toBeDefined();
      expect(hit!.severity).toBe(2);
    },
    15_000
  );
});
