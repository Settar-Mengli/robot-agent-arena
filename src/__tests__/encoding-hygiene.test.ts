import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Detect classic UTF-8-as-Latin-1 mojibake and UTF-8 BOM as characters.
 * Patterns are built from escapes so this file does not contain the sequences.
 */
function hasMojibake(line: string): boolean {
  // U+00E2 U+20AC -- start of many CP1252 mis-decodes
  if (line.includes("\u00E2\u20AC")) return true;
  // U+00C3 + U+0080-U+00BF
  if (/\u00C3[\u0080-\u00BF]/.test(line)) return true;
  // U+00C2 + U+0080-U+00BF
  if (/\u00C2[\u0080-\u00BF]/.test(line)) return true;
  // U+00EF U+00BB U+00BF (BOM as three Latin-1 chars)
  if (line.includes("\u00EF\u00BB\u00BF")) return true;
  return false;
}

const TEXT_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|md|yml|yaml|json|html|css|txt|svg)$/i;

function trackedScanPaths(): string[] {
  const all = execSync("git ls-files", { encoding: "utf8" })
    .trim()
    .split(/\n/)
    .filter(Boolean);
  return all.filter((f) => {
    if (f.startsWith("evals/fixtures")) return false;
    if (
      !(
        f.startsWith("src/") ||
        f.startsWith("docs/") ||
        f.startsWith(".github/") ||
        f.endsWith(".md")
      )
    ) {
      return false;
    }
    return TEXT_EXT.test(f) || f.startsWith(".github/");
  });
}

describe("encoding hygiene", () => {
  it("tracked src/docs/md/github files have no UTF-8 BOM or mojibake", () => {
    const hits: string[] = [];
    for (const f of trackedScanPaths()) {
      const buf = readFileSync(f);
      if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        hits.push(`${f}: UTF-8 BOM`);
      }
      const text = buf.toString("utf8");
      const lines = text.split(/\n/);
      for (let i = 0; i < lines.length; i += 1) {
        if (hasMojibake(lines[i]!)) {
          hits.push(`${f}:${i + 1}: ${lines[i]!.trim().slice(0, 100)}`);
        }
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
