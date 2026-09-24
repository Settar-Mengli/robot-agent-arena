/**
 * Fail-closed allowlist for https?:// URLs embedded in dist/assets/*.js.
 * Any URL not matching an explicit allow entry fails the check.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Exact URL or prefix (ends with /) allowed in the browser bundle. */
export const ALLOWED_URL_PREFIXES = [
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/XML/1998/namespace",
  "https://react.dev/errors/",
  "https://localhost",
  "https://openrouter.ai/"
];

/**
 * @param {string} dir path to dist/assets
 * @returns {string[]} violation messages (empty = OK)
 */
export function findDisallowedDistUrls(dir) {
  /** @type {string[]} */
  const bad = [];
  if (!fs.existsSync(dir)) {
    return [`missing directory ${dir}`];
  }
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".js")) continue;
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    const re = /https?:\/\/[^"'\\\s)`]+/g;
    let m;
    while ((m = re.exec(t))) {
      const url = m[0];
      const ok = ALLOWED_URL_PREFIXES.some(
        (a) => url === a || url.startsWith(a)
      );
      if (!ok) {
        bad.push(`${f} unexpected URL ${url}`);
      }
    }
  }
  return bad;
}

export function checkDistUrls(dir = "dist/assets") {
  const bad = findDisallowedDistUrls(dir);
  if (bad.length) {
    console.error(bad.join("\n"));
    return 1;
  }
  console.log("dist URL allowlist OK");
  return 0;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const dir = process.argv[2] ?? "dist/assets";
  process.exit(checkDistUrls(dir));
}
