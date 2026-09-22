import { describe, expect, it } from "vitest";
import { buildArenaReplayPack } from "../eval/arena-pack";
import { assertArenaReplayPackV1 } from "../ui/arena/pack/schema";
import committed from "../ui/arena/pack/arena-replay.v1.json";

describe("arena-pack", () => {
  it("committed pack asserts and lists gemini matches", () => {
    const pack = assertArenaReplayPackV1(committed);
    expect(pack.provider).toBe("gemini");
    expect(pack.matches.length).toBeGreaterThanOrEqual(4);
    expect(pack.matches.every((m) => m.turns.length > 0)).toBe(true);
  });

  it("regen matches committed bytes (dry-run)", async () => {
    const result = await buildArenaReplayPack({ dryRun: true });
    expect(result.json).toBe(`${JSON.stringify(committed)}\n`);
  }, 60_000);
});
