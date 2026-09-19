import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FRACTURE } from "../data/opponents";
import { robotEnvironment } from "../env";
import {
  findSkillDefinition,
  isBattleOver,
  MVP_SKILL_CATALOG,
  startBattle,
  stepBattle,
  type BattleRuntime,
  type SkillId
} from "../engine";
import {
  decisionStateKey,
  type DecisionSnapshot,
  type SnapshotSuite
} from "../eval/snapshots";
import { STRIKER } from "../eval/scenarios";

const suitesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../evals/suites"
);

function loadAllSuiteSnapshots(): DecisionSnapshot[] {
  const names = readdirSync(suitesDir).filter((n) => n.endsWith(".json"));
  const out: DecisionSnapshot[] = [];
  for (const name of names) {
    const suite = JSON.parse(
      readFileSync(join(suitesDir, name), "utf8")
    ) as SnapshotSuite;
    out.push(...suite.snapshots);
  }
  return out;
}

function affordableFilter(
  runtime: BattleRuntime,
  side: "player" | "cpu"
): SkillId[] {
  const skillIds = runtime.session[side].skillIds;
  const energy = side === "player" ? runtime.player.energy : runtime.cpu.energy;
  return skillIds.filter((skillId) => {
    const skill = findSkillDefinition(MVP_SKILL_CATALOG, skillId);
    return skill !== undefined && skill.energyCost <= energy;
  });
}

describe("robot environment adapter", () => {
  it("start / isTerminal / apply match engine delegates", () => {
    const seeds = ["env-grid-1", "env-grid-2", 42, 99] as const;
    for (const seed of seeds) {
      const viaEngine = startBattle(STRIKER, FRACTURE, seed, 8);
      const viaEnv = robotEnvironment.start(STRIKER, FRACTURE, seed, 8);
      expect(viaEnv).toEqual(viaEngine);

      expect(robotEnvironment.isTerminal(viaEnv)).toBe(
        isBattleOver(viaEnv.session)
      );

      const playerSkill = STRIKER.skillIds[0]!;
      const cpuSkill = FRACTURE.skillIds[0]!;
      const steppedEngine = stepBattle(viaEngine, playerSkill, () => cpuSkill);
      const steppedEnv = robotEnvironment.apply(viaEnv, playerSkill, () => cpuSkill);
      expect(steppedEnv).toEqual(steppedEngine);
      expect(robotEnvironment.isTerminal(steppedEnv.runtime)).toBe(
        isBattleOver(steppedEnv.runtime.session)
      );
    }
  });

  it("equippedActions and legalActions match session / energy filter", () => {
    let runtime = startBattle(STRIKER, FRACTURE, "env-legal-1", 10);
    for (let i = 0; i < 3; i++) {
      if (isBattleOver(runtime.session)) break;
      expect([...robotEnvironment.equippedActions(runtime, "cpu")]).toEqual([
        ...runtime.session.cpu.skillIds
      ]);
      expect([...robotEnvironment.equippedActions(runtime, "player")]).toEqual([
        ...runtime.session.player.skillIds
      ]);
      expect(robotEnvironment.legalActions(runtime, "cpu")).toEqual(
        affordableFilter(runtime, "cpu")
      );
      expect(robotEnvironment.legalActions(runtime, "player")).toEqual(
        affordableFilter(runtime, "player")
      );
      runtime = stepBattle(
        runtime,
        STRIKER.skillIds[0]!,
        () => FRACTURE.skillIds[0]!
      ).runtime;
    }
  });

  it("decisionStateKey re-export matches env on every suite state", () => {
    const snaps = loadAllSuiteSnapshots();
    expect(snaps.length).toBeGreaterThan(0);

    for (const snap of snaps) {
      const { runtime, playerSkillId } = snap;
      expect(decisionStateKey(runtime, playerSkillId)).toBe(
        robotEnvironment.decisionStateKey(runtime, playerSkillId)
      );
      expect(robotEnvironment.memoStateKey(runtime)).toContain('"turn"');
      expect(typeof robotEnvironment.terminalValue(runtime)).toBe("number");
    }
  });
});
