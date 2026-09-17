import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FixtureRecord, FixtureStore } from "./transport";

export function createDirStore(dir: string): FixtureStore {
  return {
    read: async (key) => {
      try {
        const text = await readFile(join(dir, `${key}.json`), "utf8");
        return JSON.parse(text) as FixtureRecord;
      } catch {
        return undefined;
      }
    },
    write: async (key, record) => {
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, `${key}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
        "utf8"
      );
    }
  };
}
