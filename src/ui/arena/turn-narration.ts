import type { ResolvedAction, TurnRecord } from "../../engine";
import { skillLabel } from "../copy/skill-label";

function actorLabel(actor: ResolvedAction["actor"], playerName: string, cpuName: string): string {
  return actor === "player" ? playerName : cpuName;
}

export function narrateAction(
  action: ResolvedAction,
  playerName: string,
  cpuName: string
): string {
  const who = actorLabel(action.actor, playerName, cpuName);
  const move = skillLabel(action.resolvedSkillId);
  if (action.fallback) {
    return `${who} did not have enough energy — switched to a safe stabilize.`;
  }
  const parts: string[] = [`${who} used ${move}`];
  if (action.damageDealt > 0) {
    parts.push(`and dealt ${action.damageDealt} damage`);
  }
  if (action.defenseGained > 0) {
    parts.push(`and gained ${action.defenseGained} defense`);
  }
  if (action.defenseReduced > 0) {
    parts.push(`and reduced defense by ${action.defenseReduced}`);
  }
  if (action.energyReduced > 0) {
    parts.push(`and drained ${action.energyReduced} energy`);
  }
  if (action.healthRecovered > 0) {
    parts.push(`and recovered ${action.healthRecovered} HP`);
  }
  if (parts.length === 1) {
    parts.push(`(spent ${action.energySpent} energy)`);
  }
  return `${parts.join(" ")}.`;
}

export function narrateTurn(
  turn: TurnRecord,
  playerName: string,
  cpuName: string
): string[] {
  return turn.actions.map((a) => narrateAction(a, playerName, cpuName));
}

/** Story-style lines when only skill ids are known (Watch pack frames). */
export function narrateSkillExchange(
  playerName: string,
  cpuName: string,
  playerSkillId: string,
  cpuSkillId: string
): string[] {
  return [
    `${playerName} used ${skillLabel(playerSkillId)}.`,
    `${cpuName} used ${skillLabel(cpuSkillId)}.`
  ];
}
