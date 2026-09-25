import { describe, expect, it } from "vitest";

/** Relative luminance for sRGB hex (#rrggbb). */
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fg: string, bg: string): number {
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Blend fg over bg at opacity t in [0,1]; returns #rrggbb. */
function blendOver(fg: string, bg: string, t: number): string {
  const ch = (hex: string, i: number) =>
    parseInt(hex.replace("#", "").slice(i * 2, i * 2 + 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(ch(fg, i) * t + ch(bg, i) * (1 - t))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

describe("M0 contrast pairs (default path)", () => {
  const bg = "#0c0a09"; // stone-950 / --aa-bg
  const bgElevated = "#1c1917"; // stone-900 / --aa-surface
  const stone400 = "#a8a29e"; // --aa-muted
  const fg = "#f5f5f4"; // --aa-fg
  const accent = "#d97706"; // --aa-accent
  const accentFg = "#0c0a09"; // --aa-accent-fg
  const danger = "#f87171"; // --aa-danger
  const ok = "#34d399"; // --aa-ok
  const border = "#78716c"; // --aa-border (WCAG 3:1 large chrome)

  it("lists changed pairs at WCAG thresholds", () => {
    const pairs: Array<{
      name: string;
      fg: string;
      bg: string;
      opacity?: number;
      min: number;
      ratio: number;
    }> = [
      {
        name: "token aa-fg on aa-bg",
        fg,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "token aa-muted on aa-bg",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "token aa-muted on aa-surface",
        fg: stone400,
        bg: bgElevated,
        min: 4.5,
        ratio: 0
      },
      {
        name: "token aa-accent-fg on aa-accent",
        fg: accentFg,
        bg: accent,
        min: 4.5,
        ratio: 0
      },
      {
        name: "token aa-danger on aa-bg",
        fg: danger,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "token aa-ok on aa-bg",
        fg: ok,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "token aa-fg on aa-surface",
        fg,
        bg: bgElevated,
        min: 4.5,
        ratio: 0
      },
      {
        name: "token aa-border on aa-bg (UI chrome, large)",
        fg: border,
        bg,
        min: 3,
        ratio: 0
      },
      {
        name: "unaffordable hint stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "energy warning amber-200 on stone-900",
        fg: "#fde68a",
        bg: bgElevated,
        min: 3,
        ratio: 0
      },
      {
        name: "opponent line stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "builder skill desc stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "challenge disabled show-answer stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name:
          "challenge disabled show-answer must not use opacity-50 (effective)",
        fg: stone400,
        bg,
        opacity: 1,
        min: 4.5,
        ratio: 0
      },
      {
        name: "challenge advanced list stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "combatant bars label stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "watch battle start stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "decision lab situations count stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "decision lab empty selection stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "diagnostics empty compare stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "diagnostics none stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "diagnostics list stone-400 on stone-900",
        fg: stone400,
        bg: bgElevated,
        min: 4.5,
        ratio: 0
      },
      {
        name: "leaderboard subtitle stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "leaderboard meta stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "methodology subtitle stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      },
      {
        name: "compare empty pairs stone-400 on stone-950",
        fg: stone400,
        bg,
        min: 4.5,
        ratio: 0
      }
    ];
    for (const p of pairs) {
      const effectiveFg =
        p.opacity !== undefined && p.opacity < 1
          ? blendOver(p.fg, p.bg, p.opacity)
          : p.fg;
      p.ratio = contrastRatio(effectiveFg, p.bg);
      expect(p.ratio, `${p.name} ${p.ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
        p.min
      );
    }
  });

  it("opacity-50 stone-400 on stone-950 would fail WCAG AA (guard)", () => {
    const effective = blendOver(stone400, bg, 0.5);
    const ratio = contrastRatio(effective, bg);
    expect(ratio).toBeLessThan(4.5);
  });

  it("ChallengeView disabled Show answer is muted solid without opacity-50 fade", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/ui/lab/ChallengeView.tsx", "utf8");
    expect(src).toMatch(/challenge-show-answer/);
    expect(src).toMatch(/Pick a move first/);
    expect(src).toMatch(/bg-stone-800 text-stone-200/);
    expect(src).not.toMatch(
      /challenge-show-answer[\s\S]{0,200}opacity-50/
    );
  });

  it("UI chrome has no border-stone-600/700/800 classes", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    async function walk(dir: string): Promise<string[]> {
      const ents = await readdir(dir, { withFileTypes: true });
      const out: string[] = [];
      for (const e of ents) {
        const p = join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(p)));
        else if (/\.(tsx|css)$/.test(e.name) && !e.name.includes(".test."))
          out.push(p);
      }
      return out;
    }
    const files = await walk("src/ui");
    const hits: string[] = [];
    for (const f of files) {
      const text = await readFile(f, "utf8");
      for (const line of text.split("\n")) {
        if (
          text.includes("border-stone-600") ||
          text.includes("border-stone-700") ||
          text.includes("border-stone-800")
        ) {
          if (
            line.includes("border-stone-600") ||
            line.includes("border-stone-700") ||
            line.includes("border-stone-800")
          ) {
            hits.push(`${f}: ${line.trim().slice(0, 120)}`);
          }
        }
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
