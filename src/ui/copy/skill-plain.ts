import type { SkillId } from "../../engine";

/** Plain move descriptions for the default path (no catalog flavor text). */
export const SKILL_PLAIN_DESCRIPTION: Readonly<Record<SkillId, string>> = {
  "skill-core-identity":
    "Raises your defense a little to soften the next hits.",
  "skill-signal-exposure":
    "A light disrupt that also drains a bit of the foe's energy.",
  "skill-logic-drift": "Recovers some of your health.",
  "skill-null-pulse": "Raises your defense to soften the next hits.",
  "skill-signal-breach":
    "A disrupt attack that also drains some of the foe's energy.",
  "skill-sigil-rule": "A small defense boost before the next exchange.",
  "skill-override-pulse": "A strong attack.",
  "skill-logic-storm": "A very strong attack."
};

export function skillPlainDescription(skillId: string): string {
  return (
    SKILL_PLAIN_DESCRIPTION[skillId as SkillId] ?? "A combat move."
  );
}
