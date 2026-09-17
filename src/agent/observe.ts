import { stepBattle } from "../engine";
import type { BattleRuntime, CombatantState, SkillId } from "../engine";

/**
 * Probe the post-player-action combatant state without keeping the step result.
 * Returns null when the player's action ends the battle (selector never called).
 */
export function observePostPlayerState(
  runtime: BattleRuntime,
  playerSkillId: SkillId
): { cpu: CombatantState; player: CombatantState } | null {
  let captured: { cpu: CombatantState; player: CombatantState } | undefined;

  stepBattle(runtime, playerSkillId, (cpu, player) => {
    captured = { cpu, player };
    return runtime.session.cpu.skillIds[0];
  });

  return captured ?? null;
}
