import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const liveDir = path.dirname(fileURLToPath(import.meta.url));

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      out.push(...listSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(name.name) && !name.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("src/ui/live import fence", () => {
  it("does not import node:*, process, Buffer, or eval from live sources", () => {
    const files = listSourceFiles(liveDir);
    expect(files.length).toBeGreaterThan(0);

    const forbidden = [
      /from\s+["']node:/,
      /import\s+["']node:/,
      /from\s+["']process["']/,
      /from\s+["']buffer["']/i,
      /\bBuffer\b/,
      /from\s+["'][^"']*\/eval(?:\/[^"']*)?["']/,
      /from\s+["'][^"']*eval["']/
    ];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const re of forbidden) {
        expect(src, `${path.relative(liveDir, file)} matched ${re}`).not.toMatch(
          re
        );
      }
    }
  });
});
