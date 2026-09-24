import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temps: string[] = [];

afterEach(() => {
  for (const t of temps.splice(0)) {
    rmSync(t, { recursive: true, force: true });
  }
});

function runCheck(dir: string): {
  status: number;
  stderr: string;
  stdout: string;
} {
  const r = spawnSync(process.execPath, ["scripts/check-dist-urls.mjs", dir], {
    encoding: "utf8",
    cwd: process.cwd()
  });
  return {
    status: r.status ?? 1,
    stderr: r.stderr ?? "",
    stdout: r.stdout ?? ""
  };
}

function plantAssets(jsBody: string): string {
  const root = mkdtempSync(path.join(tmpdir(), "dist-url-"));
  temps.push(root);
  const assets = path.join(root, "assets");
  mkdirSync(assets, { recursive: true });
  writeFileSync(path.join(assets, "plant.js"), jsBody);
  return assets;
}

describe("check-dist-urls fail-closed", () => {
  it(
    "rejects planted foreign hosts including path-only /api/",
    () => {
      for (const url of [
        "https://evil-llm.example/v1",
        "https://evil.com/api/v1",
        "https://api.evil-llm.example/v1"
      ]) {
        const dir = plantAssets(
          `const ok = "https://openrouter.ai/api/v1";\nconst evil = "${url}";\n`
        );
        const r = runCheck(dir);
        expect(r.status, url).toBe(1);
        expect(r.stderr).toContain(url);
      }
    },
    15_000
  );

  it("passes a clean openrouter-only plant", () => {
    const dir = plantAssets(
      [
        '"http://www.w3.org/2000/svg"',
        '"https://react.dev/errors/123"',
        '"https://localhost"',
        '"https://openrouter.ai/api/v1"'
      ].join("\n")
    );
    const r = runCheck(dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/dist URL allowlist OK/);
  });
});
