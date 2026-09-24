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

describe("M0 contrast pairs (default path)", () => {
  const bg = "#0c0a09"; // stone-950
  const bgElevated = "#1c1917"; // stone-900
  const stone400 = "#a8a29e";

  it("lists changed pairs at WCAG thresholds", () => {
    const pairs: Array<{
      name: string;
      fg: string;
      bg: string;
      min: number;
      ratio: number;
    }> = [
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
      p.ratio = contrastRatio(p.fg, p.bg);
      expect(p.ratio, `${p.name} ${p.ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
        p.min
      );
    }
  });
});
