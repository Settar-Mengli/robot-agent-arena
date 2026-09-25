import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

/** GitHub heading slug (approximate; good enough for ASCII READMEs). */
function githubSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function collectHeadings(md: string): Set<string> {
  const slugs = new Set<string>();
  const counts = new Map<string, number>();
  for (const line of md.split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!m) continue;
    const base = githubSlug(m[2]!);
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    slugs.add(n === 0 ? base : `${base}-${n}`);
  }
  return slugs;
}

function extractMarkdownLinks(md: string): { href: string; raw: string }[] {
  const out: { href: string; raw: string }[] = [];
  const re = /!\[[^\]]*]\(([^)]+)\)|\[[^\]]*]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const href = (m[1] ?? m[2] ?? "").trim();
    if (href === "") continue;
    out.push({ href, raw: m[0]! });
  }
  return out;
}

describe("README link integrity", () => {
  it("every relative README link target exists; in-file anchors resolve", () => {
    const readmePath = join(ROOT, "README.md");
    const md = readFileSync(readmePath, "utf8");
    const headings = collectHeadings(md);
    const links = extractMarkdownLinks(md);
    expect(links.length).toBeGreaterThan(5);

    const failures: string[] = [];
    for (const { href, raw } of links) {
      if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) continue;
      const [pathPart, hash] = href.split("#") as [string, string | undefined];
      if (pathPart !== "" && pathPart !== ".") {
        const target = join(ROOT, pathPart);
        if (!existsSync(target)) {
          failures.push(`missing file for ${raw} → ${pathPart}`);
        }
      }
      if (hash !== undefined && hash !== "") {
        if (pathPart === "" || pathPart === "." || pathPart === "README.md") {
          if (!headings.has(hash)) {
            failures.push(`missing README anchor ${raw} → #${hash}`);
          }
        } else {
          const otherPath = join(ROOT, pathPart);
          if (existsSync(otherPath) && otherPath.endsWith(".md")) {
            const otherMd = readFileSync(otherPath, "utf8");
            const otherHeadings = collectHeadings(otherMd);
            if (!otherHeadings.has(hash)) {
              failures.push(
                `missing anchor ${raw} → ${pathPart}#${hash} (have: ${[...otherHeadings].slice(0, 8).join(", ")}…)`
              );
            }
          }
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
