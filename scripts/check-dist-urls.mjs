/**
 * Fail-closed allowlist for https?:// URLs embedded in dist/assets/*.js.
 * Any URL not matching an explicit allow entry fails the check.
 * Also verifies connect targets are covered by index.html CSP connect-src.
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

/** Origins that appear in JS but are never fetch/XHR targets (docs, SVG NS). */
const NON_CONNECT_URL_PREFIXES = [
  "http://www.w3.org/",
  "https://react.dev/errors/",
  "https://localhost"
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

/**
 * Parse connect-src hosts from index.html CSP meta (source of truth).
 * @param {string} html
 * @returns {string[] | null} hosts including 'self', or null if meta missing
 */
export function parseConnectSrcHosts(html) {
  const m =
    html.match(
      /http-equiv=["']Content-Security-Policy["'][\s\S]*?content="([^"]+)"/i
    ) ??
    html.match(
      /http-equiv=["']Content-Security-Policy["'][\s\S]*?content='([^']+)'/i
    ) ??
    html.match(
      /content="([^"]+)"[\s\S]*?http-equiv=["']Content-Security-Policy["']/i
    );
  if (!m) return null;
  const connect = m[1].match(/connect-src\s+([^;]+)/i);
  if (!connect) return null;
  return connect[1].trim().split(/\s+/).filter(Boolean);
}

/**
 * @param {string} url
 * @param {string[]} connectHosts from parseConnectSrcHosts
 * @returns {boolean}
 */
export function isCoveredByConnectSrc(url, connectHosts) {
  if (NON_CONNECT_URL_PREFIXES.some((p) => url === p || url.startsWith(p))) {
    return true;
  }
  const originMatch = url.match(/^(https?:\/\/[^/?#]+)/);
  if (!originMatch) return false;
  const origin = originMatch[1];
  return connectHosts.some((h) => {
    if (h === "'self'") return false;
    return origin === h || url.startsWith(h + "/") || url === h;
  });
}

/**
 * Every https? connect candidate in dist/assets must be covered by CSP connect-src.
 * @param {string} assetsDir
 * @param {string} indexHtmlPath
 * @returns {string[]}
 */
export function findConnectSrcGaps(assetsDir, indexHtmlPath = "index.html") {
  if (!fs.existsSync(indexHtmlPath)) {
    return [`missing ${indexHtmlPath}`];
  }
  const html = fs.readFileSync(indexHtmlPath, "utf8");
  const hosts = parseConnectSrcHosts(html);
  if (!hosts) {
    return ["index.html missing CSP connect-src"];
  }
  if (!fs.existsSync(assetsDir)) {
    return [`missing directory ${assetsDir}`];
  }
  /** @type {string[]} */
  const bad = [];
  for (const f of fs.readdirSync(assetsDir)) {
    if (!f.endsWith(".js")) continue;
    const t = fs.readFileSync(path.join(assetsDir, f), "utf8");
    const re = /https?:\/\/[^"'\\\s)`]+/g;
    let m;
    while ((m = re.exec(t))) {
      const url = m[0];
      if (!isCoveredByConnectSrc(url, hosts)) {
        bad.push(`${f} connect-src gap ${url}`);
      }
    }
  }
  return bad;
}

export function checkDistUrls(dir = "dist/assets") {
  const bad = [
    ...findDisallowedDistUrls(dir),
    ...findConnectSrcGaps(dir, "index.html")
  ];
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
