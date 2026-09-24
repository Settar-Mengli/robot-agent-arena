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
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/dist URL allowlist OK/);
  });

  it("fails when CSP connect-src omits an allowlisted connect host", () => {
    const root = mkdtempSync(path.join(tmpdir(), "csp-gap-"));
    temps.push(root);
    const assets = path.join(root, "assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(
      path.join(assets, "plant.js"),
      '"https://openrouter.ai/api/v1"\n'
    );
    const htmlPath = path.join(root, "index.html").replace(/\\/g, "/");
    writeFileSync(
      path.join(root, "index.html"),
      `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self'; script-src 'self'">`
    );
    const assetsPosix = assets.replace(/\\/g, "/");
    const r2 = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { findConnectSrcGaps } from './scripts/check-dist-urls.mjs';
const gaps = findConnectSrcGaps(${JSON.stringify(assetsPosix)}, ${JSON.stringify(htmlPath)});
if (!gaps.some((g) => g.includes('openrouter.ai'))) process.exit(2);
console.log(gaps.join('\\n'));`
      ],
      { encoding: "utf8", cwd: process.cwd() }
    );
    expect(r2.status, r2.stderr + r2.stdout).toBe(0);
    expect(r2.stdout).toContain("openrouter.ai");
  });
});
