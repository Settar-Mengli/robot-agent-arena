import { resolve } from "node:path";
import { runnerImport } from "vite";

const entryArg = process.argv[2];
if (entryArg === undefined) {
  console.error("usage: node scripts/run-ts.mjs <entry.ts> [...args]");
  process.exitCode = 1;
} else {
  const entry = resolve(entryArg);
  const argv = process.argv.slice(3);
  try {
    const { module } = await runnerImport(entry, {
      configFile: false,
      logLevel: "error"
    });
    const main = module.main;
    if (typeof main !== "function") {
      throw new TypeError(`${entry} must export async function main(argv)`);
    }
    const code = await main(argv);
    process.exitCode = typeof code === "number" ? code : 0;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
