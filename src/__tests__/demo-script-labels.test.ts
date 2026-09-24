import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Bold spans that are doc chrome, not Arena UI controls. */
const BOLD_SKIP = new Set([
  "Must-ship",
  "Optional",
  "Honesty",
  "static demo",
  "recorded",
  "this",
  "these",
  "not",
  "live AI",
  "opt-in",
  "your",
  "OBS",
  "Browser",
  "Voice (Audacity)",
  "1920×1080",
  "30 fps",
  "100%",
  "blur",
  "or",
  "1/35"
]);

function walkUiSources(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (
        ent.name === "pack" ||
        ent.name === "__fixtures__" ||
        ent.name === "data"
      ) {
        continue;
      }
      walkUiSources(p, acc);
    } else if (/\.(tsx?|ts)$/.test(ent.name)) {
      acc.push(readFileSync(p, "utf8"));
    }
  }
  return acc;
}

function extractDemoUiLabels(script: string): string[] {
  const labels = new Set<string>();

  // Full-cut table: on-screen actions column only (3rd cell)
  const tableStart = script.indexOf("## Full cut");
  const tableEnd = script.indexOf("\n## LinkedIn cut", tableStart);
  const table = script.slice(
    tableStart,
    tableEnd === -1 ? undefined : tableEnd
  );
  for (const row of table.split("\n")) {
    if (!row.startsWith("|")) continue;
    const cells = row.split("|").map((c) => c.trim());
    // | # | Time | On-screen actions | Narration |
    if (cells.length < 5) continue;
    const actions = cells[3]!;
    if (
      actions === "On-screen actions" ||
      actions.startsWith("---") ||
      actions.length === 0
    ) {
      continue;
    }
    for (const m of actions.matchAll(/\*\*([^*]+)\*\*/g)) {
      const label = m[1]!.trim().replace(/:$/, "");
      if (label.length === 0 || BOLD_SKIP.has(label)) continue;
      labels.add(label);
    }
    for (const m of actions.matchAll(/"([^"\n]{3,80})"/g)) {
      labels.add(m[1]!);
    }
  }

  return [...labels].sort();
}

describe("demo video script UI labels", () => {
  it("every bold/quoted UI label in the Full cut actions column exists in src/ui", () => {
    const script = readFileSync("docs/demo-video-script.md", "utf8");
    const labels = extractDemoUiLabels(script);
    expect(labels.length).toBeGreaterThan(5);
    const corpus = walkUiSources("src/ui").join("\n");
    const missing = labels.filter((l) => !corpus.includes(l));
    expect(missing, `missing in src/ui: ${missing.join(", ")}`).toEqual([]);
  });
});
