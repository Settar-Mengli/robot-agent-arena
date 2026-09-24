import type { BattleRuntime, Seed, SkillId } from "../engine";
import type { EnvironmentOf } from "./contract";
import type { Environment } from "./types";
import { robotEnvironment } from "./robot";

export type RobotEnvOfInit = {
  player: Parameters<Environment["start"]>[0];
  cpu: Parameters<Environment["start"]>[1];
  maxTurns?: number;
};

/**
 * Zero-behavior adapter: measurement-side action = CPU skill (oracle/snapshot convention).
 * Does not change robotEnvironment; production eval keeps calling robotEnvironment directly.
 */
export function asEnvironmentOf(
  env: Environment = robotEnvironment
): EnvironmentOf<BattleRuntime, SkillId> {
  return {
    start(seed: Seed, init?: unknown): BattleRuntime {
      const cfg = init as RobotEnvOfInit | undefined;
      if (
        cfg === undefined ||
        cfg.player === undefined ||
        cfg.cpu === undefined
      ) {
        throw new Error(
          "asEnvironmentOf.start requires init { player, cpu, maxTurns? }"
        );
      }
      return env.start(cfg.player, cfg.cpu, seed, cfg.maxTurns);
    },

    isTerminal(state: BattleRuntime): boolean {
      return env.isTerminal(state);
    },

    apply(
      state: BattleRuntime,
      action: SkillId,
      opponent?: (s: BattleRuntime) => SkillId
    ): { state: BattleRuntime } {
      // Measurement evaluates CPU choices; player action from fixed opponent policy
      // (or first equipped) so apply stays a pure step for value search.
      const playerAction =
        opponent !== undefined
          ? opponent(state)
          : env.equippedActions(state, "player")[0]!;
      const stepped = env.apply(state, playerAction, () => action);
      return { state: stepped.runtime };
    },

    equippedActions(state: BattleRuntime): readonly SkillId[] {
      return env.equippedActions(state, "cpu");
    },

    legalActions(state: BattleRuntime): SkillId[] {
      return env.legalActions(state, "cpu");
    },

    terminalValue(state: BattleRuntime): number {
      return env.terminalValue(state);
    },

    memoStateKey(state: BattleRuntime): string {
      return env.memoStateKey(state);
    },

    decisionStateKey(state: BattleRuntime, action: SkillId): string {
      return env.decisionStateKey(state, action);
    }
  };
}

/** Compile-time proof that the adapter satisfies EnvironmentOf. */
export const robotEnvironmentOf: EnvironmentOf<BattleRuntime, SkillId> =
  asEnvironmentOf(robotEnvironment);
