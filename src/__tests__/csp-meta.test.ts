import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Exact CSP content attribute required in index.html (and copied into dist). */
export const EXPECTED_CSP =
  "default-src 'self'; connect-src 'self' https://openrouter.ai; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";

const EXPECTED_REFERRER = "strict-origin-when-cross-origin";

function assertCspAndReferrer(html: string, label: string): void {
  expect(html, label).toContain(
    `http-equiv="Content-Security-Policy"`
  );
  expect(html, label).toContain(`content="${EXPECTED_CSP}"`);
  expect(html, label).toContain(`name="referrer"`);
  expect(html, label).toContain(`content="${EXPECTED_REFERRER}"`);
  // No inline <script> bodies or <style> blocks that CSP would block.
  expect(html, `${label}: inline script`).not.toMatch(
    /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i
  );
  expect(html, `${label}: inline style tag`).not.toMatch(/<style[\s>]/i);
  expect(html, `${label}: inline style attr`).not.toMatch(/\sstyle\s*=/i);
}

describe("CSP + referrer meta", () => {
  it("index.html has exact CSP directives and referrer policy", () => {
    const html = readFileSync("index.html", "utf8");
    assertCspAndReferrer(html, "index.html");
    expect(html).toContain("data:image/svg+xml");
  });

  it("source UI has no React style= props that CSP style-src 'self' would block", () => {
    // CombatantBars uses SVG width attributes; grep would catch regressions.
    const bars = readFileSync("src/ui/arena/CombatantBars.tsx", "utf8");
    expect(bars).not.toMatch(/\bstyle\s*=\s*\{/);
  });
});
