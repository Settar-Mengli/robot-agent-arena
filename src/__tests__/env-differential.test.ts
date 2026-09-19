import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createGreedySelector } from "../agent";
import { robotEnvironment } from "../env";
import {
  startBattle,
  stepBattle,
  type BattleRuntime,
  type SkillId
} from "../engine";
import { bestResponse } from "../eval/oracle";
import { resolvePlayerPolicy, type PlayerPolicy } from "../eval/policies";
import {
  buildMatchSuite,
  type MatchScenario
} from "../eval/scenarios";
import type { DecisionSnapshot, SnapshotSuite } from "../eval/snapshots";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const suitesDir = join(root, "evals/suites");

type DiffStats = {
  statesCompared: number;
  differences: number;
};

function loadAllSnapshots(): DecisionSnapshot[] {
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

function scenarioIndex(): Map<string, MatchScenario> {
  const map = new Map<string, MatchScenario>();
  for (const split of ["dev", "heldout"] as const) {
    for (const scenario of buildMatchSuite(split)) {
      map.set(scenario.id, scenario);
    }
  }
  return map;
}

function compareApply(
  runtime: BattleRuntime,
  playerSkillId: SkillId,
  cpuSkillId: SkillId,
  stats: DiffStats
): void {
  stats.statesCompared += 1;
  const viaEnv = robotEnvironment.apply(
    runtime,
    playerSkillId,
    () => cpuSkillId
  );
  const viaEngine = stepBattle(runtime, playerSkillId, () => cpuSkillId);
  if (JSON.stringify(viaEnv) !== JSON.stringify(viaEngine)) {
    stats.differences += 1;
  }
}

function walkScenario(scenario: MatchScenario, stats: DiffStats): void {
  const playerPolicy = resolvePlayerPolicy(scenario);
  const greedy = createGreedySelector(scenario.cpuConfig);

  let envRuntime = robotEnvironment.start(
    scenario.playerConfig,
    scenario.cpuConfig,
    scenario.seed
  );
  let engineRuntime = startBattle(
    scenario.playerConfig,
    scenario.cpuConfig,
    scenario.seed
  );

  stats.statesCompared += 1;
  if (JSON.stringify(envRuntime) !== JSON.stringify(engineRuntime)) {
    stats.differences += 1;
  }

  let steps = 0;
  while (!robotEnvironment.isTerminal(envRuntime) && steps < 40) {
    const playerSkillId = playerPolicy(envRuntime);
    const greedyEnv = greedy(envRuntime.cpu, envRuntime.player);
    const greedyEngine = greedy(engineRuntime.cpu, engineRuntime.player);
    stats.statesCompared += 1;
    if (greedyEnv !== greedyEngine) {
      stats.differences += 1;
    }

    compareApply(envRuntime, playerSkillId, greedyEnv, stats);

    if (robotEnvironment.equippedActions(envRuntime, "cpu").length >= 2) {
      const a = bestResponse(envRuntime, playerSkillId, playerPolicy);
      const b = bestResponse(envRuntime, playerSkillId, playerPolicy);
      stats.statesCompared += 1;
      if (
        JSON.stringify(a.values) !== JSON.stringify(b.values) ||
        JSON.stringify(a.best) !== JSON.stringify(b.best)
      ) {
        stats.differences += 1;
      }
    }

    const nextEnv = robotEnvironment.apply(envRuntime, playerSkillId, greedy);
    const nextEngine = stepBattle(engineRuntime, playerSkillId, greedy);
    stats.statesCompared += 1;
    if (JSON.stringify(nextEnv.runtime) !== JSON.stringify(nextEngine.runtime)) {
      stats.differences += 1;
    }
    envRuntime = nextEnv.runtime;
    engineRuntime = nextEngine.runtime;
    steps += 1;
  }

  stats.statesCompared += 1;
  if (JSON.stringify(envRuntime) !== JSON.stringify(engineRuntime)) {
    stats.differences += 1;
  }
}

describe("env adapter differential", () => {
  it.skipIf(process.env.SNAPSHOT_DRIFT !== "1")(
    "drift-guard: env adapter ≡ engine across suites and match walks",
    () => {
      const started = performance.now();
      const stats: DiffStats = { statesCompared: 0, differences: 0 };
      const snaps = loadAllSnapshots();
      const byId = scenarioIndex();
      expect(snaps.length).toBeGreaterThan(0);

      for (const snap of snaps) {
        const { runtime, playerSkillId, values, best } = snap;
        const scenario = byId.get(snap.scenarioId);
        expect(scenario).toBeDefined();
        const playerPolicy: PlayerPolicy = resolvePlayerPolicy(scenario!);

        const greedy = createGreedySelector(runtime.session.cpu);
        stats.statesCompared += 1;
        if (
          greedy(runtime.cpu, runtime.player) !==
          greedy(runtime.cpu, runtime.player)
        ) {
          stats.differences += 1;
        }

        for (const cpuSkillId of robotEnvironment.equippedActions(
          runtime,
          "cpu"
        )) {
          compareApply(runtime, playerSkillId, cpuSkillId, stats);
        }

        const oracle = bestResponse(runtime, playerSkillId, playerPolicy);
        stats.statesCompared += 1;
        if (
          JSON.stringify(oracle.values) !== JSON.stringify(values) ||
          JSON.stringify([...oracle.best].sort()) !==
            JSON.stringify([...best].sort())
        ) {
          stats.differences += 1;
        }
      }

      for (const split of ["dev", "heldout"] as const) {
        for (const scenario of buildMatchSuite(split)) {
          walkScenario(scenario, stats);
        }
      }

      const wallMs = Math.round(performance.now() - started);
      console.log(
        JSON.stringify({
          statesCompared: stats.statesCompared,
          differences: stats.differences,
          wallMs
        })
      );

      expect(stats.differences).toBe(0);
      expect(stats.statesCompared).toBeGreaterThan(0);
    },
    600_000
  );
});
